/**
 * 全局配置
 *
 * ⚠️ 开通云开发后，把 CLOUD_ENV_ID 替换为你的环境 ID。
 *    环境 ID 在「微信开发者工具 → 云开发 → 设置 → 环境 ID」查看。
 *    建议创建两套环境（dev / prod），此处只填当前使用的那一套。
 */

/** 云开发环境 ID（声明为 string，避免 TS 字面量收窄导致与占位符比较报错） */
export const CLOUD_ENV_ID: string = 'qingshiji-dev-d2gnb7ld01af8443e'

/** 是否为开发环境（控制日志输出与调试入口） */
export const IS_DEV = true

/** 产品常量 —— 与 core/nutrition.ts 保持单一数据源，此处仅供 UI 展示 */
export const MEAL_LABELS = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
} as const

/** 订阅消息模板 ID（申请后填入） */
export const SUBSCRIBE_TEMPLATE_IDS = {
  /** 餐点记录提醒 */
  mealReminder: '',
  /** 周报提醒 */
  weeklyReport: '',
} as const
