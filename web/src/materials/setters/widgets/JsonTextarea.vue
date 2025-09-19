<template>
  <div class="json-textarea-wrapper">
    <el-input
      v-model="modelValue"
      type="textarea"
      :rows="formConfig.rows || 6"
      :placeholder="formConfig.placeholder"
      @blur="handleBlur"
      @input="handleInput"
    />
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>
    <div v-if="formConfig.tip && !errorMessage" class="tip-message">
      {{ formConfig.tip }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { get as _get } from 'lodash-es'
import { FORM_CHANGE_EVENT_KEY } from '@/materials/setters/constant'

interface Props {
  formConfig: any
  moduleConfig: any
}

interface Emit {
  (ev: typeof FORM_CHANGE_EVENT_KEY, arg: { key: string; value: any }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emit>()

const modelValue = ref('')
const errorMessage = ref('')

// 初始化值
const initValue = () => {
  const value = _get(props.moduleConfig, props.formConfig.key, props.formConfig.value)
  if (typeof value === 'object') {
    modelValue.value = JSON.stringify(value, null, 2)
  } else if (typeof value === 'string') {
    modelValue.value = value || props.formConfig.value || '{}'
  } else {
    modelValue.value = props.formConfig.value || '{}'
  }
}

onMounted(() => {
  initValue()
})

// 监听配置变化
watch(
  () => props.moduleConfig,
  () => {
    initValue()
  },
  { deep: true }
)

// 验证JSON格式
const validateJson = (value: string): { valid: boolean; message?: string } => {
  if (!value || value.trim() === '') {
    return { valid: false, message: '请输入JSON配置' }
  }
  
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, message: '必须是JSON对象格式' }
    }
    return { valid: true }
  } catch (e) {
    return { valid: false, message: 'JSON格式错误，请检查语法' }
  }
}

// 处理输入
const handleInput = (value: string) => {
  modelValue.value = value
  errorMessage.value = ''
}

// 处理失焦，验证并提交
const handleBlur = () => {
  const validation = validateJson(modelValue.value)
  
  if (!validation.valid) {
    errorMessage.value = validation.message || 'JSON格式错误'
    return
  }
  
  errorMessage.value = ''
  
  // 发送格式化后的JSON
  try {
    const parsed = JSON.parse(modelValue.value)
    const formatted = JSON.stringify(parsed, null, 2)
    modelValue.value = formatted
    
    emit(FORM_CHANGE_EVENT_KEY, {
      key: props.formConfig.key,
      value: formatted
    })
  } catch (e) {
    // 如果解析失败，发送原始值
    emit(FORM_CHANGE_EVENT_KEY, {
      key: props.formConfig.key,
      value: modelValue.value
    })
  }
}
</script>

<style lang="scss" scoped>
.json-textarea-wrapper {
  width: 100%;
  
  :deep(.el-textarea__inner) {
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.5;
  }
  
  .error-message {
    color: #f56c6c;
    font-size: 12px;
    margin-top: 4px;
  }
  
  .tip-message {
    color: #909399;
    font-size: 12px;
    margin-top: 4px;
  }
}
</style>