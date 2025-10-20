/**
 * SCL-90症状自评量表（Symptom Checklist 90）计算模板
 */

import type { CalculateTemplate, Question, FormData } from '../types'
import { avg, calculateCompletionRate, generateTimestamp, safeCalculate, createCalculationError, SCL90_SEVERITY_LEVELS, type Scl90SeverityLevel } from '../utils'
import { SCL90_NORMS } from '../norms'

/**
 * SCL-90结果接口
 */
export interface SCL90Result {
  success: boolean
  rawScore: number            // 原始总分
  standardScore: number        // 标准分（总均分×10，便于理解）
  totalScore: number           // 总分（保留向后兼容）
  totalAverage: number         // 总均分
  positiveCount: number        // 阳性项目数
  negativeCount: number        // 阴性项目数
  positiveAverage: number      // 阳性症状均分
  level: Scl90SeverityLevel   // 总体严重程度等级
  levelArray: readonly Scl90SeverityLevel[]  // 等级枚举数组
  interpretation: string       // 结果解释
  recommendations: string[]    // 建议列表
  factors: {
    somatization: { rawScore: number; standardScore: number; average: number; level: Scl90SeverityLevel; levelArray: readonly Scl90SeverityLevel[] }        // 躯体化
    obsessiveCompulsive: { rawScore: number; standardScore: number; average: number; level: Scl90SeverityLevel; levelArray: readonly Scl90SeverityLevel[] } // 强迫
    interpersonalSensitivity: { rawScore: number; standardScore: number; average: number; level: Scl90SeverityLevel; levelArray: readonly Scl90SeverityLevel[] } // 人际敏感
    depression: { rawScore: number; standardScore: number; average: number; level: Scl90SeverityLevel; levelArray: readonly Scl90SeverityLevel[] }          // 抑郁
    anxiety: { rawScore: number; standardScore: number; average: number; level: Scl90SeverityLevel; levelArray: readonly Scl90SeverityLevel[] }             // 焦虑
    hostility: { rawScore: number; standardScore: number; average: number; level: Scl90SeverityLevel; levelArray: readonly Scl90SeverityLevel[] }           // 敌对
    phobicAnxiety: { rawScore: number; standardScore: number; average: number; level: Scl90SeverityLevel; levelArray: readonly Scl90SeverityLevel[] }       // 恐怖
    paranoidIdeation: { rawScore: number; standardScore: number; average: number; level: Scl90SeverityLevel; levelArray: readonly Scl90SeverityLevel[] }    // 偏执
    psychoticism: { rawScore: number; standardScore: number; average: number; level: Scl90SeverityLevel; levelArray: readonly Scl90SeverityLevel[] }        // 精神病性
    additional: { rawScore: number; standardScore: number; average: number; level: Scl90SeverityLevel; levelArray: readonly Scl90SeverityLevel[] }          // 其他
  }
  questions?: Array<{
    questionId: string
    questionText: string
    questionType: string
    options: any[]
    userAnswer: any
    answerScore: number
  }>
  metadata?: {
    totalQuestions: number
    answeredQuestions: number
    completionTime: number
  }
  completionRate: string
  itemScores: { [key: string]: number }
  timestamp: string
  scaleType: string
}

/**
 * SCL-90各因子题目分配
 */
const FACTOR_ITEMS = {
  somatization: [1, 4, 12, 27, 40, 42, 48, 49, 52, 53, 56, 58],           // 躯体化 12题
  obsessiveCompulsive: [3, 9, 10, 28, 38, 45, 46, 51, 55, 65],           // 强迫 10题
  interpersonalSensitivity: [6, 21, 34, 36, 37, 41, 61, 69, 73],         // 人际敏感 9题
  depression: [5, 14, 15, 20, 22, 26, 29, 30, 31, 32, 54, 71, 79],       // 抑郁 13题
  anxiety: [2, 17, 23, 33, 39, 57, 72, 78, 80, 86],                      // 焦虑 10题
  hostility: [11, 24, 63, 67, 74, 81],                                    // 敌对 6题
  phobicAnxiety: [13, 25, 47, 50, 70, 75, 82],                          // 恐怖 7题
  paranoidIdeation: [8, 18, 43, 68, 76, 83],                             // 偏执 6题
  psychoticism: [7, 16, 35, 62, 77, 84, 85, 87, 88, 90],                 // 精神病性 10题
  additional: [19, 44, 59, 60, 64, 66, 89]                               // 其他 7题
}

/**
 * 因子名称映射
 */
const FACTOR_NAMES = {
  somatization: '躯体化',
  obsessiveCompulsive: '强迫',
  interpersonalSensitivity: '人际敏感',
  depression: '抑郁',
  anxiety: '焦虑',
  hostility: '敌对',
  phobicAnxiety: '恐怖',
  paranoidIdeation: '偏执',
  psychoticism: '精神病性',
  additional: '其他'
}

