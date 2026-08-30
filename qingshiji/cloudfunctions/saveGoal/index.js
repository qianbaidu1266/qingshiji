/**
 * 云函数：保存减脂目标
 *
 * 核心原则：所有热量与营养素数字一律由服务端重算，绝不接受前端传入的结果。
 * 前端传来的只是「原始输入」（身高/体重/目标/周数），不是「计算结论」。
 *
 * 副作用：
 *   1. 将用户已有的 active 目标置为 abandoned（同时只允许一个生效目标）
 *   2. 同步 upsert users 集合里的个人档案
 */

const cloud = require('wx-server-sdk')
const { buildNutritionTarget, validateGoal, isValidProfile } = require('./nutrition')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const GOALS = 'goals'
const USERS = 'users'

function fail(code, msg) {
  return { code, msg }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  if (!OPENID) {
    return fail(-1, '无法获取用户身份，请重新进入小程序')
  }

  const { profile, targetWeight, targetWeeks } = event

  /* ---------------- 入参校验 ---------------- */

  if (!profile || typeof profile !== 'object') {
    return fail(1, '个人档案缺失')
  }

  // 数值统一转 Number，防止前端传入字符串
  const normalized = {
    gender: profile.gender,
    birthYear: Number(profile.birthYear),
    height: Number(profile.height),
    weight: Number(profile.weight),
    activityLevel: Number(profile.activityLevel),
  }

  if (!isValidProfile(normalized)) {
    return fail(1, '身高、体重或出生年份不在合理范围，请检查后重试')
  }

  const tw = Number(targetWeight)
  const weeks = Number(targetWeeks)
  if (!Number.isFinite(tw) || !Number.isFinite(weeks)) {
    return fail(1, '目标体重与周期必须为有效数字')
  }

  /* ---------------- 服务端校验（与前端同一套规则） ---------------- */

  const validation = validateGoal(normalized, tw, weeks)
  if (!validation.valid) {
    // 前端已拦截过，这里是兜底。返回同样的 code 便于前端定位。
    return { code: 4, msg: validation.message, reason: validation.code }
  }

  /* ---------------- 服务端重算营养目标 ---------------- */

  const totalLossKg = normalized.weight - tw
  const weeklyLossKg = totalLossKg / weeks
  const target = buildNutritionTarget(normalized, weeklyLossKg)

  const now = new Date()

  try {
    // 1. 作废旧目标
    await db
      .collection(GOALS)
      .where({ _openid: OPENID, status: 'active' })
      .update({ data: { status: 'abandoned', updatedAt: now } })

    // 2. 写入新目标
    const goalRecord = {
      gender: normalized.gender,
      birthYear: normalized.birthYear,
      height: normalized.height,
      startWeight: normalized.weight,
      currentWeight: normalized.weight,
      targetWeight: tw,
      targetWeeks: weeks,
      weeklyRate: weeklyLossKg,
      activityLevel: normalized.activityLevel,

      bmr: target.bmr,
      tdee: target.tdee,
      calorieTarget: target.calorieTarget,
      proteinTarget: target.protein,
      fatTarget: target.fat,
      carbTarget: target.carb,

      status: 'active',
      createdAt: now,
      updatedAt: now,
      _openid: OPENID,
    }

    const addRes = await db.collection(GOALS).add({ data: goalRecord })

    // 3. 同步个人档案（upsert）
    const exist = await db
      .collection(USERS)
      .where({ _openid: OPENID })
      .limit(1)
      .get()

    const profileData = {
      gender: normalized.gender,
      birthYear: normalized.birthYear,
      height: normalized.height,
      activityLevel: normalized.activityLevel,
      updatedAt: now,
    }

    if (exist.data.length > 0) {
      await db.collection(USERS).doc(exist.data[0]._id).update({ data: profileData })
    } else {
      await db
        .collection(USERS)
        .add({ data: { ...profileData, createdAt: now, _openid: OPENID } })
    }

    return {
      code: 0,
      id: addRes._id,
      goal: {
        calorieTarget: target.calorieTarget,
        proteinTarget: target.protein,
        fatTarget: target.fat,
        carbTarget: target.carb,
        bmr: target.bmr,
        tdee: target.tdee,
        weeklyRate: weeklyLossKg,
      },
    }
  } catch (err) {
    console.error('[saveGoal] 写入失败', err)
    return fail(3, '保存失败，请稍后重试')
  }
}
