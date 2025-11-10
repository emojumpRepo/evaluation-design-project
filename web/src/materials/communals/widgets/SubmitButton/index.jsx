import { defineComponent } from 'vue'
import '@/render/styles/variable.scss'
import './index.scss'

export default defineComponent({
  name: 'SubmitButton',
  props: {
    submitConf: Object,
    skinConf: {
      type: Object,
      default: () => ({})
    },
    isFinallyPage: Boolean,
    readonly: Boolean,
    validate: Function,
    renderData: Array,
    canGoPrev: Boolean,
    prevDisabled: {
      type: Boolean,
      default: false
    },
    // 外部传入的提交中状态，用于禁用按钮和展示文案
    loading: {
      type: Boolean,
      default: false
    },
  },
  emits: ['submit', 'select', 'prev'],
  setup(props, { emit }) {
    // 简单防抖，避免短时间内重复触发
    let clickLocked = false

    const submit = (e) => {
      if (e) {
        e.stopPropagation() // 阻止事件冒泡到外层 div
        e.preventDefault()
      }

      if (!props.readonly) return
      if (props.loading) return
      if (clickLocked) return

      clickLocked = true
      setTimeout(() => {
        clickLocked = false
      }, 300)

      const validate = props.validate
      validate((valid) => {
        if (valid) {
          emit('submit')
        }
      })
    }

    const goPrev = (e) => {
      if (e) {
        e.stopPropagation() // 阻止事件冒泡到外层 div
        e.preventDefault()
      }

      if (!props.readonly) return
      if (props.loading) return
      emit('prev')
    }

    const handleClick = (e) => {
      // 如果点击的是按钮，不处理外层的 click 事件
      if (e.target.tagName === 'BUTTON') {
        return
      }
      if (props.readonly) return
      emit('select')
    }

    return {
      props,
      submit,
      handleClick,
      goPrev,
    }
  },
  render() {
    const { submitConf, isFinallyPage, canGoPrev, prevDisabled, loading } = this.props
    return (
      <div class={['submit-warp', 'preview-submit_wrapper']} onClick={this.handleClick}>
        {canGoPrev ? (
          <button class="submit-btn prev-btn" type="button" disabled={loading || prevDisabled} onClick={this.goPrev}>
            上一页
          </button>
        ) : null}
        <button class={['submit-btn', loading ? 'is-loading' : '']} type="button" disabled={loading} onClick={this.submit}>
          {loading ? (isFinallyPage ? '提交中…' : '加载中…') : (isFinallyPage ? submitConf.submitTitle : '下一页')}
        </button>
      </div>
    )
  }
})
