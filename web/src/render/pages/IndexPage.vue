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
              args[2] = normalized
            }
          }
        } catch (_) {
          // ignore parse errors
        }
        return original.apply(history, args)
      }
      Object.defineProperty(wrapped, '__wrapped__', { value: true })
      history[method] = wrapped as typeof history[typeof method]
    }
  }
  wrapHistoryMethod('replaceState')
  wrapHistoryMethod('pushState')
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

  const redirect = getQueryString(route.query.redirect)
  const controlWordsParam =
    getQueryString(route.query.controlWords) || getQueryString(route.query.cw)
  const controlWords = parseControlWords(controlWordsParam)
  const sessionKey = `survey_params_${surveyId}`

  if (redirect) {
    const cachedParamsRaw = sessionStorage.getItem(sessionKey)

    if (cachedParamsRaw) {
      const params = JSON.parse(cachedParamsRaw) as CachedParams
      surveyStore.setSurveyPath(surveyId)
      surveyStore.setUserId(params.userId)
      surveyStore.setAssessmentNo(params.assessmentNo)
      surveyStore.setQuestionId(params.questionId)
      surveyStore.setTenantId(params.tenantId)
      surveyStore.setRedirectUrl(params.redirect)
      surveyStore.setControlWords(params.controlWords || [])
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

      sessionStorage.setItem(sessionKey, JSON.stringify(params))

      surveyStore.setSurveyPath(surveyId)
      surveyStore.setUserId(params.userId)
      surveyStore.setAssessmentNo(params.assessmentNo)
      surveyStore.setQuestionId(params.questionId)
      surveyStore.setTenantId(params.tenantId)
      surveyStore.setRedirectUrl(params.redirect)
      surveyStore.setControlWords(params.controlWords || [])

      const cleanUrl = buildCleanUrl(surveyId)

      getDetail(surveyId, alert)

      nextTick(() => {
        router.replace(cleanUrl)
      })
    }
  } else {
    const userId = getQueryString(route.query.userId)
    const assessmentNo = getQueryString(route.query.assessmentNo)
    const questionId = getQueryString(route.query.questionId)
    const tenantId = getQueryString(route.query.tenantId)

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

    // 根据题目的 oneQuestionPerPage 配置生成分页
    // 无论后端是否返回 pageConf，都根据题目配置重新生成
    const generatedPageConf: number[] = []
    const dataList = dataConf.dataList || []

    let currentPageCount = 0

    for (let i = 0; i < dataList.length; i++) {
      const question = dataList[i]
      // 默认启用一页一题，除非明确设置为 false
      const oneQuestionPerPage = question.oneQuestionPerPage !== false

      if (oneQuestionPerPage) {
        // 如果当前页已有题目，先保存当前页
        if (currentPageCount > 0) {
          generatedPageConf.push(currentPageCount)
          currentPageCount = 0
        }
        // 当前题目单独一页
        generatedPageConf.push(1)
      } else {
        // 累加到当前页
        currentPageCount++
      }
    }

    // 处理最后一页
    if (currentPageCount > 0) {
      generatedPageConf.push(currentPageCount)
    }

    // 使用生成的分页配置，如果生成失败则使用后端返回的，最后兜底为所有题目在一页
    if (generatedPageConf.length > 0) {
      questionData.pageConf = generatedPageConf
    } else if (!pageConf || pageConf.length === 0) {
      questionData.pageConf = [dataList.length]
    }

    console.log('[分页配置] 最终使用的分页配置:', questionData.pageConf)

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
