import { getActiveGoal } from '../../services/db'

Page({
  data: {
    statusBarHeight: 44,
    hasGoal: false,
    currentWeight: '--',
    targetWeight: '--',
    weeklyRate: '--',
    calorieTarget: '--',
    estimatedWeeks: '--',
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 44 })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ active: 1 })
    }
    this.loadGoal()
  },

  async loadGoal() {
    try {
      const goal = await getActiveGoal()
      if (!goal) {
        this.setData({ hasGoal: false })
        return
      }
      const remaining = Math.max(goal.currentWeight - goal.targetWeight, 0)
      this.setData({
        hasGoal: true,
        currentWeight: goal.currentWeight.toFixed(1),
        targetWeight: goal.targetWeight.toFixed(1),
        weeklyRate: goal.weeklyRate.toFixed(1),
        calorieTarget: String(goal.calorieTarget),
        estimatedWeeks:
          goal.weeklyRate > 0 ? String(Math.ceil(remaining / goal.weeklyRate)) : '--',
      })
    } catch (err) {
      console.error('[plan] 加载目标失败', err)
    }
  },

  onGoGoal() {
    wx.navigateTo({ url: '/pages/goal/goal' })
  },
})
