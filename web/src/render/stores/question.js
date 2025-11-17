import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { set } from 'lodash-es'
import { useSurveyStore } from '@/render/stores/survey'
import { queryOptionCountInfo } from '@/render/api/survey'
import { NORMAL_CHOICES, QUESTION_TYPE } from '@/common/typeEnum'

// 投票进度逻辑聚合
const useOptionCountMap = (questionData) => {
  const voteMap = ref({})
  const quotaMap = ref({})
  //初始化投票题的数据
  const initOptionCountInfo = async () => {
    const surveyStore = useSurveyStore()
    const surveyPath = surveyStore.surveyPath

    const fieldList = []

    for (const field in questionData.value) {
      const { type } = questionData.value[field]
      if (type.includes(QUESTION_TYPE.VOTE)) {
        fieldList.push(field)
      }
      if (NORMAL_CHOICES.includes(type)) {
        fieldList.push(field)
      }
    }

    if (fieldList.length <= 0) {
      return
    }
    try {
      const countRes = await queryOptionCountInfo({
        surveyPath,
        fieldList: fieldList.join(',')
      })

      if (countRes.code === 200) {
        setVoteMap(countRes.data)
      }
      Object.keys(countRes.data).forEach(field => {
        Object.keys(countRes.data[field]).forEach((optionHash) => {
          updateQuotaMapByKey({ questionKey: field, optionKey: optionHash, data: countRes.data[field][optionHash] })
        })
      })
    } catch (error) {
      console.log(error)
    }
  }
  const updateVoteMapByKey = (data) => {
    const { questionKey, voteKey, voteValue } = data
    // 兼容为空的情况
    if (!voteMap.value[questionKey]) {
      voteMap.value[questionKey] = {}
    }
    voteMap.value[questionKey][voteKey] = voteValue
  }
  const setVoteMap = (data) => {
    voteMap.value = data
  }
  const updateVoteData = (data) => {
    const { key: questionKey, value: questionVal } = data
    // 更新前获取接口缓存在localstorage中的数据
    const currentQuestion = questionData.value[questionKey]
    const options = currentQuestion.options
    const voteTotal = voteMap[questionKey]?.total || 0
    let totalPayload = {
      questionKey,
      voteKey: 'total',
      voteValue: voteTotal
    }
    options.forEach((option) => {
      const optionHash = option.hash
      const voteCount = voteMap?.[questionKey]?.[optionHash] || 0
      // 如果选中值包含该选项，对应voteCount 和 voteTotal  + 1
      if (
        Array.isArray(questionVal) ? questionVal.includes(optionHash) : questionVal === optionHash
      ) {
        const countPayload = {
          questionKey,
          voteKey: optionHash,
          voteValue: voteCount + 1
        }
        totalPayload.voteValue += 1
        updateVoteMapByKey(countPayload)
      } else {
        const countPayload = {
          questionKey,
          voteKey: optionHash,
          voteValue: voteCount
        }
        updateVoteMapByKey(countPayload)
      }
      updateVoteMapByKey(totalPayload)
    })
  }
  const updateQuotaMapByKey = ({ questionKey, optionKey, data }) =>{
    // 兼容为空的情况
    if (!quotaMap.value[questionKey]) {
      quotaMap.value[questionKey] = {}
    }
    quotaMap.value[questionKey][optionKey] = data
  }
  return {
    voteMap,
    quotaMap,
    setVoteMap,
    initOptionCountInfo,
    updateVoteData,
    updateQuotaMapByKey,
  }
}

