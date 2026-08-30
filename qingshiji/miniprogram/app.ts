import { CLOUD_ENV_ID } from './config'

export interface GlobalData {
  /** 用户 openid，登录后写入 */
  openid: string
  /** 云开发是否已就绪 */
  cloudReady: boolean
}

App<{ globalData: GlobalData }>({
  globalData: {
    openid: '',
    cloudReady: false,
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('[轻食记] 当前基础库不支持云开发，请升级微信客户端')
      return
    }

    if (CLOUD_ENV_ID === 'YOUR_ENV_ID') {
      console.warn('[轻食记] 尚未配置云开发环境 ID，请修改 miniprogram/config.ts')
      return
    }

    try {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true,
      })
      this.globalData.cloudReady = true
    } catch (e) {
      // 初始化失败不能让整个 app 崩 —— 让用户至少能打开页面看本地状态
      console.error('[轻食记] 云开发初始化失败', e)
    }
  },
})
