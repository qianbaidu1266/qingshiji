/**
 * 食物库种子数据
 *
 * 选品原则（对应产品核心判断）：
 *   **上班族根本不做饭**。真实场景是外卖 / 食堂 / 便利店 / 快餐，
 *   所以本库不收录「需要下厨的原料菜谱」，只收录用户真正会吃到的成品。
 *
 * 数据口径：每 100g 可食部的热量（kcal）与三大营养素（g），
 * 取值参考常见食物成分表，为同类食物的代表值，非实验室精确值。
 *
 * ⚠️ 这是静态营养数据，不属于「计算」，可以硬编码。
 *    但 BMR/TDEE/目标热量等**推导数字**仍由 nutrition.js 计算，不要混为一谈。
 */

/** 常见份量简写，避免每条重复写 */
const BOWL = { label: '1碗', grams: 200 }
const PLATE = { label: '1份', grams: 300 }
const CUP = { label: '1杯', grams: 250 }
const PIECE = { label: '1个', grams: 100 }

module.exports = [
  /* ---------------- 主食（食堂/外卖必点） ---------------- */
  { name: '米饭', aliases: ['白米饭', '大米饭'], category: '主食',
    caloriePer100g: 116, proteinPer100g: 2.6, fatPer100g: 0.3, carbPer100g: 25.9,
    commonPortions: [BOWL, { label: '小碗', grams: 150 }] },
  { name: '馒头', aliases: ['白面馒头'], category: '主食',
    caloriePer100g: 223, proteinPer100g: 7.0, fatPer100g: 1.1, carbPer100g: 47.0,
    commonPortions: [{ label: '1个', grams: 100 }] },
  { name: '面条', aliases: ['清汤面', '阳春面'], category: '主食',
    caloriePer100g: 110, proteinPer100g: 3.9, fatPer100g: 0.4, carbPer100g: 21.6,
    commonPortions: [BOWL] },
  { name: '白粥', aliases: ['大米粥', '稀饭'], category: '主食',
    caloriePer100g: 46, proteinPer100g: 1.1, fatPer100g: 0.3, carbPer100g: 9.9,
    commonPortions: [BOWL] },
  { name: '肉包子', aliases: ['包子'], category: '主食',
    caloriePer100g: 227, proteinPer100g: 7.0, fatPer100g: 8.0, carbPer100g: 30.0,
    commonPortions: [{ label: '1个', grams: 100 }] },
  { name: '猪肉饺子', aliases: ['饺子', '水饺'], category: '主食',
    caloriePer100g: 240, proteinPer100g: 9.0, fatPer100g: 10.0, carbPer100g: 28.0,
    commonPortions: [{ label: '10个', grams: 250 }] },
  { name: '蛋炒饭', aliases: ['炒饭'], category: '主食',
    caloriePer100g: 188, proteinPer100g: 4.5, fatPer100g: 6.0, carbPer100g: 29.0,
    commonPortions: [PLATE] },
  { name: '炒面', aliases: ['炒面条'], category: '主食',
    caloriePer100g: 200, proteinPer100g: 5.0, fatPer100g: 7.0, carbPer100g: 30.0,
    commonPortions: [PLATE] },
  { name: '全麦面包', aliases: ['吐司', '面包'], category: '主食',
    caloriePer100g: 246, proteinPer100g: 9.0, fatPer100g: 3.2, carbPer100g: 45.0,
    commonPortions: [{ label: '1片', grams: 40 }] },
  { name: '燕麦片', aliases: ['燕麦', '麦片'], category: '主食',
    caloriePer100g: 367, proteinPer100g: 15.0, fatPer100g: 6.7, carbPer100g: 61.0,
    commonPortions: [{ label: '1份', grams: 40 }] },

  /* ---------------- 外卖荤菜 ---------------- */
  { name: '宫保鸡丁', aliases: ['宫爆鸡丁'], category: '外卖荤菜',
    caloriePer100g: 180, proteinPer100g: 12.0, fatPer100g: 11.0, carbPer100g: 8.0,
    commonPortions: [PLATE] },
  { name: '鱼香肉丝', aliases: [], category: '外卖荤菜',
    caloriePer100g: 170, proteinPer100g: 9.0, fatPer100g: 10.0, carbPer100g: 10.0,
    commonPortions: [PLATE] },
  { name: '红烧肉', aliases: ['五花肉'], category: '外卖荤菜',
    caloriePer100g: 472, proteinPer100g: 8.0, fatPer100g: 45.0, carbPer100g: 5.0,
    commonPortions: [{ label: '1份', grams: 150 }] },
  { name: '糖醋排骨', aliases: ['排骨'], category: '外卖荤菜',
    caloriePer100g: 280, proteinPer100g: 14.0, fatPer100g: 18.0, carbPer100g: 15.0,
    commonPortions: [{ label: '1份', grams: 200 }] },
  { name: '水煮牛肉', aliases: ['水煮肉片'], category: '外卖荤菜',
    caloriePer100g: 190, proteinPer100g: 15.0, fatPer100g: 12.0, carbPer100g: 5.0,
    commonPortions: [PLATE] },
  { name: '麻婆豆腐', aliases: [], category: '外卖荤菜',
    caloriePer100g: 135, proteinPer100g: 8.0, fatPer100g: 9.0, carbPer100g: 6.0,
    commonPortions: [PLATE] },
  { name: '咖喱鸡', aliases: ['咖喱鸡肉'], category: '外卖荤菜',
    caloriePer100g: 160, proteinPer100g: 11.0, fatPer100g: 9.0, carbPer100g: 9.0,
    commonPortions: [PLATE] },
  { name: '黄焖鸡', aliases: ['黄焖鸡米饭'], category: '外卖荤菜',
    caloriePer100g: 165, proteinPer100g: 10.0, fatPer100g: 9.5, carbPer100g: 9.0,
    commonPortions: [PLATE] },
  { name: '酸菜鱼', aliases: [], category: '外卖荤菜',
    caloriePer100g: 120, proteinPer100g: 12.0, fatPer100g: 6.5, carbPer100g: 3.0,
    commonPortions: [PLATE] },

  /* ---------------- 食堂素菜 ---------------- */
  { name: '炒青菜', aliases: ['清炒时蔬', '青菜'], category: '素菜',
    caloriePer100g: 45, proteinPer100g: 2.0, fatPer100g: 2.5, carbPer100g: 4.0,
    commonPortions: [{ label: '1份', grams: 200 }] },
  { name: '番茄炒蛋', aliases: ['西红柿炒鸡蛋'], category: '素菜',
    caloriePer100g: 105, proteinPer100g: 6.0, fatPer100g: 7.5, carbPer100g: 4.0,
    commonPortions: [PLATE] },
  { name: '酸辣土豆丝', aliases: ['土豆丝'], category: '素菜',
    caloriePer100g: 95, proteinPer100g: 1.5, fatPer100g: 4.0, carbPer100g: 14.0,
    commonPortions: [{ label: '1份', grams: 200 }] },
  { name: '地三鲜', aliases: [], category: '素菜',
    caloriePer100g: 120, proteinPer100g: 2.5, fatPer100g: 8.0, carbPer100g: 10.0,
    commonPortions: [PLATE] },
  { name: '干煸豆角', aliases: ['四季豆'], category: '素菜',
    caloriePer100g: 110, proteinPer100g: 3.0, fatPer100g: 7.0, carbPer100g: 9.0,
    commonPortions: [{ label: '1份', grams: 200 }] },
  { name: '蒜蓉西兰花', aliases: ['西兰花'], category: '素菜',
    caloriePer100g: 60, proteinPer100g: 3.0, fatPer100g: 3.5, carbPer100g: 5.0,
    commonPortions: [{ label: '1份', grams: 200 }] },
  { name: '手撕包菜', aliases: ['炒包菜', '卷心菜'], category: '素菜',
    caloriePer100g: 70, proteinPer100g: 1.8, fatPer100g: 4.5, carbPer100g: 6.0,
    commonPortions: [{ label: '1份', grams: 200 }] },

  /* ---------------- 快餐 ---------------- */
  { name: '汉堡', aliases: ['汉堡包'], category: '快餐',
    caloriePer100g: 250, proteinPer100g: 12.0, fatPer100g: 10.0, carbPer100g: 28.0,
    commonPortions: [{ label: '1个', grams: 180 }] },
  { name: '炸鸡', aliases: ['炸鸡腿', '炸鸡块'], category: '快餐',
    caloriePer100g: 280, proteinPer100g: 18.0, fatPer100g: 18.0, carbPer100g: 12.0,
    commonPortions: [{ label: '1块', grams: 80 }] },
  { name: '薯条', aliases: ['炸薯条'], category: '快餐',
    caloriePer100g: 312, proteinPer100g: 3.5, fatPer100g: 15.0, carbPer100g: 41.0,
    commonPortions: [{ label: '中份', grams: 110 }] },
  { name: '披萨', aliases: ['比萨'], category: '快餐',
    caloriePer100g: 266, proteinPer100g: 11.0, fatPer100g: 10.0, carbPer100g: 33.0,
    commonPortions: [{ label: '1块', grams: 100 }] },
  { name: '三明治', aliases: [], category: '快餐',
    caloriePer100g: 250, proteinPer100g: 12.0, fatPer100g: 9.0, carbPer100g: 30.0,
    commonPortions: [{ label: '1个', grams: 180 }] },

  /* ---------------- 便利店 ---------------- */
  { name: '饭团', aliases: ['三角饭团'], category: '便利店',
    caloriePer100g: 180, proteinPer100g: 4.0, fatPer100g: 2.0, carbPer100g: 36.0,
    commonPortions: [{ label: '1个', grams: 110 }] },
  { name: '茶叶蛋', aliases: ['卤蛋'], category: '便利店',
    caloriePer100g: 145, proteinPer100g: 13.0, fatPer100g: 10.0, carbPer100g: 1.5,
    commonPortions: [{ label: '1个', grams: 55 }] },
  { name: '关东煮萝卜', aliases: ['关东煮'], category: '便利店',
    caloriePer100g: 20, proteinPer100g: 0.6, fatPer100g: 0.1, carbPer100g: 4.0,
    commonPortions: [{ label: '1串', grams: 80 }] },

  /* ---------------- 早餐 ---------------- */
  { name: '水煮蛋', aliases: ['白煮蛋', '鸡蛋'], category: '早餐',
    caloriePer100g: 144, proteinPer100g: 13.0, fatPer100g: 9.5, carbPer100g: 1.0,
    commonPortions: [{ label: '1个', grams: 50 }] },
  { name: '豆浆', aliases: [], category: '早餐',
    caloriePer100g: 31, proteinPer100g: 3.0, fatPer100g: 1.6, carbPer100g: 1.2,
    commonPortions: [CUP] },
  { name: '油条', aliases: [], category: '早餐',
    caloriePer100g: 388, proteinPer100g: 6.9, fatPer100g: 17.6, carbPer100g: 51.0,
    commonPortions: [{ label: '1根', grams: 60 }] },
  { name: '小笼包', aliases: ['小笼'], category: '早餐',
    caloriePer100g: 230, proteinPer100g: 8.0, fatPer100g: 9.0, carbPer100g: 29.0,
    commonPortions: [{ label: '1笼', grams: 200 }] },

  /* ---------------- 蛋白类（健康选餐用） ---------------- */
  { name: '鸡胸肉', aliases: ['鸡胸'], category: '蛋白',
    caloriePer100g: 133, proteinPer100g: 19.4, fatPer100g: 5.0, carbPer100g: 2.5,
    commonPortions: [{ label: '1块', grams: 150 }] },
  { name: '牛肉', aliases: ['瘦牛肉'], category: '蛋白',
    caloriePer100g: 125, proteinPer100g: 20.2, fatPer100g: 4.2, carbPer100g: 1.2,
    commonPortions: [{ label: '1份', grams: 150 }] },
  { name: '三文鱼', aliases: ['鲑鱼'], category: '蛋白',
    caloriePer100g: 139, proteinPer100g: 17.2, fatPer100g: 7.8, carbPer100g: 0,
    commonPortions: [{ label: '1份', grams: 120 }] },
  { name: '豆腐', aliases: ['北豆腐'], category: '蛋白',
    caloriePer100g: 81, proteinPer100g: 8.1, fatPer100g: 3.7, carbPer100g: 4.2,
    commonPortions: [{ label: '1份', grams: 200 }] },
  { name: '虾仁', aliases: ['虾'], category: '蛋白',
    caloriePer100g: 93, proteinPer100g: 18.6, fatPer100g: 0.8, carbPer100g: 2.8,
    commonPortions: [{ label: '1份', grams: 100 }] },

  /* ---------------- 水果 ---------------- */
  { name: '苹果', aliases: [], category: '水果',
    caloriePer100g: 52, proteinPer100g: 0.3, fatPer100g: 0.2, carbPer100g: 13.8,
    commonPortions: [{ label: '1个', grams: 200 }] },
  { name: '香蕉', aliases: [], category: '水果',
    caloriePer100g: 89, proteinPer100g: 1.1, fatPer100g: 0.3, carbPer100g: 22.8,
    commonPortions: [{ label: '1根', grams: 120 }] },
  { name: '橙子', aliases: ['橘子'], category: '水果',
    caloriePer100g: 47, proteinPer100g: 0.9, fatPer100g: 0.1, carbPer100g: 11.8,
    commonPortions: [{ label: '1个', grams: 180 }] },
  { name: '西瓜', aliases: [], category: '水果',
    caloriePer100g: 30, proteinPer100g: 0.6, fatPer100g: 0.2, carbPer100g: 7.6,
    commonPortions: [{ label: '1份', grams: 300 }] },

  /* ---------------- 饮品 ---------------- */
  { name: '牛奶', aliases: ['纯牛奶'], category: '饮品',
    caloriePer100g: 54, proteinPer100g: 3.0, fatPer100g: 3.2, carbPer100g: 3.4,
    commonPortions: [CUP] },
  { name: '酸奶', aliases: ['无糖酸奶'], category: '饮品',
    caloriePer100g: 72, proteinPer100g: 2.5, fatPer100g: 2.7, carbPer100g: 9.3,
    commonPortions: [{ label: '1杯', grams: 150 }] },
  { name: '美式咖啡', aliases: ['黑咖啡', '美式'], category: '饮品',
    caloriePer100g: 2, proteinPer100g: 0.1, fatPer100g: 0, carbPer100g: 0.3,
    commonPortions: [CUP] },
  { name: '拿铁', aliases: ['拿铁咖啡'], category: '饮品',
    caloriePer100g: 47, proteinPer100g: 3.0, fatPer100g: 2.4, carbPer100g: 3.6,
    commonPortions: [{ label: '1杯', grams: 300 }] },
  { name: '奶茶', aliases: ['珍珠奶茶'], category: '饮品',
    caloriePer100g: 70, proteinPer100g: 1.0, fatPer100g: 2.5, carbPer100g: 10.0,
    commonPortions: [{ label: '1杯', grams: 500 }] },
  { name: '可乐', aliases: ['碳酸饮料'], category: '饮品',
    caloriePer100g: 43, proteinPer100g: 0, fatPer100g: 0, carbPer100g: 10.8,
    commonPortions: [{ label: '1罐', grams: 330 }] },
]
