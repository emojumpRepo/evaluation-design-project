/**
 * PHQ-9抑郁症患者健康问卷（Patient Health Questionnaire-9）计算模板
 */

import type { CalculateTemplate, Question, FormData } from '../types'
import { sortQuestionsByNumber, calculateCompletionRate, generateTimestamp } from '../utils'

/**
 * PHQ-9结果接口
 */
export interface PHQ9Result {
  success: boolean
  totalScore: number
  depressionLevel: string
  interpretation: string
  recommendation: string
  itemScores: { [key: string]: number }
  functionalImpact: string
  completionRate: string
  timestamp: string
  scaleType: string
}

/**
 * 抑郁程度评估标准
 */
const DEPRESSION_LEVELS = [
  { 
    min: 0, 
    max: 4, 
    level: '无抑郁', 
    interpretation: '无明显抑郁症状',
    recommendation: '继续保持良好的心理健康状态'
  },
  { 
    min: 5, 
    max: 9, 
    level: '轻微抑郁', 
    interpretation: '存在轻微抑郁症状',
    recommendation: '建议进行自我调节，必要时寻求心理咨询'
  },
  { 
    min: 10, 
    max: 14, 
    level: '中度抑郁', 
    interpretation: '存在中度抑郁症状',
    recommendation: '建议寻求专业心理咨询或治疗'
  },
  { 
    min: 15, 
    max: 19, 
    level: '中重度抑郁', 
    interpretation: '存在中重度抑郁症状',
    recommendation: '强烈建议立即寻求专业心理治疗'
  },
  { 
    min: 20, 
    max: 27, 
    level: '重度抑郁', 
    interpretation: '存在重度抑郁症状',
    recommendation: '必须立即寻求专业精神科医生的帮助和治疗'
  }
]

/**
 * PHQ-9抑郁症患者健康问卷模板
 */
