<template>
  <div class="right-side">
    <p class="type-title">导入问卷</p>
    <div class="import-container">
      <div class="upload-area" @click="triggerFileInput" @dragover.prevent @drop.prevent="handleDrop">
        <input
          ref="fileInput"
          type="file"
          accept=".xlsx,.xls"
          @change="handleFileSelect"
          style="display: none"
        />
        <div v-if="!selectedFile" class="upload-placeholder">
          <i class="el-icon-upload2"></i>
          <p>点击或拖拽文件到此处上传</p>
          <p class="upload-tip">支持 .xlsx 和 .xls 格式的问卷文件</p>
        </div>
        <div v-else class="file-info">
          <i class="el-icon-document"></i>
          <span>{{ selectedFile.name }}</span>
          <el-button type="text" @click.stop="removeFile">删除</el-button>
        </div>
      </div>
      
      <div class="form-section">
        <el-form
          class="import-form"
          label-position="right"
          ref="ruleForm"
          :model="form"
          label-width="100px"
          :rules="rules"
        >
          <el-form-item prop="title" label="问卷名称">
            <el-input
              v-model="form.title"
              :class="form.title ? 'nonempty' : 'empty'"
              placeholder="请输入问卷名称"
            />
            <p class="form-item-tip">该标题可在打开问卷的浏览器顶部展示</p>
          </el-form-item>
          <el-form-item prop="surveyCode" label="问卷编码">
            <el-input
              v-model="form.surveyCode"
              :class="form.surveyCode ? 'nonempty' : 'empty'"
              placeholder="请输入问卷编码"
            />
            <p class="form-item-tip">问卷编码是问卷的唯一标识，要确保唯一性</p>
          </el-form-item>
          <el-form-item prop="remark" label="问卷备注">
            <el-input
              v-model="form.remark"
              :class="form.remark ? 'nonempty' : 'empty'"
              placeholder="请输入备注"
            />
            <p class="form-item-tip">备注仅自己可见</p>
          </el-form-item>
          <el-form-item prop="groupId" label="分组" v-if="menuType === MenuType.PersonalGroup">
            <el-select v-model="form.groupId" placeholder="未分组" clearable>
              <el-option
                v-for="item in groupAllList"
                :key="item?._id"
                :label="item?.name"
                :value="item?._id"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button class="import-btn" type="primary" @click="submit" :loading="loading" :disabled="!selectedFile">
              开始导入
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, toRefs } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import 'element-plus/theme-chalk/src/message.scss'
import { createSurveyFromExcel } from '@/management/api/survey'
import { MenuType, GroupState } from '@/management/utils/workSpace'
import { useWorkSpaceStore } from '@/management/stores/workSpace'

const workSpaceStore = useWorkSpaceStore()
workSpaceStore.getGroupList()
const { groupAllList, menuType, groupId, workSpaceId } = storeToRefs(workSpaceStore)

const ruleForm = ref<any>(null)
const fileInput = ref<HTMLInputElement>()
const selectedFile = ref<File | null>(null)
const loading = ref(false)

const state = reactive({
  rules: {
    title: [{ required: true, message: '请输入问卷标题', trigger: 'blur' }],
    surveyCode: [{ required: true, message: '请输入问卷编码', trigger: 'blur' }]
  },
  form: {
    title: '',
    remark: '',
    surveyCode: '',
    groupId: groupId.value === GroupState.All || groupId.value === GroupState.Not ? '' : groupId.value
  }
})
const { rules, form } = toRefs(state)

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

const handleDrop = (event: DragEvent) => {
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    const file = event.dataTransfer.files[0]
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      selectedFile.value = file
    } else {
      ElMessage.error('请选择Excel文件')
    }
  }
}

const removeFile = () => {
  selectedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const checkForm = (fn: Function) => {
  ruleForm.value?.validate?.((valid: boolean) => {
    valid && typeof fn === 'function' && fn()
  })
}

const router = useRouter()
const submit = () => {
  if (!selectedFile.value) {
    ElMessage.error('请选择要导入的文件')
    return
  }
  
  checkForm(async () => {
    if (loading.value) {
      return
    }
    loading.value = true
    
    try {
      const formData = new FormData()
      formData.append('files', selectedFile.value!)
      formData.append('title', form.value.title)
      formData.append('remark', form.value.remark)
      formData.append('surveyCode', form.value.surveyCode)
      if (workSpaceId.value) {
        formData.append('workspaceId', workSpaceId.value)
      }
      if (form.value.groupId && form.value.groupId !== GroupState.All && form.value.groupId !== GroupState.Not) {
        formData.append('groupId', form.value.groupId)
      }
      
      const res: any = await createSurveyFromExcel(formData)
      if (res?.code === 200 && res?.data?.surveyId) {
        ElMessage.success('问卷导入成功')
        const id = res.data.surveyId
        router.push({
          name: 'QuestionEditIndex',
          params: {
            id
          }
        })
      } else {
        ElMessage.error(res?.message || '导入失败')
      }
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.message || '导入失败')
    } finally {
      loading.value = false
    }
  })
}
</script>

<style lang="scss" scoped>
.right-side {
  flex: 1;
  padding: 45px 64px;
  background: #fff;
  overflow-y: auto;

  .type-title {
    color: $font-color-title;
    font-family: PingFangSC-Medium;
    font-size: 24px;
    margin-bottom: 36px;
  }
}

.import-container {
  .upload-area {
    border: 2px dashed #d9d9d9;
    border-radius: 6px;
    padding: 40px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.3s;
    margin-bottom: 30px;

    &:hover {
      border-color: $primary-color;
    }

    .upload-placeholder {
      color: #999;

      i {
        font-size: 48px;
        margin-bottom: 16px;
        display: block;
      }

      p {
        margin: 8px 0;
        font-size: 16px;
      }

      .upload-tip {
        font-size: 14px;
        color: #ccc;
      }
    }

    .file-info {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: $font-color-title;

      i {
        font-size: 24px;
        color: $primary-color;
      }

      span {
        font-size: 16px;
      }
    }
  }

  .form-section {
    .import-form {
      .form-item-tip {
        font-size: 12px;
        color: #999;
        margin: 4px 0 0 0;
      }

      .import-btn {
        width: 100%;
        height: 40px;
        font-size: 16px;
      }
    }
  }
}
</style>
