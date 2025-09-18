<template>
  <div ref="editorContainer" class="monaco-editor-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

interface Props {
  modelValue: string
  language?: string
  height?: number
  options?: any
}

interface Emit {
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  language: 'javascript',
  height: 300,
  options: () => ({})
})

const emit = defineEmits<Emit>()

const editorContainer = ref<HTMLElement>()
let editor: any = null
let monaco: any = null

// 使用简单的文本编辑器作为后备方案
const initFallbackEditor = () => {
  if (!editorContainer.value) return
  
  const textarea = document.createElement('textarea')
  textarea.style.width = '100%'
  textarea.style.height = `${props.height}px`
  textarea.style.fontFamily = 'Monaco, Menlo, Consolas, monospace'
  textarea.style.fontSize = '14px'
  textarea.style.lineHeight = '1.5'
  textarea.style.padding = '12px'
  textarea.style.border = 'none'
  textarea.style.outline = 'none'
  textarea.style.resize = 'none'
  textarea.style.backgroundColor = '#f5f5f5'
  textarea.value = props.modelValue
  
  textarea.addEventListener('input', (e: any) => {
    const value = e.target.value
    emit('update:modelValue', value)
    emit('change', value)
  })
  
  editorContainer.value.appendChild(textarea)
  
  // 监听值变化
  watch(() => props.modelValue, (newVal) => {
    if (textarea.value !== newVal) {
      textarea.value = newVal
    }
  })
}

onMounted(() => {
  // 使用简单的文本编辑器
  initFallbackEditor()
})

onBeforeUnmount(() => {
  if (editor) {
    editor.dispose()
  }
})
</script>

<style scoped>
.monaco-editor-container {
  width: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.monaco-editor-container :deep(textarea) {
  font-family: 'Monaco', 'Menlo', 'Consolas', 'Courier New', monospace !important;
}
</style>