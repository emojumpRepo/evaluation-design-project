/**
 * 计算模板工具函数库
 */

import type { Question, QuestionOption, FormData } from './types'

/**
 * 数组求和
 */
export const sum = (array: number[]): number => {
  return array.reduce((acc, val) => acc + val, 0)
}

/**
 * 数组求平均值
 */
export const avg = (array: number[]): number => {
  if (array.length === 0) return 0
  return sum(array) / array.length
}

/**
 * 数组最小值
 */
export const min = (array: number[]): number => {
  if (array.length === 0) return 0
  return Math.min(...array)
}

/**
 * 数组最大值
 */
export const max = (array: number[]): number => {
  if (array.length === 0) return 0
  return Math.max(...array)
}

/**
 * 计算标准差
 */
export const standardDeviation = (array: number[]): number => {
  if (array.length === 0) return 0
  const mean = avg(array)
  const squareDiffs = array.map(value => {
    const diff = value - mean
    return diff * diff
  })
  const avgSquareDiff = avg(squareDiffs)
  return Math.sqrt(avgSquareDiff)
}

/**
 * 计算百分位数
 */
export const percentile = (array: number[], p: number): number => {
  if (array.length === 0) return 0
  const sorted = [...array].sort((a, b) => a - b)
  const index = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index % 1
  return sorted[lower] * (1 - weight) + sorted[upper] * weight
}

/**
 * 正向计分映射（1-5分制）
 */
export const normalScoreMap5 = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5
}

/**
 * 反向计分映射（1-5分制）
 */
export const reverseScoreMap5 = {
  1: 5,
  2: 4,
  3: 3,
  4: 2,
  5: 1
}

/**
 * 正向计分映射（1-4分制）
 */
export const normalScoreMap4 = {
  1: 1,
  2: 2,
  3: 3,
  4: 4
}

/**
 * 反向计分映射（1-4分制）
 */
export const reverseScoreMap4 = {
  1: 4,
  2: 3,
  3: 2,
  4: 1
}

/**
 * 获取选项得分
 * @param question 题目信息
 * @param answer 用户答案
 * @param isReverse 是否反向计分
 * @param scoreMap 自定义计分映射
 */
export const getOptionScore = (
  question: Question,
  answer: any,
  isReverse: boolean = false,
  scoreMap?: { [key: string]: number }
): number => {
  if (!answer || !question.options) return 0

  // 查找选中的选项
  const selectedOption = question.options.find((opt: QuestionOption) => opt.hash === answer)
  if (!selectedOption) return 0

  // 如果选项本身有分数，直接使用
  if (selectedOption.score !== undefined) {
    return Number(selectedOption.score)
  }

  // 否则根据选项索引计算分数
  const optionIndex = question.options.indexOf(selectedOption) + 1
  
  if (scoreMap) {
    return scoreMap[optionIndex] || 0
  }

  // 默认使用5分制
  if (isReverse) {
    return reverseScoreMap5[optionIndex as keyof typeof reverseScoreMap5] || 0
  } else {
    return normalScoreMap5[optionIndex as keyof typeof normalScoreMap5] || 0
  }
}

/**
 * 计算完成率
 */
export const calculateCompletionRate = (
  answeredCount: number,
  totalCount: number
): string => {
  if (totalCount === 0) return '0%'
  return Math.round((answeredCount / totalCount) * 100) + '%'
}

/**
 * 根据分数获取等级
 */
export const getScoreLevel = (
  score: number,
  levels: Array<{ min: number; max: number; level: string; description?: string }>
): { level: string; description?: string } => {
  for (const levelConfig of levels) {
    if (score >= levelConfig.min && score <= levelConfig.max) {
      return {
        level: levelConfig.level,
        description: levelConfig.description
      }
    }
  }
  return { level: '未知', description: '无法确定等级' }
}

/**
 * 提取题目编号（从field中提取数字）
 */
export const extractQuestionNumber = (field: string): number => {
  const match = field.match(/\d+/)
  return match ? parseInt(match[0]) : 0
}

/**
 * 按题目编号排序
 */
export const sortQuestionsByNumber = (questions: Question[]): Question[] => {
  return [...questions].sort((a, b) => {
    const numA = extractQuestionNumber(a.field)
    const numB = extractQuestionNumber(b.field)
    return numA - numB
  })
}

/**
 * 生成时间戳
 */
export const generateTimestamp = (): string => {
  return new Date().toISOString()
}

/**
 * 验证必答题是否都已回答
 */
export const validateRequiredQuestions = (
  formData: FormData,
  requiredFields: string[]
): boolean => {
  return requiredFields.every(field => {
    const value = formData[field]
    return value !== null && value !== undefined && value !== ''
  })
}

/**
 * 计算多选题得分
 */
export const getCheckboxScore = (
  question: Question,
  answers: string[]
): number => {
  if (!answers || !Array.isArray(answers) || !question.options) return 0
  
  let totalScore = 0
  answers.forEach(hash => {
    const option = question.options?.find(opt => opt.hash === hash)
    if (option && option.score !== undefined) {
      totalScore += Number(option.score)
    }
  })
  
  return totalScore
}

/**
 * 格式化百分比
 */
export const formatPercentage = (value: number, decimals: number = 1): string => {
  return value.toFixed(decimals) + '%'
}

/**
 * 生成分数范围描述
 */
export const generateScoreRangeDescription = (
  score: number,
  min: number,
  max: number
): string => {
  const percentage = ((score - min) / (max - min)) * 100
  if (percentage <= 20) return '非常低'
  if (percentage <= 40) return '较低'
  if (percentage <= 60) return '中等'
  if (percentage <= 80) return '较高'
  return '非常高'
}