<template>
  <div class="index">
    <ProgressBar />
    <div class="wrapper" ref="boxRef">
      <HeaderContent v-if="pageIndex == 1" :bannerConf="bannerConf" :readonly="true" />
      <div class="content" :class="{ 'one-question-mode': isOneQuestionPerPageMode }">
        <MainTitle 
          v-if="pageIndex == 1 && showMainTitle" 
          :bannerConf="bannerConf" 
          :readonly="true"
        />
        <DescriptionModule 
          v-if="showDescription" 
          :bannerConf="{ ...bannerConf, currentPage: pageIndex }" 
          :readonly="true"
        />
        <MainRenderer ref="mainRef"></MainRenderer>
        <SubmitButton
          :validate="validate"
          :submitConf="submitConf"
          :readonly="true"
          :isFinallyPage="isFinallyPage"
          :renderData="renderData"
          :canGoPrev="canGoPrev"
          :prevDisabled="prevDisabled"
          :loading="isSubmitting"
          @submit="handleSubmit"
          @prev="handlePrev"
        ></SubmitButton>
      </div>
      <LogoIcon :logo-conf="logoConf" :readonly="true" />
      <VerifyDialog />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
// @ts-ignore
import communalLoader from '@materials/communals/communalLoader.js'

import useCommandComponent from '../hooks/useCommandComponent'
import MainRenderer from '../components/MainRenderer.vue'
import AlertDialog from '../components/AlertDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import VerifyDialog from '../components/VerifyDialog/index.vue'

import ProgressBar from '../components/ProgressBar.vue'

import { useSurveyStore } from '../stores/survey'
import { useQuestionStore } from '../stores/question'
import { submitForm } from '../api/survey'
import encrypt from '../utils/encrypt'
import {
  clearSurveyData,
  setSurveyData,
  clearSurveySubmit,
  setSurveySubmit
} from '../utils/storage'

interface Props {
  questionInfo?: any
  isMobile?: boolean
}

withDefaults(defineProps<Props>(), {
  isMobile: false
})

let parentOrigin = '*';

const HeaderContent = communalLoader.loadComponent('HeaderContent')
const MainTitle = communalLoader.loadComponent('MainTitle')
const DescriptionModule = communalLoader.loadComponent('DescriptionModule')
const SubmitButton = communalLoader.loadComponent('SubmitButton')
const LogoIcon = communalLoader.loadComponent('LogoIcon')

const mainRef = ref<any>()
const boxRef = ref<HTMLElement>()
const isSubmitting = ref<boolean>(false)

const alert = useCommandComponent(AlertDialog)
const confirm = useCommandComponent(ConfirmDialog)

const router = useRouter()
const surveyStore = useSurveyStore()
const questionStore = useQuestionStore()

const renderData = computed(() => questionStore.renderData)
const isFinallyPage = computed(() => questionStore.isFinallyPage)
const pageIndex = computed(() => questionStore.pageIndex)
const maxPageReached = computed(() => questionStore.maxPageReached)
const { bannerConf, submitConf, bottomConf: logoConf, whiteData } = storeToRefs(surveyStore)
const surveyPath = computed(() => surveyStore.surveyPath || '')

// 只允许返回到 (maxPageReached - 1)，即只能返回上一页
const canGoPrev = computed(() => {
  return pageIndex.value > 1
})

// 上一页按钮是否禁用
const prevDisabled = computed(() => {
  const minAllowedPage = maxPageReached.value - 1
  return pageIndex.value <= minAllowedPage
})

// 检查HTML内容是否包含有效文本（不只是HTML标签）
const hasValidContent = (htmlContent: string | undefined): boolean => {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return false
  }
  const textContent = htmlContent.replace(/<[^>]*>/g, '').trim()
  return textContent.length > 0
}

// 计算主标题与描述显示（避免模板中的类型报错）
const showMainTitle = computed(() => hasValidContent((bannerConf.value as any)?.titleConfig?.mainTitle))
const showDescription = computed(() => hasValidContent((bannerConf.value as any)?.descriptionConfig?.[`page${pageIndex.value}`]?.content))

// 判断当前是否是一页一题模式
const isOneQuestionPerPageMode = computed(() => {
  const currentPageQuestions = renderData.value[0] || []
  return currentPageQuestions.length === 1
})

