/**
 * 轻食记 · 营养计算核心
 *
 * 设计原则（对应 PRD 5.2：计算层与表达层严格分离）
 * ------------------------------------------------
 * 本模块是纯函数，无任何外部依赖、无网络请求、无随机数。
 * 相同输入必然产生相同输出 —— 这是产品信任基础的技术保障。
 *
 * ⚠️ 禁止让大模型参与本模块中的任何计算。
 *    大模型只负责把这里算出的数值翻译成自然语言方案。
 */

import type {
  ActivityLevel,
  GoalAssessment,
  GoalSuggestion,
  GoalValidation,
  MacroTargets,
  NutritionTarget,
  UserProfile,
  WeightPoint,
} from './types'

/* ------------------------------------------------------------------ */
/* 常量                                                                */
/* ------------------------------------------------------------------ */

/** 减少 1kg 脂肪所需的热量缺口（kcal） */
export const KCAL_PER_KG_FAT = 7700

/** 每周减重速率上限：不超过当前体重的 1%（PRD 3.3 硬约束） */
export const MAX_WEEKLY_LOSS_RATIO = 0.01

/** 减脂期蛋白质系数：g / kg 体重（PRD 3.4，区间 1.6–2.2） */
export const PROTEIN_PER_KG = 1.8

/** 脂肪系数：g / kg 体重（PRD 3.4，区间 0.8–1.0） */
export const FAT_PER_KG = 0.9

/** 脂肪可压缩到的下限系数：g / kg 体重 */
export const MIN_FAT_PER_KG = 0.6

/** 碳水下限（g），低于此值不符合基本生理需求 */
export const MIN_CARB = 50

/** 建议方案的安全余量：在理论上限基础上再打折，留出波动空间 */
export const SAFETY_MARGIN = 0.8

/** 每克营养素对应的热量 */
const KCAL_PER_G_PROTEIN = 4
const KCAL_PER_G_FAT = 9
const KCAL_PER_G_CARB = 4

const DAY_MS = 86400000

/* ------------------------------------------------------------------ */
/* 基础工具                                                            */
/* ------------------------------------------------------------------ */

/** 保留一位小数 */
function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** 由出生年份推算年龄 */
export function calcAge(birthYear: number, nowYear = new Date().getFullYear()): number {
  return nowYear - birthYear
}

/** 校验档案数值是否在合理范围 */
export function isValidProfile(p: UserProfile): boolean {
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
    ([1.2, 1.375, 1.55, 1.725, 1.9] as number[]).includes(p.activityLevel)
  )
}

/* ------------------------------------------------------------------ */
/* 代谢计算                                                            */
/* ------------------------------------------------------------------ */

/**
 * 基础代谢率 BMR（Mifflin-St Jeor 公式，PRD 3.1）
 *
 * 男性：10×体重 + 6.25×身高 − 5×年龄 + 5
 * 女性：10×体重 + 6.25×身高 − 5×年龄 − 161
 */
export function calcBMR(profile: UserProfile): number {
  const age = calcAge(profile.birthYear)
  const base =
    10 * profile.weight + 6.25 * profile.height - 5 * age
  const adjusted = profile.gender === 'male' ? base + 5 : base - 161
  return Math.round(adjusted)
}

/**
 * 每日总消耗 TDEE（PRD 3.2）
 * TDEE = BMR × 活动系数
 */
export function calcTDEE(bmr: number, level: ActivityLevel): number {
  return Math.round(bmr * level)
}

/**
 * 由每周目标减重反推每日热量缺口（PRD 3.3）
 * 每日缺口 = 每周减重(kg) × 7700 / 7
 */
export function calcDailyDeficit(weeklyLossKg: number): number {
  return Math.round((weeklyLossKg * KCAL_PER_KG_FAT) / 7)
}

/* ------------------------------------------------------------------ */
/* 营养素配比                                                          */
/* ------------------------------------------------------------------ */

/**
 * 三大营养素配比（PRD 3.4）
 * 计算顺序固定：先蛋白质 → 再脂肪 → 碳水补足剩余热量
 *
 * 当目标热量过低导致碳水不足时，会压缩脂肪以保住碳水；
 * 若脂肪压到下限仍不足，说明该目标热量本身不合理，应由上层拦截。
 */
