import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/render/:surveyId',
    component: () => import('../pages/IndexPage.vue'),
    children: [
      {
        path: '',
        name: 'renderPage',
        component: () => import('../pages/RenderPage.vue')
      },
      {
        path: 'success',
        name: 'successPage',
        component: () => import('../pages/SuccessPage.vue')
      },
      {
        path: 'error',
        name: 'errorPage',
        component: () => import('../pages/ErrorPage.vue')
      }
    ]
  },
  {
    path: '/:catchAll(.*)',
    name: 'emptyPage',
    component: () => import('../pages/EmptyPage.vue')
  }
]
const router = createRouter({
  history: createWebHistory('/'),
  routes
})

// 规范化异常路径：若发生跳转到 /management/render/...，强制改回 /render/...
router.beforeEach((to, _from, next) => {
  const full = to.fullPath || to.path
  console.log('full', full)
  if (full.startsWith('/management/render/')) {
    const normalized = full.replace(/^\/management/, '')
    next({ path: normalized, replace: true })
    console.log('normalized', normalized)
    return
  }
  next()
})

export default router

