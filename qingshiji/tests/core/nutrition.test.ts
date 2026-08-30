import { describe, expect, it } from 'vitest'

import {
  KCAL_PER_KG_FAT,
  MAX_WEEKLY_LOSS_RATIO,
  buildNutritionTarget,
  calcAge,
  calcBMR,
  calcDailyDeficit,
  calcMacroTargets,
  calcTDEE,
  calcTrend,
  isValidProfile,
  movingAverage,
  validateGoal,
} from '../../miniprogram/core/nutrition'
import type { UserProfile } from '../../miniprogram/core/types'

/**
 * PRD 3.3 的基准场景
 * 女，28 岁（1998 年生），160cm，60kg，久坐（1.2）
 */
const BASE: UserProfile = {
  gender: 'female',
  birthYear: new Date().getFullYear() - 28,
  height: 160,
  weight: 60,
  activityLevel: 1.2,
}

describe('年龄与档案校验', () => {
  it('由出生年份推算年龄', () => {
    expect(calcAge(BASE.birthYear)).toBe(28)
  })

  it('识别非法档案', () => {
    expect(isValidProfile(BASE)).toBe(true)
    expect(isValidProfile({ ...BASE, height: 0 })).toBe(false)
    expect(isValidProfile({ ...BASE, weight: 10 })).toBe(false)
    expect(isValidProfile({ ...BASE, activityLevel: 1.4 as never })).toBe(false)
  })
})

describe('BMR 计算（Mifflin-St Jeor）', () => {
  it('女性：60kg / 160cm / 28岁 → 1299', () => {
    // 10×60 + 6.25×160 − 5×28 − 161 = 600 + 1000 − 140 − 161 = 1299
    expect(calcBMR(BASE)).toBe(1299)
  })

  it('男性：70kg / 175cm / 30岁 → 1663', () => {
    const male: UserProfile = {
      gender: 'male',
      birthYear: new Date().getFullYear() - 30,
      height: 175,
      weight: 70,
      activityLevel: 1.2,
    }
    // 10×70 + 6.25×175 − 5×30 + 5 = 700 + 1093.75 − 150 + 5 = 1648.75
    expect(calcBMR(male)).toBe(1649)
  })

  it('男女差异恰好为 166（+5 与 −161）', () => {
    const male = { ...BASE, gender: 'male' as const }
    expect(calcBMR(male) - calcBMR(BASE)).toBe(166)
  })
})

describe('TDEE 与热量缺口', () => {
  it('久坐：BMR 1299 × 1.2 → 1559', () => {
    expect(calcTDEE(1299, 1.2)).toBe(1559)
  })

  it('中度活动：BMR 1299 × 1.55 → 2013', () => {
    expect(calcTDEE(1299, 1.55)).toBe(2013)
  })

  it('每周减 0.6kg → 每日缺口 660 kcal', () => {
    // 0.6 × 7700 / 7 = 660
    expect(calcDailyDeficit(0.6)).toBe(660)
  })

  it('缺口换算与常量自洽', () => {
    // 每天 500 kcal 缺口，7 天应恰好减 500×7/7700 kg
    const weekly = (500 * 7) / KCAL_PER_KG_FAT
    expect(calcDailyDeficit(weekly)).toBe(500)
  })
})

describe('三大营养素配比', () => {
  it('热量充足时按标准配比', () => {
    const macro = calcMacroTargets(60, 1400)
    expect(macro.protein).toBe(108) // 60 × 1.8
    expect(macro.fat).toBe(54) // 60 × 0.9
    // (1400 − 108×4 − 54×9) / 4 = (1400 − 432 − 486) / 4 = 120.5
    expect(macro.carb).toBe(121)
  })

  it('热量偏低时压缩脂肪以保住碳水', () => {
    // 目标热量 1100：标准配比下碳水仅 46g，低于 50g 下限
    const low = calcMacroTargets(60, 1100)
    expect(low.fat).toBeLessThan(54)
    expect(low.carb).toBeGreaterThanOrEqual(0)
    // 蛋白质优先保障，不因热量不足而削减
    expect(low.protein).toBe(108)
  })

  it('蛋白质不随热量变化，只与体重相关', () => {
    expect(calcMacroTargets(60, 1400).protein).toBe(
      calcMacroTargets(60, 1100).protein
    )
  })
})

