import { buildNutritionTarget, validateGoal } from '../../core/nutrition'
import { saveGoal } from '../../services/db'
import { ACTIVITY_LABELS } from '../../core/types'
import type {
  ActivityLevel,
  Gender,
  GoalValidation,
  NutritionTarget,
  UserProfile,
} from '../../core/types'

/** 活动水平选项（顺序与 PRD 3.2 一致） */
const ACTIVITY_OPTIONS: Array<{ value: ActivityLevel; label: string }> = (
  [1.2, 1.375, 1.55, 1.725, 1.9] as ActivityLevel[]
).map((value) => ({ value, label: ACTIVITY_LABELS[value] }))

interface Preview {
  bmr: number
  tdee: number
  calorieTarget: number
  protein: number
  fat: number
  carb: number
  weeklyLoss: number
  estimatedWeeks: number
}

Page({
  data: {
    statusBarHeight: 44,

    // 表单
    gender: 'female' as Gender,
    birthYear: 1995,
    height: 165,
    weight: 60,
    activityLevel: 1.2 as ActivityLevel,
    targetWeight: 55,
    targetWeeks: 12,

    activityOptions: ACTIVITY_OPTIONS,

    // 计算结果
    preview: null as Preview | null,
    validation: null as GoalValidation | null,
    /** 是否已触发拦截 */
    blocked: false,
    /** 表单是否填写完整 */
    complete: false,
    /** 是否正在保存，防止重复提交 */
    saving: false,
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const year = new Date().getFullYear()
    this.setData({
      statusBarHeight: info.statusBarHeight || 44,
      birthYear: year - 28,
    })
    this.recalc()
  },

  /* ---------------- 表单交互 ---------------- */

  onBack() {
    this.goBack()
  },

  onGenderChange(e: WechatMiniprogram.TouchEvent) {
    this.setData({ gender: e.currentTarget.dataset.value as Gender }, () => this.recalc())
  },

  onActivityChange(e: WechatMiniprogram.TouchEvent) {
    const value = Number(e.currentTarget.dataset.value) as ActivityLevel
    this.setData({ activityLevel: value }, () => this.recalc())
  },

  onNumberInput(e: WechatMiniprogram.Input) {
    const field = e.currentTarget.dataset.field as
      | 'birthYear'
      | 'height'
      | 'weight'
      | 'targetWeight'
      | 'targetWeeks'
    const value = Number(e.detail.value)
    this.setData({ [field]: Number.isFinite(value) ? value : 0 } as never, () =>
      this.recalc()
    )
  },

  /* ---------------- 计算 ---------------- */

  buildProfile(): UserProfile {
    return {
      gender: this.data.gender,
      birthYear: this.data.birthYear,
      height: this.data.height,
      weight: this.data.weight,
      activityLevel: this.data.activityLevel,
    }
  },

  recalc() {
    const d = this.data
    const complete =
      d.height > 0 && d.weight > 0 && d.targetWeight > 0 && d.targetWeeks > 0

    if (!complete) {
      this.setData({ complete: false, preview: null, validation: null, blocked: false })
      return
    }

    const profile = this.buildProfile()
    const validation = validateGoal(profile, d.targetWeight, d.targetWeeks)

    let preview: Preview
    if (validation.valid && validation.assessment) {
      const target: NutritionTarget = buildNutritionTarget(
        profile,
        validation.assessment.weeklyLossKg
      )
      preview = {
        bmr: target.bmr,
        tdee: target.tdee,
        calorieTarget: target.calorieTarget,
        protein: target.protein,
        fat: target.fat,
        carb: target.carb,
        weeklyLoss: validation.assessment.weeklyLossKg,
        estimatedWeeks: d.targetWeeks,
      }
    } else if (validation.suggestion) {
      const n = validation.suggestion.nutrition
      preview = {
        bmr: n.bmr,
        tdee: n.tdee,
        calorieTarget: n.calorieTarget,
        protein: n.protein,
        fat: n.fat,
        carb: n.carb,
        weeklyLoss: validation.suggestion.weeklyLossKg,
        estimatedWeeks: validation.suggestion.estimatedWeeks,
      }
    } else {
      preview = null as unknown as Preview
    }

    this.setData({
      complete: true,
      preview,
      validation,
      blocked: !validation.valid,
    })
  },

  /* ---------------- 采纳建议 / 保存 ---------------- */

  /** 采纳系统给出的替代方案：把建议速率换算成周数回填 */
  onAcceptSuggestion() {
    const s = this.data.validation?.suggestion
    if (!s) return
    const loss = Math.max(this.data.weight - this.data.targetWeight, 0)
    const weeks = s.weeklyLossKg > 0 ? Math.ceil(loss / s.weeklyLossKg) : 1
    this.setData({ targetWeeks: weeks }, () => this.recalc())
    wx.showToast({ title: `已调整为 ${weeks} 周`, icon: 'none' })
  },

  async onSave() {
    if (this.data.blocked) {
      wx.showModal({
        title: '目标不可执行',
        content: '当前目标未通过安全校验，请先采纳建议方案或调整目标。',
        showCancel: false,
      })
      return
    }

    if (this.data.saving) return

    this.setData({ saving: true })
    wx.showLoading({ title: '生成方案中', mask: true })

    try {
      // 只传原始输入，热量与营养素由服务端重算
      const { id, goal } = await saveGoal(
        this.buildProfile(),
        this.data.targetWeight,
        this.data.targetWeeks
      )

      wx.hideLoading()
      this.setData({ saving: false })
      console.log('[goal] 目标已保存', id, goal)

      wx.showToast({
        title: `每日 ${goal.calorieTarget} 大卡`,
        icon: 'none',
        duration: 1500,
      })

      // 延迟返回，让 toast 先展示完；返回后上一页 onShow 会重新拉数据
      setTimeout(() => this.goBack(), 1200)
    } catch (err) {
      wx.hideLoading()
      this.setData({ saving: false })

      const e = err as Error & { reason?: string }
      console.error('[goal] 保存失败', e)

      // reason 存在说明是安全规则拦截，用弹窗说清楚；否则是系统错误
      if (e.reason) {
        wx.showModal({
          title: '目标不可执行',
          content: e.message,
          showCancel: false,
        })
      } else {
        wx.showToast({ title: e.message || '保存失败', icon: 'none' })
      }
    }
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
    } else {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },
})
