/**
 * 数据访问层
 *
 * 设计约定（对应技术方案 3.5）：
 *   - 查询类操作在前端直连数据库，受安全规则保护，速度快且不消耗云函数资源
 *   - 写入、聚合、AI 相关操作一律走云函数
 *   - 集合权限除 foodLibrary 外均为「仅创建者可读写」
 */

import type { UserProfile, WeightPoint } from '../core/types'

/** 集合名常量 —— 集中管理，避免拼写错误 */
export const COLLECTIONS = {
  users: 'users',
  goals: 'goals',
  foodLogs: 'foodLogs',
  weightLogs: 'weightLogs',
  plans: 'plans',
  dailyAnalysis: 'dailyAnalysis',
  foodLibrary: 'foodLibrary',
} as const

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS]

function db() {
  return wx.cloud.database()
}

/** 今日日期，格式 YYYY-MM-DD（本地时区） */
export function today(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/* ------------------------------------------------------------------ */
/* 饮食记录                                                            */
/* ------------------------------------------------------------------ */

export interface FoodLogRecord {
  _id?: string
  date: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  foodName: string
  portion: number
  portionLabel?: string
  calorie: number
  protein: number
  fat: number
  carb: number
  source: 'photo' | 'manual' | 'library' | 'ai_estimate'
  isEstimated: boolean
  imageUrl?: string
  loggedAt?: Date
}

/** 查询某天的全部饮食记录（按记录时间升序） */
export async function getLogsByDate(date: string): Promise<FoodLogRecord[]> {
  const res = await db()
    .collection(COLLECTIONS.foodLogs)
    .where({ date })
    .orderBy('loggedAt', 'asc')
    .get()
  return res.data as FoodLogRecord[]
}

/** 查询某天某餐次的记录 */
export async function getLogsByMeal(
  date: string,
  mealType: FoodLogRecord['mealType']
): Promise<FoodLogRecord[]> {
  const res = await db()
    .collection(COLLECTIONS.foodLogs)
    .where({ date, mealType })
    .orderBy('loggedAt', 'asc')
    .get()
  return res.data as FoodLogRecord[]
}

/**
 * 新增饮食记录
 * 走云函数而非前端直写，因为需要字段校验与频率控制
 */
export async function addFoodLog(
  log: Omit<FoodLogRecord, '_id' | 'loggedAt'>
): Promise<string> {
  const res = await wx.cloud.callFunction({
    name: 'addFoodLog',
    data: { log },
  })
  const result = res.result as { code: number; id?: string; msg?: string }
  if (result.code !== 0) {
    throw new Error(result.msg || '记录失败')
  }
  return result.id as string
}

/* ------------------------------------------------------------------ */
/* 体重记录                                                            */
/* ------------------------------------------------------------------ */

export interface WeightRecord {
  _id?: string
  date: string
  weight: number
  note?: string
}

/** 查询近期体重记录（按日期升序） */
export async function getWeightLogs(limit = 90): Promise<WeightRecord[]> {
  const res = await db()
    .collection(COLLECTIONS.weightLogs)
    .orderBy('date', 'asc')
    .limit(limit)
    .get()
  return res.data as WeightRecord[]
}

/** 查询单日体重记录 */
export async function getWeightByDate(date: string): Promise<WeightRecord | null> {
  const res = await db()
    .collection(COLLECTIONS.weightLogs)
    .where({ date })
    .limit(1)
    .get()
  const data = res.data as WeightRecord[]
  return data.length > 0 ? data[0] : null
}

/**
 * 记录体重
 * 同一天重复记录走覆盖语义（云函数端 upsert），返回 created / updated 便于提示
 */
export async function addWeightLog(
  date: string,
  weight: number,
  note = ''
): Promise<{ id: string; action: 'created' | 'updated' }> {
  const res = await wx.cloud.callFunction({
    name: 'addWeightLog',
    data: { date, weight, note },
  })
  const result = res.result as {
    code: number
    id?: string
    action?: 'created' | 'updated'
    msg?: string
  }
  if (result.code !== 0) {
    throw new Error(result.msg || '记录失败')
  }
  return { id: result.id as string, action: result.action as 'created' | 'updated' }
}

/* ------------------------------------------------------------------ */
/* 食物库（公共只读）                                                  */
/* ------------------------------------------------------------------ */

export interface FoodItem {
  _id: string
  name: string
  aliases?: string[]
  category?: string
  caloriePer100g: number
  proteinPer100g: number
  fatPer100g: number
  carbPer100g: number
  commonPortions?: Array<{ label: string; grams: number }>
}

/** 按关键词搜索食物库 */
export async function searchFood(keyword: string, limit = 20): Promise<FoodItem[]> {
  if (!keyword.trim()) return []
  const res = await db()
    .collection(COLLECTIONS.foodLibrary)
    .where({
      name: db().RegExp({ regexp: keyword.trim(), options: 'i' }),
    })
    .limit(limit)
    .get()
  return res.data as FoodItem[]
}

/* ------------------------------------------------------------------ */
/* 目标与方案                                                          */
/* ------------------------------------------------------------------ */

export interface GoalRecord {
  _id?: string
  startWeight: number
  currentWeight: number
  targetWeight: number
  weeklyRate: number
  bmr: number
  tdee: number
  calorieTarget: number
  proteinTarget: number
  fatTarget: number
  carbTarget: number
  status: 'active' | 'achieved' | 'abandoned'
  createdAt?: Date
}

/** 获取当前生效的目标 */
export async function getActiveGoal(): Promise<GoalRecord | null> {
  const res = await db()
    .collection(COLLECTIONS.goals)
    .where({ status: 'active' })
    .limit(1)
    .get()
  const data = res.data as GoalRecord[]
  return data.length > 0 ? data[0] : null
}

/** 保存目标后服务端返回的营养目标（以服务端重算结果为准） */
export interface SavedGoal {
  calorieTarget: number
  proteinTarget: number
  fatTarget: number
  carbTarget: number
  bmr: number
  tdee: number
  weeklyRate: number
}

/**
 * 保存减脂目标
 *
 * 只上传原始输入（档案 / 目标体重 / 周数），热量与营养素由服务端重算后返回。
 * 前端算出的 preview 仅用于即时预览，不参与落库。
 */
export async function saveGoal(
  profile: UserProfile,
  targetWeight: number,
  targetWeeks: number
): Promise<{ id: string; goal: SavedGoal }> {
  const res = await wx.cloud.callFunction({
    name: 'saveGoal',
    data: { profile, targetWeight, targetWeeks },
  })
  const result = res.result as {
    code: number
    id?: string
    goal?: SavedGoal
    msg?: string
    reason?: string
  }
  if (result.code !== 0) {
    const err = new Error(result.msg || '保存失败') as Error & { reason?: string }
    // reason 用于区分「极端目标被拦截」与「系统错误」，前端可据此走不同提示
    err.reason = result.reason
    throw err
  }
  return { id: result.id as string, goal: result.goal as SavedGoal }
}

/** 删除一条饮食记录 */
export async function deleteFoodLog(id: string): Promise<void> {
  const res = await db().collection(COLLECTIONS.foodLogs).doc(id).remove()
  if (res.stats.removed !== 1) {
    throw new Error('删除失败')
  }
}

/* ------------------------------------------------------------------ */
/* 本地聚合（不消耗数据库读写次数）                                     */
/* ------------------------------------------------------------------ */

export interface DailySummary {
  calorie: number
  protein: number
  fat: number
  carb: number
}

/** 汇总某批记录的热量与营养素 */
export function summarize(logs: FoodLogRecord[]): DailySummary {
  return logs.reduce<DailySummary>(
    (acc, log) => ({
      calorie: acc.calorie + (log.calorie || 0),
      protein: acc.protein + (log.protein || 0),
      fat: acc.fat + (log.fat || 0),
      carb: acc.carb + (log.carb || 0),
    }),
    { calorie: 0, protein: 0, fat: 0, carb: 0 }
  )
}

/** 按餐次分组 */
export function groupByMeal(
  logs: FoodLogRecord[]
): Record<FoodLogRecord['mealType'], FoodLogRecord[]> {
  const groups = {
    breakfast: [] as FoodLogRecord[],
    lunch: [] as FoodLogRecord[],
    dinner: [] as FoodLogRecord[],
    snack: [] as FoodLogRecord[],
  }
  for (const log of logs) {
    groups[log.mealType]?.push(log)
  }
  return groups
}

export type { WeightPoint }
