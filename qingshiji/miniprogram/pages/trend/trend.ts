import { getWeightLogs } from '../../services/db'
import { calcTrend, movingAverage } from '../../core/nutrition'

interface TrendPoint {
  date: string
  weight: number
  average: number | null
}

Page({
  data: {
    statusBarHeight: 44,
    points: [] as TrendPoint[],
    hasData: false,
    trendText: '暂无足够数据',
    latestAverage: '--',
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 44 })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ active: 2 })
    }
    this.loadTrend()
  },

  async loadTrend() {
    try {
      const logs = await getWeightLogs()
      if (logs.length === 0) {
        this.setData({ hasData: false })
        return
      }

      const points = movingAverage(logs)
      const trend = calcTrend(logs)

      let trendText = '数据积累中，满 14 天后显示周环比'
      if (trend.sufficient) {
        trendText =
          trend.delta < 0
            ? `近 7 天平均下降 ${Math.abs(trend.delta).toFixed(1)} kg`
            : trend.delta > 0
              ? `近 7 天平均上升 ${trend.delta.toFixed(1)} kg`
              : '近 7 天基本持平'
      }

      const lastWithAverage = [...points].reverse().find((p) => p.average !== null)

      this.setData({
        hasData: true,
        points,
        trendText,
        latestAverage: lastWithAverage?.average != null
          ? lastWithAverage.average.toFixed(1)
          : '--',
      })
    } catch (err) {
      console.error('[trend] 加载体重数据失败', err)
    }
  },

  onAddWeight() {
    wx.showToast({ title: '体重记录待接入', icon: 'none' })
  },
})
