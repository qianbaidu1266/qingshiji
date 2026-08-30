Page({
  data: {
    statusBarHeight: 44,
    nickname: '未登录',
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ statusBarHeight: info.statusBarHeight || 44 })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ active: 3 })
    }
  },

  onNotReady() {
    wx.showToast({ title: '功能开发中', icon: 'none' })
  },

  onGoGoal() {
    wx.navigateTo({ url: '/pages/goal/goal' })
  },
})
