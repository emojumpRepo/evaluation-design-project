<template>
  <div
    class="condition-wrapper"
    :class="{ 'is-last': isLastCondition }"
    :data-content-before="!isLastCondition ? '且' : ''"
  >
    <span class="desc">如果</span>
    <el-form-item
      :prop="`conditions[${index}].field`"
      :rules="[{ required: true, message: '请选择题目', trigger: 'change' }]"
    >
      <el-select
        class="select field-select"
        v-model="conditionField"
        placeholder="请选择题目"
        @change="(val: any) => handleChange(conditionNode, 'field', val)"
      >
        <el-option v-for="{ label, value } in fieldList" :key="value" :label="label" :value="value">
        </el-option>
        <template #empty> 无数据 </template>
      </el-select>
    </el-form-item>
    <span class="desc">选择了</span>
    <el-form-item
      class="select value-select"
      :prop="`conditions[${index}].value`"
      :rules="[{ required: true, message: '请选择选项', trigger: 'change' }]"
    >
      <el-select
        v-model="conditionValue"
        placeholder="请选择选项"
        multiple
        @change="(val: any) => handleChange(conditionNode, 'value', val)"
      >
        <el-option
          v-for="{ label, value } in getRelyOptions"
          :key="value"
          :label="label"
          :value="value"
        ></el-option>
        <template #empty> 无数据 </template>
      </el-select>
    </el-form-item>
    <span class="desc">中的任一选项 </span>
    <span class="opt">
      <el-button 
        type="primary" 
        :icon="Plus" 
        circle
        size="small"
        @click="handleAdd"
        title="添加条件"
      />
      <el-button 
        type="danger" 
        :icon="Minus"
        circle
        size="small"
        v-if="index > 0"
        @click="() => handleDelete(conditionNode.id)"
        title="删除条件"
      />
    </span>
  </div>
</template>
<script setup lang="ts">
import { computed, inject, ref, type ComputedRef } from 'vue'
import { ConditionNode, RuleNode } from '@/common/logicEngine/RuleBuild'
import { CHOICES } from '@/common/typeEnum'
import { cleanRichTextWithMediaTag } from '@/common/xss'
import { Plus, Minus } from '@element-plus/icons-vue'
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
  }
})
const fieldList = computed(() => {
  const currentIndex = renderData.value.findIndex((item) => item.field === props.ruleNode.target)
  return renderData.value
    .slice(0, currentIndex)
    .filter((question: any) => CHOICES.includes(question.type))
    .map((item: any) => {
      return {
        label: `${item.showIndex ? item.indexNumber + '.' : ''} ${cleanRichTextWithMediaTag(item.title)}`,
        value: item.field
      }
    })
})
const getRelyOptions = computed(() => {
  const { field } = props.conditionNode
  if (!field) {
    return []
  }
  const currentQuestion = renderData.value.find((item) => item.field === field)
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
  props.ruleNode.addCondition(new ConditionNode())
}

const emit = defineEmits(['delete'])
const handleDelete = (id: any) => {
  emit('delete', id)
}
</script>

<style lang="scss" scoped>
.condition-wrapper {
  width: 100%;
  position: relative;
  display: flex;
  padding: 24px 0;
  &.is-last::before,
  &.is-last::after {
    content: '';
    display: block;
    width: calc(100% - 32px);
    border-top: 1px dashed #e3e4e8;
    position: absolute;
    left: 32px;
    bottom: 0;
  }
  &:not(.is-last)::before {
    content: attr(data-content-before);
    bottom: 0px;
    width: 20px;
    height: 20px;
    background: #fef6e6;
    border-radius: 2px;
    color: #faa600;
    font-size: 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    position: absolute;
    bottom: -8px;
  }
  &:not(.is-last)::after {
    content: '';
    display: block;
    width: calc(100% - 32px);
    border-top: 1px dashed #e3e4e8;
    position: absolute;
    left: 32px;
    bottom: 0;
  }
  .desc {
    display: inline-block;
    margin-right: 12px;
    color: #333;
    line-height: 32px;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 12px;
    
    .el-button {
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      
      &:hover {
        transform: scale(1.1);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      }
      
      &.el-button--primary {
        background-color: #409eff;
        border-color: #409eff;
        
        &:hover {
          background-color: #66b1ff;
          border-color: #66b1ff;
        }
      }
      
      &.el-button--danger {
        background-color: #f56c6c;
        border-color: #f56c6c;
        
        &:hover {
          background-color: #f78989;
          border-color: #f78989;
        }
      }
    }
  }
  .el-form-item {
    display: inline-block;
    vertical-align: top !important;
    margin-right: 12px;
    margin-bottom: 0px;
  }
}
.select {
  width: 200px;
}
</style>
