<template>
  <div>
    <span class="primary-color" @click="openOptionConfig"> 高级设置 > </span>

    <el-dialog
      title="选项高级设置"
      class="option-config-wrapper"
      v-model="configVisible"
      :append-to-body="true"
      width="80%"
      size="large"
    >
      <div class="option-handwrite">
        <div class="option-table-scroll">
          <div class="option-table">
        <div class="option-header">
          <div class="header-item flex-1">选项内容</div>
          <div class="header-item w100">分值</div>
          <div class="header-item w100 mutex-head">与其余互斥</div>
          <div class="header-item w100">默认隐藏</div>
          <div class="header-item w285" v-if="showMutexTargets">互斥目标（可多选）</div>
          <div class="header-item w285" v-if="showOthers">选项后增添输入框</div>
          <div class="header-item w285">选中本项时展示以下选项</div>
        </div>
        <div>
          <draggable :list="curOptions" handle=".drag-handle" itemKey="hash">
            <template #item="{ element, index }">
              <div class="option-item">
                <span class="drag-handle qicon qicon-tuodong"></span>
                <div class="flex-1 oitem">
                  <div
                    contenteditable="true"
                    class="render-html"
                    v-html="textOptions[index]"
                    @blur="onBlur($event, index)"
                  ></div>
                </div>
                <div class="oitem w100">
                  <el-input-number v-model="element.score" :min="0" :max="999999" :step="1" size="small" />
                </div>
                <div class="oitem w100">
                  <el-switch v-model="element.mutex"></el-switch>
                </div>
                <div class="oitem w100">
                  <el-switch v-model="element.defaultHidden"></el-switch>
                </div>
                <div class="oitem w285" v-if="showMutexTargets">
                  <el-select
                    v-model="element.mutexTargets"
                    multiple
                    collapse-tags
                    collapse-tags-tooltip
                    filterable
                    placeholder="选择与其互斥的选项，不选表示与全部互斥"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="opt in optionTargetList(element.hash)"
                      :key="opt.value"
                      :label="opt.label"
                      :value="opt.value"
                    />
                  </el-select>
                </div>
                <div class="oitem moreInfo lh36" v-if="showOthers">
                  <el-switch
                    :modelValue="element.others"
                    @change="(val) => changeOptionOthers(val, element)"
                  ></el-switch>
                  <div class="more-info-content" v-if="element.others">
                    <el-input v-model="element.placeholderDesc" placeholder="提示文案"></el-input>
                    <el-checkbox v-model="element.mustOthers">必填</el-checkbox>
                  </div>
                </div>

                
                <div class="oitem w285">
                  <el-select
                    v-model="element.showTargetsWhenSelected"
                    multiple
                    collapse-tags
                    collapse-tags-tooltip
                    filterable
                    placeholder="选择被本项显示的选项"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="opt in optionTargetList(element.hash)"
                      :key="opt.value"
                      :label="opt.label"
                      :value="opt.value"
                    />
                  </el-select>
                </div>

                <div class="operate-area">
                  <i-ep-circlePlus class="area-btn-icon" @click="addOption('选项', false, index)" />
                  <i-ep-remove
                    v-show="curOptions.length"
                    class="area-btn-icon"
                    @click="deleteOption(index)"
                  />
                </div>
              </div>
            </template>
          </draggable>
        </div>
          </div>
        </div>
        <div class="add-btn-row">
          <div class="add-option" @click="addOption()">
            <span class="add-option-item"> <i-ep-circlePlus class="icon" /> 添加新选项 </span>
          </div>

          <div class="add-option" @click="addOtherOption" v-if="showOthers">
            <span class="add-option-item"> <i-ep-circlePlus class="icon" /> 其他____ </span>
          </div>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="configVisible = false">取消</el-button>
          <el-button type="primary" @click="optionConfigChange">确认</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import draggable from 'vuedraggable'
import { forEach as _forEach, cloneDeep as _cloneDeep } from 'lodash-es'

import { ElMessage } from 'element-plus'
import 'element-plus/theme-chalk/src/message.scss'

import { useEditStore } from '@/management/stores/edit'
import { cleanRichText } from '@/common/xss'
import { cleanRichTextWithMediaTag } from '@/common/xss'
import { storeToRefs } from 'pinia'

