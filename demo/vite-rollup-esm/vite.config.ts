import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// custom-svga 已通过 npm pack + file: 依赖安装到 node_modules，
// 直接使用 package.json 的 exports 解析真实 ESM 产物。
export default defineConfig({
  base: './',
  plugins: [vue()],
  server: {
    port: 5173,
    // 不自动打开浏览器：避免每次重启 dev server 都新增一个浏览器页签
    // 请使用已打开的页面（vite 热更新会自动生效）
    // 通过同源代理规避 .svga 资源的跨域限制（dev 期）
    proxy: {
      '/svga': {
        target: 'https://nexa.res.wooyavip.com',
        changeOrigin: true,
      },
    },
  },
})