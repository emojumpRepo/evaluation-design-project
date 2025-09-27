/**
 * SDS抑郁自评量表计算模板
 */

import type { CalculateTemplate, Question, FormData, SDSResult } from '../types'
import { sortQuestionsByNumber, getOptionScore, calculateCompletionRate, generateTimestamp, reverseScoreMap4 } from '../utils'

/**
 * SDS量表反向计分题目编号
 * 这些题目描述积极情绪，需要反向计分
 */
const REVERSE_QUESTIONS = [2, 5, 6, 11, 12, 14, 16, 17, 18, 20]

/**
 * 抑郁程度评估标准
 */
const DEPRESSION_LEVELS = [
  { min: 0, max: 52, level: '正常', description: '您的情绪状态在正常范围内' },
  { min: 53, max: 62, level: '轻度抑郁', description: '可能存在轻度抑郁倾向，建议关注情绪健康' },
  { min: 63, max: 72, level: '中度抑郁', description: '可能存在中度抑郁倾向，建议寻求专业帮助' },
  { min: 73, max: 100, level: '重度抑郁', description: '可能存在重度抑郁倾向，强烈建议尽快寻求专业帮助' }
]

/**
 * SDS抑郁自评量表模板
 */
const sdsTemplate: CalculateTemplate = {
  metadata: {
    id: 'sds',
    name: 'SDS抑郁自评量表',
    description: 'Zung氏抑郁自评量表，用于评估抑郁症状的严重程度',
    version: '1.0.0',
    author: 'Zung',
    tags: ['心理健康', '抑郁', '自评量表'],
    requiredQuestions: 20
  },

  /**
   * 生成计算代码
   */
  generateCode: (questions?: Question[]): string => {
    let template = `// SDS抑郁自评量表计算代码
// 基于Zung氏抑郁自评量表评分标准

// 定义正向计分和反向计分映射
const scoreMap = {
  1: 1,  // 选项1(没有或偶尔)
  2: 2,  // 选项2(有时)
  3: 3,  // 选项3(大部分时间)
  4: 4   // 选项4(经常或持续)
};

const reverseScoreMap = {
  1: 4,  // 反向计分
  2: 3,
  3: 2,
  4: 1
};

// 定义反向计分的题目编号（基于标准SDS量表）
const reverseQuestions = [${REVERSE_QUESTIONS.join(', ')}];

// 获取所有题目并按顺序排列
const sortedQuestions = [...questions].sort((a, b) => {
  const numA = parseInt(a.field.replace(/[^0-9]/g, ""));
  const numB = parseInt(b.field.replace(/[^0-9]/g, ""));
  return numA - numB;
});

// 计算粗分
let rawScore = 0;
const itemScores = {};
let answeredCount = 0;

sortedQuestions.forEach((question, index) => {
  const answer = formData[question.field];
  const questionNumber = index + 1;
  
  if (answer && question.options) {
    // 找到选中的选项
    const selectedOption = question.options.find(opt => opt.hash === answer);
    if (selectedOption) {
      answeredCount++;
      // 获取选项的序号（1-4）
      const optionIndex = question.options.indexOf(selectedOption) + 1;
      
      // 判断是否需要反向计分
      let score;
      if (reverseQuestions.includes(questionNumber)) {
        score = reverseScoreMap[optionIndex] || 0;
        console.log(\`题目\${questionNumber}(\${question.field}): 反向计分，选项\${optionIndex} -> 分数\${score}\`);
      } else {
        score = scoreMap[optionIndex] || 0;
        console.log(\`题目\${questionNumber}(\${question.field}): 正向计分，选项\${optionIndex} -> 分数\${score}\`);
      }
      
      itemScores[question.field] = score;
      rawScore += score;
    }
  }
});

// 转换为标准分（粗分 × 1.25）
const standardScore = Math.round(rawScore * 1.25);

// 根据评分标准评估抑郁程度
let depressionLevel;
let interpretation;

if (standardScore <= 52) {
  depressionLevel = "正常";
  interpretation = "您的情绪状态在正常范围内";
} else if (standardScore >= 53 && standardScore <= 62) {
  depressionLevel = "轻度抑郁";
  interpretation = "可能存在轻度抑郁倾向，建议关注情绪健康";
} else if (standardScore >= 63 && standardScore <= 72) {
  depressionLevel = "中度抑郁";
  interpretation = "可能存在中度抑郁倾向，建议寻求专业帮助";
} else {
  depressionLevel = "重度抑郁";
  interpretation = "可能存在重度抑郁倾向，强烈建议尽快寻求专业帮助";
}

// 返回计算结果
const result = {
  success: true,
  rawScore: rawScore,           // 粗分
  standardScore: standardScore, // 标准分
  depressionLevel: depressionLevel, // 抑郁程度
  interpretation: interpretation,   // 结果解释
  itemScores: itemScores,       // 各题得分
  completionRate: Math.round((answeredCount / 20) * 100) + "%", // 完成率
  timestamp: new Date().toISOString(),
  scaleType: "SDS抑郁自评量表"
};

console.log("计算结果:", result);
return result;`

    return template
  },

  /**
   * 直接计算函数（可选，用于服务端计算）
   */
  calculate: (formData: FormData, questions: Question[]): SDSResult => {
    // 排序题目
    const sortedQuestions = sortQuestionsByNumber(questions)
    
    // 计算粗分
    let rawScore = 0
    const itemScores: { [key: string]: number } = {}
    let answeredCount = 0

    sortedQuestions.forEach((question, index) => {
      const answer = formData[question.field]
      const questionNumber = index + 1
      
      if (answer && question.options) {
        const isReverse = REVERSE_QUESTIONS.includes(questionNumber)
        const score = getOptionScore(question, answer, isReverse, isReverse ? reverseScoreMap4 : undefined)
        
        if (score > 0) {
          answeredCount++
          itemScores[question.field] = score
          rawScore += score
        }
      }
    })

    // 转换为标准分
    const standardScore = Math.round(rawScore * 1.25)
    
    // 评估抑郁程度
    const levelInfo = DEPRESSION_LEVELS.find(level => 
      standardScore >= level.min && standardScore <= level.max
    ) || DEPRESSION_LEVELS[DEPRESSION_LEVELS.length - 1]

    return {
      success: true,
      rawScore,
      standardScore,
      depressionLevel: levelInfo.level,
      interpretation: levelInfo.description,
      itemScores,
      completionRate: calculateCompletionRate(answeredCount, 20),
      timestamp: generateTimestamp(),
      scaleType: 'SDS抑郁自评量表'
    }
  },

  /**
   * 验证问卷是否符合SDS量表要求
   */
  validate: (questions: Question[]): boolean => {
    // SDS量表应该有20道题
    if (questions.length !== 20) {
      console.warn(`SDS量表应该有20道题，当前有${questions.length}道题`)
      return false
    }

    // 检查每道题是否都有4个选项
    for (const question of questions) {
      if (!question.options || question.options.length !== 4) {
        console.warn(`题目${question.field}应该有4个选项`)
        return false
      }
    }

    return true
  }
}

export default sdsTemplate