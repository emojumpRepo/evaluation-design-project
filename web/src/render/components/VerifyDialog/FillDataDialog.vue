<template>
  <ConfirmDialog
    :title="fillAnswer ? '是否继续上次填写的内容？' : '是否继续上次提交的内容？'"
    :cancel="true"
    cancel-btn-text="重新填写"
    confirm-btn-text="继续填写"
    :autoClose="false"
    @confirm="handleConfirm"
    @close="handleCancel"
  />
</template>
<script setup>
import { useSurveyStore } from '../../stores/survey'
import { clearSurveyData } from '../../utils/storage'

import ConfirmDialog from '../ConfirmDialog.vue'

const emit = defineEmits(['close'])

const surveyStore = useSurveyStore()
const { fillAnswer } = surveyStore.baseConf || {}

const handleConfirm = () => {
  // 调用 surveyStore 的 restoreProgress 方法来回填数据
  surveyStore.restoreProgress()
  emit('close')
}

const handleCancel = () => {
  const surveyPath = surveyStore.surveyPath
  const userId = surveyStore.userId
  // 用户选择重新填写，清除保存的数据
  clearSurveyData(surveyPath, userId)
  emit('close')
}
</script>
<style lang="scss" scoped></style>
