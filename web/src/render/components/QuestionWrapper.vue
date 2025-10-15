<template>
  <QuestionRuleContainer
    v-if="visibility"
    :moduleConfig="questionConfig"
    :indexNumber="indexNumber"
    :showTitle="questionConfig.showTitle !== false"
    @input="handleInput"
    @change="handleChange"
  ></QuestionRuleContainer>
</template>
<script setup>
import { unref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { debounce, cloneDeep } from 'lodash-es'

import { NORMAL_CHOICES, RATES, QUESTION_TYPE } from '@/common/typeEnum.ts'
import QuestionRuleContainer from '@/materials/questions/QuestionRuleContainer'

import { useVoteMap } from '@/render/hooks/useVoteMap'
import { useOthersData } from '@/render/hooks/useOthersData'
import { useInputData } from '@/render/hooks/useInputData'
import { useOptionsQuota } from '@/render/hooks/useOptionsQuota'
import { useQuestionStore } from '@/render/stores/question'
import { useSurveyStore } from '@/render/stores/survey'

import { getSurveyData, setSurveyData, setSurveySubmit } from '@/render/utils/storage'

const props = defineProps({
  indexNumber: {
    type: [Number, String],
    default: 1
  },
  moduleConfig: {
    type: Object,
    default: () => {
      return {}
    }
  }
})
const emit = defineEmits(['change'])
const questionStore = useQuestionStore()
const surveyStore = useSurveyStore()

const formValues = computed(() => {
  return surveyStore.formValues
})
const { showLogicEngine } = storeToRefs(surveyStore)
const { changeField, changeIndex, needHideFields } = storeToRefs(questionStore)

// 题型配置转换
const questionConfig = computed(() => {
  let moduleConfig = props.moduleConfig
  const { type, field, options = [], ...rest } = cloneDeep(moduleConfig)

  let allOptions = options

  if (type === QUESTION_TYPE.VOTE) {
    // 处理投票进度
    const { options, voteTotal } = useVoteMap(field)
    const voteOptions = unref(options)
    allOptions = allOptions.map((obj, index) => Object.assign(obj, voteOptions[index]))
    moduleConfig.voteTotal = unref(voteTotal)
  }
  if(NORMAL_CHOICES.includes(type) &&
    options.some(option => option.quota > 0)) {
    // 处理普通选择题的选项配额
    let { options: optionWithQuota } = useOptionsQuota(field)
    
    allOptions = allOptions.map((obj, index) => Object.assign(obj, optionWithQuota[index]))
  }
  if (NORMAL_CHOICES.includes(type) && options.some((option) => option.others)) {
    // 处理普通选择题的填写更多
    let { options, othersValue } = useOthersData(field)
    const othersOptions = unref(options)
    allOptions = allOptions.map((obj, index) => Object.assign(obj, othersOptions[index]))
    moduleConfig.othersValue = unref(othersValue)
  }

  // 选项级显隐（仅同题内规则）：
  // 1) 同题内：默认隐藏 defaultHidden
  // 2) 同题内：选中项的 showTargetsWhenSelected 显示优先，其次 hideTargetsWhenSelected 隐藏
  if (NORMAL_CHOICES.includes(type) && Array.isArray(allOptions) && allOptions.length) {
    try {
      // a) 初始状态（不再支持问卷级 option 显隐）：全部不隐藏
      let nextOptions = allOptions.map((opt) => ({ ...opt, hide: false }))

      // b) 应用默认隐藏
      nextOptions = nextOptions.map((o) => ({ ...o, hide: o.hide || !!o.defaultHidden }))

      // c) 根据当前选中项的 show/hide 目标进行合并（同题内）
      const selected = formValues.value[field]
      const selectedArr = Array.isArray(selected) ? selected : (selected ? [selected] : [])
      if (selectedArr.length) {
        const optionMap = new Map(nextOptions.map((o) => [o.hash, o]))
        const toShow = new Set()
        const toHide = new Set()
        selectedArr.forEach((h) => {
          const opt = optionMap.get(h)
          if (opt && Array.isArray(opt.showTargetsWhenSelected)) {
            opt.showTargetsWhenSelected.filter(Boolean).forEach((hh) => toShow.add(hh))
          }
          if (opt && Array.isArray(opt.hideTargetsWhenSelected)) {
            opt.hideTargetsWhenSelected.filter(Boolean).forEach((hh) => toHide.add(hh))
          }
        })
        nextOptions = nextOptions.map((o) => {
          // 显示优先：若在 toShow 中，则强制显示
          if (toShow.has(o.hash)) return { ...o, hide: false }
          // 其次隐藏规则
          if (toHide.has(o.hash)) return { ...o, hide: true }
          return o
        })
      }

      allOptions = nextOptions
    } catch (e) {
      // ignore
    }
  }

  if (
    RATES.includes(type) &&
    rest?.rangeConfig &&
    Object.keys(rest?.rangeConfig).filter((index) => rest?.rangeConfig[index].isShowInput).length >
      0
  ) {
    // 处理评分题的的选项后输入框
    let { rangeConfig, othersValue } = useInputData(field)
    moduleConfig.rangeConfig = unref(rangeConfig)
    moduleConfig.othersValue = unref(othersValue)
  }

  return {
    ...moduleConfig,
    options: allOptions,
    value: formValues.value[props.moduleConfig.field]
  }
})

const updateFormData = (value) => {
  const key = props.moduleConfig.field
  const formData = cloneDeep(formValues.value)
  formData[key] = value
  console.log(formData)
  return formData
}

const handleChange = (data) => {
  emit('change', data)

  // 更新formValues
  surveyStore.changeData(data)

  // 处理投票题questionConfig
  if (props.moduleConfig.type === QUESTION_TYPE.VOTE) {
    questionStore.updateVoteData(data)
  }

  processJumpSkip()
  processShowLogicClear()

  // 默认开启断点续答：记录内容
  // 直接使用完整的formValues，包含所有字段和扩展字段
  storageAnswer(formValues.value)
}

const handleInput = debounce((e) => {
  // 默认开启断点续答：记录内容
  const formData = updateFormData(e.target.value)
  storageAnswer(formData)
}, 500)

// 数据回填处理
const storageAnswer = (formData) => {
  const surveyId = surveyStore.surveyPath
  const userId = surveyStore.userId

  // 直接保存数据，不清除之前的数据
  setSurveyData(surveyId, formData, userId)
  setSurveySubmit(surveyId, 0, userId)
}

/** 问卷逻辑处理 */
// 显示逻辑：题目是否需要显示
const logicShow = computed(() => {
  // computed有计算缓存，当match有变化的时候触发重新计算
  // 传入答案与题目schema供分数合计计算
  const facts = Object.assign({ __schema: surveyStore?.dataConf?.dataList || [] }, formValues.value)
  const result = showLogicEngine.value.match(props.moduleConfig.field, 'question', facts)
  return result === undefined ? true : result
})
watch(()=> logicShow.value, (value) => {
  if(!value){
    questionStore.addShowLogicHideFields([props.moduleConfig.field])
  } else {
    questionStore.removeShowLogicHideFields([props.moduleConfig.field])
  }
}, {
  immediate: true
})

// 跳转逻辑：题目是否需要跳过（隐藏）
const logicSkip = computed(() => {
  return needHideFields.value.includes(props.moduleConfig.field)
})
const visibility = computed(() => {
  return logicShow.value && !logicSkip.value
})

// 清空指定题目的答案（含扩展键）并精确更新本地存储
const clearAnswerForField = (targetField) => {
  try {
    const q = questionStore.questionData?.[targetField] || {}
    const qType = q?.type
    let emptyVal = ''
    if (qType === QUESTION_TYPE.CHECKBOX) {
      emptyVal = []
    }

    surveyStore.changeData({ key: targetField, value: emptyVal })

    const prefix = `${targetField}_`
    const extKeys = Object.keys(formValues.value || {}).filter((k) => k.startsWith(prefix))
    extKeys.forEach((k) => surveyStore.changeData({ key: k, value: '' }))

    const surveyId = surveyStore.surveyPath
    const userId = surveyStore.userId
    const saved = getSurveyData(surveyId, userId) || {}
    saved[targetField] = emptyVal
    extKeys.forEach((k) => { saved[k] = '' })
    setSurveyData(surveyId, saved, userId)
  } catch (e) {
    // ignore
  }
}

// 当题目被隐藏时，清空题目的选中项，实现a显示关联b，b显示关联c场景下，b隐藏不影响题目c的展示
watch(
  () => visibility.value,
  (newVal, oldVal) => {
    const { field, type, innerType } = props.moduleConfig
    if (!newVal && oldVal) {
      // 仅当本题与“上次变更题”存在逻辑关联时才执行清空
      let isRelated = false
      try {
        const lastChanged = changeField.value
        if (lastChanged) {
          const jumpTargets = surveyStore.jumpLogicEngine
            ? surveyStore.jumpLogicEngine.getResultsByField(lastChanged, surveyStore.formValues)
            : []
          const showTargets = surveyStore.showLogicEngine && surveyStore.showLogicEngine.getResultsByField
            ? surveyStore.showLogicEngine.getResultsByField(lastChanged, surveyStore.formValues)
            : []
          const relatedTargets = [...jumpTargets, ...showTargets].map((it) => it && it.target)
          isRelated = relatedTargets.includes(field)
        }
      } catch (e) {
        // ignore
      }
      if (!isRelated) return
      // 如果被隐藏题目有选中值，则需要清空选中值
      if (formValues.value[field].toString()) {
        let value = ''
        // 题型是多选，或者子题型是多选（innerType是用于投票）
        if (type === QUESTION_TYPE.CHECKBOX || innerType === QUESTION_TYPE.CHECKBOX) {
          value = value ? [value] : []
        }

        const data = {
          key: field,
          value: value
        }
        surveyStore.changeData(data)

        // 同步清理该题目的扩展输入（如 others/评分后输入），约定为 `${field}_*` 的键
        try {
          const prefix = `${field}_`
          const keys = Object.keys(formValues.value || {}).filter((k) => k.startsWith(prefix))
          keys.forEach((k) => {
            surveyStore.changeData({ key: k, value: '' })
          })
        } catch (e) {
          // ignore
        }

        // 持久化清空后的数据到本地存储：仅覆盖被隐藏题及其扩展键对应的缓存
        try {
          const surveyId = surveyStore.surveyPath
          const userId = surveyStore.userId
          const saved = getSurveyData(surveyId, userId) || {}
          const prefix = `${field}_`
          const clearedKeys = Object.keys(formValues.value || {}).filter((k) => k.startsWith(prefix))
          saved[field] = value
          clearedKeys.forEach((k) => { saved[k] = '' })
          setSurveyData(surveyId, saved, userId)
        } catch (e) {
          // ignore
        }

        processJumpSkip()
      }
    }
  }
)

// 当选项被隐藏时，清理当前题目已选择的隐藏选项
watch(
  () => {
    const cfg = questionConfig.value || {}
    return [cfg?.options, formValues.value[props.moduleConfig.field]]
  },
  ([, currVal]) => {
    try {
      const { type, field } = props.moduleConfig
      const options = (questionConfig.value && questionConfig.value.options) || []
      const hiddenHashes = options.filter((o) => o && o.hide).map((o) => o.hash)
      if (!hiddenHashes.length) return

      if (type === QUESTION_TYPE.CHECKBOX && Array.isArray(currVal)) {
        const filtered = currVal.filter((h) => !hiddenHashes.includes(h))
        if (JSON.stringify(filtered) !== JSON.stringify(currVal)) {
          surveyStore.changeData({ key: field, value: filtered })
        }
      } else if (type !== QUESTION_TYPE.CHECKBOX && typeof currVal === 'string') {
        if (hiddenHashes.includes(currVal)) {
          surveyStore.changeData({ key: field, value: '' })
        }
      }
    } catch (e) {
      // ignore
    }
  },
  { deep: true }
)

// 解析跳转逻辑
const processJumpSkip = () => {
  const targetResult = surveyStore.jumpLogicEngine
    .getResultsByField(changeField.value, surveyStore.formValues)
    .map((item) => {
      // 获取目标题的序号，处理跳转问卷末尾为最大题的序号
      const index =
        item.target === 'end'
          ? surveyStore.dataConf.dataList.length
          : questionStore.getQuestionIndexByField(item.target)
      return {
        index,
        ...item
      }
    })
  const notMatchedFields = targetResult.filter((item) => !item.result)
  const matchedFields = targetResult.filter((item) => item.result)
  // 目标题均未匹配，需要展示出来条件题和目标题之间的题目
  if (notMatchedFields.length) {
    notMatchedFields.forEach((element) => {
      const endIndex = element.index
      const fields = surveyStore.dataConf.dataList
        .slice(changeIndex.value + 1, endIndex)
        .map((item) => item.field)
      // hideMap中remove被跳过的题
      questionStore.removeNeedHideFields(fields)
    })
  }

  if (!matchedFields.length) return
  // 匹配到多个目标题时，取最大序号的题目
  const maxIndexQuestion = matchedFields
    .filter((item) => item.result)
    .sort((a, b) => b.index - a.index)[0].index

  // 条件题和目标题之间的题目隐藏
  const skipKey = surveyStore.dataConf.dataList
    .slice(changeIndex.value + 1, maxIndexQuestion)
    .map((item) => item.field)
  questionStore.addNeedHideFields(skipKey)

  // 清空所有被跳转隐藏的题目答案
  skipKey.forEach((f) => clearAnswerForField(f))
}

// 根据显示逻辑清空被隐藏的目标题答案
const processShowLogicClear = () => {
  try {
    const lastChanged = changeField.value
    if (!lastChanged) return
    const showTargets = surveyStore.showLogicEngine && surveyStore.showLogicEngine.getResultsByField
      ? surveyStore.showLogicEngine.getResultsByField(lastChanged, surveyStore.formValues)
      : []
    showTargets
      .filter((t) => t && t.target && t.result === false)
      .forEach((t) => {
        if (questionStore.questionData?.[t.target]) {
          clearAnswerForField(t.target)
        }
      })
  } catch (e) {
    // ignore
  }
}
/** 问卷逻辑处理 */
</script>
