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
  },
  emits: ['submit', 'select', 'prev'],
  setup(props, { emit }) {
    const submit = (e) => {
      if (!props.readonly) return
      const validate = props.validate
      if (e) {
        e.preventDefault()
        validate((valid) => {
          if (valid) {
            emit('submit')
          }
        })
      }
    }

    const goPrev = (e) => {
      if (!props.readonly) return
      if (e) e.preventDefault()
      emit('prev')
    }

    const handleClick = () => {
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
    const { submitConf, isFinallyPage, canGoPrev } = this.props
    return (
      <div class={['submit-warp', 'preview-submit_wrapper']} onClick={this.handleClick}>
        {canGoPrev ? (
          <button class="submit-btn prev-btn" type="button" onClick={this.goPrev}>
            上一页
          </button>
        ) : null}
        <button class="submit-btn" type="primary" onClick={this.submit}>
          {isFinallyPage ? submitConf.submitTitle : '下一页'}
        </button>
      </div>
    )
  }
})
