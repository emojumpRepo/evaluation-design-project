<template>
  <div class="condition-wrapper" :class="{ 'is-last': isLastCondition }">
    <span class="desc">如果</span>
    <el-form-item :prop="`conditions[${index}].field`"
      :rules="[{ required: true, message: '请选择题目', trigger: 'change' }]">
      <el-select class="select field-select" v-model="conditionField" placeholder="请选择题目"
        @change="(val: any) => handleChange(conditionNode, 'field', val)">
        <el-option v-for="{ label, value } in fieldList" :key="value" :label="label" :value="value">
        </el-option>
        <template #empty> 无数据 </template>
      </el-select>
    </el-form-item>
    <span class="desc" v-if="conditionField !== '__scoreBetween'">选择了</span>
    <!-- 普通条件：选择某些选项 -->
    <el-form-item v-if="conditionField !== '__scoreBetween'" class="select value-select"
      :prop="`conditions[${index}].value`" :rules="[{ required: true, message: '请选择选项', trigger: 'change' }]">
      <el-select v-model="conditionValue" placeholder="请选择选项" multiple
        @change="(val: any) => handleChange(conditionNode, 'value', val)">
        <el-option v-for="{ label, value } in getRelyOptions" :key="value" :label="label" :value="value"></el-option>
        <template #empty> 无数据 </template>
      </el-select>
    </el-form-item>
    <!-- 分数组合条件：选择题目 + 分数区间 -->
    <template v-else>
      <span class="desc">选择题目</span>
      <el-form-item class="select value-select">
        <el-select v-model="scoreFields" placeholder="请选择题目" multiple collapse-tags collapse-tags-tooltip
          @change="onScoreBetweenChange">
          <el-option v-for="{ label, value } in getRelyOptions" :key="value" :label="label" :value="value"></el-option>
          <template #empty> 无数据 </template>
        </el-select>
      </el-form-item>
      <span class="desc">的分数总和</span>
      <el-input-number v-model="scoreMin" :min="0" :controls="false" class="score-input"
        @change="onScoreBetweenChange" />
      <span class="desc">至</span>
      <el-input-number v-model="scoreMax" :min="0" :controls="false" class="score-input"
        @change="onScoreBetweenChange" />
    </template>
    <span class="desc" v-if="conditionField !== '__scoreBetween'">中的任一选项 </span>
    <span class="opt">
      <i-ep-plus class="opt-icon opt-icon-plus" @click="handleAdd" />
      <i-ep-minus class="opt-icon" v-if="index > 0" :size="14" @click="() => handleDelete(conditionNode.id)" />
    </span>

    <!-- 分组控制（每条条件可单独设置） -->
    <template v-if="enableGroup">
      <div class="group-control">
        <el-tag size="small" type="info" effect="plain" class="group-badge">组 {{ groupIdLocal }}</el-tag>
        <el-button size="small" type="primary" link @click="nextGroup(conditionNode)">新组</el-button>
      </div>
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed, inject, ref, watch, type ComputedRef } from 'vue'
import { ConditionNode, RuleNode } from '@/common/logicEngine/RuleBuild'
import { CHOICES } from '@/common/typeEnum'
import { Operator } from '@/common/logicEngine/BasicType'
import { cleanRichTextWithMediaTag } from '@/common/xss'
import { useEditStore } from '@/management/stores/edit'
const renderData = inject<ComputedRef<Array<any>>>('renderData') || ref([])
const props = defineProps({
  index: {
    type: Number,
    default: 0
  },
  ruleNode: {
    type: RuleNode,
    default: () => {
      return {}
    }
  },
  conditionNode: {
    type: ConditionNode,
    default: () => {
      return {
        field: '',
        operator: '',
        value: ''
      }
    }
  },
  enableGroup: {
    type: Boolean,
    default: false
  }
})
const editStore = useEditStore()
const fieldList = computed(() => {
  const list = renderData?.value || []
  const currentIndex = list.findIndex((item) => item.field === props.ruleNode.target)
  const questionFields = list
    .slice(0, currentIndex)
    .filter((question: any) => CHOICES.includes(question.type))
    .map((item: any) => {
      return {
        label: `${item.showIndex ? item.indexNumber + '.' : ''} ${cleanRichTextWithMediaTag(item.title)}`,
        value: item.field
      }
    })

  // 追加显隐控制词虚拟字段
  const extra = [
    { label: '显隐控制词', value: '__controlWords' },
    { label: '分数合计（选择多题目）', value: '__scoreBetween' }
  ]
  return [...extra, ...questionFields]
})
const getRelyOptions = computed(() => {
  const { field } = props.conditionNode
  if (!field) {
    return []
  }
  if (field === '__scoreBetween') {
    // 选择要计分的题目列表
    return (renderData?.value || [])
      .filter((q) => CHOICES.includes(q.type))
      .map((q) => ({
        label: `${q.showIndex ? q.indexNumber + '.' : ''} ${cleanRichTextWithMediaTag(q.title)}`,
        value: q.field
      }))
  }
  // 针对显隐控制词：从问卷设置中读取配置
  if (field === '__controlWords') {
    const words = (editStore.schema?.baseConf as any)?.controlWords || []
    return (words || []).map((w: string) => ({ label: w, value: w }))
  }
  const currentQuestion = (renderData?.value || []).find((item) => item.field === field)
  return (
    currentQuestion?.options.map((item: any) => {
      return {
        label: cleanRichTextWithMediaTag(item.text),
        value: item.hash
      }
    }) || []
  )
})