export function calcMacroTargets(
  weight: number,
  calorieTarget: number
): MacroTargets {
  const protein = Math.round(weight * PROTEIN_PER_KG)
  const fat = Math.round(weight * FAT_PER_KG)

  const carb = Math.round(
    (calorieTarget - protein * KCAL_PER_G_PROTEIN - fat * KCAL_PER_G_FAT) /
      KCAL_PER_G_CARB
  )

  if (carb >= MIN_CARB) {
    return { protein, fat, carb }
  }

  // 碳水不足：压缩脂肪到下限，重新分配
  const fatMin = Math.round(weight * MIN_FAT_PER_KG)
  const carbWithMinFat = Math.round(
    (calorieTarget - protein * KCAL_PER_G_PROTEIN - fatMin * KCAL_PER_G_FAT) /
      KCAL_PER_G_CARB
  )

  if (carbWithMinFat >= MIN_CARB) {
    return { protein, fat: fatMin, carb: carbWithMinFat }
  }

  // 脂肪已压到下限仍然不足 —— 目标热量过低，返回最低保障方案
  return { protein, fat: fatMin, carb: Math.max(carbWithMinFat, 0) }
}

/* ------------------------------------------------------------------ */
/* 营养目标构建                                                        */
/* ------------------------------------------------------------------ */

/**
 * 基于每周减重目标，构建完整的营养目标
 *
 * 硬约束：目标热量不得低于 BMR。即便传入的每周减重过大，
 * 也会在此处被钳制到 BMR，保证输出始终是安全的。
 */
