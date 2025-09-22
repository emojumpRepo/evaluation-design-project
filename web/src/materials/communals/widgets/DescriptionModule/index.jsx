import { defineComponent, computed, shallowRef, defineAsyncComponent } from 'vue'
import '@/render/styles/variable.scss'
import './index.scss'

export default defineComponent({
  name: 'DescriptionModule',
  props: {
    bannerConf: {
      type: Object,
      default: () => {}
    },
    readonly: {
      type: Boolean,
      default: false
    },
    isSelected: {
      type: Boolean,
      default: false
    }
  },
  emits: ['select', 'change'],
  setup(props, { emit }) {
    const descriptionClass = computed(() => {
      let classStr = ''
      if (!props.readonly) {
        classStr = `description-content ${props.isSelected ? 'active' : ''}`
      } else {
        classStr = 'descriptionPanel'
      }
      return classStr
    })

    const isDescriptionHide = computed(() => {
      if (props.readonly && !descriptionContent.value) {
        return false
      }
      return true
    })

    const descriptionContent = computed(() => {
      // 根据当前页面获取对应的描述内容
      const currentPage = props.bannerConf.currentPage || 1
      return props.bannerConf.descriptionConfig?.[`page${currentPage}`]?.content
    })

    const handleClick = () => {
      if (props.readonly) return
      emit('select')
    }

    const onContentInput = (val) => {
      if (!props.isSelected) {
        return
      }
      // 根据当前页面保存到对应的描述字段
      const currentPage = props.bannerConf.currentPage || 1
      emit('change', {
        key: `descriptionConfig.page${currentPage}.content`,
        value: val
      })
    }

    const richEditorView = shallowRef(null)
    if (!props.readonly) {
      richEditorView.value = defineAsyncComponent(() => import('@/common/Editor/RichEditor.vue'))
    }

    return {
      props,
      descriptionClass,
      isDescriptionHide,
      descriptionContent,
      richEditorView,
      handleClick,
      onContentInput
    }
  },
  render() {
    const { readonly, descriptionContent, onContentInput, richEditorView } = this
    return (
      <div class={['description-module', !readonly ? 'pd15' : '']} onClick={this.handleClick}>
        {this.isDescriptionHide ? (
          <div class={this.descriptionClass}>
            {!readonly ? (
              <richEditorView
                modelValue={descriptionContent}
                onInput={onContentInput}
                placeholder="请输入描述内容"
                class="descriptionText"
              />
            ) : (
              <div class="descriptionText" v-html={descriptionContent}></div>
            )}
          </div>
        ) : (
          ''
        )}
      </div>
    )
  }
})
