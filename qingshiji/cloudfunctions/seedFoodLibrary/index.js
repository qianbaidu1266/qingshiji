/**
 * 云函数：导入食物库种子数据
 *
 * 幂等设计：按 name 去重，已存在的跳过，可安全重复运行。
 * 想强制覆盖时传 { force: true }（会先删掉库里全部记录再写入）。
 *
 * 调用方式：
 *   开发者工具 → 云开发 → 云函数 → seedFoodLibrary → 云端测试
 *   或小程序端 wx.cloud.callFunction({ name: 'seedFoodLibrary' })
 */

const cloud = require('wx-server-sdk')
const FOODS = require('./foods')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const COLLECTION = 'foodLibrary'

exports.main = async (event) => {
  // 种子数据是公共数据，不校验用户身份。
  // 注意：从「云端测试」调用时不存在用户上下文，getWXContext().OPENID 为空，
  //       若在此校验身份，云端测试会永远返回「无法获取用户身份」。
  const force = event && event.force === true

  try {
    // 1. 强制模式：先清空（分批删除，云函数端不受集合权限限制）
    let removed = 0
    if (force) {
      const all = await db.collection(COLLECTION).limit(1000).field({ _id: true }).get()
      for (const doc of all.data) {
        await db.collection(COLLECTION).doc(doc._id).remove()
        removed++
      }
    }

    // 2. 读取现有名称集合（用于去重）
    const existing = await db.collection(COLLECTION).limit(1000).field({ name: true }).get()
    const existingNames = new Set(existing.data.map((d) => d.name))

    // 3. 过滤出需要新增的
    const toAdd = FOODS.filter((f) => !existingNames.has(f.name))

    if (toAdd.length === 0) {
      return {
        code: 0,
        msg: '食物库已是最新，无需导入',
        total: existingNames.size,
        added: 0,
        skipped: FOODS.length,
        removed,
      }
    }

    // 4. 逐条写入（云函数端 add 一次一条，50 条以内无需分批）
    let added = 0
    for (const food of toAdd) {
      await db.collection(COLLECTION).add({
        data: {
          ...food,
          createdAt: new Date(),
          // 系统预置数据，无真实归属用户；foodLibrary 为公共读，不影响前端查询
          _openid: 'system',
        },
      })
      added++
    }

    return {
      code: 0,
      msg: `导入完成：新增 ${added} 条，跳过 ${FOODS.length - added} 条`,
      total: existingNames.size + added,
      added,
      skipped: FOODS.length - added,
      removed,
    }
  } catch (err) {
    console.error('[seedFoodLibrary] 导入失败', err)
    return { code: 1, msg: `导入失败：${err.message || err.errMsg || '未知错误'}` }
  }
}