// 分页变化时，滚动到页面头部并定位当前页第一个问题
watch(pageIndex, async () => {
  await nextTick()
  const contentEl = boxRef.value?.querySelector('.content') as HTMLElement | null
  if (contentEl) {
    if (typeof contentEl.scrollTo === 'function') {
      contentEl.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      contentEl.scrollTop = 0
    }
    const firstQuestion = contentEl.querySelector('.gap') as HTMLElement | null
    if (firstQuestion && typeof firstQuestion.scrollIntoView === 'function') {
      firstQuestion.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
})

const validate = (callback: (v: boolean) => void) => {
  const index = 0
  ;(mainRef.value as any).$refs.formGroup[index].validate(callback)
}

const handlePrev = () => {
  questionStore.subPageIndex()
}

const normalizationRequestBody = () => {
  const enterTime = surveyStore.enterTime
  const encryptInfo: any = surveyStore.encryptInfo
  const formValues = surveyStore.formValues
  const baseConf: any = surveyStore.baseConf
  const userId = surveyStore.userId
  const assessmentId = surveyStore.assessmentNo
  const questionId = surveyStore.questionId
  const tenantId = surveyStore.tenantId

  const result: any = {
    surveyPath: surveyPath.value,
    data: JSON.stringify(formValues),
    diffTime: Date.now() - enterTime,
    clientTime: Date.now(),
    userId,
    assessmentId,
    questionId,
    tenantId,
    ...whiteData.value
  }

  if (baseConf.fillSubmitAnswer) {
    clearSurveyData(surveyPath.value, userId)
    clearSurveySubmit(surveyPath.value, userId)

    setSurveyData(surveyPath.value, formValues, userId)
    setSurveySubmit(surveyPath.value, 1, userId)
  }

  if (encryptInfo?.encryptType) {
    result.encryptType = encryptInfo.encryptType

    result.data = encrypt[result.encryptType as 'rsa']({
      data: result.data,
      secretKey: encryptInfo?.data?.secretKey
    })

    result.userId = encrypt[result.encryptType as 'rsa']({
      data: result.userId,
      secretKey: encryptInfo?.data?.secretKey
    })

    result.assessmentId = encrypt[result.encryptType as 'rsa']({
      data: result.assessmentId,
      secretKey: encryptInfo?.data?.secretKey
    })

    result.questionId = encrypt[result.encryptType as 'rsa']({
      data: result.questionId,
      secretKey: encryptInfo?.data?.secretKey
    })

    result.tenantId = encrypt[result.encryptType as 'rsa']({
      data: result.tenantId,
      secretKey: encryptInfo?.data?.secretKey
    })

    if (encryptInfo?.data?.sessionId) {
      result.sessionId = encryptInfo.data.sessionId
    }
  } else {
    result.data = JSON.stringify(result.data)
  }

  return result
}

function notifyComplete(payload: any) {
  console.log('send notifyComplete', payload)
  window.parent.postMessage({ type: 'complete', payload }, parentOrigin);
}

const submitSurvey = async () => {
  if (surveyPath.value.length > 8) {
    router.push({ name: 'successPage' })
    return
  }
  try {
    isSubmitting.value = true
    const params = normalizationRequestBody()
    const res: any = await submitForm(params)
    if (res.code === 200) {
      // 提交成功后清空作答数据
      clearSurveyData(surveyPath.value, surveyStore.userId)
      clearSurveySubmit(surveyPath.value, surveyStore.userId)
      
      // 清理sessionStorage中的参数缓存
      const sessionKey = `survey_params_${surveyPath.value}`
      sessionStorage.removeItem(sessionKey)
      console.log('清理缓存参数')
      
      // 前端回调已移至后端处理，确保数据格式统一和计算结果包含
      // 注释原因：
      // 1. 后端可以包含计算结果
      // 2. 统一的数据格式
      // 3. 更好的错误处理和重试机制
      /*
      // 处理前端回调
      const callbackConfig = (surveyStore.submitConf as any).callbackConfig
      if (callbackConfig?.enabled && callbackConfig?.url) {
        try {
          // 执行前端回调
          const callbackData = {
            surveyPath: surveyPath.value,
            userId: surveyStore.userId,
            assessmentNo: surveyStore.assessmentNo,
            questionId: surveyStore.questionId,
            formData: surveyStore.formValues,
            responseId: res.data?.responseId,
            timestamp: Date.now()
          }
          
          // 如果配置了前端回调，发送请求
          let headers: any = {
            'Content-Type': 'application/json'
          }
          
          // 如果启用了自定义headers
          if (callbackConfig.headersEnabled && callbackConfig.headers) {
            try {
              const customHeaders = JSON.parse(callbackConfig.headers)
              headers = { ...headers, ...customHeaders }
            } catch (e) {
              console.error('解析自定义headers失败:', e)
            }
          }
          
          const timeout = (parseInt(callbackConfig.timeout) || 10) * 1000
          
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), timeout)
          
          const callbackRes = await fetch(callbackConfig.url, {
            method: callbackConfig.method || 'POST',
            headers,
            body: callbackConfig.method === 'GET' ? undefined : JSON.stringify(callbackData),
            signal: controller.signal
          })
          
          clearTimeout(timeoutId)
          
          if (!callbackRes.ok) {
            console.error('回调请求失败:', callbackRes.status)
          }
        } catch (callbackError) {
          // 回调失败不影响问卷提交
          console.error('回调执行失败:', callbackError)
        }
      }
      */
      
      notifyComplete({
        userId: surveyStore.userId,
        assessmentNo: surveyStore.assessmentNo,
        tenantId: surveyStore.tenantId,
        questionId: surveyStore.questionId,
        surveyPath: surveyPath.value,
      })
      
      // 检查是否有重定向URL（用于页面跳转）
      // 注意：回调地址（callbackConfig）是后端用于数据推送的，不是页面跳转
      if (surveyStore.redirectUrl) {
        console.log('重定向到:', surveyStore.redirectUrl)
        // 延迟一秒让用户看到成功提示，然后重定向
        setTimeout(() => {
          window.location.href = surveyStore.redirectUrl
        }, 1000)
      } else {
        // 没有重定向URL时，跳转到成功页面
        router.replace({ name: 'successPage' })
      }
    } else {
      alert({
        title: res.errmsg || '提交失败'
      })
      if (res.code === 9003 && res.data) {
        surveyStore.changeData({ key: res.data.field, value: null })
        questionStore.initOptionCountInfo()
      }
    }
  } catch (error: any) {
    alert({
      title: error.message || '提交失败，请稍后重试'
    })
    console.log(error)
  } finally {
    isSubmitting.value = false
  }
}

const handleSubmit = () => {
  // 清除任何可能正在进行的自动跳转定时器，避免冲突
  window.dispatchEvent(new CustomEvent('manual-next-page'))

  const confirmAgain = (surveyStore.submitConf as any).confirmAgain
  const { again_text, is_again } = confirmAgain
  if (!isFinallyPage.value) {
    questionStore.addPageIndex()
    return
  }
  if (is_again) {
    confirm({
      title: again_text,
      onConfirm: async () => {
        try {
          await submitSurvey()
        } catch (error) {
          console.log(error)
        } finally {
          confirm.close()
        }
      }
    })
  } else {
    if (!isSubmitting.value) {
      submitSurvey()
    }
  }
}
</script>
<style scoped lang="scss">
.index {
  min-height: 100%;

  .wrapper {
    min-height: 100%;
    display: flex;
    flex-direction: column;

    .content {
      flex: 1;
      background: rgba(255, 255, 255, var(--opacity));
      border-radius: 8px 8px 0 0;
      height: 100%;

      // 一页一题模式样式优化
      &.one-question-mode {
        display: flex;
        flex-direction: column;
        min-height: 75vh;

        // 题目区域：靠上显示，不完全居中，视距更舒适
        :deep(.main) {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-start; // 改为靠上对齐
          padding: 120px 20px 40px; // 增加顶部 padding，让题目位置更舒适
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
        }

        // 隐藏一页一题模式下的题目分割线
        :deep(.question-wrapper.spliter) {
          border-bottom: none;
        }

        // 按钮区域固定在底部
        :deep(.submit-warp) {
          margin-top: auto;
          padding: 20px 20px 80px;
          position: sticky;
          bottom: 0;
          margin-bottom: 60px;
        }

        // 移动端适配
        @media (max-width: 768px) {
          min-height: 65vh;

          :deep(.main) {
            padding: 80px 16px 30px; // 移动端减少顶部间距
          }

          :deep(.submit-warp) {
            padding: 16px;
          }
        }

        // 平板适配
        @media (min-width: 769px) and (max-width: 1024px) {
          :deep(.main) {
            padding: 100px 20px 40px;
          }
        }
      }
    }
  }
}
</style>
