<template>
  <form ref="ruleForm" :model="formValues" :rules="rules">
    <template v-for="(row, rowIndex) in groupedRows" :key="rowIndex">
      <div
        class="question-row"
        :class="`columns-${row.columns}`"
        :style="{ display: row.columns > 1 && !isMobile ? 'grid' : 'block' }"
      >
        <QuestionWrapper
          v-for="item in row.items"
          :key="item.field"
          class="gap question-col"
          :moduleConfig="item"
          :indexNumber="item.indexNumber"
          @change="handleChange"
        ></QuestionWrapper>
      </div>
    </template>
  </form>
</template>
<script setup>
import { inject, provide, computed, onBeforeMount, ref, onMounted, onUnmounted } from 'vue'
import QuestionWrapper from './QuestionWrapper.vue'
// import { flatten } from 'lodash-es'

const $bus = inject('$bus')
const props = defineProps({
  rules: {
    type: Object,
    default: () => {
      return {}
    }
  },
  formValues: {
    type: Object,
    default: () => {
      return {}
    }
  },
  renderData: {
    type: Array,
    default: () => {
      return []
    }
  }
})

const emit = defineEmits(['formChange', 'blur'])

// 检测是否为移动端
const isMobile = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

// 将题目按照 columnsPerRow 分组成行
const groupedRows = computed(() => {
  const rows = []
  let currentRow = null

  props.renderData.forEach((item, index) => {
    const columns = item.columnsPerRow || 1

    // 如果是新的一行,或者列数不同,创建新行
    if (!currentRow || currentRow.columns !== columns || currentRow.items.length >= columns) {
      currentRow = {
        columns: columns,
        items: []
      }
      rows.push(currentRow)
    }

    currentRow.items.push(item)
  })

  return rows
})

// 这里不能直接使用change事件，否则父元素监听change的事件，会被绑定到里面的input上
// 导致接受到的data是个Event
const handleChange = (data) => {
  emit('formChange', data)
}
// 动态 field 管理
const fields = []
provide('Form', {
  model: computed(() => {
    return props.formValues
  }),
  rules: computed(() => {
    return props.rules
  })
})

// 记录当前视图中渲染的元素，用于提交时全局表单校验
onBeforeMount(() => {
  $bus.on('form.addField', (field) => {
    if (field) {
      fields.push(field)
    }
  })

  $bus.on('form.removeField', (field) => {
    if (field) {
      fields.splice(fields.indexOf(field), 1)
    }
  })
})

const validate = (callback) => {
  const length = fields.length
  if (length === 0) {
    callback(true)
  }

  let valid = true
  let count = 0
  let flag = false // 滚动到第一个未验证成功的元素

  // 表单校验
  fields.forEach((field) => {
    field.validate('', (errors) => {
      count++
      if (errors) {
        if (!flag) {
          flag = true
          try {
            const el = field.$el
            el.scrollIntoViewIfNeeded()
          } catch (e) {
            console.error(e)
          }
        }
        valid = false
      }
      if (typeof callback === 'function' && count === length) {
        callback(valid)
      }
    })
  })
}

defineExpose({
  validate
})
</script>

<style lang="scss" scoped>
.question-row {
  width: 100%;

  &.columns-2 {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  &.columns-3 {
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  &.columns-4 {
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  .question-col {
    min-width: 0; // 防止内容溢出
  }
}

// 移动端强制单列布局
@media (max-width: 768px) {
  .question-row {
    display: block !important;

    &.columns-2,
    &.columns-3,
    &.columns-4 {
      grid-template-columns: 1fr !important;
      gap: 0;
    }

    .question-col {
      width: 100%;
    }
  }
}
</style>
