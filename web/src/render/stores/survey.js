import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { defineStore } from 'pinia'
import { pick } from 'lodash-es'
import moment from 'moment'

import { isMobile as isInMobile } from '@/render/utils/index'

import { getEncryptInfo as getEncryptInfoApi } from '@/render/api/survey'
import { useQuestionStore } from '@/render/stores/question'
import { useErrorInfo } from '@/render/stores/errorInfo'
import { getSurveyData, getSurveySubmit, setSurveyData } from '@/render/utils/storage'

import adapter from '../adapter'
import { RuleMatch } from '@/common/logicEngine/RulesMatch'
/**
 * CODE_MAP不从management引入，在dev阶段，会导致B端 router被加载，进而导致C端路由被添加 baseUrl: /management
 */
const CODE_MAP = {
  SUCCESS: 200,
  ERROR: 500,
  NO_AUTH: 403
}

export const useSurveyStore = defineStore('survey', () => {
  const surveyPath = ref('')
  const isMobile = ref(isInMobile())
  const enterTime = ref(0)
  const encryptInfo = ref(null)
  const rules = ref({})
  const bannerConf = ref({})
  const baseConf = ref({})
  const bottomConf = ref({})
  const dataConf = ref({})
  const skinConf = ref({})
  const submitConf = ref({})
  const formValues = ref({})
  const whiteData = ref({})
  const pageConf = ref([])
  const userId = ref('') // 用户id
  const assessmentNo = ref('') // 测评任务编号
  const tenantId = ref('') // 租户id
  const questionId = ref('') // 问卷id
  const redirectUrl = ref('') // 完成后重定向地址
  const controlWords = ref([]) // 显隐控制词

  const router = useRouter()
  const questionStore = useQuestionStore()
  const { setErrorInfo } = useErrorInfo()

  const setWhiteData = (data) => {
    whiteData.value = data
  }

  const setSurveyPath = (data) => {
    surveyPath.value = data
  }

  const setEnterTime = () => {
    enterTime.value = Date.now()
  }

  const setFormValues = (data) => {
    formValues.value = data
  }

  const setUserId = (data) => {
    userId.value = data
  }

  const setAssessmentNo = (data) => {
    assessmentNo.value = data
  }

  const setQuestionId = (data) => {
    questionId.value = data
  }

  const setTenantId = (data) => {
    tenantId.value = data
  }

  const setRedirectUrl = (data) => {
    redirectUrl.value = data
  }
  const setControlWords = (data) => {
    controlWords.value = Array.isArray(data) ? data : []
    // 若已初始化formValues，同步注入运行时事实
    try {
      if (formValues.value) {
        formValues.value['__controlWords'] = controlWords.value
      }
    } catch (e) {
      // ignore
    }
  }

  const getEncryptInfo = async () => {
    try {
      const res = await getEncryptInfoApi()
      if (res.code === CODE_MAP.SUCCESS) {
        encryptInfo.value = res.data
      }
    } catch (error) {
      console.log(error)
    }
  }

  const canFillQuestionnaire = (baseConf, submitConf) => {
    const { beginTime, endTime, answerBegTime, answerEndTime } = baseConf
    const { msgContent } = submitConf
    const now = Date.now()
    let isSuccess = true

    if (now < new Date(beginTime).getTime()) {
      isSuccess = false
      setErrorInfo({
        errorType: 'overTime',
        errorMsg: `<p>问卷未到开始填写时间，暂时无法进行填写<p/>
                   <p>开始时间为: ${beginTime}</p>`
      })
    } else if (now > new Date(endTime).getTime()) {
      isSuccess = false
      setErrorInfo({
        errorType: 'overTime',
        errorMsg: msgContent.msg_9001 || '您来晚了，感谢支持问卷~'
      })
    } else if (answerBegTime && answerEndTime) {
      const momentNow = moment()
      const todayStr = momentNow.format('yyyy-MM-DD')
      const momentStartTime = moment(`${todayStr} ${answerBegTime}`)
      const momentEndTime = moment(`${todayStr} ${answerEndTime}`)
      if (momentNow.isBefore(momentStartTime) || momentNow.isAfter(momentEndTime)) {
        isSuccess = false
        setErrorInfo({
          errorType: 'overTime',
          errorMsg: `<p>不在答题时间范围内，暂时无法进行填写<p/>
                    <p>答题时间为: ${answerBegTime} ~ ${answerEndTime}</p>`
        })
      }
    }

    if (!isSuccess) {
      router.push({ name: 'errorPage' })
    }

    return isSuccess
  }
  // 加载空白页面
  function clearFormData(option) {
    // 根据初始的schema生成questionData, questionSeq, rules, formValues, 这四个字段
    const {
      questionData,
      questionSeq,
      rules: _rules,
      formValues: _formValues
    } = adapter.generateData(
      pick(option, [
        'bannerConf',
        'baseConf',
        'bottomConf',
        'dataConf',
        'skinConf',
        'submitConf',
        'whiteData',
        'pageConf'
      ])
    )

    questionStore.questionData = questionData
    questionStore.questionSeq = questionSeq

    // 将数据设置到state上
    rules.value = _rules
    bannerConf.value = option.bannerConf
    baseConf.value = option.baseConf
    bottomConf.value = option.bottomConf
    dataConf.value = option.dataConf
    skinConf.value = option.skinConf
    submitConf.value = option.submitConf
    formValues.value = _formValues
    whiteData.value = option.whiteData
    pageConf.value = option.pageConf

    // 注入显隐控制词到事实对象
    try {
      if (controlWords.value && controlWords.value.length) {
        formValues.value['__controlWords'] = controlWords.value
      }
    } catch (e) {
      // ignore
    }

    questionStore.initOptionCountInfo()

    // 运行时重复 field 监测，仅报警不改数据
    try {
      const list = option?.dataConf?.dataList || []
      const map = list.reduce((m, q, i) => {
        const k = q?.field
        if (!k) return m
        if (!m[k]) m[k] = []
        m[k].push(i + 1)
        return m
      }, {})
      const dups = Object.entries(map).filter(([, v]) => Array.isArray(v) && v.length > 1)
      if (dups.length) {
        // eslint-disable-next-line no-console
        console.warn('检测到重复 field（题号列表）：', dups)
      }
    } catch (e) {
      // ignore
    }

  }

  const initSurvey = (option) => {
    setEnterTime()
    if (!canFillQuestionnaire(option.baseConf, option.submitConf)) {
      return
    }
    // 加载空白问卷
    clearFormData(option)
    
    // 注册全局调试工具
    registerDebugTools()

  }

  // 注册全局调试工具
  const registerDebugTools = () => {
    if (typeof window !== 'undefined') {
      window.surveyDebug = {
        getCurrentAnswers: () => formValues.value,
        getSavedData: getCurrentAnswerData,
        getProgress: () => calculateProgress(formValues.value, questionStore.questionData),
        restoreProgress: restoreProgress,
        getSurveyId: () => surveyPath.value,
        getAllLocalStorage: () => {
          const allData = {}
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && (key.includes('_questionData') || key.includes('_submit'))) {
              allData[key] = JSON.parse(localStorage.getItem(key) || 'null')
            }
          }
          return allData
        },
        saveCurrentData: () => {
          const surveyId = surveyPath.value
          const currentUserId = userId.value
          if (surveyId) {
            setSurveyData(surveyId, formValues.value, currentUserId)
            return true
          }
          return false
        }
      }
    }
  }

  // 回填保存的进度
  const restoreProgress = () => {
    try {
      const savedData = getSurveyData(surveyPath.value, userId.value)
      getSurveySubmit(surveyPath.value, userId.value)
      if (savedData && Object.keys(savedData).length > 0) {
        formValues.value = { ...formValues.value, ...savedData }
        Object.keys(savedData).forEach(field => {
          const v = savedData[field]
          if (v !== null && v !== undefined && v !== '') {
            logAnswerProgress(field, v)
          }
        })
        setSurveyData(surveyPath.value, savedData, userId.value)
      }
    } catch (error) {
      console.error('restoreProgress failed:', error)
    }
  }

  // 调试工具：查看当前作答数据
  const getCurrentAnswerData = () => {
    const surveyId = surveyPath.value
    const currentUserId = userId.value
    if (!surveyId) return null
    const savedData = getSurveyData(surveyId, currentUserId)
    return savedData
  }

  // 用户输入或者选择后，更新表单数据
  const changeData = (data) => {
    let { key, value } = data
    formValues.value[key] = value
    questionStore.setChangeField(key)
    
    // 记录每道题的作答结果
    logAnswerProgress(key, value)
  }

  // 记录每道题的作答进度和结果（仅控制台日志，不保存到localStorage）
  const logAnswerProgress = (field, value) => {
    void value
    const questionData = questionStore.questionData
    if (!questionData || !questionData[field]) return
    
    const currentAnswers = { ...formValues.value }
    // 如需埋点，可在此处发送最小必要信息
    void calculateProgress(currentAnswers, questionData)
  }

  // 计算作答进度
  const calculateProgress = (answers, questionData) => {
    const totalQuestions = Object.keys(questionData).length
    const answeredQuestions = Object.keys(answers).filter(key => {
      const value = answers[key]
      return value !== null && value !== undefined && value !== '' && 
             (Array.isArray(value) ? value.length > 0 : true)
    }).length
    
    return {
      answered: answeredQuestions,
      total: totalQuestions,
      percentage: Math.round((answeredQuestions / totalQuestions) * 100)
    }
  }

  // 初始化逻辑引擎
  const showLogicEngine = ref()
  const initShowLogicEngine = (showLogicConf) => {
    showLogicEngine.value = new RuleMatch().fromJson(showLogicConf || [])
  }
  const jumpLogicEngine = ref()
  const initJumpLogicEngine = (jumpLogicConf) => {
    jumpLogicEngine.value = new RuleMatch().fromJson(jumpLogicConf || [])
  }

  return {
    surveyPath,
    isMobile,
    enterTime,
    encryptInfo,
    rules,
    bannerConf,
    baseConf,
    bottomConf,
    dataConf,
    skinConf,
    submitConf,
    formValues,
    whiteData,
    pageConf,
    userId,
    assessmentNo,
    questionId,
    tenantId,
    redirectUrl,
    controlWords,
    initSurvey,
    changeData,
    setWhiteData,
    setFormValues,
    setSurveyPath,
    setEnterTime,
    setUserId,
    setAssessmentNo,
    setQuestionId,
    setTenantId,
    setRedirectUrl,
    setControlWords,
    getEncryptInfo,
    showLogicEngine,
    initShowLogicEngine,
    jumpLogicEngine,
    initJumpLogicEngine,
    logAnswerProgress,
    calculateProgress,
    restoreProgress,
    getCurrentAnswerData,
    registerDebugTools
  }
})
