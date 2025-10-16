import { defineComponent, onMounted, shallowRef } from 'vue'

import questionLoader from '@/materials/questions/questionLoader.js'

import moduleList from '../common/config/moduleList.js'
import './style.scss'

import PreviewTitle from '../widgets/TitleModules/PreviewTitle'

export const getBlockComponent = async (type) => {
  const path = moduleList[type]
  const component = await questionLoader.loadComponent(type, path)

  return component
}

export default defineComponent({
  name: 'QuestionContainerC',
  props: {
    type: {
      type: String,
      default: 'text'
    },
    showTitle: {
      type: Boolean,
      default: true
    },
    indexNumber: {
      type: [Number, String],
      default: 1
    },
    moduleConfig: {
      type: Object,
      default: () => {
        return {}
      }
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
  emits: ['change', 'focus', 'blur'],
  setup(props, { emit }) {
    const BlockComponent = shallowRef(null)
    onMounted(async () => {
      const { component } = await getBlockComponent(props.type)
      BlockComponent.value = component
    })
    const onBlur = () => {
      emit('blur')
    }
    const onFocus = () => {
      emit('focus')
    }
    const onChange = (data) => {
      emit('change', data)
    }
    return {
      props,
      BlockComponent,
      onBlur,
      onFocus,
      onChange
    }
  },
  render() {
    const props = {
      ...this.moduleConfig,
      ...this.$props
    }
    const BlockComponent = this.BlockComponent
    // 内联填空题和描述文本在渲染页面不显示标题，其他题型根据showTitle属性判断
    const shouldShowTitle = (this.type === 'inline-form' || this.type === 'description')
      ? false
      : (this.moduleConfig.showTitle ?? this.showTitle)

    // 内联填空题在渲染页面需要可输入，不使用readonly
    const componentReadonly = this.type === 'inline-form' ? false : true
    const isDescription = this.type === 'description'

    return (
      <div class={['question', isDescription ? 'is-description' : '']}>
        {shouldShowTitle && <PreviewTitle {...props} />}
        <div class="question-block">
          {this.BlockComponent ? (
            <BlockComponent
              readonly={componentReadonly}
              {...props}
              onBlur={this.onBlur}
              onFocus={this.onFocus}
              onChange={this.onChange}
            />
          ) : (
            <span>题型控件加载中</span>
          )}
        </div>
      </div>
    )
  }
})
