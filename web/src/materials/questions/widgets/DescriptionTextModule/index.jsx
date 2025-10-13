import { defineComponent, computed } from 'vue'
import { filterXSS } from '@/common/xss'

import './style.scss'
import myMeta from './meta'

export const meta = myMeta

export default defineComponent({
  name: 'DescriptionTextModule',
  props: {
    type: {
      type: String,
      default: 'description'
    },
    field: {
      type: String,
      required: true
    },
    content: {
      type: String,
      default: ''
    },
    readonly: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    const displayContent = computed(() => {
      return filterXSS(props.content || '')
    })

    return {
      displayContent
    }
  },
  render() {
    const { displayContent, readonly } = this

    return (
      <div class={['description-text-module', { readonly }]}>
        <div class="description-content" v-html={displayContent}></div>
      </div>
    )
  }
})