export default {
  name: 'OptionConfig',
  props: {
    fieldId: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      configVisible: false,
      curOptions: []
    }
  },
  computed: {
    options() {
      const editStore = useEditStore()
      return editStore.moduleConfig.options
    },
    hashMap() {
      const mapData = {}
      _forEach(this.curOptions, (item) => {
        if (item.hash) {
          mapData[item.hash] = true
        }
      })
      return mapData
    },
    textOptions() {
      return this.curOptions.map((item) => cleanRichTextWithMediaTag(item.text))
    },
    showOthers() {
      const editStore = useEditStore()
      const { currentEditMeta } = storeToRefs(editStore)
      return currentEditMeta.value?.editConfigure?.optionEditBar.configure.showOthers
    },
    showMutexTargets() {
      const editStore = useEditStore()
      return (editStore.moduleConfig?.type || '').toLowerCase() === 'checkbox'
    }
  },
  provide() {
    return {}
  },
  components: {
    draggable
  },
  mounted() {
    this.initCurOption()
  },
  watch: {
    options: {
      handler(val) {
        const list = _cloneDeep(val)
        list.forEach((it) => {
          if (!Array.isArray(it.mutexTargets)) it.mutexTargets = []
          // ensure numeric score
          if (typeof it.score !== 'number') {
            const parsed = Number(it.score)
            it.score = Number.isFinite(parsed) ? parsed : 0
          }
          if (!Array.isArray(it.showTargetsWhenSelected)) it.showTargetsWhenSelected = []
          if (typeof it.defaultHidden !== 'boolean') it.defaultHidden = false
        })
        this.curOptions = list
      },
      deep: true
    }
  },
  methods: {
    optionTargetList(currentHash) {
      try {
        return (this.curOptions || [])
          .filter((it) => it.hash && it.hash !== currentHash)
          .map((it) => ({ label: cleanRichText(it.text || ''), value: it.hash }))
      } catch (e) {
        return []
      }
    },
    initCurOption() {
      const editStore = useEditStore()
      const list = _cloneDeep(editStore.moduleConfig.options)
      list.forEach((it) => {
        if (!Array.isArray(it.mutexTargets)) it.mutexTargets = []
        if (!Array.isArray(it.showTargetsWhenSelected)) it.showTargetsWhenSelected = []
        if (typeof it.defaultHidden !== 'boolean') it.defaultHidden = false
        if (typeof it.score !== 'number') {
          const parsed = Number(it.score)
          it.score = Number.isFinite(parsed) ? parsed : 0
        }
      })
      this.curOptions = list
    },
    addOtherOption() {
      this.addOption('其他', true, -1, this.fieldId)
    },
    openOptionConfig() {
      this.configVisible = true
      this.initCurOption()
    },
    addOption(text = '选项', others = false, index = -1, fieldId) {
      let addOne = {
        text: '',
        hash: '',
        others: false,
        mustOthers: false,
        othersKey: '',
        placeholderDesc: '',
        score: 0,
        mutex: false,
        mutexTargets: [],
        showTargetsWhenSelected: [],
        defaultHidden: false
      }
      for (const i in addOne) {
        if (i === 'others') {
          addOne[i] = others
          if (others) addOne.othersKey = `${fieldId}_${addOne.hash}`
        } else if (i === 'mustOthers') {
          addOne[i] = false
        } else if (i === 'text') {
          addOne[i] = text
        } else if (i === 'score') {
          addOne[i] = 0
        }
      }
      addOne.hash = this.getNewHash()
      if (index < 0 || typeof index !== 'number') {
        this.curOptions.push(addOne)
      } else {
        this.curOptions.splice(index + 1, 0, addOne)
      }

      return addOne
    },
    deleteOption(index) {
      this.curOptions.splice(index, 1)
    },
    parseImport(newOptions) {
      if (typeof newOptions !== 'undefined' && newOptions.length > 0) {
        this.curOptions = newOptions
        this.importKey = 'single'
      } else {
        ElMessage.warning('最少保留一项')
      }
    },
    getNewHash() {
      let random = this.getRandom()
      while (random in this.hashMap) {
        random = this.getRandom()
      }
      return random
    },
    getRandom() {
      return Math.random().toString().slice(-6)
    },
    changeOptionOthers(val, option) {
      option.others = val
      if (val) {
        option.othersKey = `${this.fieldId}_${option.hash}`
      } else {
        option.othersKey = ''
      }
    },
    optionConfigChange() {
      const arr = []
      this.curOptions.forEach((item) => {
        item.label !== undefined && item.label !== '' && arr.push(item.label)
      })
      const set = [...new Set(arr)]
      if (set.length < arr.length) {
        this.curOptions.forEach((item, index) => {
          item.label = this.options[index].label || ''
        })
        ElMessage.warning('已存在相同的标签内容，请重新输入')
        return
      }
      this.$emit('handleChange', { key: 'options', value: this.curOptions })
      this.configVisible = false
    },
    onBlur(e, index) {
      if (cleanRichText(e.target.innerHTML) === '') return
      this.curOptions[index].text = e.target.innerHTML
    }
  }
}
</script>

