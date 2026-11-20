import { defineConfig } from 'vitest/config'

// 教学版全球地貌图谱：Vite 配置。
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: {
        main: 'index.html',
        atlas: 'index2.html',
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
