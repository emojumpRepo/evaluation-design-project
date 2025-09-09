<template>
  <el-form-item class="pick-wrap">
    <el-color-picker
      :modelValue="formConfig.value"
      :show-alpha="formConfig.showAlpha ?? true"
      :predefine="formConfig.predefine"
      :teleported="true"
      :popper-class="'color-picker-popper'"
      :clearable="formConfig.clearable ?? true"
      @change="handleColorPickerChange"
    ></el-color-picker>
    <el-button
      v-if="formConfig.allowTransparent"
      size="small"
      link
      type="primary"
      @click="setTransparent"
    >透明</el-button>
  </el-form-item>
</template>
<script setup lang="ts">
import { FORM_CHANGE_EVENT_KEY } from '@/materials/setters/constant'

interface Props {
  formConfig: any
}

interface Emit {
  (ev: typeof FORM_CHANGE_EVENT_KEY, arg: { key: string; value: string }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emit>()

const handleColorPickerChange = (value: string) => {
  const key = props.formConfig.key
  emit(FORM_CHANGE_EVENT_KEY, { key, value })
}

const setTransparent = () => {
  const key = props.formConfig.key
  emit(FORM_CHANGE_EVENT_KEY, { key, value: 'transparent' })
}
</script>
<style lang="scss" scoped>
.pick-wrap {
  width: 100%;

  :deep(.el-form-item__content) {
    width: 100%;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}

/* 提升 ColorPicker 弹层层级，避免被父容器裁剪遮挡 */
:global(.color-picker-popper) {
  z-index: 3000;
}
</style>