describe('营养目标构建 —— 目标热量不得低于 BMR', () => {
  it('正常目标直接采用', () => {
    const target = buildNutritionTarget(BASE, 0.3)
    expect(target.bmr).toBe(1299)
    expect(target.tdee).toBe(1559)
    expect(target.calorieTarget).toBeGreaterThanOrEqual(target.bmr)
  })

  it('即使每周减重给得过大，目标热量也被钳制在 BMR', () => {
    // 荒谬的目标：每周减 5kg
    const target = buildNutritionTarget(BASE, 5)
    expect(target.calorieTarget).toBeGreaterThanOrEqual(1299)
    expect(target.dailyDeficit).toBeLessThanOrEqual(target.tdee - target.bmr)
  })
})

describe('极端目标拦截', () => {
  it('拦截「一个月减 10 斤」这类激进目标', () => {
    // 60kg → 55kg，4 周达成 = 每周 1.25kg = 体重 2.08%
    const result = validateGoal(BASE, 55, 4)

    expect(result.valid).toBe(false)
    expect(result.code).toBe('RATE_TOO_HIGH')
    expect(result.assessment?.weeklyLossKg).toBe(1.3)
    expect(result.assessment!.rateRatio).toBeGreaterThan(MAX_WEEKLY_LOSS_RATIO)
  })

  it('拦截时必须给出替代方案，而不是只弹警告', () => {
    const result = validateGoal(BASE, 55, 4)
    expect(result.suggestion).toBeDefined()
    expect(result.suggestion!.weeklyLossKg).toBeGreaterThan(0)
    expect(result.suggestion!.estimatedWeeks).toBeGreaterThan(4)
    expect(result.message).toContain('基础消耗')
  })

  it('替代方案必须满足「目标热量 ≥ BMR」硬约束', () => {
    const result = validateGoal(BASE, 55, 4)
    expect(result.suggestion!.nutrition.calorieTarget).toBeGreaterThanOrEqual(
      result.suggestion!.nutrition.bmr
    )
  })

  it('替代方案的速率不超过体重 1%', () => {
    const result = validateGoal(BASE, 55, 4)
    expect(result.suggestion!.weeklyLossKg / BASE.weight).toBeLessThanOrEqual(
      MAX_WEEKLY_LOSS_RATIO
    )
  })

  it('久坐且体重基数小时，明确建议增加运动而非继续压低摄入', () => {
    // 此场景下瓶颈来自 TDEE−BMR 空间不足，而非速率上限
    const result = validateGoal(BASE, 55, 4)
    expect(result.suggestion?.advice).toBeDefined()
    expect(result.suggestion!.advice).toContain('运动')
  })

  it('合理目标予以通过（有运动习惯者）', () => {
    // 中度活动：TDEE = 1299 × 1.55 = 2013
    // 60kg → 57kg，12 周 = 每周 0.25kg = 0.42%
    const result = validateGoal({ ...BASE, activityLevel: 1.55 }, 57, 12)
    expect(result.valid).toBe(true)
    expect(result.code).toBe('OK')
    expect(result.suggestion).toBeUndefined()
    // 目标热量 = 2013 − 275 = 1738，远高于 BMR
    expect(result.assessment!.calorieTarget).toBe(1738)
  })

  it('久坐且体重基数小时，减脂空间极其有限（真实约束）', () => {
    // TDEE 1559 − BMR 1299 = 每日最多 260 kcal 缺口
    // 对应每周最多减 260 × 7 / 7700 ≈ 0.236 kg
    const target = buildNutritionTarget(BASE, 5)
    expect(target.dailyDeficit).toBe(260)

    const maxWeeklyLoss = (260 * 7) / KCAL_PER_KG_FAT
    expect(maxWeeklyLoss).toBeCloseTo(0.236, 2)

    // 因此即便「每周减 0.25kg」这种看似温和的目标，对久坐的她也会触及 BMR 下限
    expect(validateGoal(BASE, 57, 12).code).toBe('BELOW_BMR')
  })

  it('拒绝目标体重不低于当前体重的输入', () => {
    const result = validateGoal(BASE, 62, 8)
    expect(result.valid).toBe(false)
    expect(result.code).toBe('INVALID_INPUT')
  })

  it('拒绝非法周期', () => {
    expect(validateGoal(BASE, 55, 0).code).toBe('INVALID_INPUT')
    expect(validateGoal(BASE, 55, -3).code).toBe('INVALID_INPUT')
  })

  it('档案不完整时直接拒绝', () => {
    const broken = { ...BASE, height: 0 }
    expect(validateGoal(broken, 55, 8).code).toBe('INVALID_INPUT')
  })

  it('增加活动水平能显著改善减脂空间', () => {
    const sedentary = validateGoal(BASE, 55, 4)
    const active = validateGoal({ ...BASE, activityLevel: 1.55 }, 55, 4)

    // 提高活动水平后，达成同样目标所需周数应大幅缩短
    expect(active.suggestion!.estimatedWeeks).toBeLessThan(
      sedentary.suggestion!.estimatedWeeks
    )
  })
})