const conditionField = computed(() => {
  return props.conditionNode.field
})

const conditionValue = computed(() => {
  return props.conditionNode.value
})

// 分数区间本地状态
const scoreMin = ref<number | undefined>(undefined)
const scoreMax = ref<number | undefined>(undefined)
const scoreFields = ref<string[]>([])
watch(
  () => props.conditionNode,
  (node: any) => {
    const v: any = (node && (node as any).value) || {}
    scoreMin.value = typeof v?.min === 'number' ? v.min : undefined
    scoreMax.value = typeof v?.max === 'number' ? v.max : undefined
    scoreFields.value = Array.isArray(v?.fields) ? v.fields : []
  },
  { immediate: true, deep: true }
)
const onScoreBetweenChange = () => {
  const value = {
    fields: scoreFields.value,
    min: scoreMin.value,
    max: scoreMax.value
  }
  props.conditionNode.setOperator(Operator.ScoreBetween as any)
  props.conditionNode.setValue(value as any)
}

const scoreFieldsText = computed(() => {
  if (!scoreFields.value?.length) return ''
  const map = new Map((renderData?.value || []).map((q: any) => [q.field, q]))
  const labels = scoreFields.value.map((f) => {
    const q: any = map.get(f)
    if (!q) return f
    const base = q.type === 'description'
      ? (q?.content || '').replace(/<[^>]*>/g, '').slice(0, 30) || '描述文本'
      : `${q.showIndex ? q.indexNumber + '.' : ''} ${cleanRichTextWithMediaTag(q.title)}`
    return base
  })
  return labels.join('，')
})
const scoreRangeText = computed(() => {
  const hasMin = typeof scoreMin.value === 'number'
  const hasMax = typeof scoreMax.value === 'number'
  if (hasMin && hasMax) return `${scoreMin.value} ~ ${scoreMax.value}`
  if (hasMin) return `≥ ${scoreMin.value}`
  if (hasMax) return `≤ ${scoreMax.value}`
  return '未设置'
})

const isLastCondition = computed(() => {
  return props.index === props.ruleNode.conditions.length - 1
})

const handleChange = (conditionNode: ConditionNode, key: string, value: any) => {
  switch (key) {
    case 'field':
      conditionNode.setField(value)
      // 前置题改变清空选项
      conditionNode.setValue([])
      break
    case 'operator':
      conditionNode.setOperator(value)
      break
    case 'value':
      conditionNode.setValue(value)
      break
  }
}

const handleAdd = () => {
  const cond = new ConditionNode()
  // 默认继承上一行的分组与关系，便于成组编辑
  const last = props.ruleNode.conditions[props.ruleNode.conditions.length - 1] as any
  if (last) {
    cond.groupId = last.groupId
    cond.groupComparor = last.groupComparor
  }
  props.ruleNode.addCondition(cond)
}

const emit = defineEmits(['delete'])
const handleDelete = (id: any) => {
  emit('delete', id)
}

// 分组本地状态与同步
const groupIdLocal = ref<number>((props.conditionNode as any)?.groupId ?? 0)
const groupComparorLocal = ref<'and' | 'or'>(((props.conditionNode as any)?.groupComparor as any) || 'and')
watch(
  () => props.conditionNode,
  (node: any) => {
    groupIdLocal.value = typeof node?.groupId === 'number' ? node.groupId : 0
    groupComparorLocal.value = (node?.groupComparor === 'or' ? 'or' : 'and') as any
  },
  { immediate: true, deep: true }
)
const onGroupChange = (node: any) => {
  ; (node as any).groupId = Number(groupIdLocal.value) || 0
    ; (node as any).groupComparor = groupComparorLocal.value
}
const nextGroup = (node: any) => {
  groupIdLocal.value = (Number(groupIdLocal.value) || 0) + 1
  onGroupChange(node)
}
</script>

<style lang="scss" scoped>
.condition-wrapper {
  width: 100%;
  position: relative;
  display: flex;
  padding: 24px 0;
  align-items: center;
  flex-wrap: wrap;

  .desc {
    display: inline-block;
    margin-right: 12px;
    color: #333;
    line-height: 32px;
  }

  .opt {
    display: flex;
    align-items: center;

    .opt-icon {
      cursor: pointer;
      font-size: 12px;
    }

    .opt-icon-plus {
      margin-right: 10px;
    }
  }

  .el-form-item {
    display: inline-block;
    vertical-align: top !important;
    margin-right: 12px;
    margin-bottom: 0px;
  }
}

.value-select {
  min-width: 220px;
}

.score-input {
  width: 80px;
  margin-right: 12px;
}

.group-input {
  width: 90px;
  margin-left: 8px;
}

.group-comparor {
  margin-left: 6px;
}

.group-badge {
  margin-left: 8px;
}

.group-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.select {
  width: 240px;
}

.summary {
  margin-top: 12px;
  color: #909399;
  font-size: 12px;
  text-align: left;
}
</style>
