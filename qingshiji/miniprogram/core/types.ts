/**
 * 轻食记 · 核心类型定义
 *
 * 本文件只放类型，不放实现。所有营养相关计算见 nutrition.ts。
 */

/** 生理性别 —— 影响 BMR 公式的常数项 */
export type Gender = 'male' | 'female'

/**
 * 活动系数（用于 TDEE = BMR × 活动系数）
 * 对应 PRD 3.2 的五档活动水平
 */
export type ActivityLevel = 1.2 | 1.375 | 1.55 | 1.725 | 1.9

/** 活动水平的中文描述，用于 UI 展示 */
export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  1.2: '久坐（几乎不运动）',
  1.375: '轻度（每周 1–3 次）',
  1.55: '中度（每周 3–5 次）',
  1.725: '高度（每周 6–7 次）',
  1.9: '极高（体力劳动或每日训练）',
}

/** 用户基础档案 */
export interface UserProfile {
  gender: Gender
  /** 出生年份，用于推算年龄 */
  birthYear: number
  /** 身高（cm） */
  height: number
  /** 当前体重（kg） */
  weight: number
  activityLevel: ActivityLevel
}

/** 三大营养素目标（g） */
export interface MacroTargets {
  protein: number
  fat: number
  carb: number
}

/** 完整的营养目标 */
export interface NutritionTarget extends MacroTargets {
  /** 基础代谢率（kcal/天） */
  bmr: number
  /** 每日总消耗（kcal/天） */
  tdee: number
  /** 每日目标摄入热量（kcal） */
  calorieTarget: number
  /** 每日热量缺口（kcal） */
  dailyDeficit: number
}

/** 目标校验结果编码 */
export type GoalValidationCode =
  | 'OK'
  /** 目标热量低于基础代谢，不可执行 */
  | 'BELOW_BMR'
  /** 每周减重速率超过体重的 1% */
  | 'RATE_TOO_HIGH'
  /** 目标体重未低于当前体重，或目标周期非法 */
  | 'INVALID_INPUT'

/** 用户原定目标的测算结果 */
export interface GoalAssessment {
  /** 每周需减重（kg） */
  weeklyLossKg: number
  /** 每周减重占体重的比例 */
  rateRatio: number
  /** 推算出的每日目标热量（kcal） */
  calorieTarget: number
}

/** 系统给出的替代方案 */
export interface GoalSuggestion {
  /** 建议的每周减重（kg） */
  weeklyLossKg: number
  /** 建议的每日热量（kcal） */
  calorieTarget: number
  /** 按建议速率达成目标所需周数 */
  estimatedWeeks: number
  /** 对应的完整营养目标 */
  nutrition: NutritionTarget
  /** 追加建议（例如减脂空间不足时建议增加运动） */
  advice?: string
}

/** 目标校验结果 */
export interface GoalValidation {
  valid: boolean
  code: GoalValidationCode
  /** 面向用户的说明文案 */
  message: string
  /** 用户原目标的测算值 */
  assessment?: GoalAssessment
  /** 仅在 valid 为 false 时提供 */
  suggestion?: GoalSuggestion
}

/** 体重曲线上的点 */
export interface WeightPoint {
  /** YYYY-MM-DD */
  date: string
  /** 实测体重（kg）；若该日为前值填充，等于最近一次实测值 */
  weight: number
  /** 7 日移动平均（kg）；数据不足 7 天时为 null */
  average: number | null
  /** 该日是否为前值填充（非真实记录） */
  filled: boolean
}
