/**
 * EPQ埃森克人格问卷（Eysenck Personality Questionnaire）计算模板
 */

import type { CalculateTemplate, Question, FormData } from '../types'
import { sortQuestionsByNumber, calculateCompletionRate, generateTimestamp, safeCalculate, createCalculationError, FACTOR_LEVELS_3, type FactorLevel3 } from '../utils'

/**
 * EPQ结果接口
 */
export interface EPQResult {
  success: boolean
  rawScore: number                        // 所有维度原始分总和
  standardScore: number                   // 主要维度标准分（外向性T分数）
  dimensions: {
    E: { name: string; rawScore: number; standardScore: number; level: FactorLevel3; levelArray: readonly FactorLevel3[]; description: string }
    N: { name: string; rawScore: number; standardScore: number; level: FactorLevel3; levelArray: readonly FactorLevel3[]; description: string }
    P: { name: string; rawScore: number; standardScore: number; level: FactorLevel3; levelArray: readonly FactorLevel3[]; description: string }
    L: { name: string; rawScore: number; standardScore: number; level: FactorLevel3; levelArray: readonly FactorLevel3[]; description: string }
  }
  level: FactorLevel3                    // 总体人格特征等级（基于主要维度）
  levelArray: readonly FactorLevel3[]   // 等级枚举数组
  interpretation: string                 // 结果解释
  recommendations: string[]              // 建议列表
  factors: Array<{
    name: string
    rawScore: number        // 原始分
    standardScore: number   // 标准分（T分数）
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
  }>
  metadata?: {
    totalQuestions: number
    answeredQuestions: number
    completionTime: number
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
const getDimensionLevel = (tScore: number, dimension: string): { level: FactorLevel3; description: string } => {
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

  if (tScore >= 61) return { level: FACTOR_LEVELS_3[2], description: dimDesc.high }
  if (tScore >= 40 && tScore <= 60) return { level: FACTOR_LEVELS_3[1], description: dimDesc.medium }
  return { level: FACTOR_LEVELS_3[0], description: dimDesc.low }
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
  if (tScore >= 61) return ${JSON.stringify(FACTOR_LEVELS_3[2])};
  if (tScore >= 40 && tScore <= 60) return ${JSON.stringify(FACTOR_LEVELS_3[1])};
  return ${JSON.stringify(FACTOR_LEVELS_3[0])};
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
    rawScore: score,
    standardScore: tScore,
    level: getLevel(tScore),
    levelArray: ${JSON.stringify(FACTOR_LEVELS_3)},
    description: \`\${dimensionNames[dim]}得分：\${score}，T分数：\${tScore}\`
  };
}

// 生成人格剖面
let profile = '您的人格特征：';
if (dimensions.E.level === ${JSON.stringify(FACTOR_LEVELS_3[2])}) profile += '外向、';
else if (dimensions.E.level === ${JSON.stringify(FACTOR_LEVELS_3[0])}) profile += '内向、';

if (dimensions.N.level === ${JSON.stringify(FACTOR_LEVELS_3[2])}) profile += '情绪不稳定、';
else if (dimensions.N.level === ${JSON.stringify(FACTOR_LEVELS_3[0])}) profile += '情绪稳定、';

if (dimensions.P.level === ${JSON.stringify(FACTOR_LEVELS_3[2])}) profile += '独立性强、';
else if (dimensions.P.level === ${JSON.stringify(FACTOR_LEVELS_3[0])}) profile += '合作性强、';

if (dimensions.L.tScore > 60) {
  profile += '（注意：掩饰性得分较高，结果可能受到社会期望影响）';
}

// 计算总体等级和解释
const overallLevel = dimensions.E.level; // 以外向性作为主要参考维度
let interpretation = '';
let recommendations = [];

if (overallLevel === ${JSON.stringify(FACTOR_LEVELS_3[2])}) {
  interpretation = '您表现出较为明显的外向性人格特征，善于社交，充满活力。';
  recommendations = ['发挥社交优势', '注意情绪管理', '保持工作生活平衡', '深化人际关系'];
} else if (overallLevel === ${JSON.stringify(FACTOR_LEVELS_3[1])}) {
  interpretation = '您的人格特征较为均衡，在不同情境下表现出灵活性。';
  recommendations = ['继续发挥适应性优势', '明确个人价值观', '平衡社交与独处', '发展多元兴趣'];
} else {
  interpretation = '您表现出较为内向的人格特征，喜欢独处，深思熟虑。';
  recommendations = ['培养深度思考能力', '选择适合的工作环境', '建立小而精的社交圈', '发挥专注优势'];
}

if (dimensions.L.tScore > 60) {
  interpretation += '（注意：掩饰性得分较高，结果可能受到社会期望影响）';
  recommendations.push('建议在更放松的状态下重新评估');
}

// 构建factors数组
const factors = Object.entries(dimensions).map(([key, dim]) => ({
  name: dim.name,
  rawScore: dim.rawScore,
  standardScore: dim.standardScore,
  interpretation: dim.description,
  level: dim.level,
  levelArray: ${JSON.stringify(FACTOR_LEVELS_3)}
}));

// 计算总分
const totalRawScore = Object.values(dimensions).reduce((sum, dim) => sum + dim.rawScore, 0);

// 返回结果
const result = {
  success: true,
  rawScore: totalRawScore,
  standardScore: dimensions.E.standardScore, // 以外向性T分数作为主要标准分
  dimensions: dimensions,
  level: overallLevel,
  levelArray: ${JSON.stringify(FACTOR_LEVELS_3)},
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
    totalQuestions: 88,
    answeredQuestions: answeredCount,
    completionTime: Date.now() - (formData.startTime || Date.now())
  },
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
    return safeCalculate<EPQResult>(epqTemplate.metadata, () => {
      if (!epqTemplate.validate?.(questions)) {
        return createCalculationError(epqTemplate.metadata, '问卷不符合EPQ要求') as any
      }
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
        rawScore: score,
        standardScore: tScore,
        level: levelInfo.level,
        levelArray: FACTOR_LEVELS_3,
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
    if (dimensions.E.level === FACTOR_LEVELS_3[2]) profile += '外向、'
    else if (dimensions.E.level === FACTOR_LEVELS_3[0]) profile += '内向、'

    if (dimensions.N.level === FACTOR_LEVELS_3[2]) profile += '情绪不稳定、'
    else if (dimensions.N.level === FACTOR_LEVELS_3[0]) profile += '情绪稳定、'

    if (dimensions.P.level === FACTOR_LEVELS_3[2]) profile += '独立性强、'
    else if (dimensions.P.level === FACTOR_LEVELS_3[0]) profile += '合作性强、'

    if (dimensions.L.standardScore > 60) {
      profile += '（注意：掩饰性得分较高，结果可能受到社会期望影响）'
    }

      // 生成总体解释和建议
    const overallLevel = dimensions.E.level // 以外向性作为主要参考维度
    let interpretation = ''
    let recommendations: string[] = []

    if (overallLevel === FACTOR_LEVELS_3[2]) {
      interpretation = '您表现出较为明显的外向性人格特征，善于社交，充满活力。'
      recommendations = ['发挥社交优势', '注意情绪管理', '保持工作生活平衡', '深化人际关系']
    } else if (overallLevel === FACTOR_LEVELS_3[1]) {
      interpretation = '您的人格特征较为均衡，在不同情境下表现出灵活性。'
      recommendations = ['继续发挥适应性优势', '明确个人价值观', '平衡社交与独处', '发展多元兴趣']
    } else {
      interpretation = '您表现出较为内向的人格特征，喜欢独处，深思熟虑。'
      recommendations = ['培养深度思考能力', '选择适合的工作环境', '建立小而精的社交圈', '发挥专注优势']
    }

    if (dimensions.L.standardScore > 60) {
      interpretation += '（注意：掩饰性得分较高，结果可能受到社会期望影响）'
      recommendations.push('建议在更放松的状态下重新评估')
    }

    // 构建factors数组
    const factors = Object.entries(dimensions).map(([key, dim]) => ({
      name: dim.name,
      rawScore: dim.rawScore,
      standardScore: dim.standardScore,
      interpretation: dim.description,
      level: dim.level,
      levelArray: FACTOR_LEVELS_3
    }))

    // 计算总分
    const totalRawScore = Object.values(dimensions).reduce((sum, dim) => sum + dim.rawScore, 0)

    return {
      success: true,
      rawScore: totalRawScore,
      standardScore: dimensions.E.standardScore, // 以外向性T分数作为主要标准分
      dimensions,
      level: overallLevel,
      levelArray: FACTOR_LEVELS_3,
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
        totalQuestions: 88,
        answeredQuestions: answeredCount,
        completionTime: Date.now() - (formData.startTime || Date.now())
      },
      profile,
      itemScores,
      completionRate: calculateCompletionRate(answeredCount, 88),
      timestamp: generateTimestamp(),
      scaleType: 'EPQ埃森克人格问卷（88题版）'
    }
    })
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
