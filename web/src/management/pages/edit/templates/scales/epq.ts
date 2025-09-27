/**
 * EPQ埃森克人格问卷（Eysenck Personality Questionnaire）计算模板
 */

import type { CalculateTemplate, Question, FormData } from '../types'
import { sortQuestionsByNumber, calculateCompletionRate, generateTimestamp } from '../utils'

/**
 * EPQ结果接口
 */
export interface EPQResult {
  success: boolean
  dimensions: {
    E: { name: string; score: number; tScore: number; level: string; description: string }
    N: { name: string; score: number; tScore: number; level: string; description: string }
    P: { name: string; score: number; tScore: number; level: string; description: string }
    L: { name: string; score: number; tScore: number; level: string; description: string }
  }
  profile: string
  itemScores: { [key: string]: number }
  completionRate: string
  timestamp: string
  scaleType: string
}

/**
 * EPQ-88题版本各维度题目分配
 * E: 外向性(Extraversion) - 21题
 * N: 神经质(Neuroticism) - 24题
 * P: 精神质(Psychoticism) - 20题
 * L: 掩饰性(Lie) - 23题
 */
const DIMENSION_ITEMS = {
  // 外向性题目（21题）
  E: {
    yes: [1, 5, 10, 13, 14, 17, 25, 33, 37, 41, 49, 53, 55, 61, 65, 71, 80, 84],
    no: [21, 29, 45]
  },
  // 神经质题目（24题）
  N: {
    yes: [3, 7, 12, 15, 19, 23, 27, 31, 35, 39, 43, 47, 51, 57, 59, 63, 67, 69, 73, 74, 77, 78, 82, 86],
    no: []
  },
  // 精神质题目（20题）
  P: {
    yes: [2, 6, 9, 11, 18, 22, 26, 30, 34, 38, 42, 46, 50, 56, 62, 72, 81],
    no: [28, 54, 68]
  },
  // 掩饰性题目（23题）
  L: {
    yes: [8, 16, 24, 32, 36, 40, 44, 48, 52, 58, 60, 64, 66, 70, 76, 79, 83, 87],
    no: [4, 20, 75, 85, 88]
  }
}

/**
 * T分数转换表（简化版，实际应用需要根据常模数据）
 */
const getTScore = (rawScore: number, dimension: string): number => {
  // 这里使用简化的线性转换，实际应用需要使用标准常模
  const means = { E: 12, N: 12, P: 7, L: 10 }
  const sds = { E: 4, N: 5, P: 3, L: 4 }
  
  const mean = means[dimension as keyof typeof means] || 10
  const sd = sds[dimension as keyof typeof sds] || 4
  
  return Math.round(50 + 10 * (rawScore - mean) / sd)
}

/**
 * 获取维度水平描述
 */
const getDimensionLevel = (tScore: number, dimension: string): { level: string; description: string } => {
  const descriptions = {
    E: {
      high: '外向，善于社交，喜欢刺激和冒险',
      medium: '中等外向性，社交和独处保持平衡',
      low: '内向，安静，深思熟虑，喜欢独处'
    },
    N: {
      high: '情绪不稳定，容易焦虑、紧张',
      medium: '情绪稳定性中等',
      low: '情绪稳定，冷静，不易焦虑'
    },
    P: {
      high: '独立，冷漠，可能具有攻击性',
      medium: '独立性适中',
      low: '友善，富有同情心，合作'
    },
    L: {
      high: '倾向于掩饰，或社会期望效应高',
      medium: '掩饰程度适中',
      low: '回答较为真实坦诚'
    }
  }
  
  const dimDesc = descriptions[dimension as keyof typeof descriptions]
  
  if (tScore >= 61) {
    return { level: '高', description: dimDesc.high }
  } else if (tScore >= 40 && tScore <= 60) {
    return { level: '中', description: dimDesc.medium }
  } else {
    return { level: '低', description: dimDesc.low }
  }
}

