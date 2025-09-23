import { type Ref, ref, reactive } from 'vue'
import { merge } from 'lodash-es'

import { getSurveyById, getSessionId } from '@/management/api/survey'
import useLogicEngine from './useLogicEngine'

export default function useInitializeSchema(
  surveyId: Ref<string>,
  initializeSchemaCallBack: () => void
) {
  const schema = reactive({
    metaData: null,
    bannerConf: {
      descriptionConfig: {
        content: '请输入描述内容'
      }
    } as any,
    bottomConf: {} as any,
    skinConf: {} as any,
    baseConf: {} as any,
    submitConf: {} as any,
    pageConf: [] as any,
    logicConf: {} as any,
    questionDataList: [] as any,
    calculateConf: {} as any,  // 添加计算配置
    pageEditOne: 1
  })
  const { showLogicEngine, initShowLogicEngine, jumpLogicEngine, initJumpLogicEngine } =
    useLogicEngine(schema)

  function initSchema({ metaData, codeData }: { metaData: any; codeData: any }) {
    schema.metaData = metaData
    schema.bannerConf = merge({}, schema.bannerConf, codeData.bannerConf)
    // 确保descriptionConfig存在
    if (!schema.bannerConf.descriptionConfig) {
      schema.bannerConf.descriptionConfig = {
        content: '请输入描述内容'
      }
    }
    schema.bottomConf = merge({}, schema.bottomConf, codeData.bottomConf)
    schema.skinConf = merge({}, schema.skinConf, codeData.skinConf)
    schema.baseConf = merge({}, schema.baseConf, codeData.baseConf)
    schema.logicConf = codeData.logicConf
    schema.pageConf = codeData.pageConf
    schema.submitConf = merge({}, schema.submitConf, codeData.submitConf)
    schema.calculateConf = merge({}, schema.calculateConf, codeData.calculateConf || {})  // 添加计算配置
    schema.questionDataList = codeData.questionDataList || []
    schema.pageEditOne = 1
  }

  const sessionId = ref('')
  async function initSessionId() {
    const sessionIdKey = `${surveyId.value}_sessionId`
    const localSessionId = sessionStorage.getItem(sessionIdKey)
    if (localSessionId) {
      sessionId.value = localSessionId
    } else {
      const res: Record<string, any> = await getSessionId({ surveyId: surveyId.value })
      if (res.code === 200) {
        sessionId.value = res.data.sessionId
        sessionStorage.setItem(sessionIdKey, sessionId.value)
      }
    }
  }

  async function getSchemaFromRemote() {
    const res: any = await getSurveyById(surveyId.value)
    if (res.code === 200) {
      const metaData = res.data.surveyMetaRes
      document.title = metaData.title
      const data = res.data.surveyConfRes.code
      const {
        bannerConf,
        bottomConf,
        skinConf,
        baseConf,
        submitConf,
        dataConf,
        logicConf = {},
        calculateConf = {}  // 添加计算配置
      } = data
      if (!data.pageConf || data.pageConf.length === 0) {
        data.pageConf = [dataConf.dataList.length]
      }
      initSchema({
        metaData,
        codeData: {
          bannerConf,
          bottomConf,
          skinConf,
          baseConf,
          submitConf,
          questionDataList: dataConf.dataList,
          pageConf: data.pageConf,
          logicConf,
          calculateConf  // 添加计算配置
        }
      })
      initializeSchemaCallBack()

      initShowLogicEngine()
      initJumpLogicEngine()
    } else {
      throw new Error(res.errmsg || '问卷不存在')
    }
  }

  return {
    schema,
    getSchemaFromRemote,
    showLogicEngine,
    jumpLogicEngine,
    sessionId,
    initSessionId
  }
}