export function buildNutritionTarget(
  profile: UserProfile,
  weeklyLossKg: number
): NutritionTarget {
  const bmr = calcBMR(profile)
  const tdee = calcTDEE(bmr, profile.activityLevel)
  const rawDeficit = calcDailyDeficit(weeklyLossKg)

  // 缺口不得超过 TDEE − BMR，否则摄入低于基础代谢
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

/* ------------------------------------------------------------------ */
/* 目标校验与极端目标拦截                                              */
/* ------------------------------------------------------------------ */

/**
 * 生成替代方案
 *
 * 取两项约束的较小值作为理论上限：
 *   1. 由「目标热量 ≥ BMR」推出的最大每周减重
 *   2. 由「速率 ≤ 体重 1%」推出的最大每周减重
 * 再乘以安全余量，得到建议值。
 */
function buildSuggestion(
  profile: UserProfile,
  bmr: number,
  tdee: number,
  totalLossKg: number
): GoalSuggestion {
  // 约束一：热量缺口空间（TDEE − BMR）能支撑的最大每周减重
  const maxDeficit = Math.max(tdee - bmr, 0)
  const maxLossByBmr = (maxDeficit * 7) / KCAL_PER_KG_FAT

  // 约束二：速率上限对应的每周减重
  const maxLossByRate = profile.weight * MAX_WEEKLY_LOSS_RATIO

  const ceiling = Math.min(maxLossByBmr, maxLossByRate)
  const weeklyLossKg = round1(ceiling * SAFETY_MARGIN)

  const nutrition = buildNutritionTarget(profile, weeklyLossKg)
  const estimatedWeeks =
    weeklyLossKg > 0 ? Math.ceil(totalLossKg / weeklyLossKg) : Infinity

  // 若瓶颈来自代谢空间而非速率上限，说明靠节食已无空间，应转向增加消耗
  const advice =
    maxLossByBmr < maxLossByRate
      ? '你的基础代谢占日常消耗的比例很高，单纯控制饮食的空间有限。建议每周增加 3–4 次运动来提高每日消耗，减脂空间会明显改善，也比继续压低摄入更容易坚持。'
      : undefined

  return {
    weeklyLossKg,
    calorieTarget: nutrition.calorieTarget,
    estimatedWeeks,
    nutrition,
    advice,
  }
}

/**
 * 校验减脂目标，拦截极端目标（PRD 3.3）
 *
 * 拦截规则（硬性，不可绕过）：
 *   1. 每周减重速率不得超过当前体重的 1%
 *   2. 每日目标热量不得低于 BMR
 * 触发拦截时必须给出替代方案与解释，不允许仅弹出警告后放行。
 */
export function validateGoal(
  profile: UserProfile,
  targetWeight: number,
  targetWeeks: number
): GoalValidation {
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

  const assessment: GoalAssessment = {
    weeklyLossKg: round1(weeklyLossKg),
    rateRatio,
    calorieTarget,
  }

  const suggestion = buildSuggestion(profile, bmr, tdee, totalLossKg)

  // 约束一：速率上限
  if (rateRatio > MAX_WEEKLY_LOSS_RATIO) {
    return {
      valid: false,
      code: 'RATE_TOO_HIGH',
      message:
        `按你的目标，每周需要减 ${round1(weeklyLossKg)} kg，` +
        `相当于体重的 ${(rateRatio * 100).toFixed(1)}%，` +
        `超过了每周 1% 的健康上限。\n` +
        `以此速率每天只能摄入约 ${calorieTarget} 大卡，` +
        `而你的身体基础消耗是 ${bmr} 大卡 —— 这个吃法会先掉肌肉、` +
        `代谢下降，结束后极易反弹。`,
      assessment,
      suggestion,
    }
  }

  // 约束二：目标热量不得低于 BMR
  if (calorieTarget < bmr) {
    return {
      valid: false,
      code: 'BELOW_BMR',
      message:
        `按你的目标，每天需要摄入约 ${calorieTarget} 大卡，` +
        `低于身体基础消耗 ${bmr} 大卡。\n` +
        `长期低于基础代谢会导致肌肉流失与代谢损伤，不可执行。`,
      assessment,
      suggestion,
    }
  }

  return {
    valid: true,
    code: 'OK',
    message:
      `目标可行：每周减 ${round1(weeklyLossKg)} kg，` +
      `每天摄入 ${calorieTarget} 大卡，预计 ${targetWeeks} 周达成。`,
    assessment,
  }
}

/* ------------------------------------------------------------------ */
/* 体重趋势（7 日移动平均）                                            */
/* ------------------------------------------------------------------ */

/** 'YYYY-MM-DD' → UTC 时间戳 */
function parseDate(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** UTC 时间戳 → 'YYYY-MM-DD' */
function formatDate(ts: number): string {
  const d = new Date(ts)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${mm}-${dd}`
}

/**
 * 计算 7 日移动平均体重曲线（PRD 2.5.1 / 3.5）
 *
 * 人体日体重波动 1–2kg 属常态，直接连接日线会让用户因正常波动产生挫败感，
 * 是导致放弃的首要原因。因此主曲线使用移动平均，日线仅作淡化背景。
 *
 * 特性：
 *   - 输入无需连续，缺失日期按最近一次实测值填充（PRD 3.5）
 *   - 数据不足 7 天时，average 返回 null，前端应只画实测点
 *   - filled 标记该日是否为填充值，前端可用更淡的样式渲染
 */
export function movingAverage(
  records: Array<{ date: string; weight: number }>,
  windowSize = 7
): WeightPoint[] {
  if (!records || records.length === 0) return []

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))

  // 补全缺失日期
  const filled: Array<{ date: string; weight: number; filled: boolean }> = [
    { ...sorted[0], filled: false },
  ]

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    const gapDays = Math.round((parseDate(curr.date) - parseDate(prev.date)) / DAY_MS)

    for (let d = 1; d < gapDays; d++) {
      filled.push({
        date: formatDate(parseDate(prev.date) + d * DAY_MS),
        weight: prev.weight,
        filled: true,
      })
    }
    filled.push({ ...curr, filled: false })
  }

  // 滑动平均
  return filled.map((item, index) => {
    if (index < windowSize - 1) {
      return { ...item, average: null }
    }
    const slice = filled.slice(index - windowSize + 1, index + 1)
    const sum = slice.reduce((acc, r) => acc + r.weight, 0)
    return { ...item, average: round1(sum / windowSize) }
  })
}

/**
 * 计算近期趋势：最近 windowSize 天平均 vs 上一个 windowSize 天平均
 * 用于文案表达「近 7 天平均下降 0.4kg」，避免强调单点数值
 */
export function calcTrend(
  records: Array<{ date: string; weight: number }>,
  windowSize = 7
): { delta: number; sufficient: boolean } {
  const points = movingAverage(records, windowSize)
  const real = points.filter((p) => p.average !== null)
  if (real.length < windowSize) {
    return { delta: 0, sufficient: false }
  }
  const latest = real[real.length - 1].average as number
  const previous = real[real.length - windowSize]?.average
  if (previous == null) {
    return { delta: 0, sufficient: false }
  }
  return { delta: round1(latest - previous), sufficient: true }
}
