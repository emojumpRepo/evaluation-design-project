import { computed, defineComponent, shallowRef, defineAsyncComponent, watch } from 'vue'
import { includes } from 'lodash-es'

import BaseChoice from '../BaseChoice'
import metaConfig from './meta.js'

export const meta = metaConfig
/**
 * 支持配置：
 * 排列方式, layout
 */
export default defineComponent({
  name: 'CheckBoxModule',
  props: {
    type: {
      type: String,
      default: ''
    },
    field: {
      type: String,
      default: ''
    },
    value: {
      type: Array,
      default: () => {
        return []
      }
    },
    layout: {
      type: String,
      default: 'vertical'
    },
    horizontalColumns: {
      type: [Number, String],
      default: 0
    },
    options: {
      type: Array,
      default: () => []
    },
    readonly: {
      type: Boolean,
      default: false
    },
    maxNum: {
      type: [Number, String],
      default: 1
    },
    quotaDisplay:{
      type: Boolean,
      default: true
    }
  },
  emits: ['change'],
  setup(props, { emit }) {
    const disableState = computed(() => {
      if (!props.maxNum) {
        return false
      }
      return props.value.length >= +props.maxNum
    })
    const isDisabled = (item) => {
      const { value, options } = props
      const selected = Array.isArray(value) ? value : []
      const optionMap = new Map((options || []).map((o) => [o.hash, o]))

      // 计算某个互斥项的目标集（为空代表与全部其它互斥）
      const getMutexTargets = (opt) => {
        if (!opt || !opt.mutex) return []
        const targets = Array.isArray(opt.mutexTargets) ? opt.mutexTargets.filter(Boolean) : []
        if (targets.length) return targets
        // 默认与全部其它选项互斥
        return (options || []).map((o) => o.hash).filter((h) => h !== opt.hash)
      }
      // 判断两者是否互斥（任一一方声明与对方互斥即视为互斥）
      const isConflicted = (a, b) => {
        const ao = typeof a === 'string' ? optionMap.get(a) : a
        const bo = typeof b === 'string' ? optionMap.get(b) : b
        if (!ao || !bo) return false
        const aTargets = getMutexTargets(ao)
        const bTargets = getMutexTargets(bo)
        return aTargets.includes(bo.hash) || bTargets.includes(ao.hash)
      }

      // 若当前项与任意已选项互斥，则禁用
      const conflictedWithSelected = selected.some((sel) => isConflicted(sel, item))
      if (conflictedWithSelected) return true

      // 数量上限禁用
      return disableState.value && !includes(selected, item.hash)
    }
    const myOptions = computed(() => {
      const { options } = props
      return options.map((item) => {
        return {
          ...item,
          disabled: (item.release <= 0) || isDisabled(item)
        }
      })
    })
    // 兼容断点续答情况下选项配额为0的情况
    watch(() => myOptions, (value) => {
      const disabledHash = myOptions.value.filter(i => i.disabled).map(i => i.hash)
      if (value && disabledHash.length) {
        disabledHash.forEach(hash => {
          const index = value.indexOf(hash)
          if( index> -1) {
            const newValue = [...value]
            newValue.splice(index, 1)
            onChange(newValue)
          }
        })
      }
    })
    const onChange = (value) => {
      const key = props.field
      emit('change', {
        key,
        value
      })
    }
    const handleSelectMoreChange = (data) => {
      const { key, value } = data
      emit('change', {
        key,
        value
      })
    }

    const selectMoreView = shallowRef(null)
    if (props.readonly) {
      selectMoreView.value = defineAsyncComponent(
        () => import('@materials/questions/QuestionContainerB')
      )
    } else {
      selectMoreView.value = defineAsyncComponent(
        () => import('@materials/questions/QuestionRuleContainer')
      )
    }
    return {
      onChange,
      handleSelectMoreChange,
      disableState,
      myOptions,
      selectMoreView
    }
  },
  render() {
    const { readonly, field, myOptions, onChange, maxNum, value, quotaDisplay, selectMoreView } = this
    return (
      <BaseChoice
        uiTarget="checkbox"
        readonly={readonly}
        name={field}
        maxNum={maxNum}
        options={myOptions}
        onChange={onChange}
        value={value}
        layout={this.layout}
          columnsPerRow={this.horizontalColumns}
        quotaDisplay={quotaDisplay}
      >
        {{
          selectMore: (scoped) => {
            return (
              <selectMoreView
                readonly={this.readonly}
                showTitle={false}
                moduleConfig={scoped.selectMoreConfig}
                onChange={(e) => this.handleSelectMoreChange(e)}
              ></selectMoreView>
            )
          }
        }}
      </BaseChoice>
    )
  }
})
