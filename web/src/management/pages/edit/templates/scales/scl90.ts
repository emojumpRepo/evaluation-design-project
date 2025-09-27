/**
 * SCL-90症状自评量表（Symptom Checklist 90）计算模板
 */

import type { CalculateTemplate, Question, FormData } from '../types'
import { avg, calculateCompletionRate, generateTimestamp } from '../utils'

/**
 * SCL-90结果接口
 */
export interface SCL90Result {
  success: boolean
  totalScore: number           // 总分
  totalAverage: number         // 总均分
  positiveCount: number        // 阳性项目数
  negativeCount: number        // 阴性项目数
  positiveAverage: number      // 阳性症状均分
  factors: {
    somatization: { score: number; average: number; level: string }        // 躯体化
    obsessiveCompulsive: { score: number; average: number; level: string } // 强迫
    interpersonalSensitivity: { score: number; average: number; level: string } // 人际敏感
    depression: { score: number; average: number; level: string }          // 抑郁
    anxiety: { score: number; average: number; level: string }             // 焦虑
    hostility: { score: number; average: number; level: string }           // 敌对
    phobicAnxiety: { score: number; average: number; level: string }       // 恐怖
    paranoidIdeation: { score: number; average: number; level: string }    // 偏执
    psychoticism: { score: number; average: number; level: string }        // 精神病性
    additional: { score: number; average: number; level: string }          // 其他
  }
  interpretation: string
  completionRate: string
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
const getFactorLevel = (average: number): string => {
  if (average < 1.5) return '正常'
  else if (average < 2.5) return '轻度'
  else if (average < 3.5) return '中度'
  else if (average < 4.5) return '重度'
  else return '极重度'
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
  if (average < 1.5) return '正常';
  else if (average < 2.5) return '轻度';
  else if (average < 3.5) return '中度';
  else if (average < 4.5) return '重度';
  else return '极重度';
};

for (const [factor, scores] of Object.entries(factorScores)) {
  const factorScore = scores.reduce((sum, score) => sum + score, 0);
  const factorAverage = scores.length > 0 ? factorScore / scores.length : 0;
  
  factors[factor] = {
    name: factorNames[factor],
    score: factorScore,
    average: parseFloat(factorAverage.toFixed(2)),
    itemCount: scores.length,
    level: getFactorLevel(factorAverage)
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

// 返回结果
const result = {
  success: true,
  totalScore: totalScore,
  totalAverage: parseFloat(totalAverage),
  positiveCount: positiveCount,
  negativeCount: negativeCount,
  positiveAverage: parseFloat(positiveAverage),
  factors: factors,
  interpretation: interpretation,
  completionRate: Math.round((answeredCount / 90) * 100) + '%',
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
        score: factorScore,
        average: Math.round(factorAverage * 100) / 100,
        level: getFactorLevel(factorAverage)
      }
    }
    
    // 生成解释
    let interpretation = '整体评估：'
    if (totalAverage < 1.5) {
      interpretation += '心理健康状况良好'
    } else if (totalAverage < 2.0) {
      interpretation += '存在轻度心理问题'
    } else if (totalAverage < 2.5) {
      interpretation += '存在中度心理问题，建议寻求心理咨询'
    } else {
      interpretation += '存在较严重心理问题，强烈建议寻求专业心理帮助'
    }

    return {
      success: true,
      totalScore,
      totalAverage: Math.round(totalAverage * 100) / 100,
      positiveCount,
      negativeCount,
      positiveAverage: Math.round(positiveAverage * 100) / 100,
      factors,
      interpretation,
      completionRate: calculateCompletionRate(answeredCount, 90),
      timestamp: generateTimestamp(),
      scaleType: 'SCL-90症状自评量表'
    }
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