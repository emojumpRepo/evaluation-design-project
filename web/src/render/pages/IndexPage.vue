<template>
  <router-view></router-view>
</template>
<script setup lang="ts">
import { watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getPublishedSurveyInfo, getPreviewSchema } from '../api/survey'
import AlertDialog from '../components/AlertDialog.vue'
import { useSurveyStore } from '../stores/survey'
import useCommandComponent from '../hooks/useCommandComponent'

const route = useRoute()
const router = useRouter()
const surveyStore = useSurveyStore()

watch(
  () => route.query.t,
  (t) => {
    if (t) location.reload()
  }
)

onMounted(() => {
  const surveyId = route.params.surveyId as string
  const alert = useCommandComponent(AlertDialog)
  
  console.log('IndexPage onMounted - surveyId:', surveyId)
  console.log('IndexPage onMounted - route.query:', route.query)
  console.log('IndexPage onMounted - full URL:', window.location.href)
  
  // 检查sessionStorage中是否已有参数
  const sessionKey = `survey_params_${surveyId}`
  const cachedParams = sessionStorage.getItem(sessionKey)
  
  console.log('IndexPage - sessionKey:', sessionKey)
  console.log('IndexPage - cachedParams:', cachedParams)
  
  if (cachedParams) {
    // 如果已有缓存参数，使用缓存的参数
    const params = JSON.parse(cachedParams)
    surveyStore.setSurveyPath(surveyId)
    surveyStore.setUserId(params.userId)
    surveyStore.setAssessmentNo(params.assessmentNo)
    surveyStore.setQuestionId(params.questionId)
    surveyStore.setTenantId(params.tenantId)
    surveyStore.setRedirectUrl(params.redirect)
    console.log('使用缓存的参数:', params)
    getDetail(surveyId)
  } else if (route.query.userId || route.query.assessmentNo || route.query.questionId || route.query.tenantId || route.query.redirect) {
    console.log('检测到URL参数，准备缓存和跳转')
    // 如果URL中有参数，验证必填参数并缓存
    const userId = route.query.userId as string
    const assessmentNo = route.query.assessmentNo as string
    const questionId = route.query.questionId as string
    const tenantId = route.query.tenantId as string
    const redirect = route.query.redirect as string
    const timestamp = route.query.t as string
    
    console.log('解析的参数:', { userId, assessmentNo, questionId, tenantId, redirect, timestamp })
    
    // 验证必填参数
    if (!userId) {
      console.log('缺少userId参数')
      alert({ 
        title: '缺少必填参数',
        content: '请提供userId参数' 
      })
      return
    }
    
    // 缓存参数到sessionStorage
    const params = {
      userId: userId || '',
      assessmentNo: assessmentNo || '',
      questionId: questionId || '',
      tenantId: tenantId || '',
      redirect: redirect || '',
      timestamp: timestamp || Date.now().toString()
    }
    sessionStorage.setItem(sessionKey, JSON.stringify(params))
    console.log('已缓存参数到sessionStorage:', params)
    
    // 设置到store
    surveyStore.setSurveyPath(surveyId)
    surveyStore.setUserId(params.userId)
    surveyStore.setTenantId(params.tenantId)
    surveyStore.setAssessmentNo(params.assessmentNo)
    surveyStore.setQuestionId(params.questionId)
    surveyStore.setRedirectUrl(params.redirect)
    console.log('已设置参数到store')
    
    // 清理URL参数，跳转到干净的URL
    const cleanUrl = `/${surveyId}`
    console.log('准备跳转到干净URL:', cleanUrl)
    console.log('当前路由base:', router.options.history.base)
    
    // 先加载数据，然后再跳转
    getDetail(surveyId)
    
    // 使用 nextTick 确保数据加载后再跳转
    nextTick(() => {
      console.log('执行URL跳转...')
      router.replace(cleanUrl).then(() => {
        console.log('URL跳转完成')
      }).catch(err => {
        console.error('URL跳转失败:', err)
      })
    })
  } else {
    // 如果既没有缓存也没有URL参数，正常加载问卷（不需要参数的情况）
    console.log('无参数访问问卷')
    surveyStore.setSurveyPath(surveyId)
    surveyStore.setUserId('')
    surveyStore.setAssessmentNo('')
    surveyStore.setQuestionId('')
    surveyStore.setTenantId('')
    surveyStore.setRedirectUrl('')
    getDetail(surveyId)
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

    if (!pageConf || pageConf?.length == 0) {
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

function isObjectId(id: string) {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/
  return objectIdRegex.test(id)
}

const getDetail = async (surveyPath: string) => {
  const alert = useCommandComponent(AlertDialog)
  try {
    if (isObjectId(surveyPath)) {
      const res: any = await getPreviewSchema({ surveyPath })
      loadData(res, surveyPath)
    } else {
      const res: any = await getPublishedSurveyInfo({ surveyPath })
      // checkStatus(res.data)
      loadData(res, surveyPath)
      surveyStore.getEncryptInfo()
    }
  } catch (error: any) {
    console.log(error)
    alert({ title: error.message || '获取问卷失败' })
  }
}
</script>
