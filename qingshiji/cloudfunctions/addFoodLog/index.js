/**
 * 云函数：新增饮食记录
 *
 * 为什么走云函数而不是前端直写：
 *   1. 需要字段校验 —— 前端传来的数字不可信（可能被篡改或计算异常）
 *   2. 需要频率控制 —— 防止误触或恶意写入刷爆读写次数
 *   3. 需要显式写入 _openid —— 云函数端写入数据库不会自动注入 openid，
 *      必须手动带上，否则前端按「仅创建者可读写」权限将查不到这条记录
 */

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

const COLLECTION = 'foodLogs'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack']
const SOURCES = ['photo', 'manual', 'library', 'ai_estimate']

/** 单日记录条数上限 */
const MAX_LOGS_PER_DAY = 50

/** 营养素字段及其上限 */
const NUTRIENT_FIELDS = ['calorie', 'protein', 'fat', 'carb']

function isNum(n) {
  return typeof n === 'number' && Number.isFinite(n)
}

function fail(msg) {
  return { code: 1, msg }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return { code: -1, msg: '无法获取用户身份，请重新进入小程序' }
  }

  const log = event.log
  if (!log || typeof log !== 'object') {
    return fail('记录内容缺失')
  }

  const { date, mealType, foodName, portion, source } = log

  /* ---------------- 字段校验 ---------------- */

  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return fail('日期格式不正确')
  }

  if (!MEAL_TYPES.includes(mealType)) {
    return fail('餐次不合法')
  }

  if (typeof foodName !== 'string' || !foodName.trim() || foodName.trim().length > 40) {
    return fail('食物名称需在 40 字以内')
  }

  if (!isNum(portion) || portion <= 0 || portion > 5000) {
    return fail('食物分量不合法')
  }

  for (const field of NUTRIENT_FIELDS) {
    const v = log[field]
    if (!isNum(v) || v < 0 || v > 10000) {
      return fail(`${field} 数值不合法`)
    }
  }

  if (!SOURCES.includes(source)) {
    return fail('记录来源不合法')
  }

  /* ---------------- 频率控制 ---------------- */

  try {
    const countRes = await db
      .collection(COLLECTION)
      .where({ _openid: OPENID, date })
      .count()

    if (countRes.total >= MAX_LOGS_PER_DAY) {
      return { code: 2, msg: '今日记录条数已达上限' }
    }
  } catch (err) {
    console.error('[addFoodLog] 计数失败', err)
    return { code: 3, msg: '服务暂时不可用，请稍后重试' }
  }

  /* ---------------- 写入 ---------------- */

  const portionLabel =
    typeof log.portionLabel === 'string' && log.portionLabel.trim()
      ? log.portionLabel.trim().slice(0, 20)
      : `${portion}g`

  const data = {
    date,
    mealType,
    foodName: foodName.trim(),
    portion,
    portionLabel,
    calorie: log.calorie,
    protein: log.protein,
    fat: log.fat,
    carb: log.carb,
    source,
    isEstimated: !!log.isEstimated,
    imageUrl: typeof log.imageUrl === 'string' ? log.imageUrl : '',
    loggedAt: new Date(),
    // 关键：云函数写入必须显式带 openid，否则前端查不到
    _openid: OPENID,
  }

  try {
    const addRes = await db.collection(COLLECTION).add({ data })
    return { code: 0, id: addRes._id }
  } catch (err) {
    console.error('[addFoodLog] 写入失败', err)
    return { code: 3, msg: '保存失败，请稍后重试' }
  }
}
