import { type Ref, ref, computed } from 'vue'

import submitFormConfig from '@/management/pages/edit/setterConfig/submitConfig'
import questionLoader from '@/materials/questions/questionLoader'

const innerMetaConfig = {
  submit: {
    title: '提交配置',
    formConfig: submitFormConfig
  },
  description: {
    title: '描述文本',
    formConfig: [
      {
        name: 'content',
        title: '描述内容',
        type: 'RichTextSetter',
        key: 'descriptionConfig.page1.content',
        placeholder: '请输入描述内容，支持HTML格式',
        tip: '支持HTML格式，可用于添加题目描述或模块描述'
      }
    ]
  }
}

export default function useCurrentEdit({
  schema,
  questionDataList
}: {
  schema: any
  questionDataList: Ref<any[]>
}) {
  const currentEditOne = ref()
  const currentEditStatus = ref('Success')

  const currentEditKey = computed(() => {
    if (currentEditOne.value === null) {
      return null
    }
    let key = ''
    switch (currentEditOne.value) {
      case 'banner':
      case 'mainTitle':
      case 'description':
        key = 'bannerConf'
        break
      case 'submit':
        key = 'submitConf'
        break
      case 'logo':
        key = 'bottomConf'
        break
      default:
        key = `questionDataList.${currentEditOne.value}`
    }
    return key
  })

  const currentEditMeta = computed(() => {
    if (currentEditOne.value === null) {
      return null
    } else if (innerMetaConfig[currentEditOne.value as keyof typeof innerMetaConfig]) {
      const config = innerMetaConfig[currentEditOne.value as keyof typeof innerMetaConfig]
      // 如果是description，需要根据当前页面动态生成配置
      if (currentEditOne.value === 'description') {
        const currentPage = schema.pageEditOne || 1
        return {
          ...config,
          formConfig: config.formConfig.map(item => ({
            ...item,
            key: `descriptionConfig.page${currentPage}.content`
          }))
        }
      }
      return config
    } else {
      const questionType = questionDataList.value?.[currentEditOne.value]?.type
      return questionLoader.getMeta(questionType)
    }
  })

  const moduleConfig = computed(() => {
    if (currentEditOne.value === null) {
      return null
    }

    if (currentEditOne.value === 'banner' || currentEditOne.value === 'mainTitle' || currentEditOne.value === 'description') {
      return schema?.bannerConf
    } else if (currentEditOne.value === 'submit') {
      return schema?.submitConf
    } else if (currentEditOne.value === 'logo') {
      return schema?.bottomConf
    } else if (!Number.isNaN(currentEditOne.value)) {
      return questionDataList.value?.[currentEditOne.value]
    } else {
      return null
    }
  })

  const formConfigList = computed(() => {
    if (currentEditOne.value === null) {
      return null
    }

    return currentEditMeta.value?.formConfig || []
  })

  function setCurrentEditOne(data: any) {
    currentEditOne.value = data
  }

  function changeCurrentEditStatus(status: string) {
    currentEditStatus.value = status
  }

  return {
    currentEditOne,
    currentEditKey,
    currentEditStatus,
    moduleConfig,
    formConfigList,
    currentEditMeta,
    setCurrentEditOne,
    changeCurrentEditStatus
  }
}
