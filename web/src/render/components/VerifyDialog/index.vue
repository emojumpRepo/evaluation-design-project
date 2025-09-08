<template>
  <div>
    <WhiteListDialog
      v-if="showWhiteList"
      :visible="showWhiteList"
      ref="whiteListRef"
      @confirm="whiteListConfirm"
    />
    <FillDataDialog v-if="showFillData" :visible="showFillData" ref="fillDataRef" @close="handleFillDataClose" />
  </div>
</template>

<script setup lang="ts">
import { watch, computed, ref, onMounted } from 'vue'
import { useSurveyStore } from '../../stores/survey'
import { getSurveyData, getSurveySubmit } from '../../utils/storage'

import WhiteListDialog from './WhiteListDialog.vue'
import FillDataDialog from './FillDataDialog.vue'

const surveyStore = useSurveyStore()
const baseConf: any = computed(() => surveyStore?.baseConf)

const showWhiteList = ref(false)
const showFillData = ref(false)
const hasCheckedFillData = ref(false) // 防止重复检查

// 检查是否需要显示回填对话框
const checkFillData = () => {
  if (hasCheckedFillData.value) return
  hasCheckedFillData.value = true
  
  const { surveyPath } = surveyStore || {}
  const { fillSubmitAnswer } = baseConf.value || {}
  
  // 保留最小必要日志可按需启用
  
  if (!surveyPath) return
  
  // 默认开启断点续答，或者自动填充
  const userId = surveyStore.userId
  const localData = getSurveyData(surveyPath, userId)
  const isSubmit = getSurveySubmit(surveyPath, userId)
  
  // 保留最小必要日志可按需启用
  
  if (localData && (true || (fillSubmitAnswer && isSubmit))) {
    showFillData.value = true
  }
}

watch(
  () => baseConf.value,
  () => {
    const { passwordSwitch, whitelistType } = baseConf.value

    // 密码 or 白名单
    if ((whitelistType && whitelistType != 'ALL') || passwordSwitch) {
      showWhiteList.value = true
      return
    }

    whiteListConfirm()
  }
)

const whiteListConfirm = () => {
  checkFillData()
}

// 处理回填对话框关闭
const handleFillDataClose = () => {
  showFillData.value = false
  hasCheckedFillData.value = false // 重置检查状态，允许下次进入时再次检查
}

// 组件挂载时也检查一次
onMounted(() => {
  // 延迟检查，确保 surveyStore 已经初始化
  setTimeout(() => {
    checkFillData()
  }, 100)
})

// export default {
//   components: { DialogComponent },
//   data() {
//     return {
//       showWhiteListDialog: false,
//       showFillDataDialog: false,
//     };
//   },
//   methods: {
//     startValidation() {
//       this.showDialog1 = true
//       await this.$refs.dialog1.validate()  // 校验第一个弹窗
//       this.showDialog1 = false

//       this.showDialog2 = true
//       await this.$refs.dialog2.validate()  // 校验第二个弹窗
//       this.showDialog2 = false
//     }
//   }
// };
</script>
