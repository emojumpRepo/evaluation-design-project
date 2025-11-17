import { computed } from 'vue'
import { useSurveyStore } from '../stores/survey'
import { useQuestionStore } from '../stores/question'
export const useProgressBar = () => {
  console.log('[进度条调试] useProgressBar 被调用了！当前时间:', new Date().toLocaleTimeString())
  const surveyStore = useSurveyStore()
  const questionStore = useQuestionStore()
  const isVariableEmpty = (variable) => {
    if (variable === undefined || variable === null) {
      return true
    }
    if (typeof variable === 'string' && variable.trim() === '') {
      return true
    }
    if (Array.isArray(variable) && variable.length === 0) {
      return true
    }
    if (typeof variable === 'object' && Object.keys(variable).length === 0) {
      return true
    }
    return false
  }

  // 获取从第一页到当前页的所有题目字段（累积进度）
  const cumulativeQuestionFields = computed(() => {
    const questionData = questionStore.questionData
    const questionSeq = questionStore.questionSeq
    const pageIndex = questionStore.pageIndex
    const pageConf = surveyStore.pageConf || []

    console.log('[进度条调试] questionData:', questionData)
    console.log('[进度条调试] questionSeq:', questionSeq)
    console.log('[进度条调试] pageIndex:', pageIndex)
    console.log('[进度条调试] pageConf:', pageConf)

    if (!questionData || !questionSeq || questionSeq.length === 0) {
      console.log('[进度条调试] 基础数据不完整')
      return []
    }

    // 计算从第一页到当前页应该包含多少个题目
    let endIndex = 0
    for (let i = 0; i < pageIndex; i++) {
      endIndex += pageConf[i] || 0
    }
    console.log('[进度条调试] endIndex:', endIndex)

    // questionSeq 是二维数组，第一个元素包含所有题目
    const allQuestionFields = questionSeq[0] || []
    console.log('[进度条调试] allQuestionFields:', allQuestionFields)

    // 获取从第一个题目到当前页最后一个题目的字段
    const fieldsUpToCurrentPage = allQuestionFields.slice(0, endIndex)
    console.log('[进度条调试] fieldsUpToCurrentPage:', fieldsUpToCurrentPage)

    // 获取显示逻辑引擎和表单值
    const showLogicEngine = surveyStore.showLogicEngine
    const formValues = surveyStore.formValues
    const facts = Object.assign({ __schema: surveyStore?.dataConf?.dataList || [] }, formValues)

    // 只统计可见的、非描述类型的题目
    const result = fieldsUpToCurrentPage.filter((field) => {
      const question = questionData[field]
      if (!question) {
        console.log('[进度条调试] 题目不存在:', field)
        return false
      }

      if (question.type === 'description') {
        console.log('[进度条调试] 过滤掉描述题目:', field)
        return false
      }

      // 检查显示逻辑
      let logicShow = true
      if (showLogicEngine && typeof showLogicEngine.match === 'function') {
        try {
          const result = showLogicEngine.match(field, 'question', facts)
          logicShow = result === undefined ? true : result
        } catch (error) {
          logicShow = true
        }
      }

      // 检查跳转逻辑
      const logicSkip = questionStore.needHideFields.includes(field)

      const visible = logicShow && !logicSkip
      console.log('[进度条调试] 题目过滤:', { field, logicShow, logicSkip, visible })
      return visible
    })

    console.log('[进度条调试] 最终结果 cumulativeFields:', result)
    return result
  })

  const surveySchedule = computed(() => {
    let data = {
      fillCount: 0,
      topicCount: 0
    }
    const formValues = surveyStore.formValues || {}
    const cumulativeFields = cumulativeQuestionFields.value
    data.topicCount = cumulativeFields.length

    console.log('[进度条调试] pageIndex:', questionStore.pageIndex)
    console.log('[进度条调试] cumulativeFields:', cumulativeFields)
    console.log('[进度条调试] formValues:', formValues)

    cumulativeFields.forEach((field) => {
      const value = formValues[field]
      const isEmpty = isVariableEmpty(value)
      console.log(`[进度条调试] 题目 ${field}:`, { value, isEmpty })
      if (!isEmpty) {
        data.fillCount++
      }
    })

    console.log('[进度条调试] 结果:', data)
    return data
  })

  const percent = computed(() => {
    const { fillCount, topicCount } = surveySchedule.value
    if (!topicCount) {
      return '0%'
    }
    return Math.floor((fillCount / topicCount) * 100) + '%'
  })

  return { surveySchedule, percent }
}
