<template>
  <div class="inline-form-setter">
    <!-- 配置列表 -->
    <div class="segment-list">
      <draggable v-model="segments" item-key="id" handle=".drag-handle">
        <template #item="{ element, index }">
          <div class="segment-item">
            <div class="drag-handle">
              <i-ep-rank />
            </div>

            <!-- 文本片段 -->
            <div v-if="element.type === 'text'" class="segment-content">
              <el-input
                v-model="element.content"
                placeholder="请输入文本"
                @input="updateContent"
                class="text-input"
              />
            </div>

            <!-- 输入框片段 -->
            <div v-else-if="element.type === 'input'" class="segment-content input-segment">
              <div class="input-row">
                <el-tag type="primary" size="large">
                  <i-ep-edit /> 输入框
                </el-tag>
                <el-input
                  v-model="element.fieldName"
                  placeholder="字段名"
                  @input="updateContent"
                  size="small"
                  style="width: 120px; margin-left: 8px"
                />
                <el-input
                  v-model="element.placeholder"
                  placeholder="占位提示"
                  @input="updateContent"
                  size="small"
                  style="width: 150px; margin-left: 8px"
                />
                <el-select
                  v-model="element.inputType"
                  placeholder="类型"
                  @change="updateContent"
                  size="small"
                  style="width: 100px; margin-left: 8px"
                >
                  <el-option label="文本" value="text" />
                  <el-option label="数字" value="number" />
                </el-select>
              </div>
              <div v-if="element.inputType === 'number'" class="number-config">
                <el-input-number
                  v-model="element.min"
                  placeholder="最小值"
                  @change="updateContent"
                  size="small"
                  style="width: 110px"
                  controls-position="right"
                />
                <el-input-number
                  v-model="element.max"
                  placeholder="最大值"
                  @change="updateContent"
                  size="small"
                  style="width: 110px; margin-left: 8px"
                  controls-position="right"
                />
                <el-input-number
                  v-model="element.step"
                  placeholder="步长"
                  @change="updateContent"
                  size="small"
                  style="width: 110px; margin-left: 8px"
                  :step="0.1"
                  controls-position="right"
                />
              </div>
            </div>

            <!-- 下拉框片段 -->
            <div v-else-if="element.type === 'select'" class="segment-content">
              <el-tag type="success" size="large">
                <i-ep-list /> 下拉框
              </el-tag>
              <el-input
                v-model="element.fieldName"
                placeholder="字段名"
                @input="updateContent"
                size="small"
                style="width: 120px; margin-left: 8px"
              />
              <el-button
                size="small"
                type="primary"
                link
                @click="editOptions(index)"
                style="margin-left: 8px"
              >
                配置选项 ({{ element.options?.length || 0 }})
              </el-button>
            </div>

            <!-- 删除按钮 -->
            <el-button
              type="danger"
              link
              size="small"
              @click="removeSegment(index)"
              class="delete-btn"
            >
              <i-ep-delete />
            </el-button>
          </div>
        </template>
      </draggable>
    </div>

    <!-- 添加按钮 -->
    <div class="add-buttons">
      <el-button size="small" @click="addText">
        <i-ep-document /> 添加文本
      </el-button>
      <el-button size="small" type="primary" @click="addInput">
        <i-ep-edit /> 添加输入框
      </el-button>
      <el-button size="small" type="success" @click="addSelect">
        <i-ep-list /> 添加下拉框
      </el-button>
    </div>

    <!-- 预览 -->
    <div class="preview-section">
      <div class="preview-label">预览效果：</div>
      <div class="preview-content">{{ previewText }}</div>
    </div>

    <!-- 选项配置对话框 -->
    <el-dialog
      v-model="optionsDialogVisible"
      title="配置下拉选项"
      width="600px"
    >
      <div class="options-config">
        <el-radio-group v-model="optionsMode" @change="onOptionsModeChange">
          <el-radio value="simple">简单模式</el-radio>
          <el-radio value="advanced">高级模式（分数+填写更多）</el-radio>
        </el-radio-group>

        <!-- 简单模式 -->
        <div v-if="optionsMode === 'simple'" class="simple-options">
          <el-input
            v-model="simpleOptionsText"
            type="textarea"
            :rows="4"
            placeholder="每行一个选项，例如：&#10;选项1&#10;选项2&#10;选项3"
          />
        </div>

        <!-- 高级模式 -->
        <div v-else class="advanced-options">
          <div
            v-for="(opt, idx) in advancedOptions"
            :key="idx"
            class="option-row"
          >
            <el-input v-model="opt.text" placeholder="选项文本" size="small" style="width: 150px" />
            <el-input-number
              v-model="opt.score"
              placeholder="分数"
              size="small"
              style="width: 100px; margin-left: 8px"
            />
            <el-checkbox
              v-model="opt.others"
              label="填写更多"
              size="small"
              style="margin-left: 8px"
            />
            <el-input
              v-if="opt.others"
              v-model="opt.placeholder"
              placeholder="输入框提示"
              size="small"
              style="width: 120px; margin-left: 8px"
            />
            <el-button
              type="danger"
              link
              size="small"
              @click="removeAdvancedOption(idx)"
              style="margin-left: 8px"
            >
              删除
            </el-button>
          </div>
          <el-button size="small" type="primary" @click="addAdvancedOption" style="margin-top: 8px">
            添加选项
          </el-button>
        </div>
      </div>

      <template #footer>
        <el-button @click="optionsDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveOptions">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { FORM_CHANGE_EVENT_KEY } from '@/materials/setters/constant'
