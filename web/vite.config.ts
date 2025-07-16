import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'

import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

const isProd = process.env.NODE_ENV === 'production'

// https://vitejs.dev/config/
export default defineConfig({
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
  plugins: [
    vue(),
    vueJsx(),
    AutoImport({
      resolvers: [
        ElementPlusResolver(),
        // Auto import icon components
        IconsResolver({
          prefix: 'Icon'
        })
      ]
    }),
    Components({
      resolvers: [
        ElementPlusResolver({
          importStyle: 'sass'
        }),
        // Auto register icon components
        IconsResolver({
          enabledCollections: ['ep']
        })
      ]
    }),
    Icons({
      autoInstall: true
    })
  ],
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
    port: 8080,
    open: false, // 是否自动打开浏览器
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      },
      '/exportfile': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      },
      // 静态文件的默认存储文件夹
      '/userUpload': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    minify: false, // 禁用压缩
    rollupOptions: {
      input: {
        management: 'src/management/index.html',
        render: 'src/render/index.html'
      },
      treeshake: false, // 完全禁用 tree-shaking
      output: {
        assetFileNames: '[ext]/[name]-[hash].[ext]',
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        manualChunks: undefined // 禁用手动分包
      }
    }
  }
})
