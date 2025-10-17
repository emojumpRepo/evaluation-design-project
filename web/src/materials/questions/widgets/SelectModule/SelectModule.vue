<template>
  <div v-if="readonly" class="select-module-readonly">
    <span class="select-display-value">{{ displayValue || '未选择' }}</span>
  </div>
  <div v-else class="select-module">
    <el-select
      :model-value="value"
      @change="onChange"
      :placeholder="placeholder"
      :multiple="multiple"
      collapse-tags
      :max-collapse-tags="3"
      collapse-tags-tooltip
      clearable
      filterable
      style="width: 100%"
    >
      <el-option
        v-for="option in myOptions"
        :key="option.hash"
        :label="option.label"
        :value="option.value"
        :disabled="option.disabled"
      />
    </el-select>
  </div>
</template>

<script>
import { computed, watch } from 'vue'
import { includes } from 'lodash-es'
import { cleanRichText } from '@/common/xss'

export default {
  name: 'SelectModule',
  props: {
    type: {
      type: String,
      default: 'select'
    },
    field: {
      type: String,
      default: ''
    },
    value: {
      type: [String, Array],
      default: () => ''
    },
    options: {
      type: Array,
      default: () => []
    },
    multiple: {
      type: Boolean,
      default: false
    },
    readonly: {
      type: Boolean,
      default: false
    },
    placeholder: {
      type: String,
      default: '请选择'
    },
    minNum: {
      type: [Number, String],
      default: 0
    },
    maxNum: {
      type: [Number, String],
      default: 0
    }
  },
  emits: ['change'],
  setup(props, { emit }) {
    // 值变化处理
    const onChange = (value) => {
      const key = props.field
      emit('change', {
        key,
        value
      })
    }

    // 监听multiple变化,自动转换value类型
    watch(
      () => props.multiple,
      (newVal, oldVal) => {

        // 避免初始化时触发
        if (oldVal === undefined) {
          return
        }

        // 当切换到多选模式时,如果value不是数组,转换为空数组
        if (newVal && !Array.isArray(props.value)) {
          onChange([])
        }
        // 当切换到单选模式时,如果value是数组,转换为空字符串
        if (!newVal && Array.isArray(props.value)) {
          onChange('')
        }
      }
    )

    // 计算禁用状态（多选模式下）
    const disableState = computed(() => {
      if (!props.multiple || !props.maxNum) {
        return false
      }
      return Array.isArray(props.value) && props.value.length >= +props.maxNum
    })

    // 判断选项是否禁用
    const isDisabled = (item) => {
      if (!item || typeof item !== 'object') {
        return true
      }
      if (!props.multiple) {
        return item.disabled
      }
      const { value } = props
      return disableState.value && !includes(value, item.hash)
    }

    // 处理后的选项列表,清理HTML标签
    const normalizedOptions = computed(() => {
      const opts = Array.isArray(props.options) ? props.options : []
      if (!Array.isArray(props.options)) {
        console.warn('[SelectModule] options should be an array. Received:', props.options)
      }
      return opts
    })

    const myOptions = computed(() => {
      return normalizedOptions.value.map((item) => {
        return {
          ...item,
          disabled: isDisabled(item),
          label: cleanRichText(item.text),
          value: item.hash || ''
        }
      })
    })

    // 格式化显示的值,清理HTML标签
    const displayValue = computed(() => {
      if (!props.readonly) {
        return props.value
      }
      const options = normalizedOptions.value
      if (props.multiple && Array.isArray(props.value)) {
        return props.value
          .map((hash) => {
            const option = options.find((opt) => opt.hash === hash)
            return option ? cleanRichText(option.text) : hash
          })
          .join('、')
      }
      const option = options.find((opt) => opt.hash === props.value)
      return option ? cleanRichText(option.text) : props.value
    })

    // 监听选项变化，移除禁用的选项
    watch(
      () => myOptions.value,
      (newOptions) => {
        const disabledHashes = newOptions
          .filter((i) => i && i.disabled && i.hash)
          .map((i) => i.hash)
        if (props.multiple && Array.isArray(props.value) && disabledHashes.length) {
          disabledHashes.forEach((hash) => {
            const index = props.value.indexOf(hash)
            if (index > -1) {
              const newValue = [...props.value]
              newValue.splice(index, 1)
              onChange(newValue)
            }
          })
        }
      }
    )

    return {
      myOptions,
      onChange,
      disableState,
      displayValue
    }
  }
}
</script>

<style lang="scss" scoped>
.select-module-readonly {
  padding: 8px 0;
  min-height: 32px;
  line-height: 1.5;

  .select-display-value {
    color: #4a4c5b;
    word-break: break-all;
  }
}

.select-module {
  width: 100%;
}
</style>
