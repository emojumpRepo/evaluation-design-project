/**
 * 大五人格量表（NEO-FFI-60）计算模板
 */

import type { CalculateTemplate, Question, FormData, BigFiveResult, BigFiveDimension } from '../types'
import { sortQuestionsByNumber, getOptionScore, calculateCompletionRate, generateTimestamp, reverseScoreMap5, avg } from '../utils'

/**
 * 大五人格各维度题目分配（60题版本）
 * N: 神经质 (Neuroticism)
 * E: 外向性 (Extraversion)  
 * O: 开放性 (Openness)
 * A: 宜人性 (Agreeableness)
 * C: 尽责性 (Conscientiousness)
 */
const DIMENSION_ITEMS = {
  N: [1, 6, 11, 16, 21, 26, 31, 36, 41, 46, 51, 56],  // 神经质
  E: [2, 7, 12, 17, 22, 27, 32, 37, 42, 47, 52, 57],  // 外向性
  O: [3, 8, 13, 18, 23, 28, 33, 38, 43, 48, 53, 58],  // 开放性
  A: [4, 9, 14, 19, 24, 29, 34, 39, 44, 49, 54, 59],  // 宜人性
  C: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]  // 尽责性
}

/**
 * 反向计分题目
 * 这些题目需要反向计分（5分制：1->5, 2->4, 3->3, 4->2, 5->1）
 */
const REVERSE_ITEMS = {
  N: [1, 11, 16, 31, 46],                    // 神经质反向题目
  E: [12, 27, 42, 57],                       // 外向性反向题目  
  O: [8, 18, 23, 38, 43, 48],               // 开放性反向题目
  A: [9, 14, 24, 29, 39, 44, 54, 59],       // 宜人性反向题目
  C: [15, 30, 45, 55]                        // 尽责性反向题目
}

/**
 * 维度名称映射
 */
const DIMENSION_NAMES = {
  N: { name: '神经质', nameEn: 'Neuroticism' },
  E: { name: '外向性', nameEn: 'Extraversion' },
  O: { name: '开放性', nameEn: 'Openness' },
  A: { name: '宜人性', nameEn: 'Agreeableness' },
  C: { name: '尽责性', nameEn: 'Conscientiousness' }
}

/**
 * 维度得分解释
 */
const DIMENSION_INTERPRETATIONS = {
  N: {
    high: '情绪不稳定，容易焦虑、紧张、易怒，对压力敏感',
    medium: '情绪稳定性适中，能够应对一般的压力和挑战',
    low: '情绪稳定，冷静，能够很好地应对压力'
  },
  E: {
    high: '外向，善于社交，充满活力，喜欢与人交往',
    medium: '外向性适中，在社交和独处之间保持平衡',
    low: '内向，喜欢独处，谨慎，深思熟虑'
  },
  O: {
    high: '思想开放，富有创造力，好奇心强，喜欢新鲜事物',
    medium: '开放性适中，对新事物有一定接受度',
    low: '保守，务实，喜欢熟悉的事物和传统方式'
  },
  A: {
    high: '友善，富有同情心，乐于助人，信任他人',
    medium: '宜人性适中，能够平衡自己和他人的需求',
    low: '竞争性强，怀疑，以自我为中心'
  },
  C: {
    high: '有条理，可靠，自律，追求成就',
    medium: '尽责性适中，能够完成任务但不过分追求完美',
    low: '灵活，随性，不拘小节，适应性强'
  }
}

/**
 * 根据T分数获取等级和解释
 */
const getLevel = (tScore: number, dimension: string): { level: string; description: string } => {
  const interpretations = DIMENSION_INTERPRETATIONS[dimension as keyof typeof DIMENSION_INTERPRETATIONS]
  
  if (tScore >= 56) {
    return { level: '高', description: interpretations.high }
  } else if (tScore >= 45 && tScore <= 55) {
    return { level: '中', description: interpretations.medium }
  } else {
    return { level: '低', description: interpretations.low }
  }
}

/**
 * 计算T分数（标准分）
 * 使用标准化公式：T = 50 + 10 * (X - M) / SD
 * 这里使用简化的常模数据
 */
const calculateTScore = (rawScore: number, mean: number = 36, sd: number = 7): number => {
  return Math.round(50 + 10 * (rawScore - mean) / sd)
}

/**
 * 生成人格剖面描述
 */
