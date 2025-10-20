/**
 * 计算模板类型定义
 */

import type { SDSDepressionLevel, FactorLevel3 } from './utils'

/**
 * 题目选项
 */
export interface QuestionOption {
  hash: string
  text: string
  score?: number
  othersKey?: string
}

/**
 * 题目信息
 */
export interface Question {
  field: string
  title: string
  type: string
  options?: QuestionOption[]
  rangeConfig?: {
    min: number
    max: number
  }
}

/**
 * 表单数据
 */
export interface FormData {
  [key: string]: any
}

/**
 * 计算结果基础接口
 */
export interface CalculateResult {
  success: boolean
  timestamp: string
  scaleType: string
  rawScore?: number        // 原始总分（所有题目得分的直接相加）
  standardScore?: number   // 标准分（经过转换、标准化或权重的分数）
  [key: string]: any
}

/**
 * 模板元数据
 */
export interface TemplateMetadata {
  id: string
  name: string
  description: string
  version: string
  author?: string
  tags?: string[]
  requiredQuestions?: number
}

/**
 * 计算模板接口
 */
export interface CalculateTemplate {
  metadata: TemplateMetadata
  generateCode: (questions?: Question[]) => string
  calculate?: (formData: FormData, questions: Question[]) => CalculateResult
  validate?: (questions: Question[]) => boolean
}

/**
 * 模板注册表
 */
export interface TemplateRegistry {
  [key: string]: CalculateTemplate
}

/**
 * SDS计算结果
 */
export interface SDSResult extends CalculateResult {
  rawScore: number
  standardScore: number
  level: SDSDepressionLevel
  levelArray: readonly SDSDepressionLevel[]
  interpretation: string
  recommendations: string[]
  factors: Array<{
    name: string
    score: number
    interpretation: string
    level: SDSDepressionLevel
    levelArray: readonly SDSDepressionLevel[]
  }>
  questions?: Array<{
    questionId: string
    questionText: string
    questionType: string
    options: any[]
    userAnswer: any
    answerScore: number
    isReverse?: boolean
  }>
  metadata?: {
    totalQuestions: number
    answeredQuestions: number
    reverseItemsCount: number
    completionTime: number
  }
  answeredCount: number
  itemScores: { [key: string]: number }
  completionRate: string
}

/**
 * 大五人格维度
 */
export interface BigFiveDimension {
  name: string
  nameEn: string
  rawScore: number        // 维度原始分
  standardScore: number   // 维度标准分（T分数）
  level: FactorLevel3
  levelArray: readonly FactorLevel3[]
  description: string
  percentile?: number
}

/**
 * 大五人格计算结果
 */
export interface BigFiveResult extends CalculateResult {
  rawScore: number                        // 所有维度原始分总和
  standardScore: number                   // 主要维度标准分（外向性T分数）
  dimensions: {
    neuroticism: BigFiveDimension
    extraversion: BigFiveDimension
    openness: BigFiveDimension
    agreeableness: BigFiveDimension
    conscientiousness: BigFiveDimension
  }
  level: FactorLevel3                    // 总体人格等级（基于主要维度）
  levelArray: readonly FactorLevel3[]   // 等级枚举数组
  interpretation: string                 // 结果解释
  recommendations: string[]              // 建议列表
  factors: Array<{
    name: string
    nameEn: string
    rawScore: number        // 因子原始分
    standardScore: number   // 因子标准分
    interpretation: string
    level: FactorLevel3
    levelArray: readonly FactorLevel3[]
  }>
  questions?: Array<{
    questionId: string
    questionText: string
    questionType: string
    options: any[]
    userAnswer: any
    answerScore: number
    isReverse?: boolean
  }>
  metadata?: {
    totalQuestions: number
    answeredQuestions: number
    completionTime: number
  }
  itemScores: { [key: string]: number }
  completionRate: string
  profile: string
}

/**
 * 通用计算结果
 */
export interface GeneralResult extends CalculateResult {
  totalScore?: number
  scores?: { [key: string]: number }
  level?: string
  answeredCount?: number
  totalQuestions?: number
  completionRate?: string
  formData?: FormData
}