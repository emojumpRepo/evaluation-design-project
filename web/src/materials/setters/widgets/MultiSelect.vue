<template>
  <el-select
    :placeholder="placeholder"
    v-model="modelValue"
    @change="handleSelectChange"
    multiple
    popper-class="option-list-width"
    :disabled="formConfig.disabled"
    :filterable="formConfig.filterable"
    :allow-create="formConfig.allowCreate"
    :default-first-option="formConfig.defaultFirstOption || true"
    clearable
  >
    <el-option
      v-for="item in options"
      :label="item.label"
      :title="item.label"
      :value="item.value"
      :key="item.value"
    />
  </el-select>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { cleanRichText } from '@/common/xss'
import { FORM_CHANGE_EVENT_KEY } from '@/materials/setters/constant'

interface Props {
  formConfig: any
  moduleConfig: any
}

interface Emit {
  (ev: typeof FORM_CHANGE_EVENT_KEY, arg: { key: string; value: Array<string> }): void
}

const emit = defineEmits<Emit>()
const props = defineProps<Props>()

const modelValue = ref(
  Array.isArray(props.formConfig?.value) ? props.formConfig.value : []
)
const placeholder = computed(() => props.formConfig.placeholder || props.formConfig.label)
const options = computed(() => {
  let list = []
  if (Array.isArray(props.formConfig?.options)) {
    list = props.formConfig.options
  } else if (props.formConfig?.optionsKey && props.moduleConfig) {
    const key = props.formConfig.optionsKey
    const source = (props.moduleConfig || {})[key] || []
    if (Array.isArray(source)) {
      list = source.map((v: any) => ({ label: String(v), value: String(v) }))
    }
  }

  return list.map((item: any) => {
    item.label = cleanRichText(item.label)
    return item
  })
})

const handleSelectChange = (value: Array<string>) => {
  const key = props.formConfig.key
  // 触发外部保存
  emit(FORM_CHANGE_EVENT_KEY, { key, value })
}

// 同步外部变更
watch(
  () => props.formConfig?.value,
  (val) => {
    const next = Array.isArray(val) ? val : []
    if (JSON.stringify(next) !== JSON.stringify(modelValue.value)) {
      modelValue.value = next
    }
  },
  { deep: true }
)

// 将新创建的选项（文本）回显到 options 中，避免无法选中
watch(
  () => modelValue.value,
  (vals) => {
    // 若外部没有提供 options，但允许创建，则根据已选值构造 options
    if ((!Array.isArray(props.formConfig?.options) && props.formConfig?.allowCreate) || props.formConfig?.optionsKey) {
      const existing = new Set((options.value || []).map((o: any) => o.value))
      const need = (vals || []).filter((v: any) => !existing.has(String(v)))
      if (need.length && props.formConfig?.optionsKey && props.moduleConfig) {
        const key = props.formConfig.optionsKey
        const source = (props.moduleConfig || {})[key] || []
        const merged = Array.from(new Set([...(Array.isArray(source) ? source : []), ...need.map((v: any) => String(v))]))
        // 直接向外抛变更，由上层保存 schema
        emit(FORM_CHANGE_EVENT_KEY, { key, value: merged })
      }
    }
  },
  { deep: true }
)
</script>
<style lang="scss" scoped>
.select-wrapper {
  .el-select-dropdown__item {
    font-size: 12px;
    height: 32px;
    line-height: 32px;
  }
}

.option-list-width {
  max-width: 400px;
}

.el-select .el-tag {
  max-width: 150px;

  .el-select__tags-text {
    display: inline-block;
    width: 95%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 19px;
  }

  .el-tag__close {
    right: -9px;
    top: -5px;
  }
}
</style>