const generateProfile = (dimensions: any): string => {
  const profiles = []
  
  // 找出最突出的维度
  const dimensionScores = [
    { dim: 'N', score: dimensions.neuroticism.score, name: '神经质' },
    { dim: 'E', score: dimensions.extraversion.score, name: '外向性' },
    { dim: 'O', score: dimensions.openness.score, name: '开放性' },
    { dim: 'A', score: dimensions.agreeableness.score, name: '宜人性' },
    { dim: 'C', score: dimensions.conscientiousness.score, name: '尽责性' }
  ]
  
  const sorted = dimensionScores.sort((a, b) => b.score - a.score)
  const highest = sorted[0]
  const lowest = sorted[sorted.length - 1]
  
  if (highest.score >= 56) {
    profiles.push(`您在${highest.name}维度上得分较高`)
  }
  if (lowest.score <= 44) {
    profiles.push(`您在${lowest.name}维度上得分较低`)
  }
  
  return profiles.length > 0 ? profiles.join('，') + '。' : '您的人格特质较为均衡。'
}

/**
 * 大五人格量表模板
 */
const bigFiveTemplate: CalculateTemplate = {
  metadata: {
    id: 'bigfive',
    name: '大五人格量表',
    description: 'NEO-FFI-60大五人格量表，评估神经质、外向性、开放性、宜人性和尽责性五个维度',
    version: '1.0.0',
    author: 'Costa & McCrae',
    tags: ['人格测评', '大五人格', 'NEO-FFI'],
    requiredQuestions: 60
  },

  /**
   * 生成计算代码
   */
  generateCode: (questions?: Question[]): string => {
    return `// 大五人格量表（NEO-FFI-60）计算代码
// 评估五个人格维度：神经质、外向性、开放性、宜人性、尽责性

// 各维度题目分配
const dimensionItems = ${JSON.stringify(DIMENSION_ITEMS, null, 2)};

// 反向计分题目
const reverseItems = ${JSON.stringify(REVERSE_ITEMS, null, 2)};

// 正向和反向计分映射（5分制）
const scoreMap = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 };
const reverseScoreMap = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };

// 排序题目
const sortedQuestions = [...questions].sort((a, b) => {
  const numA = parseInt(a.field.replace(/[^0-9]/g, ""));
  const numB = parseInt(b.field.replace(/[^0-9]/g, ""));
  return numA - numB;
});

// 初始化各维度分数
const dimensionScores = {
  N: [], // 神经质
  E: [], // 外向性
  O: [], // 开放性
  A: [], // 宜人性
  C: []  // 尽责性
};

const itemScores = {};
let answeredCount = 0;

// 计算每道题的得分
sortedQuestions.forEach((question, index) => {
  const answer = formData[question.field];
  const questionNumber = index + 1;
  
  if (answer && question.options) {
    answeredCount++;
    const selectedOption = question.options.find(opt => opt.hash === answer);
    
    if (selectedOption) {
      const optionIndex = question.options.indexOf(selectedOption) + 1;
      
      // 判断属于哪个维度
      let dimension = null;
      for (const [dim, items] of Object.entries(dimensionItems)) {
        if (items.includes(questionNumber)) {
          dimension = dim;
          break;
        }
      }
      
      if (dimension) {
        // 判断是否需要反向计分
        const isReverse = reverseItems[dimension].includes(questionNumber);
        const score = isReverse ? reverseScoreMap[optionIndex] : scoreMap[optionIndex];
        
        itemScores[question.field] = score;
        dimensionScores[dimension].push(score);
        
        console.log(\`题目\${questionNumber}(\${question.field}) - 维度:\${dimension}, 得分:\${score}\${isReverse ? '(反向)' : ''}\`);
      }
    }
  }
});

// 计算各维度的原始分和T分数
const calculateTScore = (rawScore, mean = 36, sd = 7) => {
  return Math.round(50 + 10 * (rawScore - mean) / sd);
};

const getLevel = (tScore) => {
  if (tScore >= 56) return { level: '高', description: '该维度特征明显' };
  if (tScore >= 45 && tScore <= 55) return { level: '中', description: '该维度特征适中' };
  return { level: '低', description: '该维度特征不明显' };
};

// 计算各维度结果
const dimensions = {};
const dimensionInfo = {
  N: { name: '神经质', nameEn: 'Neuroticism' },
  E: { name: '外向性', nameEn: 'Extraversion' },
  O: { name: '开放性', nameEn: 'Openness' },
  A: { name: '宜人性', nameEn: 'Agreeableness' },
  C: { name: '尽责性', nameEn: 'Conscientiousness' }
};

for (const [dim, scores] of Object.entries(dimensionScores)) {
  const rawScore = scores.reduce((sum, score) => sum + score, 0);
  const avgScore = scores.length > 0 ? rawScore / scores.length : 0;
  const tScore = calculateTScore(rawScore);
  const levelInfo = getLevel(tScore);
  
  const dimKey = dim === 'N' ? 'neuroticism' :
                dim === 'E' ? 'extraversion' :
                dim === 'O' ? 'openness' :
                dim === 'A' ? 'agreeableness' :
                'conscientiousness';
  
  dimensions[dimKey] = {
    name: dimensionInfo[dim].name,
    nameEn: dimensionInfo[dim].nameEn,
    score: tScore,
    rawScore: rawScore,
    avgScore: avgScore.toFixed(2),
    level: levelInfo.level,
    description: levelInfo.description,
    itemCount: scores.length
  };
}

// 生成人格剖面
let profile = '您的人格特质：';
const highDimensions = [];
const lowDimensions = [];

Object.entries(dimensions).forEach(([key, dim]) => {
  if (dim.score >= 56) {
    highDimensions.push(dim.name);
  } else if (dim.score <= 44) {
    lowDimensions.push(dim.name);
  }
});

if (highDimensions.length > 0) {
  profile += \`在\${highDimensions.join('、')}方面表现突出；\`;
}
if (lowDimensions.length > 0) {
  profile += \`在\${lowDimensions.join('、')}方面相对较低。\`;
}
if (highDimensions.length === 0 && lowDimensions.length === 0) {
  profile += '各维度较为均衡。';
}

// 返回结果
const result = {
  success: true,
  dimensions: dimensions,
  itemScores: itemScores,
  completionRate: Math.round((answeredCount / 60) * 100) + '%',
  profile: profile,
  timestamp: new Date().toISOString(),
  scaleType: '大五人格量表（NEO-FFI-60）'
};

console.log('大五人格计算结果:', result);
return result;`
  },

  /**
   * 直接计算函数
   */
  calculate: (formData: FormData, questions: Question[]): BigFiveResult => {
    const sortedQuestions = sortQuestionsByNumber(questions)
    
    // 初始化各维度分数
    const dimensionScores: { [key: string]: number[] } = {
      N: [],
      E: [],
      O: [],
      A: [],
      C: []
    }
    
    const itemScores: { [key: string]: number } = {}
    let answeredCount = 0

    // 计算每道题的得分
    sortedQuestions.forEach((question, index) => {
      const answer = formData[question.field]
      const questionNumber = index + 1
      
      if (answer && question.options) {
        answeredCount++
        
        // 判断属于哪个维度
        let dimension: string | null = null
        for (const [dim, items] of Object.entries(DIMENSION_ITEMS)) {
          if (items.includes(questionNumber)) {
            dimension = dim
            break
          }
        }
        
        if (dimension) {
          const reverseItemsForDim = REVERSE_ITEMS[dimension as keyof typeof REVERSE_ITEMS]
          const isReverse = reverseItemsForDim.includes(questionNumber)
          const score = getOptionScore(question, answer, isReverse, isReverse ? reverseScoreMap5 : undefined)
          
          if (score > 0) {
            itemScores[question.field] = score
            dimensionScores[dimension].push(score)
          }
        }
      }
    })

    // 计算各维度结果
    const createDimension = (
      dimKey: string,
      scores: number[]
    ): BigFiveDimension => {
      const rawScore = scores.reduce((sum, score) => sum + score, 0)
      const tScore = calculateTScore(rawScore)
      const levelInfo = getLevel(tScore, dimKey)
      const dimInfo = DIMENSION_NAMES[dimKey as keyof typeof DIMENSION_NAMES]
      
      return {
        name: dimInfo.name,
        nameEn: dimInfo.nameEn,
        score: tScore,
        level: levelInfo.level,
        description: levelInfo.description,
        percentile: Math.round((tScore - 20) * 1.5) // 简化的百分位数计算
      }
    }

    const dimensions = {
      neuroticism: createDimension('N', dimensionScores.N),
      extraversion: createDimension('E', dimensionScores.E),
      openness: createDimension('O', dimensionScores.O),
      agreeableness: createDimension('A', dimensionScores.A),
      conscientiousness: createDimension('C', dimensionScores.C)
    }

    return {
      success: true,
      dimensions,
      itemScores,
      completionRate: calculateCompletionRate(answeredCount, 60),
      profile: generateProfile(dimensions),
      timestamp: generateTimestamp(),
      scaleType: '大五人格量表（NEO-FFI-60）'
    }
  },

  /**
   * 验证问卷是否符合大五人格量表要求
   */
  validate: (questions: Question[]): boolean => {
    if (questions.length !== 60) {
      console.warn(`大五人格量表应该有60道题，当前有${questions.length}道题`)
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

export default bigFiveTemplate