/**
 * 根据因子均分判定严重程度
 */
const getFactorLevel = (average: number): Scl90SeverityLevel => {
  const [b1, b2, b3, b4] = SCL90_NORMS.factorSeverity.breaks
  if (average < b1) return SCL90_SEVERITY_LEVELS[0]
  if (average < b2) return SCL90_SEVERITY_LEVELS[1]
  if (average < b3) return SCL90_SEVERITY_LEVELS[2]
  if (average < b4) return SCL90_SEVERITY_LEVELS[3]
  return SCL90_SEVERITY_LEVELS[4]
}

/**
 * SCL-90症状自评量表模板
 */
const scl90Template: CalculateTemplate = {
  metadata: {
    id: 'scl90',
    name: 'SCL-90症状自评量表',
    description: '90项症状清单，评估心理健康状况',
    version: '1.0.0',
    author: 'Derogatis',
    tags: ['心理健康', '症状评估', 'SCL-90'],
    requiredQuestions: 90
  },

  /**
   * 生成计算代码
   */
  generateCode: (questions?: Question[]): string => {
    return `// SCL-90症状自评量表计算代码
// 90项症状清单，5点量表（1-5分）

// 各因子题目分配
const factorItems = ${JSON.stringify(FACTOR_ITEMS, null, 2)};

// 因子名称
const factorNames = ${JSON.stringify(FACTOR_NAMES, null, 2)};

// 获取所有题目并按顺序排列
const sortedQuestions = [...questions].sort((a, b) => {
  const numA = parseInt(a.field.replace(/[^0-9]/g, ""));
  const numB = parseInt(b.field.replace(/[^0-9]/g, ""));
  return numA - numB;
});

// 初始化统计变量
let totalScore = 0;
let positiveCount = 0;  // 阳性项目数（得分≥2）
let negativeCount = 0;  // 阴性项目数（得分=1）
let answeredCount = 0;
const itemScores = {};
const factorScores = {};

// 初始化各因子得分数组
Object.keys(factorItems).forEach(factor => {
  factorScores[factor] = [];
});

// 遍历题目计算得分
sortedQuestions.forEach((question, index) => {
  const answer = formData[question.field];
  const questionNumber = index + 1;
  
  if (answer !== null && answer !== undefined && answer !== "") {
    answeredCount++;
    
    // 获取得分（1-5分）
    let score = 0;
    if (question.options && question.options.length >= 5) {
      const selectedOption = question.options.find(opt => opt.hash === answer);
      if (selectedOption) {
        const optionIndex = question.options.indexOf(selectedOption);
        score = optionIndex + 1; // 1-5分对应选项索引0-4
      }
    } else {
      score = parseInt(answer) || 1;
    }
    
    // 确保分数在1-5范围内
    score = Math.max(1, Math.min(5, score));
    
    itemScores[question.field] = score;
    totalScore += score;
    
    // 统计阳性/阴性项目
    if (score >= 2) {
      positiveCount++;
    } else {
      negativeCount++;
    }
    
    // 分配到对应因子
    for (const [factor, items] of Object.entries(factorItems)) {
      if (items.includes(questionNumber)) {
        factorScores[factor].push(score);
        break;
      }
    }
  }
});

// 计算总均分
const totalAverage = answeredCount > 0 ? (totalScore / answeredCount).toFixed(2) : 0;

// 计算阳性症状均分
const positiveSum = Object.values(itemScores).filter(score => score >= 2).reduce((sum, score) => sum + score, 0);
const positiveAverage = positiveCount > 0 ? (positiveSum / positiveCount).toFixed(2) : 0;

// 计算各因子得分和均分
const factors = {};
const getFactorLevel = (average) => {
  if (average < 1.5) return ${JSON.stringify(SCL90_SEVERITY_LEVELS[0])};
  else if (average < 2.5) return ${JSON.stringify(SCL90_SEVERITY_LEVELS[1])};
  else if (average < 3.5) return ${JSON.stringify(SCL90_SEVERITY_LEVELS[2])};
  else if (average < 4.5) return ${JSON.stringify(SCL90_SEVERITY_LEVELS[3])};
  else return ${JSON.stringify(SCL90_SEVERITY_LEVELS[4])};
};

for (const [factor, scores] of Object.entries(factorScores)) {
  const factorScore = scores.reduce((sum, score) => sum + score, 0);
  const factorAverage = scores.length > 0 ? factorScore / scores.length : 0;
  
  factors[factor] = {
    name: factorNames[factor],
    rawScore: factorScore,
    standardScore: Math.round(factorAverage * 10), // 平均分×10作为标准分
    average: parseFloat(factorAverage.toFixed(2)),
    itemCount: scores.length,
    level: getFactorLevel(factorAverage),
    levelArray: ${JSON.stringify(SCL90_SEVERITY_LEVELS)}
  };
}

// 生成解释
let interpretation = '整体评估：';
if (totalAverage < 1.5) {
  interpretation += '心理健康状况良好';
} else if (totalAverage < 2.0) {
  interpretation += '存在轻度心理问题';
} else if (totalAverage < 2.5) {
  interpretation += '存在中度心理问题，建议寻求心理咨询';
} else {
  interpretation += '存在较严重心理问题，强烈建议寻求专业心理帮助';
}

// 找出得分最高的因子
const sortedFactors = Object.entries(factors)
  .sort((a, b) => b[1].average - a[1].average)
  .slice(0, 3);

if (sortedFactors.length > 0 && sortedFactors[0][1].average >= 2.0) {
  interpretation += '\\n主要问题领域：';
  sortedFactors.forEach(([key, factor]) => {
    if (factor.average >= 2.0) {
      interpretation += \`\${factor.name}(\${factor.level})、\`;
    }
  });
  interpretation = interpretation.slice(0, -1); // 去掉最后的顿号
}

// 计算总体严重程度等级
const overallLevel = getFactorLevel(parseFloat(totalAverage));

// 生成建议
let recommendations = [];
if (overallLevel === ${JSON.stringify(SCL90_SEVERITY_LEVELS[0])}) {
  recommendations = ['保持良好心态', '规律作息', '适度运动', '维持社交活动'];
} else if (overallLevel === ${JSON.stringify(SCL90_SEVERITY_LEVELS[1])}) {
  recommendations = ['关注心理健康', '学习压力管理', '增加放松活动', '与亲友交流'];
} else if (overallLevel === ${JSON.stringify(SCL90_SEVERITY_LEVELS[2])}) {
  recommendations = ['建议寻求心理咨询', '学习应对策略', '调整生活方式', '建立支持系统'];
} else if (overallLevel === ${JSON.stringify(SCL90_SEVERITY_LEVELS[3])}) {
  recommendations = ['建议寻求专业心理治疗', '考虑心理评估', '密切监护', '综合干预'];
} else {
  recommendations = ['立即寻求专业心理帮助', '可能需要精神科评估', '密切监护安全', '紧急干预'];
}

// 返回结果
const result = {
  success: true,
  rawScore: totalScore,
  standardScore: Math.round(parseFloat(totalAverage) * 10), // 总均分×10作为标准分
  totalScore: totalScore,           // 保留向后兼容
  totalAverage: parseFloat(totalAverage),
  positiveCount: positiveCount,
  negativeCount: negativeCount,
  positiveAverage: parseFloat(positiveAverage),
  level: overallLevel,
  levelArray: ${JSON.stringify(SCL90_SEVERITY_LEVELS)},
  interpretation: interpretation,
  recommendations: recommendations,
  factors: factors,
  questions: sortedQuestions.map((question, index) => ({
    questionId: question.field,
    questionText: question.title ? question.title.replace(/<[^>]*>/g, '') : \`题目\${index + 1}\`,
    questionType: question.type || 'single_choice',
    options: question.options || [],
    userAnswer: formData[question.field] || null,
    answerScore: itemScores[question.field] || 0
  })),
  metadata: {
    totalQuestions: 90,
    answeredQuestions: answeredCount,
    completionTime: Date.now() - (formData.startTime || Date.now())
  },
  completionRate: Math.round((answeredCount / 90) * 100) + '%',
  itemScores: itemScores,
  timestamp: new Date().toISOString(),
  scaleType: 'SCL-90症状自评量表'
};

console.log('SCL-90计算结果:', result);
return result;`
  },

  /**
   * 直接计算函数
   */
  calculate: (formData: FormData, questions: Question[]): SCL90Result => {
    return safeCalculate<SCL90Result>(scl90Template.metadata, () => {
      if (!scl90Template.validate?.(questions)) {
        return createCalculationError(scl90Template.metadata, '问卷不符合SCL-90要求') as any
      }
      // 排序题目
      const sortedQuestions = [...questions].sort((a, b) => {
      const numA = parseInt(a.field.replace(/[^0-9]/g, ''))
      const numB = parseInt(b.field.replace(/[^0-9]/g, ''))
      return numA - numB
    })
    
    // 初始化统计变量
    let totalScore = 0
    let positiveCount = 0
    let negativeCount = 0
    let answeredCount = 0
    const itemScores: { [key: string]: number } = {}
    const factorScores: { [key: string]: number[] } = {}
    
    // 初始化各因子得分数组
    Object.keys(FACTOR_ITEMS).forEach(factor => {
      factorScores[factor] = []
    })
    
    // 遍历题目计算得分
    sortedQuestions.forEach((question, index) => {
      const answer = formData[question.field]
      const questionNumber = index + 1
      
      if (answer !== null && answer !== undefined && answer !== '') {
        answeredCount++
        
        // 获取得分（1-5分）
        let score = 1
        if (question.options && question.options.length >= 5) {
          const selectedOption = question.options.find(opt => opt.hash === answer)
          if (selectedOption) {
            const optionIndex = question.options.indexOf(selectedOption)
            score = optionIndex + 1
          }
        } else {
          score = parseInt(answer as string) || 1
        }
        
        score = Math.max(1, Math.min(5, score))
        itemScores[question.field] = score
        totalScore += score
        
        if (score >= 2) positiveCount++
        else negativeCount++
        
        // 分配到对应因子
        for (const [factor, items] of Object.entries(FACTOR_ITEMS)) {
          if (items.includes(questionNumber)) {
            factorScores[factor].push(score)
            break
          }
        }
      }
    })
    
    // 计算总均分和阳性症状均分
    const totalAverage = answeredCount > 0 ? totalScore / answeredCount : 0
    const positiveSum = Object.values(itemScores).filter(score => score >= 2).reduce((sum, score) => sum + score, 0)
    const positiveAverage = positiveCount > 0 ? positiveSum / positiveCount : 0
    
    // 计算各因子得分
    const factors: any = {}
    for (const [factor, scores] of Object.entries(factorScores)) {
      const factorScore = scores.reduce((sum, score) => sum + score, 0)
      const factorAverage = scores.length > 0 ? factorScore / scores.length : 0

      factors[factor] = {
        rawScore: factorScore,
        standardScore: Math.round(factorAverage * 10), // 平均分×10作为标准分
        average: Math.round(factorAverage * 100) / 100,
        level: getFactorLevel(factorAverage),
        levelArray: SCL90_SEVERITY_LEVELS
      }
    }
    
    // 生成解释和建议
    const overallLevel = getFactorLevel(totalAverage)
    let interpretation = '整体评估：'
    let recommendations: string[] = []

    if (overallLevel === SCL90_SEVERITY_LEVELS[0]) {
      interpretation += '心理健康状况良好'
      recommendations = ['保持良好心态', '规律作息', '适度运动', '维持社交活动']
    } else if (overallLevel === SCL90_SEVERITY_LEVELS[1]) {
      interpretation += '存在轻度心理问题'
      recommendations = ['关注心理健康', '学习压力管理', '增加放松活动', '与亲友交流']
    } else if (overallLevel === SCL90_SEVERITY_LEVELS[2]) {
      interpretation += '存在中度心理问题，建议寻求心理咨询'
      recommendations = ['建议寻求心理咨询', '学习应对策略', '调整生活方式', '建立支持系统']
    } else if (overallLevel === SCL90_SEVERITY_LEVELS[3]) {
      interpretation += '存在较严重心理问题，强烈建议寻求专业心理帮助'
      recommendations = ['建议寻求专业心理治疗', '考虑心理评估', '密切监护', '综合干预']
    } else {
      interpretation += '存在严重心理问题，需要立即寻求专业帮助'
      recommendations = ['立即寻求专业心理帮助', '可能需要精神科评估', '密切监护安全', '紧急干预']
    }

    return {
      success: true,
      rawScore: totalScore,
      standardScore: Math.round(totalAverage * 10), // 总均分×10作为标准分
      totalScore,                        // 保留向后兼容
      totalAverage: Math.round(totalAverage * 100) / 100,
      positiveCount,
      negativeCount,
      positiveAverage: Math.round(positiveAverage * 100) / 100,
      level: overallLevel,
      levelArray: SCL90_SEVERITY_LEVELS,
      interpretation,
      recommendations,
      factors,
      questions: sortedQuestions.map((question, index) => ({
        questionId: question.field,
        questionText: question.title ? question.title.replace(/<[^>]*>/g, '') : `题目${index + 1}`,
        questionType: question.type || 'single_choice',
        options: question.options || [],
        userAnswer: formData[question.field] || null,
        answerScore: itemScores[question.field] || 0
      })),
      metadata: {
        totalQuestions: 90,
        answeredQuestions: answeredCount,
        completionTime: Date.now() - (formData.startTime || Date.now())
      },
      completionRate: calculateCompletionRate(answeredCount, 90),
      itemScores,
      timestamp: generateTimestamp(),
      scaleType: 'SCL-90症状自评量表'
    }
    })
  },

  /**
   * 验证问卷是否符合SCL-90要求
   */
  validate: (questions: Question[]): boolean => {
    if (questions.length !== 90) {
      console.warn(`SCL-90应该有90道题，当前有${questions.length}道题`)
      return false
    }

    for (const question of questions) {
      if (!question.options || question.options.length !== 5) {
        console.warn(`题目${question.field}应该有5个选项（5点量表）`)
        return false
      }
    }

    return true
  }
}

export default scl90Template
