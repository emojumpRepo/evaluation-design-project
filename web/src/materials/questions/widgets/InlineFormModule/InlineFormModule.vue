<template>
  <div class="inline-form-module" :class="{ readonly: readonly }">
    <div class="module-content">
      <!-- 必填标识 -->
      <i v-if="isRequired" class="module-required">*</i>

      <!-- 题目序号 -->
      <span v-if="showIndex && indexNumber" class="index">{{ indexNumber }}.</span>

      <div class="inline-content">
        <template v-for="(segment, index) in parsedSegments" :key="index">
          <!-- 普通文本 -->
          <span v-if="segment.type === 'text'" class="text-segment" v-html="segment.content"></span>

          <!-- 文本输入框 -->
          <el-input
            v-else-if="segment.type === 'input' && (!segment.inputType || segment.inputType === 'text')"
            :model-value="getFieldValue(segment.field)"
            @input="(val) => onFieldChange(segment.field, val)"
            :placeholder="segment.placeholder || '请输入'"
            :readonly="readonly"
            class="inline-input"
            clearable
          />

          <!-- 数字输入框 -->
          <el-input-number
            v-else-if="segment.type === 'input' && segment.inputType === 'number'"
            :model-value="getFieldValue(segment.field)"
            @input="(val) => onFieldChange(segment.field, val)"
            :placeholder="segment.placeholder || '请输入数字'"
            :readonly="readonly"
            :min="segment.min"
            :max="segment.max"
            :step="segment.step"
            class="inline-input-number"
            :controls="false"
          />

          <!-- 下拉选择 -->
          <el-select
            v-else-if="segment.type === 'select'"
            :model-value="getFieldValue(segment.field)"
            @change="(val) => onSelectChange(segment.field, val)"
            :placeholder="segment.placeholder || '请选择'"
            :disabled="readonly"
            class="inline-select"
            clearable
          >
            <el-option
              v-for="option in segment.options"
              :key="option.hash || option.text"
              :label="option.text || option"
              :value="option.hash || option.text || option"
            />
          </el-select>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { filterXSS } from '@/common/xss'

