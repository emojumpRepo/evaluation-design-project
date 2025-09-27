/**
 * DISC行为风格测评（DISC Assessment）计算模板
 */

import type { CalculateTemplate, Question, FormData } from '../types'
import { calculateCompletionRate, generateTimestamp, max } from '../utils'

/**
 * DISC结果接口
 */
export interface DISCResult {
  success: boolean
  dimensions: {
    D: { score: number; percentage: number; level: string; traits: string[] }  // 支配型
    I: { score: number; percentage: number; level: string; traits: string[] }  // 影响型
    S: { score: number; percentage: number; level: string; traits: string[] }  // 稳健型
    C: { score: number; percentage: number; level: string; traits: string[] }  // 谨慎型
  }
  primaryStyle: string        // 主要风格
  secondaryStyle: string      // 次要风格
  profile: string            // 行为风格剖面
  strengths: string[]        // 优势
  challenges: string[]       // 挑战
  recommendations: string    // 发展建议
  completionRate: string
  timestamp: string
  scaleType: string
}

/**
 * DISC各维度特征描述
 */
const DISC_TRAITS = {
  D: {
    high: {
      traits: ['果断', '目标导向', '竞争性强', '直接', '独立'],
      strengths: ['决策迅速', '结果导向', '接受挑战', '领导力强'],
      challenges: ['可能过于强势', '缺乏耐心', '忽视细节', '不善倾听']
    },
    low: {
      traits: ['谨慎', '协作', '深思熟虑', '谦逊'],
      strengths: ['善于合作', '考虑周全', '尊重他人'],
      challenges: ['决策缓慢', '避免冲突', '缺乏主动性']
    }
  },
  I: {
    high: {
      traits: ['外向', '乐观', '热情', '善于社交', '有说服力'],
      strengths: ['人际关系好', '激励他人', '创造积极氛围', '沟通能力强'],
      challenges: ['可能过于乐观', '缺乏条理', '注意力分散', '情绪化']
    },
    low: {
      traits: ['内向', '严肃', '注重事实', '客观'],
      strengths: ['专注任务', '理性分析', '独立工作'],
      challenges: ['社交困难', '缺乏热情', '过于严肃']
    }
  },
  S: {
    high: {
      traits: ['耐心', '可靠', '支持性', '稳定', '忠诚'],
      strengths: ['团队合作', '倾听能力', '持续性强', '值得信赖'],
      challenges: ['抗拒变化', '优柔寡断', '避免对抗', '过度迁就']
    },
    low: {
      traits: ['多变', '急躁', '寻求变化', '灵活'],
      strengths: ['适应性强', '行动迅速', '多任务处理'],
      challenges: ['缺乏耐心', '不够稳定', '难以坚持']
    }
  },
  C: {
    high: {
      traits: ['精确', '分析性', '系统化', '谨慎', '完美主义'],
      strengths: ['注重细节', '质量导向', '逻辑思维', '规划能力'],
      challenges: ['过度分析', '完美主义', '决策缓慢', '过于批判']
    },
    low: {
      traits: ['灵活', '独立', '不拘小节', '创新'],
      strengths: ['适应性强', '创新思维', '快速行动'],
      challenges: ['忽视细节', '缺乏条理', '质量风险']
    }
  }
}

/**
 * 根据得分判断水平
 */
const getLevel = (percentage: number): string => {
  if (percentage >= 40) return '非常高'
  else if (percentage >= 30) return '高'
  else if (percentage >= 20) return '中'
  else if (percentage >= 10) return '低'
  else return '非常低'
}

/**
 * DISC行为风格测评模板
 */