<style lang="scss" scoped>
.primary-color {
  color: $primary-color;
}

.option-config-wrapper {
  :deep(.el-dialog) {
    overflow: visible;
  }
  .option-handwrite {
    :deep(.el-dialog__body) {
      overflow: visible; // 允许内部横向滚动容器展示滚动条
      padding-bottom: 8px;
    }
    .option-table-scroll {
      overflow-x: auto;
      overflow-y: hidden;
      width: 100%;
      padding-bottom: 8px; // 预留滚动条空间
    }
    .option-table {
      min-width: 1400px; // 统一列宽，避免被压缩
    }
    .option-header {
      position: relative;
      background: #f9fafc;
      border: 1px solid #edeffc;
      border-radius: 2px;
      font-size: inherit;
      color: #506b7b;
      height: 32px;
      line-height: 32px;
      padding-left: 24px;
      padding-right: 50px;
      display: flex;
      overflow: hidden;
      .header-item {
        white-space: nowrap;
        padding: 0 8px;
      }
      .header-item.flex-1 {
        flex: 1 1 auto;
        min-width: 260px;
      }
      .header-item.w100 {
        flex: 0 0 120px;
        width: 120px;
        text-align: center;
      }
      .header-item.w285 {
        flex: 0 0 285px;
        width: 285px;
      }
    }
    .option-item {
      display: flex;
      align-items: center;
      margin-top: 10px;
      padding-right: 50px;
      position: relative;
      gap: 12px;
      .oitem {
        margin-right: 8px;
        text-align: center;
        &.moreInfo {
          text-align: left;
        }
        .star-imgupload-icon {
          color: #92949d;
          background-color: #fff !important;
        }
      }
      .flex-1 { min-width: 260px; }
      .w120 {
        width: 120px;
      }
      .w100 { flex: 0 0 120px; width: 120px; }
      .icon-mobile {
        line-height: 36px;
        margin-right: 8px;
      }
      .lh36 {
        line-height: 36px;
      }
      .moreInfo {
        width: 285px;
        .more-info-content {
          display: inline-block;
          margin-left: 10px;
          border-bottom: 1px solid #e3e4e8;
          border-radius: 2px;
          .el-input {
            width: 150px;
            :deep(.el-input__wrapper) {
              box-shadow: none;
            }
          }
          .el-checkbox {
            color: #6e707c;
          }
        }
      }

      .area-btn-icon {
        margin-right: 5px;
        cursor: pointer;
        font-size: 16px;
      }
    }
    .flex-1 {
      flex: 1;
      .render-html {
        border-color: #e3e4e8;
        border-radius: 2px;
        color: #6e707c;
        height: auto;
        padding: 9px 0;
        transition: border-color 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
        width: 100%;
        border: 1px solid #dcdfe6;
      }
    }

    .w100 {
      width: 100px;
    }

    .w100 { width: 120px; }
    .w285 {
      width: 285px;
    }
    .operate-area {
      width: 50px;
      position: absolute;
      right: 0;
      z-index: 2;
      border-color: #fff;
      font-size: 18px;
      text-align: right;
      .el-icon {
        cursor: pointer;
        font-size: inherit;
        &:first-child {
          margin-right: 8px;
        }
      }
    }
    .drag-handle {
      margin-top: 0;
      cursor: move;
    }

    .add-btn-row {
      color: $primary-color;
      display: flex;
      align-items: center;
      .add-option {
        padding-left: 23px;
        margin-top: 15px;
        margin-bottom: 15px;
        font-size: 12px;
        cursor: pointer;
        .add-option-item {
          display: flex;
          align-items: center;
          .icon {
            margin-right: 5px;
          }
        }
      }
      .add-option:first-child {
        padding-left: 0;
      }
    }
  }
}
</style>