export default {
  name: 'InlineFormModule',
  props: {
    type: {
      type: String,
      default: 'inline-form'
    },
    field: {
      type: String,
      required: true
    },
    value: {
      type: [Object, String],
      default: () => ({})
    },
    content: {
      type: String,
      default: ''
    },
    readonly: {
      type: Boolean,
      default: false
    },
    showIndex: {
      type: Boolean,
      default: false
    },
    indexNumber: {
      type: [Number, String],
      default: ''
    },
    isRequired: {
      type: Boolean,
      default: false
    }
  },
  emits: ['change'],
  setup(props, { emit }) {
    // 解析内容,提取占位符（支持多个输入框/下拉框）
    const parsedSegments = computed(() => {
      if (!props.content) return [{ type: 'text', content: '' }]

      const segments = []
      let lastIndex = 0
      let i = 0

      while (i < props.content.length) {
        // 查找 {{
        const openIndex = props.content.indexOf('{{', i)
        if (openIndex === -1) {
          // 没有更多占位符了
          const text = props.content.substring(lastIndex)
          if (text) {
            segments.push({
              type: 'text',
              content: filterXSS(text)
            })
          }
          break
        }

        // 添加占位符前的文本
        if (openIndex > lastIndex) {
          const text = props.content.substring(lastIndex, openIndex)
          segments.push({
            type: 'text',
            content: filterXSS(text)
          })
        }

        // 查找对应的 }}
        let closeIndex = -1
        let depth = 0
        for (let j = openIndex + 2; j < props.content.length - 1; j++) {
          const char = props.content[j]
          const nextChar = props.content[j + 1]

          if (char === '{') {
            depth++
          } else if (char === '}') {
            if (depth > 0) {
              depth--
            } else if (nextChar === '}') {
              closeIndex = j + 1
              break
            }
          }
        }

        if (closeIndex === -1) {
          // 没找到闭合的 }},当作普通文本
          segments.push({
            type: 'text',
            content: filterXSS(props.content.substring(openIndex))
          })
          break
        }

        // 提取占位符内容 {{...}}
        const placeholder = props.content.substring(openIndex + 2, closeIndex - 1)

        // 解析占位符: input:placeholder 或 select:options
        const colonIndex = placeholder.indexOf(':')
        if (colonIndex === -1) {
          // 格式不对,当作文本
          segments.push({
            type: 'text',
            content: filterXSS(props.content.substring(openIndex, closeIndex + 1))
          })
        } else {
          const fieldType = placeholder.substring(0, colonIndex).trim()
          const restContent = placeholder.substring(colonIndex + 1)

          if (fieldType === 'input') {
            // 格式：{{input:fieldName:placeholder:inputType:min:max:step}}
            const parts = restContent.split(':')
            const fieldName = parts[0]?.trim() || 'field'
            const placeholderText = parts[1]?.trim() || '请输入'
            const inputType = parts[2]?.trim() || 'text'
            const min = parts[3] && parts[3].trim() !== '' ? parseFloat(parts[3].trim()) : undefined
            const max = parts[4] && parts[4].trim() !== '' ? parseFloat(parts[4].trim()) : undefined
            const step = parts[5] && parts[5].trim() !== '' ? parseFloat(parts[5].trim()) : 1

            segments.push({
              type: 'input',
              field: fieldName,
              placeholder: placeholderText,
              inputType: inputType,
              min: min,
              max: max,
              step: step
            })
          } else if (fieldType === 'select') {
            // 格式：{{select:fieldName:options}}
            const parts = restContent.split(':')
            const fieldName = parts[0]?.trim() || 'field'
            const optionsStr = parts.slice(1).join(':').trim()

            // 解析选项
            let parsedOptions = []
            if (optionsStr) {
              if (optionsStr.startsWith('[')) {
                // JSON格式：{{select:gender:[{"text":"男","hash":"male"}]}}
                try {
                  parsedOptions = JSON.parse(optionsStr)
                } catch (e) {
                  console.error('解析下拉选项JSON失败:', e, optionsStr)
                  parsedOptions = []
                }
              } else {
                // 简单格式：{{select:gender:男|女}}
                parsedOptions = optionsStr.split('|').map(text => ({
                  text: text.trim(),
                  hash: text.trim()
                }))
              }
            }

            segments.push({
              type: 'select',
              field: fieldName,
              options: parsedOptions,
              placeholder: '请选择'
            })
          } else {
            // 未知类型,当作文本
            segments.push({
              type: 'text',
              content: filterXSS(props.content.substring(openIndex, closeIndex + 1))
            })
          }
        }

        lastIndex = closeIndex + 1
        i = closeIndex + 1
      }

      return segments
    })

    const getFieldValue = (fieldName) => {
      // 处理旧数据：如果value是字符串，返回空
      if (typeof props.value === 'string') {
        return ''
      }
      const val = props.value?.[fieldName]
      // 如果值不存在，返回空字符串或undefined（根据情况）
      if (val === undefined || val === null || val === '') {
        return undefined
      }
      return val
    }

    const onFieldChange = (fieldName, fieldValue) => {
      // 确保value是对象类型
      const currentValue = typeof props.value === 'object' && props.value !== null ? props.value : {}
      const newValue = {
        ...currentValue,
        [fieldName]: fieldValue
      }
      // 直接emit对象值，不拼接字符串
      emit('change', {
        key: props.field,
        value: newValue
      })
    }

    // 下拉框选择变化
    const onSelectChange = (fieldName, selectedValue) => {
      // 确保value是对象类型
      const currentValue = typeof props.value === 'object' && props.value !== null ? props.value : {}
      const newValue = {
        ...currentValue,
        [fieldName]: selectedValue
      }
      // 直接emit对象值，不拼接字符串
      emit('change', {
        key: props.field,
        value: newValue
      })
    }

    // 根据content模板和字段值拼接结果字符串
    const buildResultString = (values) => {
      let result = props.content

      // 替换所有占位符为实际值
      parsedSegments.value.forEach(seg => {
        if (seg.type === 'input' || seg.type === 'select') {
          const fieldValue = values[seg.field] || ''
          // 找到占位符，替换为值
          const regex = new RegExp(`\\{\\{(input|select):${seg.field}:[^}]*\\}\\}`, 'g')
          result = result.replace(regex, fieldValue)
        }
      })

      // 清理剩余的HTML标签
      result = result.replace(/<[^>]*>/g, '')

      return result
    }

    return {
      parsedSegments,
      getFieldValue,
      onFieldChange,
      onSelectChange
    }
  }
}
</script>

