<template>
  <div class="rule-wrapper">
    <el-form :hide-required-asterisk="true" class="form" ref="ruleForm" :inline="true" :model="ruleNode">
      <div class="comparor-line">
        <div class="enable-group">
          <span class="desc">启用分组</span>
          <el-switch v-model="enableGroup" size="small" />
        </div>
        <div class="preview">
          <span>当前规则：</span>
          <span>{{ expressionText }}</span>
        </div>
      </div>
      <template v-for="(conditionNode, index) in (ruleNode?.conditions || [])" :key="conditionNode?.id || index">
        <div v-if="index > 0" class="between-rel">
          <el-radio-group v-model="joins[index-1]" size="small" @change="(v: any) => onJoinChange(index-1, v)">
            <el-radio-button label="and">且</el-radio-button>
            <el-radio-button label="or">或</el-radio-button>
          </el-radio-group>
        </div>
        <ConditionView :index="index" :ruleNode="ruleNode" :conditionNode="conditionNode" :enable-group="enableGroup"
          @delete="handleDeleteCondition"></ConditionView>
      </template>
      <div class="target-wrapper">
        <div class="line">
          <span class="desc">则显示</span>
          <el-form-item prop="target" :rules="[{ required: true, message: '请选择目标题目', trigger: 'change' }]">
            <el-select class="select field-select" v-model="selectedTargets" placeholder="请选择题目" multiple collapse-tags
              collapse-tags-tooltip @change="(val: any) => handleChange(ruleNode, 'target', val)">
              <el-option v-for="{ label, value, disabled } in targetQuestionList" :key="value" :label="label"
                :disabled="disabled && ruleNode.target !== value" :value="value">
              </el-option>
              <template #empty> 无数据 </template>
            </el-select>
          </el-form-item>
        </div>
        <i-ep-delete style="font-size: 14px" @click="() => handleDelete(ruleNode.id)" />
      </div>
    </el-form>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, shallowRef, inject, type ComputedRef, watch } from 'vue'
import { cloneDeep } from 'lodash-es'
import { ElMessageBox } from 'element-plus'
import 'element-plus/theme-chalk/src/message-box.scss'
import { RuleNode, ConditionNode } from '@/common/logicEngine/RuleBuild'
import { Scope } from '@/common/logicEngine/BasicType'
import { cleanRichText } from '@/common/xss'
import { useEditStore } from '@/management/stores/edit'
import { storeToRefs } from 'pinia'
const editStore = useEditStore()
const { showLogicEngine } = storeToRefs(editStore)
import ConditionView from './ConditionView.vue'

const renderData = inject<ComputedRef<Array<any>>>('renderData') || ref([])

const props = defineProps({
  ruleNode: {
    type: RuleNode,
    default: () => { }
  }
})
const emit = defineEmits(['delete'])
const selectedTargets = ref<string[]>([])
const comparor = ref('and')
const joins = ref<Array<'and' | 'or'>>([])
const enableGroup = ref(false)
// 初始化与外部同步
watch(
  () => props.ruleNode.target,
  (v: string) => {
    const next = v ? [v] : []
    if (JSON.stringify(next) !== JSON.stringify(selectedTargets.value)) {
      selectedTargets.value = next
    }
  },
  { immediate: true }
)
watch(
  () => props.ruleNode?.comparor,
  (v: any) => {
    comparor.value = v || 'and'
  },
  { immediate: true }
)
watch(
  () => props.ruleNode?.conditions,
  (list: any) => {
    const n = (list || []).length
    const need = Math.max(n - 1, 0)
    if (joins.value.length !== need) {
      const next: Array<'and'|'or'> = []
      for (let i = 0; i < need; i++) {
        next[i] = (props.ruleNode as any)?.joins?.[i] || joins.value[i] || 'and'
      }
      joins.value = next
      ;(props.ruleNode as any).joins = next
    }
  },
  { immediate: true, deep: true }
)
const handleChange = (ruleNode: any, key: any, value: any) => {
  switch (key) {
    case 'target':
      // 支持一次选择多道目标题：第一个作为当前规则，其他目标克隆为新规则
      if (Array.isArray(value)) {
        const list = value.filter(Boolean)
        if (list.length === 0) return
        // 当前规则使用第一个
        ruleNode.setTarget(list[0])
        // 仅支持题目级
        ruleNode.scope = Scope.Question
        // 其余目标创建新规则并复制条件
        list.slice(1).forEach((t: string) => {
          // 避免重复目标
          const existsInQuestion = showLogicEngine.value.findTargetsByScope('question').includes(t)
          if (existsInQuestion) return
          const newRule = new RuleNode()
          newRule.setTarget(t)
          newRule.scope = Scope.Question
            ; (ruleNode.conditions || []).forEach((c: any) => {
              const cond = new ConditionNode(c.field, c.operator, cloneDeep(c.value))
              newRule.addCondition(cond)
            })
          showLogicEngine.value.addRule(newRule)
        })
      } else {
        ruleNode.setTarget(value)
        ruleNode.scope = Scope.Question
      }
      break
    case 'comparor':
      ruleNode.comparor = value === 'or' ? 'or' : 'and'
      break
  }
}
const onJoinChange = (idx: number, v: any) => {
  const val = v === 'or' ? 'or' : 'and'
  joins.value[idx] = val
  ;(props.ruleNode as any).joins = [...joins.value]
}
// 仅在“从开到关”的用户切换时清空分组；初始化或从关到开不清空
watch(
  () => enableGroup.value,
  (val, oldVal) => {
    if (oldVal === true && val === false) {
      (props.ruleNode?.conditions || []).forEach((c: any) => {
        c.groupId = 0
        c.groupComparor = 'and'
      })
    }
  }
)

