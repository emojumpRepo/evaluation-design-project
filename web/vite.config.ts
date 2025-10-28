import { fileURLToPath, URL } from 'node:url'
import { defineConfig, normalizePath } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

import { createMpaPlugin, createPages } from 'vite-plugin-virtual-mpa'

import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'

import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

const isProd = process.env.NODE_ENV === 'production'

let mpaPlugin = null
// 生产环境才使用 mpaPlugin，在生产环境，Vite 会生成多个 HTML 文件
// 开发环境由 Vite Dev Server 和 rewrites 规则处理
// 但是，vite-plugin-virtual-mpa 建议在 dev 环境也使用
if (!isProd) {
  // 保持在非生产环境启用
  const pages = createPages([
    {
      name: 'management',
      filename: 'src/management/index.html', // 源文件路径
      template: 'src/management/index.html',
      entry: '/src/management/main.js' // 源文件路径
    },
    {
      name: 'render',
      filename: 'src/render/index.html',
      template: 'src/render/index.html',
      entry: '/src/render/main.js'
    }
  ])

  mpaPlugin = createMpaPlugin({
    pages,
    verbose: true,
    rewrites: [
      // 捕获 /management/preview 或 /management/preview/xxx
      {
        from: /^\/management\/preview($|\/.*)/,
        to: () => normalizePath('/src/render/index.html')
      },
      // 捕获 /management 或 /management/xxx
      {
        from: /^\/management($|\/.*)/,
        to: () => normalizePath('/src/management/index.html')
      },
      // 捕获 /render 或 /render/xxx
      {
        from: /^\/render($|\/.*)/,
        to: () => normalizePath('/src/render/index.html')
      },
      // 根路径也重写到 management 应用的 HTML
      {
        from: /^\/$/,
        to: () => normalizePath('/src/management/index.html')
      }
    ]
  })
}

const basePlugins = [
  vue(),
  vueJsx(),
  AutoImport({ resolvers: [ElementPlusResolver(), IconsResolver({ prefix: 'Icon' })] }),
  Components({
    resolvers: [
      ElementPlusResolver({ importStyle: 'sass' }),
      IconsResolver({ enabledCollections: ['ep'] })
    ]
  }),
  Icons({ autoInstall: true })
]

const plugins = isProd ? basePlugins : [...basePlugins, mpaPlugin]

export default defineConfig({
  // 生产环境统一使用根路径
  base: '/',

  optimizeDeps: {
    include: [
      'lodash-es',
      'async-validator',
      'vuedraggable',
      'element-plus/es',
      '@wangeditor/editor-for-vue',
      'element-plus/es/components/*/style/index',
      'element-plus/dist/locale/zh-cn.mjs',
      'copy-to-clipboard',
      'qrcode',
      'moment',
      'moment/locale/zh-cn',
      'echarts',
      'nanoid',
      'yup',
      'crypto-js/sha256',
      'element-plus/es/locale/lang/zh-cn',
      'node-forge',
      '@logicflow/core',
      '@logicflow/extension'
    ]
  },
  plugins,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@management': fileURLToPath(new URL('./src/management', import.meta.url)),
      '@materials': fileURLToPath(new URL('./src/materials', import.meta.url)),
      '@render': fileURLToPath(new URL('./src/render', import.meta.url))
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        additionalData: `@use "@/management/styles/element-variables.scss" as *;`
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 8085,
    open: false,
    allowedHosts: ['vwbcvsukxihy.sealoshzh.site'],
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/exportfile': { target: 'http://127.0.0.1:3000', changeOrigin: true },
      '/userUpload': { target: 'http://127.0.0.1:3000', changeOrigin: true }
    }
  },
  build: {
    minify: false,
    rollupOptions: {
      input: { management: 'src/management/index.html', render: 'src/render/index.html' },
      treeshake: false,
      output: {
        // 这些 output 路径是针对 base 设置的，只有在生产环境 base 才生效
        assetFileNames: '[ext]/[name]-[hash].[ext]',
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        manualChunks: undefined
      }
    }
  }
})
