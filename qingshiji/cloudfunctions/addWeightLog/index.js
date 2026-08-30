/**
 * 云函数：记录体重
 *
 * 语义：同一天重复记录视为「修正」，覆盖当天已有数据，而不是新增一条。
 * 体重是单点事实，同一天不该存在两个互相矛盾的值。
 *
 * 副作用：同步刷新 active 目标的 currentWeight，
 *         保证首页热量目标始终基于最新体重计算。
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const WEIGHT_LOGS = 'weightLogs'
const GOALS = 'goals'

/** 体重合理区间（kg） */
const MIN_WEIGHT = 20
const MAX_WEIGHT = 300

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { code: -1, msg: '无法获取用户身份，请重新进入小程序' }
  }

  const { date } = event
  const weight = Number(event.weight)

  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { code: 1, msg: '日期格式不正确' }
  }

  if (!Number.isFinite(weight) || weight < MIN_WEIGHT || weight > MAX_WEIGHT) {
    return { code: 1, msg: `体重需在 ${MIN_WEIGHT}–${MAX_WEIGHT} kg 之间` }
  }

  const note = typeof event.note === 'string' ? event.note.slice(0, 50) : ''
  const now = new Date()

  try {
    const exist = await db
      .collection(WEIGHT_LOGS)
      .where({ _openid: OPENID, date })
      .limit(1)
      .get()

    let id
    let action

    if (exist.data.length > 0) {
      id = exist.data[0]._id
      await db
        .collection(WEIGHT_LOGS)
        .doc(id)
        .update({ data: { weight, note, updatedAt: now } })
      action = 'updated'
    } else {
      const addRes = await db.collection(WEIGHT_LOGS).add({
        data: { date, weight, note, createdAt: now, _openid: OPENID },
      })
      id = addRes._id
      action = 'created'
    }

    // 同步刷新生效目标的当前体重
    await db
      .collection(GOALS)
      .where({ _openid: OPENID, status: 'active' })
      .update({ data: { currentWeight: weight, updatedAt: now } })

    return { code: 0, id, action }
  } catch (err) {
    console.error('[addWeightLog] 写入失败', err)
    return { code: 3, msg: '保存失败，请稍后重试' }
  }
}