const discTemplate: CalculateTemplate = {
  metadata: {
    id: 'disc',
    name: 'DISC行为风格测评',
    description: '评估支配型、影响型、稳健型、谨慎型四种行为风格',
    version: '1.0.0',
    author: 'William Marston',
    tags: ['行为风格', '人格测评', 'DISC'],
    requiredQuestions: 24  // 标准版本24题
  },

  /**
   * 生成计算代码
   */
  generateCode: (questions?: Question[]): string => {
    return `// DISC行为风格测评计算代码
// 评估D(支配型)、I(影响型)、S(稳健型)、C(谨慎型)四种行为风格

// 获取所有题目
const sortedQuestions = [...questions].sort((a, b) => {
  const numA = parseInt(a.field.replace(/[^0-9]/g, ""));
  const numB = parseInt(b.field.replace(/[^0-9]/g, ""));
  return numA - numB;
});

// 初始化DISC四个维度得分
const dimensions = {
  D: 0,  // Dominance 支配型
  I: 0,  // Influence 影响型
  S: 0,  // Steadiness 稳健型
  C: 0   // Conscientiousness 谨慎型
};

let answeredCount = 0;
const responses = [];

// 处理每组题目（通常DISC是每组4个词/句子，选择最符合和最不符合的）
// 这里简化处理：假设每题都是选择最符合自己的选项
sortedQuestions.forEach((question, index) => {
  const answer = formData[question.field];
  
  if (answer !== null && answer !== undefined && answer !== "") {
    answeredCount++;
    
    // 根据选项确定对应的DISC维度
    if (question.options && question.options.length >= 4) {
      const selectedOption = question.options.find(opt => opt.hash === answer);
      if (selectedOption) {
        const optionIndex = question.options.indexOf(selectedOption);
        
        // 简化的维度分配规则（实际DISC有更复杂的计分规则）
        // 假设每组4个选项分别对应D、I、S、C
        const dimensionMap = ['D', 'I', 'S', 'C'];
        const selectedDimension = dimensionMap[optionIndex % 4];
        
        dimensions[selectedDimension]++;
        responses.push({
          question: index + 1,
          dimension: selectedDimension
        });
      }
    }
  }
});

// 计算百分比和等级
const totalScore = Object.values(dimensions).reduce((sum, score) => sum + score, 0);

const dimensionResults = {};
const dimensionNames = {
  D: '支配型',
  I: '影响型',
  S: '稳健型',
  C: '谨慎型'
};

const getLevel = (percentage) => {
  if (percentage >= 40) return '非常高';
  else if (percentage >= 30) return '高';
  else if (percentage >= 20) return '中';
  else if (percentage >= 10) return '低';
  else return '非常低';
};

// 获取特征描述
const getTraits = (dimension, level) => {
  const traits = {
    D: {
      high: ['果断', '目标导向', '竞争性强', '直接', '独立'],
      low: ['谨慎', '协作', '深思熟虑', '谦逊']
    },
    I: {
      high: ['外向', '乐观', '热情', '善于社交', '有说服力'],
      low: ['内向', '严肃', '注重事实', '客观']
    },
    S: {
      high: ['耐心', '可靠', '支持性', '稳定', '忠诚'],
      low: ['多变', '急躁', '寻求变化', '灵活']
    },
    C: {
      high: ['精确', '分析性', '系统化', '谨慎', '完美主义'],
      low: ['灵活', '独立', '不拘小节', '创新']
    }
  };
  
  return level === '高' || level === '非常高' ? 
    traits[dimension].high : traits[dimension].low;
};

// 处理每个维度
Object.keys(dimensions).forEach(dim => {
  const score = dimensions[dim];
  const percentage = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
  const level = getLevel(percentage);
  
  dimensionResults[dim] = {
    name: dimensionNames[dim],
    score: score,
    percentage: percentage,
    level: level,
    traits: getTraits(dim, level)
  };
});

// 确定主要和次要风格
const sortedDimensions = Object.entries(dimensions)
  .sort((a, b) => b[1] - a[1]);

const primaryStyle = dimensionNames[sortedDimensions[0][0]];
const secondaryStyle = dimensionNames[sortedDimensions[1][0]];

// 生成行为风格剖面
let profile = \`您的主要行为风格是\${primaryStyle}\`;
if (sortedDimensions[0][1] === sortedDimensions[1][1]) {
  profile += \`，同时具有\${secondaryStyle}的特征\`;
} else if (sortedDimensions[1][1] > 0) {
  profile += \`，次要风格是\${secondaryStyle}\`;
}

// 生成优势和挑战
const strengths = [];
const challenges = [];

// 基于最高的两个维度生成优势和挑战
const topDimensions = sortedDimensions.slice(0, 2);
topDimensions.forEach(([dim, score]) => {
  if (score > 0) {
    const level = dimensionResults[dim].level;
    if (level === '高' || level === '非常高') {
      // 添加该维度的优势和挑战
      if (dim === 'D') {
        strengths.push('决策迅速', '结果导向');
        challenges.push('可能过于强势', '缺乏耐心');
      } else if (dim === 'I') {
        strengths.push('人际关系好', '激励他人');
        challenges.push('可能过于乐观', '缺乏条理');
      } else if (dim === 'S') {
        strengths.push('团队合作', '值得信赖');
        challenges.push('抗拒变化', '优柔寡断');
      } else if (dim === 'C') {
        strengths.push('注重细节', '质量导向');
        challenges.push('过度分析', '完美主义');
      }
    }
  }
});

// 生成发展建议
let recommendations = '建议：';
if (sortedDimensions[0][0] === 'D') {
  recommendations += '发挥您的领导能力，同时注意倾听他人意见；';
} else if (sortedDimensions[0][0] === 'I') {
  recommendations += '继续发挥您的人际影响力，同时加强条理性和专注度；';
} else if (sortedDimensions[0][0] === 'S') {
  recommendations += '保持您的稳定性和支持性，同时尝试接受新的变化；';
} else if (sortedDimensions[0][0] === 'C') {
  recommendations += '继续保持高标准，同时避免过度完美主义；';
}

// 返回结果
const result = {
  success: true,
  dimensions: dimensionResults,
  primaryStyle: primaryStyle,
  secondaryStyle: secondaryStyle,
  profile: profile,
  strengths: strengths,
  challenges: challenges,
  recommendations: recommendations,
  completionRate: Math.round((answeredCount / questions.length) * 100) + '%',
  timestamp: new Date().toISOString(),
  scaleType: 'DISC行为风格测评'
};

console.log('DISC计算结果:', result);
return result;`
  },

  /**
   * 直接计算函数
   */
  calculate: (formData: FormData, questions: Question[]): DISCResult => {
    // 排序题目
    const sortedQuestions = [...questions].sort((a, b) => {
      const numA = parseInt(a.field.replace(/[^0-9]/g, ''))
      const numB = parseInt(b.field.replace(/[^0-9]/g, ''))
      return numA - numB
    })
    
    // 初始化DISC四个维度得分
    const dimensionScores = { D: 0, I: 0, S: 0, C: 0 }
    let answeredCount = 0
    
    // 处理每个题目
    sortedQuestions.forEach((question, index) => {
      const answer = formData[question.field]
      
      if (answer !== null && answer !== undefined && answer !== '') {
        answeredCount++
        
        if (question.options && question.options.length >= 4) {
          const selectedOption = question.options.find(opt => opt.hash === answer)
          if (selectedOption) {
            const optionIndex = question.options.indexOf(selectedOption)
            // 简化的维度分配
            const dimensionMap: ('D' | 'I' | 'S' | 'C')[] = ['D', 'I', 'S', 'C']
            const selectedDimension = dimensionMap[optionIndex % 4]
            dimensionScores[selectedDimension]++
          }
        }
      }
    })
    
    // 计算百分比和等级
    const totalScore = Object.values(dimensionScores).reduce((sum, score) => sum + score, 0)
    
    // 构建维度结果
    const dimensions: any = {}
    Object.entries(dimensionScores).forEach(([dim, score]) => {
      const percentage = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0
      const level = getLevel(percentage)
      const isHigh = level === '高' || level === '非常高'
      const traits = DISC_TRAITS[dim as keyof typeof DISC_TRAITS]
      
      dimensions[dim] = {
        score,
        percentage,
        level,
        traits: isHigh ? traits.high.traits : traits.low.traits
      }
    })
    
    // 确定主要和次要风格
    const sortedDims = Object.entries(dimensionScores).sort((a, b) => b[1] - a[1])
    const primaryKey = sortedDims[0][0]
    const secondaryKey = sortedDims[1][0]
    
    const styleNames = { D: '支配型', I: '影响型', S: '稳健型', C: '谨慎型' }
    const primaryStyle = styleNames[primaryKey as keyof typeof styleNames]
    const secondaryStyle = styleNames[secondaryKey as keyof typeof styleNames]
    
    // 生成剖面
    let profile = `您的主要行为风格是${primaryStyle}`
    if (sortedDims[1][1] > 0) {
      profile += `，次要风格是${secondaryStyle}`
    }
    
    // 生成优势和挑战
    const strengths: string[] = []
    const challenges: string[] = []
    
    sortedDims.slice(0, 2).forEach(([dim]) => {
      const dimKey = dim as keyof typeof DISC_TRAITS
      const level = dimensions[dim].level
      if (level === '高' || level === '非常高') {
        strengths.push(...DISC_TRAITS[dimKey].high.strengths.slice(0, 2))
        challenges.push(...DISC_TRAITS[dimKey].high.challenges.slice(0, 2))
      }
    })
    
    // 生成建议
    const recommendations = `基于您的${primaryStyle}特质，建议发挥您的${strengths.slice(0, 2).join('、')}等优势，同时注意改善${challenges.slice(0, 2).join('、')}等方面。`

    return {
      success: true,
      dimensions,
      primaryStyle,
      secondaryStyle,
      profile,
      strengths,
      challenges,
      recommendations,
      completionRate: calculateCompletionRate(answeredCount, questions.length),
      timestamp: generateTimestamp(),
      scaleType: 'DISC行为风格测评'
    }
  },

  /**
   * 验证问卷是否符合DISC要求
   */
  validate: (questions: Question[]): boolean => {
    if (questions.length < 24) {
      console.warn(`DISC标准版本应该有24道题或更多，当前有${questions.length}道题`)
      return false
    }

    // DISC通常每题有4个选项
    for (const question of questions) {
      if (!question.options || question.options.length < 4) {
        console.warn(`DISC题目${question.field}应该至少有4个选项`)
        return false
      }
    }

    return true
  }
}

export default discTemplate