const phq9Template: CalculateTemplate = {
  metadata: {
    id: 'phq9',
    name: 'PHQ-9抑郁症患者健康问卷',
    description: '9题版本，快速评估抑郁症状严重程度',
    version: '1.0.0',
    author: 'Kroenke et al.',
    tags: ['心理健康', '抑郁', '快速筛查', 'PHQ-9'],
    requiredQuestions: 10  // 9个症状题 + 1个功能影响题
  },

  /**
   * 生成计算代码
   */
  generateCode: (questions?: Question[]): string => {
    return `// PHQ-9抑郁症患者健康问卷计算代码
// 评估过去两周内的抑郁症状频率

// 评分标准（0-3分）
const scoreMap = {
  0: 0,  // 完全没有
  1: 1,  // 有几天
  2: 2,  // 一半以上的天数
  3: 3   // 几乎每天
};

// 获取所有题目
const sortedQuestions = [...questions].sort((a, b) => {
  const numA = parseInt(a.field.replace(/[^0-9]/g, ""));
  const numB = parseInt(b.field.replace(/[^0-9]/g, ""));
  return numA - numB;
});

// 计算总分（前9题）
let totalScore = 0;
const itemScores = {};
let answeredCount = 0;
let functionalImpact = '';

sortedQuestions.forEach((question, index) => {
  const answer = formData[question.field];
  const questionNumber = index + 1;
  
  if (answer !== null && answer !== undefined && answer !== "") {
    answeredCount++;
    
    if (questionNumber <= 9) {
      // 前9题计算总分
      let score = 0;
      
      // 根据选项获取分数
      if (question.options && question.options.length >= 4) {
        const selectedOption = question.options.find(opt => opt.hash === answer);
        if (selectedOption) {
          const optionIndex = question.options.indexOf(selectedOption);
          score = scoreMap[optionIndex] || 0;
        }
      } else {
        // 如果直接是数字答案
        score = parseInt(answer) || 0;
      }
      
      itemScores[question.field] = score;
      totalScore += score;
      
      console.log(\`题目\${questionNumber}: 得分\${score}\`);
    } else if (questionNumber === 10) {
      // 第10题是功能影响评估（不计入总分）
      if (question.options) {
        const selectedOption = question.options.find(opt => opt.hash === answer);
        if (selectedOption) {
          functionalImpact = selectedOption.text || '未评估';
        }
      } else {
        functionalImpact = answer;
      }
    }
  }
});

// 根据总分评估抑郁程度
let depressionLevel;
let interpretation;
let recommendation;

if (totalScore <= 4) {
  depressionLevel = "无抑郁";
  interpretation = "无明显抑郁症状";
  recommendation = "继续保持良好的心理健康状态";
} else if (totalScore >= 5 && totalScore <= 9) {
  depressionLevel = "轻微抑郁";
  interpretation = "存在轻微抑郁症状";
  recommendation = "建议进行自我调节，必要时寻求心理咨询";
} else if (totalScore >= 10 && totalScore <= 14) {
  depressionLevel = "中度抑郁";
  interpretation = "存在中度抑郁症状";
  recommendation = "建议寻求专业心理咨询或治疗";
} else if (totalScore >= 15 && totalScore <= 19) {
  depressionLevel = "中重度抑郁";
  interpretation = "存在中重度抑郁症状";
  recommendation = "强烈建议立即寻求专业心理治疗";
} else {
  depressionLevel = "重度抑郁";
  interpretation = "存在重度抑郁症状";
  recommendation = "必须立即寻求专业精神科医生的帮助和治疗";
}

// 自杀风险评估（第9题）
const suicidalIdeation = itemScores[sortedQuestions[8]?.field];
if (suicidalIdeation >= 1) {
  recommendation += "\\n⚠️ 警告：存在自杀意念，请立即寻求紧急心理援助！";
}

// 返回结果
const result = {
  success: true,
  totalScore: totalScore,
  depressionLevel: depressionLevel,
  interpretation: interpretation,
  recommendation: recommendation,
  itemScores: itemScores,
  functionalImpact: functionalImpact || '未评估',
  completionRate: Math.round((answeredCount / 10) * 100) + '%',
  timestamp: new Date().toISOString(),
  scaleType: 'PHQ-9抑郁症患者健康问卷'
};

console.log('PHQ-9计算结果:', result);
return result;`
  },

  /**
   * 直接计算函数
   */
  calculate: (formData: FormData, questions: Question[]): PHQ9Result => {
    const sortedQuestions = sortQuestionsByNumber(questions)
    
    let totalScore = 0
    const itemScores: { [key: string]: number } = {}
    let answeredCount = 0
    let functionalImpact = ''

    sortedQuestions.forEach((question, index) => {
      const answer = formData[question.field]
      const questionNumber = index + 1
      
      if (answer !== null && answer !== undefined && answer !== '') {
        answeredCount++
        
        if (questionNumber <= 9) {
          // 前9题计算总分
          let score = 0
          
          if (question.options && question.options.length >= 4) {
            const selectedOption = question.options.find(opt => opt.hash === answer)
            if (selectedOption) {
              const optionIndex = question.options.indexOf(selectedOption)
              score = optionIndex // 0-3分对应选项索引
            }
          } else {
            score = parseInt(answer as string) || 0
          }
          
          itemScores[question.field] = score
          totalScore += score
        } else if (questionNumber === 10) {
          // 第10题是功能影响评估
          if (question.options) {
            const selectedOption = question.options.find(opt => opt.hash === answer)
            if (selectedOption) {
              functionalImpact = selectedOption.text || '未评估'
            }
          } else {
            functionalImpact = answer as string
          }
        }
      }
    })

    // 评估抑郁程度
    const levelInfo = DEPRESSION_LEVELS.find(level => 
      totalScore >= level.min && totalScore <= level.max
    ) || DEPRESSION_LEVELS[DEPRESSION_LEVELS.length - 1]

    let recommendation = levelInfo.recommendation

    // 自杀风险评估（第9题）
    const suicidalIdeation = itemScores[sortedQuestions[8]?.field]
    if (suicidalIdeation >= 1) {
      recommendation += '\n⚠️ 警告：存在自杀意念，请立即寻求紧急心理援助！'
    }

    return {
      success: true,
      totalScore,
      depressionLevel: levelInfo.level,
      interpretation: levelInfo.interpretation,
      recommendation,
      itemScores,
      functionalImpact: functionalImpact || '未评估',
      completionRate: calculateCompletionRate(answeredCount, 10),
      timestamp: generateTimestamp(),
      scaleType: 'PHQ-9抑郁症患者健康问卷'
    }
  },

  /**
   * 验证问卷是否符合PHQ-9要求
   */
  validate: (questions: Question[]): boolean => {
    if (questions.length !== 10 && questions.length !== 9) {
      console.warn(`PHQ-9应该有9或10道题（含功能影响题），当前有${questions.length}道题`)
      return false
    }

    // 前9题应该有4个选项（0-3分）
    for (let i = 0; i < Math.min(9, questions.length); i++) {
      const question = questions[i]
      if (!question.options || question.options.length !== 4) {
        console.warn(`PHQ-9第${i + 1}题应该有4个选项`)
        return false
      }
    }

    return true
  }
}

export default phq9Template