describe('体重 7 日移动平均', () => {
  const makeRecords = (start: string, weights: number[]) => {
    const [y, m, d] = start.split('-').map(Number)
    return weights.map((weight, i) => {
      const date = new Date(Date.UTC(y, m - 1, d + i))
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(date.getUTCDate()).padStart(2, '0')
      return { date: `${date.getUTCFullYear()}-${mm}-${dd}`, weight }
    })
  }

  it('数据不足 7 天时 average 为 null', () => {
    const points = movingAverage(makeRecords('2026-08-01', [60, 59.8, 59.6]))
    expect(points).toHaveLength(3)
    expect(points.every((p) => p.average === null)).toBe(true)
  })

  it('第 7 天起产生移动平均值', () => {
    const weights = [60, 60.2, 59.8, 59.9, 59.6, 59.7, 59.5]
    const points = movingAverage(makeRecords('2026-08-01', weights))
    expect(points[5].average).toBeNull()
    expect(points[6].average).not.toBeNull()
    // 均值 = 418.7 / 7 = 59.814... → 59.8
    expect(points[6].average).toBe(59.8)
  })

  it('缺失日期按前值填充，不中断曲线', () => {
    const records = [
      { date: '2026-08-01', weight: 60 },
      // 08-02、08-03 缺失
      { date: '2026-08-04', weight: 59 },
    ]
    const points = movingAverage(records)
    expect(points).toHaveLength(4)
    expect(points[1].filled).toBe(true)
    expect(points[1].weight).toBe(60) // 前值填充
    expect(points[2].filled).toBe(true)
    expect(points[3].filled).toBe(false)
  })

  it('输入顺序不影响结果', () => {
    const a = [
      { date: '2026-08-01', weight: 60 },
      { date: '2026-08-02', weight: 59 },
    ]
    const b = [...a].reverse()
    expect(movingAverage(a)).toEqual(movingAverage(b))
  })

  it('空输入返回空数组', () => {
    expect(movingAverage([])).toEqual([])
  })
})

describe('近期趋势（用于文案表达）', () => {
  it('数据充足时返回周环比变化', () => {
    const weights = [60, 60.1, 59.9, 59.8, 59.7, 59.6, 59.5, 59.3, 59.2, 59, 58.9, 58.8, 58.7, 58.6]
    const records = weights.map((weight, i) => {
      const d = new Date(Date.UTC(2026, 7, 1 + i))
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(d.getUTCDate()).padStart(2, '0')
      return { date: `${d.getUTCFullYear()}-${mm}-${dd}`, weight }
    })
    const trend = calcTrend(records)
    expect(trend.sufficient).toBe(true)
    expect(trend.delta).toBeLessThan(0) // 呈下降趋势
  })

  it('数据不足时标记 insufficient，避免展示误导性数字', () => {
    const records = [
      { date: '2026-08-01', weight: 60 },
      { date: '2026-08-02', weight: 59 },
    ]
    const trend = calcTrend(records)
    expect(trend.sufficient).toBe(false)
    expect(trend.delta).toBe(0)
  })
})
