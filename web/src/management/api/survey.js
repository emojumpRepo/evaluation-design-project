import axios from './base'

export const getSurveyList = ({ curPage, filter, order, workspaceId, groupId, isRecycleBin }) => {
  return axios.get('/survey/getList', {
    params: {
      pageSize: 10,
      curPage,
      filter,
      order,
      workspaceId,
      groupId,
      isRecycleBin
    }
  })
}

export const getSurveyById = (id) => {
  return axios.get('/survey/getSurvey', {
    params: {
      surveyId: id
    }
  })
}

export const saveSurvey = ({ surveyId, configData, sessionId }) => {
  return axios.post('/survey/updateConf', { surveyId, configData, sessionId })
}

export const publishSurvey = ({ surveyId }) => {
  return axios.post('/survey/publishSurvey', {
    surveyId
  })
}

export const createSurvey = (data) => {
  return axios.post('/survey/createSurvey', data)
}

export const getSurveyHistory = ({ surveyId, historyType }) => {
  return axios.get('/surveyHistory/getList', {
    params: {
      surveyId,
      historyType
    }
  })
}

export const deleteSurvey = (surveyId) => {
  return axios.post('/survey/deleteSurvey', {
    surveyId
  })
}

export const recoverSurvey = (surveyId) => {
  return axios.post('/survey/recoverSurvey', {
    surveyId
  })
}

export const completeDeleteSurvey = (surveyId) => {
  return axios.post('/survey/completeDeleteSurvey', {
    surveyId
  })
}

export const updateSurvey = (data) => {
  return axios.post('/survey/updateMeta', data)
}

export const pausingSurvey = (surveyId) => {
  return axios.post('/survey/pausingSurvey', {
    surveyId
  })
}

export const upgradeSubStatus = () => {
  return axios.get('/upgrade/subStatus')
}

export const getSessionId = ({ surveyId }) => {
  return axios.post('/session/create', { surveyId })
}

export const seizeSession = ({ sessionId }) => {
  return axios.post('/session/seize', { sessionId })
}

// 导出问卷
export const exportSurvey = (surveyId) => {
  return axios.get('/survey/exportSurvey', {
    params: { surveyId },
    responseType: 'blob'
  })
}

// 导入问卷
export const importSurveyFromExcel = (formData) => {
  return axios.post('/survey/importSurveyFromExcel', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}

// 从Excel创建问卷
export const createSurveyFromExcel = (formData) => {
  return axios.post('/survey/createSurveyFromExcel', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
}