<style lang="scss" scoped>
@import '@materials/questions/common/css/default.scss';

.inline-form-module {
  .module-content {
    display: flex;
    align-items: baseline;
    font-size: $title-size;
    line-height: 0.45rem;
    position: relative;

    :deep(.el-select__wrapper) {
      width: 100%;
    }

    .module-required {
      color: $error-color;
      position: absolute;
      left: -0.24rem;
      top: 0.05rem;
      font-size: 0.2rem;
      transform-origin: left top;
    }

    .index {
      float: left;
      padding-right: 0.06rem;
      font-size: $title-size;
      color: #000000;
      flex-shrink: 0;
    }

    .inline-content {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      font-size: $title-size;
      flex: 1;

      .text-segment {
        color: #000000;
        white-space: pre-wrap;

        :deep(p) {
          display: inline;
          margin: 0;
          font-size: inherit;
        }

        :deep(span) {
          font-size: inherit;
        }
      }

      .inline-input {
        width: 150px;
        display: inline-flex;
        vertical-align: middle;

        :deep(.el-input__wrapper) {
          border: none;
          border-bottom: 1px solid #dcdfe6;
          border-radius: 0;
          box-shadow: none;
          padding: 1px 0;
          background-color: transparent;

          &:hover {
            border-bottom-color: #c0c4cc;
          }

          &.is-focus {
            border-bottom-color: var(--el-color-primary);
          }
        }
      }

      .inline-input-number {
        width: 130px;
        display: inline-flex;
        vertical-align: middle;
        :deep(.el-input-number) {
          width: 100%;
        }
        :deep(.el-input-number__increase),
        :deep(.el-input-number__decrease) {
          display: none; // 隐藏上下调整按钮
        }
        :deep(.el-input__wrapper) {
          border: none;
          border-bottom: 1px solid #dcdfe6; // 仅保留下边线
          border-radius: 0;
          box-shadow: none;
          padding: 1px 0;
          background-color: transparent;
          &:hover {
            border-bottom-color: #c0c4cc;
          }
          &.is-focus {
            border-bottom-color: var(--el-color-primary);
          }
        }
        // 隐藏各浏览器默认微调按钮
        :deep(input[type='number']) {
          -moz-appearance: textfield;
        }
        :deep(input[type='number']::-webkit-outer-spin-button),
        :deep(input[type='number']::-webkit-inner-spin-button) {
          -webkit-appearance: none;
          margin: 0;
        }
      }

      .inline-select {
        width: 120px;
        display: inline-flex;
        vertical-align: middle;
      }

      .inline-others-input {
        width: 150px;
        display: inline-flex;
        vertical-align: middle;

        :deep(.el-input__wrapper) {
          border: none;
          border-bottom: 1px solid #dcdfe6;
          border-radius: 0;
          box-shadow: none;
          padding: 1px 0;
          background-color: transparent;

          &:hover {
            border-bottom-color: #c0c4cc;
          }

          &.is-focus {
            border-bottom-color: var(--el-color-primary);
          }
        }
      }
    }
  }

  &.readonly {
    .inline-input,
    .inline-select,
    .inline-others-input {
      :deep(.el-input__wrapper) {
        background-color: transparent;
        box-shadow: none;
        padding: 0;
      }

      :deep(.el-input__inner) {
        color: #4a4c5b;
        font-weight: 500;
      }
    }
  }
}
</style>
