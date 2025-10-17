<template>
  <router-view></router-view>
</template>
<script setup lang="ts">
import { onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getPublishedSurveyInfo, getPreviewSchema } from '../api/survey'
import AlertDialog from '../components/AlertDialog.vue'
import { useSurveyStore } from '../stores/survey'
import useCommandComponent from '../hooks/useCommandComponent'

const route = useRoute()
const router = useRouter()
const surveyStore = useSurveyStore()

if (typeof window !== 'undefined' && typeof history !== 'undefined') {
  const wrapHistoryMethod = (method: 'replaceState' | 'pushState') => {
    const original = history[method] as (...args: any[]) => any
    if (typeof original === 'function' && !(original as any).__wrapped__) {
      const wrapped = (...args: any[]) => {
        try {
          if (args && args.length >= 3 && typeof args[2] === 'string') {
            const incomingUrl = args[2] as string
            // 统一解析为绝对 URL，便于判断与改写
            const url = new URL(incomingUrl, window.location.origin)
            if (url.pathname.startsWith('/management/render/')) {
              const normalizedPath = url.pathname.replace(/^\/management/, '')
              const normalized = `${normalizedPath}${url.search}${url.hash}`
              console.log(`[history.${method}] normalize ->`, incomingUrl, '=>', normalized)
              args[2] = normalized
            }
          }
        } catch (_) {
          // ignore parse errors
        }
        console.log(`[history.${method}]`, ...args)
        return original.apply(history, args)
      }
      Object.defineProperty(wrapped, '__wrapped__', { value: true })
      history[method] = wrapped as typeof history[typeof method]
    }
  }
  wrapHistoryMethod('replaceState')
  wrapHistoryMethod('pushState')
  window.addEventListener('popstate', (event) => {
    console.log('[history.popstate]', window.location.href, event.state)
  })
}

const getQueryString = (value: unknown): string => (typeof value === 'string' ? value : '')

const parseControlWords = (value: string | null | undefined): string[] => {
  if (!value) return []
  return value
    .split(',')
    .map((segment) => decodeURIComponent(segment.trim()))
    .filter((segment) => segment.length > 0)
}

const buildCleanUrl = (surveyId: string): string => `/render/${surveyId}`

type CachedParams = {
  userId: string
  assessmentNo: string
  questionId: string
  tenantId: string
  redirect: string
  timestamp: string
  controlWords?: string[]
}

onMounted(() => {
  const surveyId = route.params.surveyId as string
  const alert = useCommandComponent(AlertDialog)

  console.log('[IndexPage] mount surveyId:', surveyId)
  console.log('[IndexPage] route query:', route.query)
  console.log('[IndexPage] location:', window.location.href)

  const redirect = getQueryString(route.query.redirect)
  const controlWordsParam =
    getQueryString(route.query.controlWords) || getQueryString(route.query.cw)
  const controlWords = parseControlWords(controlWordsParam)
  const sessionKey = `survey_params_${surveyId}`

  if (redirect) {
    const cachedParamsRaw = sessionStorage.getItem(sessionKey)
    console.log('[IndexPage] sessionKey:', sessionKey)
    console.log('[IndexPage] cached params:', cachedParamsRaw)

    if (cachedParamsRaw) {
      const params = JSON.parse(cachedParamsRaw) as CachedParams
      surveyStore.setSurveyPath(surveyId)
      surveyStore.setUserId(params.userId)
      surveyStore.setAssessmentNo(params.assessmentNo)
      surveyStore.setQuestionId(params.questionId)
      surveyStore.setTenantId(params.tenantId)
      surveyStore.setRedirectUrl(params.redirect)
      surveyStore.setControlWords(params.controlWords || [])
      console.log('[IndexPage] using cached params from sessionStorage')
      getDetail(surveyId, alert)
    } else {
      const params: CachedParams = {
        userId: getQueryString(route.query.userId),
        assessmentNo: getQueryString(route.query.assessmentNo),
        questionId: getQueryString(route.query.questionId),
        tenantId: getQueryString(route.query.tenantId),
        redirect,
        timestamp: getQueryString(route.query.t) || Date.now().toString(),
        controlWords
      }

      console.log('[IndexPage] parsed query params:', params)
      sessionStorage.setItem(sessionKey, JSON.stringify(params))
      console.log('[IndexPage] cached params to sessionStorage')

      surveyStore.setSurveyPath(surveyId)
      surveyStore.setUserId(params.userId)
      surveyStore.setAssessmentNo(params.assessmentNo)
      surveyStore.setQuestionId(params.questionId)
      surveyStore.setTenantId(params.tenantId)
      surveyStore.setRedirectUrl(params.redirect)
      surveyStore.setControlWords(params.controlWords || [])
      console.log('[IndexPage] stored params in survey store')

      const cleanUrl = buildCleanUrl(surveyId)
      console.log('[IndexPage] normalize url →', cleanUrl)
      console.log('[IndexPage] router history base →', router.options.history.base)

      getDetail(surveyId, alert)

      nextTick(() => {
        console.log('[IndexPage] replacing url...')
        router.replace(cleanUrl).then(() => {
          console.log('[IndexPage] url replace done')
        })
      })
    }
  } else {
    const userId = getQueryString(route.query.userId)
    const assessmentNo = getQueryString(route.query.assessmentNo)
    const questionId = getQueryString(route.query.questionId)
    const tenantId = getQueryString(route.query.tenantId)

    console.log('[IndexPage] use direct query params:', {
      userId,
      assessmentNo,
      questionId,
      tenantId
    })

    surveyStore.setSurveyPath(surveyId)
    surveyStore.setUserId(userId)
    surveyStore.setAssessmentNo(assessmentNo)
    surveyStore.setQuestionId(questionId)
    surveyStore.setTenantId(tenantId)
    surveyStore.setRedirectUrl('')
    surveyStore.setControlWords(controlWords)

    getDetail(surveyId, alert)
  }
})

const loadData = (res: any, surveyPath: string) => {
  if (res.code === 200) {
    const data = res.data
    const {
      bannerConf,
      baseConf,
      bottomConf,
      dataConf,
      skinConf,
      submitConf,
      logicConf,
      pageConf
    } = data.code

    const questionData = {
      bannerConf,
      baseConf,
      bottomConf,
      dataConf,
      skinConf,
      submitConf,
      pageConf
    }

    if (!pageConf || pageConf.length === 0) {
      questionData.pageConf = [dataConf.dataList.length]
    }

    document.title = data.title

    surveyStore.setSurveyPath(surveyPath)
    surveyStore.initSurvey(questionData)
    surveyStore.initShowLogicEngine(logicConf?.showLogicConf)
    surveyStore.initJumpLogicEngine(logicConf?.jumpLogicConf)
  } else {
    throw new Error(res.errmsg)
  }
}

const isObjectId = (id: string): boolean => /^[0-9a-fA-F]{24}$/.test(id)

const getDetail = async (surveyPath: string, alert: ReturnType<typeof useCommandComponent>) => {
  try {
    if (isObjectId(surveyPath)) {
      const res: any = await getPreviewSchema({ surveyPath })
      loadData(res, surveyPath)
    } else {
      const res: any = await getPublishedSurveyInfo({ surveyPath })
      loadData(res, surveyPath)
      surveyStore.getEncryptInfo()
    }
  } catch (error: unknown) {
    const err = error as Error
    console.error(err)
    alert({ title: err.message || 'Failed to load survey' })
  }
}
</script>
