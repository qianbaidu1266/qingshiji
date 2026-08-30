import { getActiveGoal, getLogsByDate, groupByMeal, summarize, today } from '../../services/db'
import { MEAL_LABELS } from '../../config'
import type { GoalRecord } from '../../services/db'

interface MealGroup {
  key: keyof typeof MEAL_LABELS
  label: string
  items: Array<{ name: string; desc: string; calorie: number; estimated: boolean }>
  total: number
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

Page({
  data: {
    statusBarHeight: 44,
    dateText: '',
    weekdayText: '',
    streak: 0,
    calorie: 0,
    calorieTarget: 0,
    /** 环形进度百分比 0–100 */
    progress: 0,
    remain: 0,
    protein: 0,
    fat: 0,
    carb: 0,
    proteinTarget: 0,
    fatTarget: 0,
    carbTarget: 0,
    meals: [] as MealGroup[],
    hasGoal: false,
    loading: true,
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 44 })
  },

  onShow() {
    // 同步自定义 tabBar 的选中态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ active: 0 })
    }
    this.loadToday()
  },

  async loadToday() {
    const date = today()
    const d = new Date()
    this.setData({
      dateText: `${d.getMonth() + 1}月${d.getDate()}日`,
      weekdayText: WEEKDAYS[d.getDay()],
    })

    try {
      // 目标与记录并行拉取
      const [goal, logs] = await Promise.all([
        getActiveGoal(),
        getLogsByDate(date),
      ])

      const sum = summarize(logs)
      const groups = groupByMeal(logs)

      const meals: MealGroup[] = (
        ['breakfast', 'lunch', 'dinner', 'snack'] as const
      )
        .filter((key) => groups[key].length > 0)
        .map((key) => ({
          key,
          label: MEAL_LABELS[key],
          items: groups[key].map((log) => ({
            name: log.foodName,
            desc: log.portionLabel || `${log.portion}g`,
            calorie: log.calorie,
            estimated: log.isEstimated,
          })),
          total: summarize(groups[key]).calorie,
        }))

      this.applyGoal(goal)
      this.setData({
        calorie: sum.calorie,
        protein: sum.protein,
        fat: sum.fat,
        carb: sum.carb,
        meals,
        hasGoal: goal !== null,
        loading: false,
      })
      this.updateProgress(sum.calorie)
    } catch (err) {
      console.error('[index] 加载今日数据失败', err)
      this.setData({ loading: false })
    }
  },

  applyGoal(goal: GoalRecord | null) {
    if (!goal) {
      this.setData({ calorieTarget: 0, proteinTarget: 0, fatTarget: 0, carbTarget: 0 })
      return
    }
    this.setData({
      calorieTarget: goal.calorieTarget,
      proteinTarget: goal.proteinTarget,
      fatTarget: goal.fatTarget,
      carbTarget: goal.carbTarget,
    })
  },

  updateProgress(calorie: number) {
    const target = this.data.calorieTarget
    if (!target) {
      this.setData({ progress: 0, remain: 0 })
      return
    }
    const ratio = Math.min(calorie / target, 1)
    this.setData({
      progress: Math.round(ratio * 100),
      remain: Math.max(target - calorie, 0),
    })
  },

  onCamera() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: (res) => {
        const file = res.tempFiles[0]
        wx.showToast({ title: '识别功能待接入', icon: 'none' })
        console.log('[index] 已选择图片', file.tempFilePath, file.size)
      },
      fail: () => {
        // 用户取消，不提示
      },
    })
  },

  onManual() {
    wx.showToast({ title: '手动记录待接入', icon: 'none' })
  },

  onGoGoal() {
    wx.navigateTo({ url: '/pages/goal/goal' })
  },
})