export const useQuestionStore = defineStore('question', () => {
  const questionData = ref(null)
  const questionSeq = ref([]) // 题目的顺序，因为可能会有分页的情况，所以是一个二维数组[[qid1, qid2], [qid3,qid4]]
  const pageIndex = ref(1) // 当前分页的索引
  const maxPageReached = ref(1) // 用户到达过的最大页码，用于限制上一页功能
  const changeField = ref(null)
  const changeIndex = computed(() => {
    if(!changeField.value || !questionData.value) return null
    return questionData.value[changeField.value]?.index
  })
  const needHideFields = ref([])

  // 题目列表
  const questionList = computed(() => {
    let index = 1
    const hideMap = needHideFields.value.concat(showLogicHideFields.value)
    const surveyStore = useSurveyStore()

    // 获取显示逻辑引擎和表单值，用于主动计算题目可见性
    const showLogicEngine = surveyStore.showLogicEngine
    const formValues = surveyStore.formValues
    const facts = Object.assign({ __schema: surveyStore?.dataConf?.dataList || [] }, formValues)

    console.log('[questionList] hideMap:', hideMap)

    return (
      questionSeq.value &&
      questionSeq.value.reduce((pre, item) => {
        const questionArr = []

        item.forEach((questionKey) => {
          const question = { ...questionData.value[questionKey] }
          // 跳过描述组件的编号（描述组件不是题目）
          const isDescriptionType = question.type === 'description'

          // 主动计算显示逻辑（不依赖 QuestionWrapper 的 watch）
          let logicShow = true
          if (showLogicEngine && typeof showLogicEngine.match === 'function') {
            try {
              const result = showLogicEngine.match(questionKey, 'question', facts)
              logicShow = result === undefined ? true : result
            } catch (error) {
              logicShow = true
            }
          }

          // 检查跳转逻辑
          const logicSkip = needHideFields.value.includes(questionKey)

          // 题目是否可见
          const isVisible = logicShow && !logicSkip

          // 开启显示序号且题目可见
          if (question.showIndex && isVisible && !isDescriptionType) {
            question.indexNumber = index
            // console.log(`[questionList] 分配序号 ${index} 给题目 ${questionKey} (${question.title})`)
            index++
          } else if (!isVisible) {
            // console.log(`[questionList] 跳过隐藏题目 ${questionKey} (${question.title}), logicShow=${logicShow}, logicSkip=${logicSkip}`)
          }

          questionArr.push(question)
        })

        if (questionArr && questionArr.length) {
          pre.push(questionArr)
        }

        return pre
      }, [])
    )
  })

  const renderData = computed(() => {
    const { startIndex, endIndex } = getSorter()
    const data = questionList.value[0]
    if (!data || !Array.isArray(data) || data.length === 0) return []
    const sliced = data.slice(startIndex, endIndex)
    console.log('[renderData] 当前页题目:', {
      pageIndex: pageIndex.value,
      startIndex,
      endIndex,
      totalQuestions: data.length,
      currentPageQuestions: sliced.length,
      questions: sliced.map(q => ({ field: q.field, title: q.title, type: q.type }))
    })
    return [sliced]
  })

  // 检查某一页是否有可见题目（供上一页、下一页和isFinallyPage使用）
  const hasVisibleQuestions = (targetPage) => {
    const surveyStore = useSurveyStore()

    // 获取该页的题目范围
    let startIndex = 0
    for (let i = 0; i < targetPage - 1; i++) {
      startIndex += surveyStore.pageConf[i] || 0
    }
    const endIndex = startIndex + (surveyStore.pageConf[targetPage - 1] || 0)

    const allQuestions = questionList.value[0] || []
    const pageQuestions = allQuestions.slice(startIndex, endIndex)

    console.log(`[hasVisibleQuestions] 检查第 ${targetPage} 页题目可见性:`, {
      startIndex,
      endIndex,
      questionCount: pageQuestions.length,
      questions: pageQuestions.map(q => q.field)
    })

    if (pageQuestions.length === 0) {
      return false
    }

    // 检查显示逻辑引擎
    const showLogicEngine = surveyStore.showLogicEngine
    const formValues = surveyStore.formValues
    const facts = Object.assign({ __schema: surveyStore?.dataConf?.dataList || [] }, formValues)

    // 检查是否至少有一个题目可见
    for (const question of pageQuestions) {
      const field = question.field

      // 检查显示逻辑
      let logicShow = true
      if (showLogicEngine && typeof showLogicEngine.match === 'function') {
        try {
          const result = showLogicEngine.match(field, 'question', facts)
          logicShow = result === undefined ? true : result
        } catch (error) {
          console.warn('[hasVisibleQuestions] logicShow match failed:', error)
          logicShow = true
        }
      }

      // 检查跳转逻辑
      const logicSkip = needHideFields.value.includes(field)

      const visible = logicShow && !logicSkip

      console.log(`[hasVisibleQuestions] 题目 ${field} 可见性:`, {
        title: question.title,
        logicShow,
        logicSkip,
        visible
      })

      if (visible) {
        return true
      }
    }

    return false
  }

  const isFinallyPage = computed(() => {
    const surveyStore = useSurveyStore()
    if (surveyStore.pageConf.length === 0) {
      return true
    }

    // 如果已经是物理上的最后一页
    if (pageIndex.value === surveyStore.pageConf.length) {
      return true
    }

    // 检查当前页之后是否还有可见题目
    const totalPages = surveyStore.pageConf.length
    for (let targetPage = pageIndex.value + 1; targetPage <= totalPages; targetPage++) {
      if (hasVisibleQuestions(targetPage)) {
        // 找到至少一个有可见题目的页面，不是最后一页
        console.log(`[isFinallyPage] 第 ${targetPage} 页有可见题目，当前不是最后一页`)
        return false
      }
    }

    // 后面所有页面都没有可见题目，当前页是最后一页
    console.log(`[isFinallyPage] 后续页面都无可见题目，当前页为最后一页`)
    return true
  })

  const addPageIndex = () => {
    const surveyStore = useSurveyStore()
    const totalPages = Array.isArray(surveyStore.pageConf) ? surveyStore.pageConf.length : 0
    const beforePage = pageIndex.value

    if (pageIndex.value >= totalPages) {
      console.log('[addPageIndex] 已是最后一页，无法继续')
      return
    }

    // 从下一页开始往后找，直到找到有可见题目的页
    let targetPage = pageIndex.value + 1

    while (targetPage <= totalPages) {
      if (hasVisibleQuestions(targetPage)) {
        pageIndex.value = targetPage
        // 更新用户到达过的最大页码
        if (pageIndex.value > maxPageReached.value) {
          maxPageReached.value = pageIndex.value
        }
        console.log('[addPageIndex] 跳转到下一页:', {
          beforePage,
          afterPage: pageIndex.value,
          maxPageReached: maxPageReached.value,
          changed: beforePage !== pageIndex.value
        })
        return
      }

      console.log(`[addPageIndex] 第 ${targetPage} 页无可见题目，继续往后找`)
      targetPage++
    }

    // 如果没找到可见页，不移动
    console.log('[addPageIndex] 未找到有可见题目的页面，保持当前页')
  }

  const subPageIndex = () => {
    const beforePage = pageIndex.value
    // 只允许点击一次上一页：当前页必须等于 maxPageReached 才能返回
    if (pageIndex.value < maxPageReached.value) {
      console.log('[subPageIndex] 已经在历史页面，无法继续返回')
      return
    }

    if (pageIndex.value <= 1) {
      console.log('[subPageIndex] 已在第一页，无法返回')
      return
    }

    // 从当前页往前找，直到找到有可见题目的页（不限制查找范围，只限制点击次数）
    let targetPage = pageIndex.value - 1

    while (targetPage >= 1) {
      if (hasVisibleQuestions(targetPage)) {
        pageIndex.value = targetPage
        console.log('[subPageIndex] 返回上一页:', {
          beforePage,
          afterPage: pageIndex.value,
          maxPageReached: maxPageReached.value,
          changed: beforePage !== pageIndex.value
        })
        return
      }

      console.log(`[subPageIndex] 第 ${targetPage} 页无可见题目，继续往前找`)
      targetPage--
    }

    // 如果没找到可见页，不移动
    console.log('[subPageIndex] 未找到有可见题目的页面，保持当前页')
  }

  const getSorter = () => {
    let startIndex = 0
    const surveyStore = useSurveyStore()
    const newPageEditOne = pageIndex.value
    const endIndex = surveyStore.pageConf[newPageEditOne - 1]

    for (let index = 0; index < surveyStore.pageConf.length; index++) {
      const item = surveyStore.pageConf[index]
      if (newPageEditOne - 1 == index) {
        break
      }
      startIndex += item
    }
    return {
      startIndex,
      endIndex: startIndex + endIndex
    }
  }

  const setQuestionData = (data) => {
    questionData.value = data
  }
  const { voteMap, quotaMap, setVoteMap, initOptionCountInfo, updateVoteData } = useOptionCountMap(questionData)

  const changeSelectMoreData = (data) => {
    const { key, value, field } = data
    set(questionData.value, `${field}.othersValue.${key}`, value)
  }

  const setQuestionSeq = (data) => {
    questionSeq.value = data
  }

  const setChangeField = (field) => {
    changeField.value = field
  }
  const getQuestionIndexByField = (field) => {
    return questionData.value[field].index
  }
  const addNeedHideFields = (fields) => {
    fields.forEach((field) => {
      if (!needHideFields.value.includes(field)) {
        needHideFields.value.push(field)
      }
    })
  }
  const removeNeedHideFields = (fields) => {
    needHideFields.value = needHideFields.value.filter((field) => !fields.includes(field))
  }
  const showLogicHideFields = ref([])
  const addShowLogicHideFields = (fields) => {
    fields.forEach((field) => {
      if (!showLogicHideFields.value.includes(field)) {
        showLogicHideFields.value.push(field)
      }
    })
  }
  const removeShowLogicHideFields = (fields) => {
    showLogicHideFields.value = showLogicHideFields.value.filter((field) => !fields.includes(field))
  }
  return {
    questionData,
    questionSeq,
    renderData,
    isFinallyPage,
    pageIndex,
    maxPageReached,
    addPageIndex,
    subPageIndex,
    setQuestionData,
    changeSelectMoreData,
    setQuestionSeq,
    voteMap,
    quotaMap,
    setVoteMap,
    initOptionCountInfo,
    updateVoteData,
    changeField,
    changeIndex,
    setChangeField,
    needHideFields,
    addNeedHideFields,
    removeNeedHideFields,
    showLogicHideFields,
    addShowLogicHideFields,
    removeShowLogicHideFields,
    getQuestionIndexByField
  }
})
