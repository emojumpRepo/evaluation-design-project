/**
 * 计算模板管理器
 */

import type { CalculateTemplate, TemplateRegistry, Question } from './types'

// 动态导入各个模板
const templateModules = {
  sds: () => import('./scales/SDS'),
  sas: () => import('./scales/sas'),
  epq: () => import('./scales/epq'),
  phq9: () => import('./scales/phq9'),
  psqi: () => import('./scales/psqi'),
  scl90: () => import('./scales/scl90'),
  disc: () => import('./scales/disc'),
  bigfive: () => import('./scales/BFI'),
  general: () => import('./scales/general')
}

/**
 * 模板注册表
 */
const templateRegistry: TemplateRegistry = {}

/**
 * 加载模板
 * @param templateId 模板ID
 */
export const loadTemplate = async (templateId: string): Promise<CalculateTemplate | null> => {
  // 如果已经加载过，直接返回
  if (templateRegistry[templateId]) {
    return templateRegistry[templateId]
  }

  // 动态加载模板
  const loader = templateModules[templateId as keyof typeof templateModules]
  if (loader) {
    try {
      const module = await loader()
      const template = module.default
      // 缓存模板
      templateRegistry[templateId] = template
      return template
    } catch (error) {
      console.error(`Failed to load template ${templateId}:`, error)
      return null
    }
  }

  console.warn(`Template ${templateId} not found`)
  return null
}

/**
 * 获取所有可用模板的元数据
 */
export const getAvailableTemplates = () => {
  return [
    {
      id: 'sds',
      name: 'SDS抑郁自评量表',
      description: 'Zung氏抑郁自评量表，20题版本',
      category: '心理健康'
    },
    {
      id: 'sas',
      name: 'SAS焦虑自评量表',
      description: 'Zung氏焦虑自评量表，20题版本',
      category: '心理健康'
    },
    {
      id: 'phq9',
      name: 'PHQ-9抑郁问卷',
      description: '9题快速抑郁筛查工具',
      category: '心理健康'
    },
    {
      id: 'epq',
      name: 'EPQ埃森克人格问卷',
      description: '88题版本，评估人格四维度',
      category: '人格测评'
    },
    {
      id: 'bigfive',
      name: '大五人格量表(BFI)',
      description: 'NEO-FFI-60大五人格测评',
      category: '人格测评'
    },
    {
      id: 'psqi',
      name: 'PSQI睡眠质量指数',
      description: '匹兹堡睡眠质量评估',
      category: '心理健康'
    },
    {
      id: 'scl90',
      name: 'SCL-90症状自评量表',
      description: '90项症状清单',
      category: '心理健康'
    },
    {
      id: 'disc',
      name: 'DISC行为风格测评',
      description: '行为风格四维度评估',
      category: '人格测评'
    },
    {
      id: 'general',
      name: '通用计算模板',
      description: '适用于各种类型的问卷',
      category: '通用'
    }
  ]
}

/**
 * 根据模板ID生成计算代码
 * @param templateId 模板ID
 * @param questions 题目列表
 */
export const generateCodeFromTemplate = async (
  templateId: string,
  questions?: Question[]
): Promise<string | null> => {
  const template = await loadTemplate(templateId)
  if (template) {
    return template.generateCode(questions)
  }
  return null
}

/**
 * 验证问卷是否符合特定模板要求
 * @param templateId 模板ID
 * @param questions 题目列表
 */
export const validateQuestionnaire = async (
  templateId: string,
  questions: Question[]
): Promise<boolean> => {
  const template = await loadTemplate(templateId)
  if (template && template.validate) {
    return template.validate(questions)
  }
  return true
}

/**
 * 获取模板的元数据
 * @param templateId 模板ID
 */
export const getTemplateMetadata = async (templateId: string) => {
  const template = await loadTemplate(templateId)
  if (template) {
    return template.metadata
  }
  return null
}

/**
 * 清除模板缓存
 */
export const clearTemplateCache = () => {
  Object.keys(templateRegistry).forEach(key => {
    delete templateRegistry[key]
  })
}

/**
 * 导出工具函数供模板代码使用
 */
export { sum, avg, min, max, calculateCompletionRate, standardDeviation, percentile } from './utils'