<template>
  <div class="textarea-setter">
    <el-input type="textarea" :model-value="formConfig.value" @input="handleChange"
      :placeholder="formConfig.placeholder || '请输入'" :rows="formConfig.rows || 4" :maxlength="formConfig.maxlength"
      show-word-limit />
  </div>
  <div v-if="formConfig.tip" class="setter-tip">
    <i-ep-questionFilled class="tip-icon" />
    <span>{{ formConfig.tip }}</span>
  </div>
</template>

<script setup>
import { FORM_CHANGE_EVENT_KEY } from '@/materials/setters/constant'

const props = defineProps({
  formConfig: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits([FORM_CHANGE_EVENT_KEY])

const handleChange = (value) => {
  emit(FORM_CHANGE_EVENT_KEY, {
    key: props.formConfig.key,
    value
  })
}
</script>

<style lang="scss" scoped>
.textarea-setter {
  :deep(.el-textarea__inner) {
    font-family: 'Courier New', Courier, monospace;
  }
}

.setter-tip {
  display: block;
  margin-top: 12px;
  padding: 12px 16px;
  font-size: 12px;
  line-height: 1.8;
  color: #606266;
  background-color: #f4f4f5;
  border-left: 3px solid #04dc70;
  border-radius: 4px;
  white-space: pre-line;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB',
    'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;

  .tip-icon {
    display: none;
  }
}
</style>
