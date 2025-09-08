// 用于记录"问卷断点续答"的数据
export const getSurveyData = (surveyId: string, userId?: string): any => {
  try {
    const key = userId ? `${surveyId}_${userId}_questionData` : `${surveyId}_questionData`
    return JSON.parse(localStorage.getItem(key) as string) || null
  } catch (e) {
    console.log(e)
  }

  return null
}
export const setSurveyData = (surveyId: string, formData: any = {}, userId?: string) => {
  const key = userId ? `${surveyId}_${userId}_questionData` : `${surveyId}_questionData`
  localStorage.setItem(key, JSON.stringify(formData))
}
export const clearSurveyData = (surveyId: string, userId?: string) => {
  const key = userId ? `${surveyId}_${userId}_questionData` : `${surveyId}_questionData`
  localStorage.removeItem(key)
}

// 问卷是否提交过，用于"自动填充上次填写内容"
export const getSurveySubmit = (surveyId: string, userId?: string): number => {
  try {
    const key = userId ? `${surveyId}_${userId}_submit` : `${surveyId}_submit`
    return Number(JSON.parse(localStorage.getItem(key) as string)) || 0
  } catch (e) {
    console.log(e)
  }

  return 0
}
export const setSurveySubmit = (surveyId: string, value: number, userId?: string) => {
  const key = userId ? `${surveyId}_${userId}_submit` : `${surveyId}_submit`
  localStorage.setItem(key, JSON.stringify(value))
}
export const clearSurveySubmit = (surveyId: string, userId?: string) => {
  const key = userId ? `${surveyId}_${userId}_submit` : `${surveyId}_submit`
  localStorage.removeItem(key)
}

// 投票记录
export const getVoteData = (): any => {
  try {
    return JSON.parse(localStorage.getItem('voteData') as string) || null
  } catch (e) {
    console.log(e)
  }

  return null
}
export const setVoteData = (params: any) => {
  localStorage.setItem('voteData', JSON.stringify(params))
}
export const clearVoteData = () => localStorage.removeItem('voteData')
