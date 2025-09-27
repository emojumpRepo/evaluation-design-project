/**
 * 计算模板类型定义
 */

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
  depressionLevel: string
  interpretation: string
  itemScores: { [key: string]: number }
  completionRate: string
}

/**
 * 大五人格维度
 */
export interface BigFiveDimension {
  name: string
  nameEn: string
  score: number
  level: string
  description: string
  percentile?: number
}

/**
 * 大五人格计算结果
 */
export interface BigFiveResult extends CalculateResult {
  dimensions: {
    neuroticism: BigFiveDimension
    extraversion: BigFiveDimension
    openness: BigFiveDimension
    agreeableness: BigFiveDimension
    conscientiousness: BigFiveDimension
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