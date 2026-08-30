import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // 测试统一放在 tests/ 下
    // ⚠️ 不要放回 miniprogram/ —— 小程序会编译该目录下所有 .ts，
    //    测试文件引用的 vitest 在小程序环境不存在，会导致编译失败
    include: ['tests/**/*.test.ts'],
  },
})
