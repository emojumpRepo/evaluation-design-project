/**
 * SAS焦虑自评量表（Self-Rating Anxiety Scale）计算模板
 */

import type { CalculateTemplate, Question, FormData } from '../types'
import { sortQuestionsByNumber, getOptionScore, calculateCompletionRate, generateTimestamp, reverseScoreMap4 } from '../utils'

/**
 * SAS结果接口
 */
export interface SASResult {
  success: boolean
  rawScore: number
  standardScore: number
  anxietyLevel: string
  interpretation: string
  itemScores: { [key: string]: number }
  completionRate: string
  timestamp: string
  scaleType: string
}

/**
 * SAS量表反向计分题目编号
 * 这些题目描述积极情绪，需要反向计分
 */
const REVERSE_QUESTIONS = [5, 9, 13, 17, 19]

/**
 * 焦虑程度评估标准
 */
const ANXIETY_LEVELS = [
  { min: 0, max: 49, level: '正常', description: '无明显焦虑症状' },
  { min: 50, max: 59, level: '轻度焦虑', description: '可能存在轻度焦虑，建议适当放松调节' },
  { min: 60, max: 69, level: '中度焦虑', description: '存在中度焦虑，建议寻求专业帮助' },
  { min: 70, max: 100, level: '重度焦虑', description: '存在重度焦虑，强烈建议立即寻求专业帮助' }
]

/**
 * SAS焦虑自评量表模板
 */
const sasTemplate: CalculateTemplate = {
  metadata: {
    id: 'sas',
    name: 'SAS焦虑自评量表',
    description: 'Zung氏焦虑自评量表，用于评估焦虑症状的严重程度',
    version: '1.0.0',
    author: 'Zung',
    tags: ['心理健康', '焦虑', '自评量表'],
    requiredQuestions: 20
  },

  /**
   * 生成计算代码
   */
  generateCode: (questions?: Question[]): string => {
    return `// SAS焦虑自评量表计算代码
// 基于Zung氏焦虑自评量表评分标准

// 定义正向计分和反向计分映射（4点量表）
const scoreMap = {
  1: 1,  // 没有或很少时间
  2: 2,  // 小部分时间
  3: 3,  // 相当多时间
  4: 4   // 绝大部分或全部时间
};

const reverseScoreMap = {
  1: 4,  // 反向计分
  2: 3,
  3: 2,
  4: 1
};

// 定义反向计分的题目编号
// 第5、9、13、17、19题为反向计分题
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

// 根据评分标准评估焦虑程度
let anxietyLevel;
let interpretation;

if (standardScore < 50) {
  anxietyLevel = "正常";
  interpretation = "无明显焦虑症状";
} else if (standardScore >= 50 && standardScore <= 59) {
  anxietyLevel = "轻度焦虑";
  interpretation = "可能存在轻度焦虑，建议适当放松调节";
} else if (standardScore >= 60 && standardScore <= 69) {
  anxietyLevel = "中度焦虑";
  interpretation = "存在中度焦虑，建议寻求专业帮助";
} else {
  anxietyLevel = "重度焦虑";
  interpretation = "存在重度焦虑，强烈建议立即寻求专业帮助";
}

// 返回计算结果
const result = {
  success: true,
  rawScore: rawScore,           // 粗分
  standardScore: standardScore, // 标准分
  anxietyLevel: anxietyLevel,   // 焦虑程度
  interpretation: interpretation, // 结果解释
  itemScores: itemScores,       // 各题得分
  completionRate: Math.round((answeredCount / 20) * 100) + "%", // 完成率
  timestamp: new Date().toISOString(),
  scaleType: "SAS焦虑自评量表"
};

console.log("SAS计算结果:", result);
return result;`
  },

  /**
   * 直接计算函数（可选，用于服务端计算）
   */
  calculate: (formData: FormData, questions: Question[]): SASResult => {
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
    
    // 评估焦虑程度
    const levelInfo = ANXIETY_LEVELS.find(level => 
      standardScore >= level.min && standardScore <= level.max
    ) || ANXIETY_LEVELS[ANXIETY_LEVELS.length - 1]

    return {
      success: true,
      rawScore,
      standardScore,
      anxietyLevel: levelInfo.level,
      interpretation: levelInfo.description,
      itemScores,
      completionRate: calculateCompletionRate(answeredCount, 20),
      timestamp: generateTimestamp(),
      scaleType: 'SAS焦虑自评量表'
    }
  },

  /**
   * 验证问卷是否符合SAS量表要求
   */
  validate: (questions: Question[]): boolean => {
    // SAS量表应该有20道题
    if (questions.length !== 20) {
      console.warn(`SAS量表应该有20道题，当前有${questions.length}道题`)
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

export default sasTemplate