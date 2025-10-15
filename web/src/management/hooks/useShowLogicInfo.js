import { computed, unref } from 'vue'
import { useQuestionInfo } from './useQuestionInfo'
import { flatten } from 'lodash-es'
import { cleanRichText } from '@/common/xss'
import { useEditStore } from '../stores/edit'
import { storeToRefs } from 'pinia'

// 目标题的显示逻辑提示文案
export const useShowLogicInfo = (field) => {
  const editStore = useEditStore()
  const { showLogicEngine } = storeToRefs(editStore)

  const hasShowLogic = computed(() => {
    const logicEngine = showLogicEngine.value
    // 判断该题是否作为了显示逻辑前置题
    const isField = logicEngine?.findTargetsByField(field)?.length > 0
    // 判断该题是否作为了显示逻辑目标题
    const isTarget = logicEngine?.findConditionByTarget(field)?.length > 0
    return isField || isTarget
  })
  const getShowLogicText = computed(() => {
    const logicEngine = showLogicEngine.value
    // 获取目标题的规则
    const rules = logicEngine?.findConditionByTarget(field) || []
    // 若存在分组字段，按组构造更清晰的文案
    const conditions = flatten(rules).map((item) => {
      // 特殊字段：显隐控制词
      if (item.field === '__controlWords') {
        const words = Array.isArray(unref(item.value)) ? unref(item.value) : [unref(item.value)]
        const text = (words || []).filter(Boolean).join('、')
        return `<span>【 显隐控制词 】 选择了 【${text}】</span> <br/>`
      }
      // 分数合计
      if (item.operator === 'score_between') {
        const v = unref(item.value) || {}
        const fields = Array.isArray(v.fields) ? v.fields : []
        const min = typeof v.min === 'number' ? v.min : undefined
        const max = typeof v.max === 'number' ? v.max : undefined
        // 题目标题
        const labels = fields.map((f) => {
          const { getQuestionTitle } = useQuestionInfo(f)
          return cleanRichText(getQuestionTitle.value())
        })
        const range =
          typeof min === 'number' && typeof max === 'number'
            ? `${min} ~ ${max}`
            : typeof min === 'number'
              ? `≥ ${min}`
              : typeof max === 'number'
                ? `≤ ${max}`
                : '未设置'
        return `<span>【 ${labels.join('、')} 】 的分数总和在 【${range}】</span> <br/>`
      }
      // 默认：题目与选项
      const { getQuestionTitle, getOptionTitle } = useQuestionInfo(item.field)
      return `<span>【 ${cleanRichText(getQuestionTitle.value())}】 选择了 【${getOptionTitle.value(unref(item.value)).join('、')}】</span> <br/>`
    })
    return conditions.length
      ? conditions.join('') + '<span> &nbsp;满足以上全部，则显示本题</span>'
      : ''
  })
  return { hasShowLogic, getShowLogicText }
}
