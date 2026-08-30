import { MEAL_LABELS } from '../../config'
import {
  addFoodLog,
  buildPortionOptions,
  calcByPortion,
  getCommonFoods,
  searchFood,
  today,
} from '../../services/db'
import type { FoodItem } from '../../services/db'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

interface MealOption {
  value: MealType
  label: string
}

interface PortionOption {
  label: string
  grams: number
}

interface Preview {
  label: string
  grams: number
  calorie: number
  protein: number
  fat: number
  carb: number
}

const MEALS: MealOption[] = (
  ['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]
).map((value) => ({ value, label: MEAL_LABELS[value] }))

/**
 * 按当前时间推断默认餐次 —— 减少一次点击，
 * 这是产品「降低记录阻力」原则的具体落地。
 */
function guessMeal(): MealType {
  const h = new Date().getHours()
  if (h < 10) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

let searchTimer: ReturnType<typeof setTimeout> | null = null

Page({
  data: {
    statusBarHeight: 44,

    meals: MEALS,
    mealType: 'lunch' as MealType,
    /** 当前餐次中文名，用于保存按钮文案（声明为 string，避免字面量类型收窄） */
    mealLabel: MEAL_LABELS.lunch as string,

    keyword: '',
    foods: [] as FoodItem[],
    /** 当前列表是搜索结果还是常用列表 */
    isSearch: false,
    loading: false,

    /** 选中的食物及其份量选项 */
    selectedFood: null as FoodItem | null,
    portions: [] as PortionOption[],
    activeGrams: 0,
    preview: null as Preview | null,

    saving: false,
  },

  onLoad(options: Record<string, string | undefined> | undefined) {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const mealType =
      (options?.mealType as MealType) ||
      guessMeal()

    this.setData({
      statusBarHeight: info.statusBarHeight || 44,
      mealType,
      mealLabel: MEAL_LABELS[mealType],
    })

    this.loadCommon()
  },

  /* ---------------- 列表加载 ---------------- */

  async loadCommon() {
    try {
      const foods = await getCommonFoods(15)
      this.setData({ foods, isSearch: false, loading: false })
    } catch (err) {
      console.error('[record] 加载常用食物失败', err)
      this.setData({ loading: false })
    }
  },

  async doSearch(kw: string) {
    try {
      const foods = await searchFood(kw, 20)
      this.setData({ foods, isSearch: true, loading: false })
    } catch (err) {
      console.error('[record] 搜索失败', err)
      this.setData({ loading: false })
    }
  },

  /* ---------------- 交互 ---------------- */

  onMealChange(e: WechatMiniprogram.TouchEvent) {
    const mealType = e.currentTarget.dataset.value as MealType
    this.setData({ mealType, mealLabel: MEAL_LABELS[mealType] })
  },

  onSearchInput(e: WechatMiniprogram.Input) {
    const kw = e.detail.value
    this.setData({ keyword: kw })

    if (searchTimer) clearTimeout(searchTimer)
    if (!kw.trim()) {
      this.loadCommon()
      return
    }

    this.setData({ loading: true })
    // 防抖 300ms，避免每输入一个字都查库
    searchTimer = setTimeout(() => this.doSearch(kw), 300)
  },

  onClearSearch() {
    this.setData({ keyword: '' })
    this.loadCommon()
  },

  /** 选中食物：生成份量选项，默认选第一个，并算出营养预览 */
  onPickFood(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index)
    const food = this.data.foods[index]
    if (!food) return

    const portions = buildPortionOptions(food)
    const first = portions[0]
    const nutrition = calcByPortion(food, first.grams)

    this.setData({
      selectedFood: food,
      portions,
      activeGrams: first.grams,
      preview: {
        label: first.label,
        grams: first.grams,
        ...nutrition,
      },
    })
  },

  /** 切换份量：只重算营养，不重新查库 */
  onPickPortion(e: WechatMiniprogram.TouchEvent) {
    const grams = Number(e.currentTarget.dataset.grams)
    const food = this.data.selectedFood
    if (!food) return

    const label =
      this.data.portions.find((p) => p.grams === grams)?.label || `${grams}g`

    this.setData({
      activeGrams: grams,
      preview: { label, grams, ...calcByPortion(food, grams) },
    })
  },

  onCancelSelect() {
    this.setData({ selectedFood: null, portions: [], activeGrams: 0, preview: null })
  },

  /* ---------------- 保存 ---------------- */

  async onSave() {
    const food = this.data.selectedFood
    const preview = this.data.preview
    if (!food || !preview || this.data.saving) return

    this.setData({ saving: true })
    wx.showLoading({ title: '记录中', mask: true })

    try {
      await addFoodLog({
        date: today(),
        mealType: this.data.mealType,
        foodName: food.name,
        portion: preview.grams,
        portionLabel: preview.label,
        calorie: preview.calorie,
        protein: preview.protein,
        fat: preview.fat,
        carb: preview.carb,
        // 来自食物库的换算结果，不是 AI 估算
        source: 'library',
        isEstimated: false,
      })

      wx.hideLoading()
      this.setData({ saving: false })
      wx.showToast({
        title: `已记入${MEAL_LABELS[this.data.mealType]}`,
        icon: 'success',
      })
      setTimeout(() => wx.navigateBack(), 900)
    } catch (err) {
      wx.hideLoading()
      this.setData({ saving: false })
      const e = err as Error
      wx.showToast({ title: e.message || '记录失败', icon: 'none' })
    }
  },

  onBack() {
    wx.navigateBack()
  },
})