/**
 * EPQ埃森克人格问卷模板
 */
const epqTemplate: CalculateTemplate = {
  metadata: {
    id: 'epq',
    name: 'EPQ埃森克人格问卷',
    description: '88题版本，评估外向性、神经质、精神质和掩饰性四个维度',
    version: '1.0.0',
    author: 'Eysenck',
    tags: ['人格测评', 'EPQ', '艾森克'],
    requiredQuestions: 88
  },

  /**
   * 生成计算代码
   */
  generateCode: (questions?: Question[]): string => {
    return `// EPQ埃森克人格问卷计算代码（88题版本）
// 评估四个维度：外向性(E)、神经质(N)、精神质(P)、掩饰性(L)

// 各维度题目分配
const dimensionItems = ${JSON.stringify(DIMENSION_ITEMS, null, 2)};

// 获取所有题目并按顺序排列
const sortedQuestions = [...questions].sort((a, b) => {
  const numA = parseInt(a.field.replace(/[^0-9]/g, ""));
  const numB = parseInt(b.field.replace(/[^0-9]/g, ""));
  return numA - numB;
});

// 初始化各维度得分
const dimensionScores = {
  E: 0,  // 外向性
  N: 0,  // 神经质
  P: 0,  // 精神质
  L: 0   // 掩饰性
};

const itemScores = {};
let answeredCount = 0;

// 遍历题目计算各维度得分
sortedQuestions.forEach((question, index) => {
  const answer = formData[question.field];
  const questionNumber = index + 1;
  
  if (answer !== null && answer !== undefined && answer !== "") {
    answeredCount++;
    
    // 假设答案格式：是=1/true，否=0/false
    const isYes = answer === '1' || answer === 'true' || answer === '是' || 
                  (question.options && question.options[0] && answer === question.options[0].hash);
    
    // 判断题目属于哪个维度并计分
    for (const [dim, items] of Object.entries(dimensionItems)) {
      if (items.yes.includes(questionNumber)) {
        if (isYes) {
          dimensionScores[dim]++;
          itemScores[question.field] = 1;
        } else {
          itemScores[question.field] = 0;
        }
        break;
      } else if (items.no.includes(questionNumber)) {
        if (!isYes) {
          dimensionScores[dim]++;
          itemScores[question.field] = 1;
        } else {
          itemScores[question.field] = 0;
        }
        break;
      }
    }
  }
});

// T分数转换（简化版）
const getTScore = (rawScore, dimension) => {
  const means = { E: 12, N: 12, P: 7, L: 10 };
  const sds = { E: 4, N: 5, P: 3, L: 4 };
  
  const mean = means[dimension] || 10;
  const sd = sds[dimension] || 4;
  
  return Math.round(50 + 10 * (rawScore - mean) / sd);
};

// 获取维度水平
const getLevel = (tScore) => {
  if (tScore >= 61) return '高';
  if (tScore >= 40 && tScore <= 60) return '中';
  return '低';
};

// 构建结果
const dimensions = {};
const dimensionNames = {
  E: '外向性',
  N: '神经质',
  P: '精神质',
  L: '掩饰性'
};

for (const [dim, score] of Object.entries(dimensionScores)) {
  const tScore = getTScore(score, dim);
  dimensions[dim] = {
    name: dimensionNames[dim],
    score: score,
    tScore: tScore,
    level: getLevel(tScore),
    description: \`\${dimensionNames[dim]}得分：\${score}，T分数：\${tScore}\`
  };
}

// 生成人格剖面
let profile = '您的人格特征：';
if (dimensions.E.level === '高') profile += '外向、';
else if (dimensions.E.level === '低') profile += '内向、';

if (dimensions.N.level === '高') profile += '情绪不稳定、';
else if (dimensions.N.level === '低') profile += '情绪稳定、';

if (dimensions.P.level === '高') profile += '独立性强、';
else if (dimensions.P.level === '低') profile += '合作性强、';

if (dimensions.L.tScore > 60) {
  profile += '（注意：掩饰性得分较高，结果可能受到社会期望影响）';
}

// 返回结果
const result = {
  success: true,
  dimensions: dimensions,
  profile: profile,
  itemScores: itemScores,
  completionRate: Math.round((answeredCount / 88) * 100) + '%',
  timestamp: new Date().toISOString(),
  scaleType: 'EPQ埃森克人格问卷（88题版）'
};

console.log('EPQ计算结果:', result);
return result;`
  },

  /**
   * 直接计算函数
   */
  calculate: (formData: FormData, questions: Question[]): EPQResult => {
    const sortedQuestions = sortQuestionsByNumber(questions)
    
    // 初始化各维度得分
    const dimensionScores = { E: 0, N: 0, P: 0, L: 0 }
    const itemScores: { [key: string]: number } = {}
    let answeredCount = 0

    // 遍历题目计算各维度得分
    sortedQuestions.forEach((question, index) => {
      const answer = formData[question.field]
      const questionNumber = index + 1
      
      if (answer !== null && answer !== undefined && answer !== '') {
        answeredCount++
        
        // 判断是否选择"是"
        const isYes = answer === '1' || answer === 'true' || answer === '是' || 
                     (question.options && question.options[0] && answer === question.options[0].hash)
        
        // 判断题目属于哪个维度并计分
        for (const [dim, items] of Object.entries(DIMENSION_ITEMS)) {
          const dimItems = items as { yes: number[], no: number[] }
          if (dimItems.yes.includes(questionNumber)) {
            if (isYes) {
              dimensionScores[dim as keyof typeof dimensionScores]++
              itemScores[question.field] = 1
            } else {
              itemScores[question.field] = 0
            }
            break
          } else if (dimItems.no.includes(questionNumber)) {
            if (!isYes) {
              dimensionScores[dim as keyof typeof dimensionScores]++
              itemScores[question.field] = 1
            } else {
              itemScores[question.field] = 0
            }
            break
          }
        }
      }
    })

    // 构建维度结果
    const createDimension = (dim: string, score: number, name: string) => {
      const tScore = getTScore(score, dim)
      const levelInfo = getDimensionLevel(tScore, dim)
      return {
        name,
        score,
        tScore,
        level: levelInfo.level,
        description: levelInfo.description
      }
    }

    const dimensions = {
      E: createDimension('E', dimensionScores.E, '外向性'),
      N: createDimension('N', dimensionScores.N, '神经质'),
      P: createDimension('P', dimensionScores.P, '精神质'),
      L: createDimension('L', dimensionScores.L, '掩饰性')
    }

    // 生成人格剖面
    let profile = '您的人格特征：'
    if (dimensions.E.level === '高') profile += '外向、'
    else if (dimensions.E.level === '低') profile += '内向、'
    
    if (dimensions.N.level === '高') profile += '情绪不稳定、'
    else if (dimensions.N.level === '低') profile += '情绪稳定、'
    
    if (dimensions.P.level === '高') profile += '独立性强、'
    else if (dimensions.P.level === '低') profile += '合作性强、'
    
    if (dimensions.L.tScore > 60) {
      profile += '（注意：掩饰性得分较高，结果可能受到社会期望影响）'
    }

    return {
      success: true,
      dimensions,
      profile,
      itemScores,
      completionRate: calculateCompletionRate(answeredCount, 88),
      timestamp: generateTimestamp(),
      scaleType: 'EPQ埃森克人格问卷（88题版）'
    }
  },

  /**
   * 验证问卷是否符合EPQ要求
   */
  validate: (questions: Question[]): boolean => {
    if (questions.length !== 88) {
      console.warn(`EPQ-88应该有88道题，当前有${questions.length}道题`)
      return false
    }

    for (const question of questions) {
      if (!question.options || question.options.length < 2) {
        console.warn(`题目${question.field}应该有是/否两个选项`)
        return false
      }
    }

    return true
  }
}

export default epqTemplate