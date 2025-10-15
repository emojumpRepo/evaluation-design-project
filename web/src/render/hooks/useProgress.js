import { computed } from 'vue'
import { useSurveyStore } from '../stores/survey'
import { useQuestionStore } from '../stores/question'
export const useProgressBar = () => {
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

  const visibleQuestionFields = computed(() => {
    const hiddenFields = new Set([
      ...(Array.isArray(questionStore.needHideFields) ? questionStore.needHideFields : []),
      ...(Array.isArray(questionStore.showLogicHideFields)
        ? questionStore.showLogicHideFields
        : [])
    ])

    const questions = questionStore.questionData || {}
    return Object.keys(questions).filter((field) => {
      const question = questions[field]
      if (!question) return false
      if (question.type === 'description') return false
      return !hiddenFields.has(field)
    })
  })

  const surveySchedule = computed(() => {
    let data = {
      fillCount: 0,
      topicCount: 0
    }
    const formValues = surveyStore.formValues || {}
    const visibleFields = visibleQuestionFields.value
    data.topicCount = visibleFields.length
    visibleFields.forEach((field) => {
      if (!isVariableEmpty(formValues[field])) {
        data.fillCount++
      }
    })

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
