/**
 * 云函数：初始化数据库集合
 *
 * 一次性执行：部署后调用一次即可创建 7 个业务集合。
 * 集合已存在时跳过，不会报错，可安全重复调用。
 *
 * 调用方式：小程序端 wx.cloud.callFunction({ name: 'initDatabase' })
 * 或：开发者工具 → 云开发控制台 → 云函数 → initDatabase → 云端测试
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

/** 与 miniprogram/services/db.ts 的 COLLECTIONS 保持一致 */
const COLLECTIONS = [
  'users', // 用户档案
  'goals', // 减脂目标
  'foodLogs', // 饮食记录
  'weightLogs', // 体重记录
  'plans', // 饮食/运动方案
  'dailyAnalysis', // 每日分析
  'foodLibrary', // 公共食物库
]

exports.main = async () => {
  const results = []

  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name)
      results.push({ name, status: 'created' })
    } catch (err) {
      const msg = err.errMsg || err.message || ''
      // 集合已存在时云开发返回 createCollection:fail -501001 already exists
      if (/already\s*exists|exist/i.test(msg)) {
        results.push({ name, status: 'exists' })
      } else {
        results.push({ name, status: 'error', msg })
      }
    }
  }

  const failed = results.filter((r) => r.status === 'error')
  return {
    code: failed.length > 0 ? 1 : 0,
    results,
    summary: `${results.filter((r) => r.status === 'created').length} 新建，${results.filter((r) => r.status === 'exists').length} 已存在`,
  }
}