import draggable from 'vuedraggable'

const props = defineProps({
  formConfig: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits([FORM_CHANGE_EVENT_KEY])

// 片段列表
const segments = ref([])
let idCounter = 0

// 选项对话框
const optionsDialogVisible = ref(false)
const currentEditingIndex = ref(-1)
const optionsMode = ref('simple')
const simpleOptionsText = ref('')
const advancedOptions = ref([])

// 初始化：从占位符字符串解析为片段列表
const parseContentToSegments = (content) => {
  if (!content) return [{ id: idCounter++, type: 'text', content: '' }]

  const segs = []
  let lastIndex = 0
  let i = 0

  while (i < content.length) {
    // 查找 {{
    const openIndex = content.indexOf('{{', i)
    if (openIndex === -1) {
      // 没有更多占位符了
      const text = content.substring(lastIndex)
      if (text) {
        segs.push({ id: idCounter++, type: 'text', content: text })
      }
      break
    }

    // 添加占位符前的文本
    if (openIndex > lastIndex) {
      const text = content.substring(lastIndex, openIndex)
      segs.push({ id: idCounter++, type: 'text', content: text })
    }

    // 查找对应的 }}
    let closeIndex = -1
    let depth = 0
    for (let j = openIndex + 2; j < content.length - 1; j++) {
      const char = content[j]
      const nextChar = content[j + 1]

      if (char === '{') {
        depth++
      } else if (char === '}') {
        if (depth > 0) {
          depth--
        } else if (nextChar === '}') {
          // depth === 0 且下一个字符也是 },找到了闭合标签
          closeIndex = j + 1
          break
        }
      }
    }

    if (closeIndex === -1) {
      // 没找到闭合的 }},当作普通文本
      segs.push({ id: idCounter++, type: 'text', content: content.substring(openIndex) })
      break
    }

    // 提取占位符内容 {{...}}
    // closeIndex 指向第二个 },所以要减1才是第一个 } 的位置,再减1才是内容结束位置
    const placeholder = content.substring(openIndex + 2, closeIndex - 1)

    // 解析占位符: input:field 或 select:field:options
    const colonIndex = placeholder.indexOf(':')
    if (colonIndex === -1) {
      // 格式不对,当作文本
      segs.push({ id: idCounter++, type: 'text', content: content.substring(openIndex, closeIndex + 1) })
    } else {
      const fieldType = placeholder.substring(0, colonIndex).trim()
      const restContent = placeholder.substring(colonIndex + 1)

      if (fieldType === 'input') {
        // 格式：input:fieldName:placeholder:inputType:min:max:step
        const parts = restContent.split(':')
        const fieldName = parts[0]?.trim() || `field${idCounter}`
        const placeholderText = parts[1]?.trim() || '请输入'
        const inputType = parts[2]?.trim() || 'text'
        const min = parts[3] && parts[3].trim() !== '' ? parseFloat(parts[3].trim()) : undefined
        const max = parts[4] && parts[4].trim() !== '' ? parseFloat(parts[4].trim()) : undefined
        const step = parts[5] && parts[5].trim() !== '' ? parseFloat(parts[5].trim()) : 1

        segs.push({
          id: idCounter++,
          type: 'input',
          fieldName: fieldName,
          placeholder: placeholderText,
          inputType: inputType,
          min: min,
          max: max,
          step: step
        })
      } else if (fieldType === 'select') {
        // 格式：select:fieldName:options
        const parts = restContent.split(':')
        const fieldName = parts[0]?.trim() || `field${idCounter}`
        const optionsStr = parts.slice(1).join(':').trim()

        // 解析选项
        let parsedOptions = []
        if (optionsStr) {
          if (optionsStr.startsWith('[')) {
            // JSON格式
            try {
              parsedOptions = JSON.parse(optionsStr)
            } catch (e) {
              console.error('InlineFormSetter解析JSON失败:', e, optionsStr)
              parsedOptions = []
            }
          } else {
            // 简单格式: 选项1|选项2
            parsedOptions = optionsStr.split('|').map(text => ({
              text: text.trim(),
              hash: text.trim()
            }))
          }
        }

        segs.push({
          id: idCounter++,
          type: 'select',
          fieldName: fieldName,
          options: parsedOptions
        })
      } else {
        // 未知类型,当作文本
        segs.push({ id: idCounter++, type: 'text', content: content.substring(openIndex, closeIndex + 1) })
      }
    }

    lastIndex = closeIndex + 1
    i = closeIndex + 1
  }

  return segs.length > 0 ? segs : [{ id: idCounter++, type: 'text', content: '' }]
}

// 初始化
segments.value = parseContentToSegments(props.formConfig.value)

// 用于判断是否是自己触发的更新
let isInternalUpdate = false

// 用于判断是否正在加载新的数据（避免拖拽watch触发）
let isLoadingNewData = false

// 监听formConfig.value变化，重新解析（仅当外部变化时）
watch(
  () => props.formConfig.value,
  (newValue) => {
    if (isInternalUpdate) {
      isInternalUpdate = false
      return
    }
    isLoadingNewData = true
    segments.value = parseContentToSegments(newValue)
    nextTick(() => {
      isLoadingNewData = false
    })
  }
)

// 片段转换为占位符字符串
const segmentsToContent = () => {
  return segments.value
    .map((seg) => {
      if (seg.type === 'text') {
        return seg.content || ''
      } else if (seg.type === 'input') {
        const fieldName = seg.fieldName || `field${seg.id}`
        const placeholder = seg.placeholder || '请输入'
        const inputType = seg.inputType || 'text'

        if (inputType === 'number') {
          const min = seg.min !== undefined ? seg.min : ''
          const max = seg.max !== undefined ? seg.max : ''
          const step = seg.step !== undefined ? seg.step : 1
          return `{{input:${fieldName}:${placeholder}:${inputType}:${min}:${max}:${step}}}`
        } else {
          return `{{input:${fieldName}:${placeholder}:${inputType}:::}}`
        }
      } else if (seg.type === 'select') {
        const fieldName = seg.fieldName || `field${seg.id}`
        const opts = seg.options || []
        if (opts.length === 0) return `{{select:${fieldName}:}}`

        // 判断是简单还是高级格式
        const hasAdvanced = opts.some(o => o.score !== undefined || o.others)
        if (hasAdvanced) {
          return `{{select:${fieldName}:${JSON.stringify(opts)}}}`
        } else {
          const simple = opts.map(o => o.text || o).join('|')
          return `{{select:${fieldName}:${simple}}}`
        }
      }
      return ''
    })
    .join('')
}

// 预览文本
const previewText = computed(() => {
  return segments.value
    .map((seg) => {
      if (seg.type === 'text') return seg.content || ''
      if (seg.type === 'input') return `[输入框]`
      if (seg.type === 'select') return `[下拉框]`
      return ''
    })
    .join('')
})

// 更新内容
const updateContent = () => {
  const content = segmentsToContent()
  isInternalUpdate = true
  emit(FORM_CHANGE_EVENT_KEY, {
    key: props.formConfig.key,
    value: content
  })
}

// 添加片段
const addText = () => {
  segments.value.push({ id: idCounter++, type: 'text', content: '' })
  updateContent()
}

const addInput = () => {
  segments.value.push({
    id: idCounter++,
    type: 'input',
    fieldName: `field${idCounter}`,
    placeholder: '请输入',
    inputType: 'text',
    min: undefined,
    max: undefined,
    step: 1
  })
  updateContent()
}

const addSelect = () => {
  segments.value.push({
    id: idCounter++,
    type: 'select',
    fieldName: `field${idCounter}`,
    options: []
  })
  updateContent()
}

// 删除片段
const removeSegment = (index) => {
  segments.value.splice(index, 1)
  updateContent()
}

// 编辑选项
const editOptions = (index) => {
  currentEditingIndex.value = index
  const seg = segments.value[index]
  const opts = seg.options || []

  // 判断是简单还是高级
  const hasAdvanced = opts.some(o => o.score !== undefined || o.others)
  optionsMode.value = hasAdvanced ? 'advanced' : 'simple'

  if (optionsMode.value === 'simple') {
    simpleOptionsText.value = opts.map(o => o.text || o).join('\n')
  } else {
    advancedOptions.value = opts.map(o => ({
      text: o.text || '',
      score: o.score || 0,
      others: o.others || false,
      placeholder: o.placeholder || '请输入',
      hash: o.hash || o.text || ''
    }))
  }

  optionsDialogVisible.value = true
}

// 选项模式切换
const onOptionsModeChange = () => {
  if (optionsMode.value === 'simple') {
    simpleOptionsText.value = ''
  } else {
    advancedOptions.value = []
  }
}

// 添加高级选项
const addAdvancedOption = () => {
  advancedOptions.value.push({
    text: '',
    score: 0,
    others: false,
    placeholder: '请输入',
    hash: `opt${advancedOptions.value.length + 1}`
  })
}

// 删除高级选项
const removeAdvancedOption = (idx) => {
  advancedOptions.value.splice(idx, 1)
}

// 保存选项
const saveOptions = () => {
  const index = currentEditingIndex.value
  if (index === -1) return

  let opts = []
  if (optionsMode.value === 'simple') {
    opts = simpleOptionsText.value
      .split('\n')
      .map(line => line.trim())
      .filter(line => line)
      .map(text => ({ text, hash: text }))
  } else {
    opts = advancedOptions.value
      .filter(o => o.text.trim())
      .map(o => ({
        text: o.text.trim(),
        hash: o.hash || o.text.trim(),
        score: o.score || 0,
        others: o.others || false,
        placeholder: o.placeholder || '请输入'
      }))
  }

  segments.value[index].options = opts
  optionsDialogVisible.value = false
  updateContent()
}

// 监听拖拽变化 - 但不能监听deep，否则每次输入都会触发
watch(
  () => segments.value.map(s => s.id).join(','),
  () => {
    // 如果正在加载新数据（切换题目），不触发更新
    if (isLoadingNewData) return
    // 只有segments的顺序变化时才更新
    updateContent()
  }
)

</script>

<style lang="scss" scoped>
.inline-form-setter {
  .segment-list {
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    padding: 8px;
    min-height: 100px;
    background-color: #fafafa;
  }

  .segment-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    margin-bottom: 8px;
    background: white;
    border: 1px solid #e4e7ed;
    border-radius: 4px;

    &:last-child {
      margin-bottom: 0;
    }

    .drag-handle {
      cursor: move;
      color: #909399;
      font-size: 16px;
      flex-shrink: 0;
    }

    .segment-content {
      flex: 1;
      display: flex;
      align-items: center;

      .text-input {
        flex: 1;
      }

      &.input-segment {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;

        .input-row {
          display: flex;
          align-items: center;
        }

        .number-config {
          display: flex;
          align-items: center;
          padding-left: 8px;
        }
      }
    }

    .delete-btn {
      flex-shrink: 0;
    }
  }

  .add-buttons {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .preview-section {
    margin-top: 16px;
    padding: 12px;
    background-color: #f4f4f5;
    border-left: 3px solid #409eff;
    border-radius: 4px;

    .preview-label {
      font-size: 12px;
      color: #909399;
      margin-bottom: 4px;
    }

    .preview-content {
      font-size: 14px;
      color: #303133;
      line-height: 1.6;
    }
  }

  .options-config {
    .simple-options {
      margin-top: 16px;
    }

    .advanced-options {
      margin-top: 16px;

      .option-row {
        display: flex;
        align-items: center;
        margin-bottom: 12px;
      }
    }
  }
}
</style>