// 根据已回填的条件自动判断是否启用分组（用于刷新/回填）
const computeEnableGroup = () => {
  const list: any[] = props.ruleNode?.conditions || []
  if (!list.length) return false
  const gids = new Set<number>()
  let hasCustom = false
  list.forEach((c: any) => {
    const gid = typeof c.groupId === 'number' ? c.groupId : 0
    gids.add(gid)
    if (c.groupComparor === 'or') hasCustom = true
  })
  return gids.size > 1 || hasCustom
}
watch(
  () => props.ruleNode?.conditions,
  () => {
    // 仅当用户未主动开关时，按内容自动判定
    enableGroup.value = computeEnableGroup()
  },
  { deep: true, immediate: true }
)
// 规则可读表达式（按 joins 渲染；有分组则组内按 joins、组间按规则级关系）
const expressionText = computed(() => {
  try {
    const list = (props.ruleNode?.conditions || []).map((c: any, i: number) => ({ c, i }))
    if (!list.length) return '（未添加条件）'
    const joinsArr: Array<'and' | 'or'> = ((props.ruleNode as any)?.joins || []).slice()
    const hasAnyGroup = list.some(({ c }: any) => typeof c.groupId === 'number' && c.groupId !== 0)

    const renderCond = (c: any) => {
      // 分数合计：展示题目列表与区间
      if (c.operator === 'score_between') {
        const v = (c && c.value) || {}
        const fields: string[] = Array.isArray(v.fields) ? v.fields : []
        const min = typeof v.min === 'number' ? v.min : undefined
        const max = typeof v.max === 'number' ? v.max : undefined
        const labels = fields.map((f) => {
          const q = (renderData.value || []).find((x: any) => x.field === f)
          return q ? cleanRichText(q.title) : f
        })
        const range = typeof min === 'number' && typeof max === 'number'
          ? `${min} ~ ${max}`
          : typeof min === 'number'
            ? `≥ ${min}`
            : typeof max === 'number'
              ? `≤ ${max}`
              : '未设置'
        return `【${labels.join('、')}】 的分数总和在 【${range}】`
      }
      // 显隐控制词：展示选择词
      if (c.field === '__controlWords') {
        const words = Array.isArray(c.value) ? c.value : (c.value ? [c.value] : [])
        return `【 显隐控制词 】 选择了 【${words.join('、')}】`
      }
      const q = (renderData.value || []).find((q: any) => q.field === c.field)
      let title = q ? cleanRichText(q.title) : c.field
      if (Array.isArray(c.value) && q?.options) {
        const labels = q.options
          .filter((op: any) => (c.value || []).includes(op.hash))
          .map((op: any) => cleanRichText(op.text))
        if (labels.length) title = `【${title}】 选择了 【${labels.join('、')}】`
      }
      return title
    }

    if (!hasAnyGroup) {
      const pieces: string[] = []
      list.forEach(({ c, i }: any, idx: number) => {
        pieces.push(renderCond(c))
        if (idx < list.length - 1) {
          const op = joinsArr[i] === 'or' ? '或' : '且'
          pieces.push(op)
        }
      })
      return pieces.join(' ')
    }

    const groups = new Map<number, Array<{ c: any; i: number }>>()
    list.forEach(({ c, i }: any) => {
      const gid = typeof c.groupId === 'number' ? c.groupId : 0
      const arr = groups.get(gid) || []
      arr.push({ c, i })
      groups.set(gid, arr)
    })
    const groupExprs: string[] = []
    groups.forEach((arr) => {
      const conds = arr.sort((a, b) => a.i - b.i)
      const parts: string[] = []
      conds.forEach(({ c, i }, idx) => {
        parts.push(renderCond(c))
        if (idx < conds.length - 1) {
          const op = joinsArr[i] === 'or' ? '或' : '且'
          parts.push(op)
        }
      })
      const inner = parts.join(' ')
      groupExprs.push(conds.length > 1 ? `（ ${inner} ）` : inner)
    })
    const ruleComp = (props.ruleNode?.comparor === 'or') ? '或' : '且'
    return groupExprs.join(` ${ruleComp} `)
  } catch (e) {
    return ''
  }
})
const handleDelete = async (id: any) => {
  await ElMessageBox.confirm('是否确认删除规则？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
  emit('delete', id)
}
const handleDeleteCondition = (id: any) => {
  props.ruleNode.removeCondition(id)
}
const ruleForm = shallowRef<any>(null)
const submitForm = () => {
  ruleForm.value?.validate((valid: any) => {
    if (valid) {
      return true
    } else {
      return false
    }
  })
}
const targetQuestionList = computed(() => {
  const currntIndexs: number[] = []
  props.ruleNode.conditions.forEach((el) => {
    currntIndexs.push(
      renderData.value.findIndex((item: { field: string }) => item.field === el.field)
    )
  })
  const currntIndex = Math.max(...currntIndexs)
  let questionList = cloneDeep(renderData.value.slice(currntIndex + 1))
  const usedQuestions = showLogicEngine.value?.findTargetsByScope?.('question') || []

  const items: Array<{ label: string; value: string; disabled?: boolean }> = []
  questionList.forEach((item: any) => {
    const isDescription = item.type === 'description'
    const baseLabel = isDescription
      ? (item?.content || '').replace(/<[^>]*>/g, '').slice(0, 30) || '描述文本'
      : `${item.showIndex ? item.indexNumber + '.' : ''} ${cleanRichText(item.title)}`
    // 题目级目标
    items.push({
      label: baseLabel,
      value: item.field,
      disabled: usedQuestions.includes(item.field)
    })
  })

  return items
})
defineExpose({
  submitForm
})
</script>
<style lang="scss" scoped>
.rule-wrapper {
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  padding: 10px 24px;
  border: 1px solid #e3e4e8;
  border-radius: 2px;
  display: flex;
  margin: 12px auto;
  box-sizing: border-box;

  .form {
    width: 100%;
  }

  .target-wrapper {
    padding: 24px 0;
    display: flex;
    align-items: center;
    border-top: 1px dashed #e3e4e8;
    padding-top: 24px;
  }

  .desc {
    display: inline-block;
    margin-right: 12px;
    color: #333;
    line-height: 32px;
  }

  .comparor-line {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    gap: 12px;

    .enable-group {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-shrink: 0;
    }

    .preview {
      width: 100%;
      margin-top: 6px;
      color: #909399;
      text-align: left;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }
  }

  .between-rel {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 2px 0 10px 0;
    position: relative;

    &:before,
    &:after {
      content: '';
      display: block;
      height: 1px;
      background: #ebeef5;
      flex: 1 1 auto;
      margin: 0 10px;
    }

    :deep(.el-radio-group) {
      background: #f5f7fa;
      border: 1px solid #ebeef5;
      border-radius: 16px;
      padding: 0 2px;
    }

    :deep(.el-radio-button__inner) {
      padding: 4px 10px;
      height: 24px;
      line-height: 16px;
    }
  }

  .el-form-item {
    display: inline-block;
    vertical-align: top !important;
    margin-bottom: 0px;
  }
}

.select {
  width: 200px;
}
</style>
