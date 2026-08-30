/**
 * 服务端营养计算（云函数内专用）
 *
 * ⚠️ 本文件是 miniprogram/core/nutrition.ts 的 JS 镜像实现，
 *    两端必须严格保持一致，否则会出现「前端显示 1500 大卡、
 *    服务端存的是 1480 大卡」的信任事故。
 *
 * 为什么服务端要重算一遍：
 *   前端传来的营养数字属于「客户端数据」，可能被篡改或由旧版本算法算出。
 *   热量是产品的信任基础，必须以服务端算的结果为准落库。
 *
 * 修改本文件时，请同步修改 miniprogram/core/nutrition.ts。
 * 修改后请跑 tests/ 下的营养计算用例验证两端一致。
 */

/** 减少 1kg 脂肪所需的热量缺口（kcal） */
const KCAL_PER_KG_FAT = 7700

/** 每周减重速率上限：不超过当前体重的 1% */
const MAX_WEEKLY_LOSS_RATIO = 0.01

/** 减脂期蛋白质系数 g/kg 体重 */
const PROTEIN_PER_KG = 1.8

/** 脂肪系数 g/kg 体重 */
const FAT_PER_KG = 0.9

/** 脂肪可压缩到的下限系数 g/kg 体重 */
const MIN_FAT_PER_KG = 0.6

/** 碳水下限（g） */
const MIN_CARB = 50

/** 每克营养素对应的热量 */
const KCAL_PER_G_PROTEIN = 4
const KCAL_PER_G_FAT = 9
const KCAL_PER_G_CARB = 4

const ACTIVITY_LEVELS = [1.2, 1.375, 1.55, 1.725, 1.9]

function round1(n) {
  return Math.round(n * 10) / 10
}

function calcAge(birthYear, nowYear = new Date().getFullYear()) {
  return nowYear - birthYear
}

function isValidProfile(p) {
  return (
    (p.gender === 'male' || p.gender === 'female') &&
    Number.isFinite(p.birthYear) &&
    p.birthYear > 1900 &&
    calcAge(p.birthYear) >= 14 &&
    calcAge(p.birthYear) <= 100 &&
    p.height > 100 &&
    p.height < 250 &&
    p.weight > 25 &&
    p.weight < 300 &&
    ACTIVITY_LEVELS.includes(p.activityLevel)
  )
}

/** BMR（Mifflin-St Jeor） */
function calcBMR(profile) {
  const age = calcAge(profile.birthYear)
  const base = 10 * profile.weight + 6.25 * profile.height - 5 * age
  const adjusted = profile.gender === 'male' ? base + 5 : base - 161
  return Math.round(adjusted)
}

/** TDEE = BMR × 活动系数 */
function calcTDEE(bmr, level) {
  return Math.round(bmr * level)
}

/** 每日热量缺口 = 每周减重(kg) × 7700 / 7 */
function calcDailyDeficit(weeklyLossKg) {
  return Math.round((weeklyLossKg * KCAL_PER_KG_FAT) / 7)
}

/**
 * 三大营养素配比
 * 顺序固定：先蛋白质 → 再脂肪 → 碳水补足剩余热量
 */
function calcMacroTargets(weight, calorieTarget) {
  const protein = Math.round(weight * PROTEIN_PER_KG)
  const fat = Math.round(weight * FAT_PER_KG)

  const carb = Math.round(
    (calorieTarget - protein * KCAL_PER_G_PROTEIN - fat * KCAL_PER_G_FAT) /
      KCAL_PER_G_CARB
  )

  if (carb >= MIN_CARB) {
    return { protein, fat, carb }
  }

  const fatMin = Math.round(weight * MIN_FAT_PER_KG)
  const carbWithMinFat = Math.round(
    (calorieTarget - protein * KCAL_PER_G_PROTEIN - fatMin * KCAL_PER_G_FAT) /
      KCAL_PER_G_CARB
  )

  if (carbWithMinFat >= MIN_CARB) {
    return { protein, fat: fatMin, carb: carbWithMinFat }
  }

  return { protein, fat: fatMin, carb: Math.max(carbWithMinFat, 0) }
}

/**
 * 构建完整营养目标
 * 硬约束：目标热量不得低于 BMR
 */
function buildNutritionTarget(profile, weeklyLossKg) {
  const bmr = calcBMR(profile)
  const tdee = calcTDEE(bmr, profile.activityLevel)
  const rawDeficit = calcDailyDeficit(weeklyLossKg)
  const safeDeficit = Math.min(rawDeficit, Math.max(tdee - bmr, 0))
  const calorieTarget = Math.round(tdee - safeDeficit)

  return {
    bmr,
    tdee,
    calorieTarget,
    dailyDeficit: safeDeficit,
    ...calcMacroTargets(profile.weight, calorieTarget),
  }
}

/**
 * 服务端目标校验
 * 与前端 validateGoal 保持同一套拦截规则，返回结构精简为云函数所需
 */
function validateGoal(profile, targetWeight, targetWeeks) {
  if (!isValidProfile(profile)) {
    return {
      valid: false,
      code: 'INVALID_INPUT',
      message: '个人档案信息不完整或不合理，请先完善身高、体重、出生年份。',
    }
  }

  if (!Number.isFinite(targetWeight) || !Number.isFinite(targetWeeks)) {
    return {
      valid: false,
      code: 'INVALID_INPUT',
      message: '目标体重与周期必须为有效数字。',
    }
  }

  if (targetWeight >= profile.weight) {
    return {
      valid: false,
      code: 'INVALID_INPUT',
      message: '目标体重需要低于当前体重。当前版本仅支持减脂目标。',
    }
  }

  if (targetWeeks < 1) {
    return {
      valid: false,
      code: 'INVALID_INPUT',
      message: '达成周期至少需要 1 周。',
    }
  }

  const bmr = calcBMR(profile)
  const tdee = calcTDEE(bmr, profile.activityLevel)
  const totalLossKg = profile.weight - targetWeight
  const weeklyLossKg = totalLossKg / targetWeeks
  const rateRatio = weeklyLossKg / profile.weight
  const calorieTarget = Math.round(tdee - calcDailyDeficit(weeklyLossKg))

  if (rateRatio > MAX_WEEKLY_LOSS_RATIO) {
    return {
      valid: false,
      code: 'RATE_TOO_HIGH',
      message: `每周减重不得超过体重的 1%，当前为 ${(rateRatio * 100).toFixed(1)}%。`,
    }
  }

  if (calorieTarget < bmr) {
    return {
      valid: false,
      code: 'BELOW_BMR',
      message: `目标热量 ${calorieTarget} 大卡低于基础代谢 ${bmr} 大卡，不可执行。`,
    }
  }

  return {
    valid: true,
    code: 'OK',
    message: '目标可行。',
    weeklyLossKg: round1(weeklyLossKg),
  }
}

module.exports = {
  KCAL_PER_KG_FAT,
  MAX_WEEKLY_LOSS_RATIO,
  calcBMR,
  calcTDEE,
  calcDailyDeficit,
  calcMacroTargets,
  buildNutritionTarget,
  validateGoal,
  isValidProfile,
  round1,
}
