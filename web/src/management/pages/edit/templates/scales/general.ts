/**
 * 通用计算模板
 */

import type { CalculateTemplate, Question, FormData, GeneralResult } from '../types'
import { sum, avg, min, max, calculateCompletionRate, generateTimestamp, getOptionScore, getCheckboxScore } from '../utils'

/**
 * 通用计算模板
 * 适用于各种类型的问卷，提供灵活的计算方式
 */
const generalTemplate: CalculateTemplate = {
  metadata: {
    id: 'general',
    name: '通用计算模板',
    description: '适用于各种类型问卷的通用计算模板，支持总分、平均分、完成率等计算',
    version: '1.0.0',
    tags: ['通用', '自定义'],
  },

  /**
   * 生成计算代码
   */
  generateCode: (questions?: Question[]): string => {
    const hasScoreQuestions = questions?.some((q: Question) => q.options?.some(opt => opt.score !== undefined))
    const hasRadioStar = questions?.some(q => q.type?.toUpperCase() === 'RADIO_STAR')
    
    let template = `// 通用计算模板
// 基于当前问卷的题目结构自动生成

// 工具函数
const sum = (array) => array.reduce((acc, val) => acc + val, 0);
const avg = (array) => array.length === 0 ? 0 : sum(array) / array.length;
const min = (array) => array.length === 0 ? 0 : Math.min(...array);
const max = (array) => array.length === 0 ? 0 : Math.max(...array);

`

    if (hasScoreQuestions || hasRadioStar) {
      template += `// 初始化分数统计
let totalScore = 0;
const scores = {};
const categoryScores = {}; // 分类分数
let answeredCount = 0;

// 遍历所有题目计算分数
questions.forEach(question => {
  const answer = formData[question.field];
  
  if (answer !== null && answer !== undefined && answer !== "") {
    answeredCount++;
    
    // 处理不同题型
    const questionType = question.type?.toUpperCase();
    
    switch (questionType) {
      case 'RADIO':
      case 'SELECT':
        // 单选题分数计算
        if (question.options) {
          const option = question.options.find(opt => opt.hash === answer);
          if (option && option.score !== undefined) {
            const score = Number(option.score);
            scores[question.field] = score;
            totalScore += score;
          }
        }
        break;
        
      case 'CHECKBOX':
      case 'VOTE':
        // 多选题分数计算
        if (Array.isArray(answer) && question.options) {
          let questionScore = 0;
          answer.forEach(hash => {
            const option = question.options.find(opt => opt.hash === hash);
            if (option && option.score !== undefined) {
              questionScore += Number(option.score);
            }
          });
          scores[question.field] = questionScore;
          totalScore += questionScore;
        }
        break;
        
      case 'RADIO_STAR':
        // 评分题直接取值
        const starScore = Number(answer);
        scores[question.field] = starScore;
        totalScore += starScore;
        break;
    }
  }
});

// 计算平均分
const avgScore = answeredCount > 0 ? (totalScore / answeredCount).toFixed(2) : 0;

// 分数等级判定
let level = '';
let interpretation = '';

if (totalScore >= 80) {
  level = '优秀';
  interpretation = '表现非常出色';
} else if (totalScore >= 60) {
  level = '良好';
  interpretation = '表现良好';
} else if (totalScore >= 40) {
  level = '中等';
  interpretation = '表现一般';
} else {
  level = '需改进';
  interpretation = '还有提升空间';
}
`
    } else {
      template += `// 统计答题情况
let answeredCount = 0;
const answers = {};

// 遍历所有题目
questions.forEach(question => {
  const answer = formData[question.field];
  
  if (answer !== null && answer !== undefined && answer !== "") {
    answeredCount++;
    answers[question.field] = answer;
    
    // 处理不同题型的答案
    const questionType = question.type?.toUpperCase();
    
    if (questionType === 'CHECKBOX' || questionType === 'VOTE') {
      // 多选题统计每个选项的选择情况
      if (Array.isArray(answer) && question.options) {
        console.log(\`题目 \${question.field} 选择了 \${answer.length} 个选项\`);
      }
    }
  }
});
`
    }

    template += `
// 计算完成率
const totalQuestions = questions.length;
const completionRate = Math.round((answeredCount / totalQuestions) * 100) + '%';

// 构建返回结果
const result = {
  success: true,`

    if (hasScoreQuestions || hasRadioStar) {
      template += `
  totalScore: totalScore,
  avgScore: avgScore,
  scores: scores,
  level: level,
  interpretation: interpretation,`
    }

    template += `
  answeredCount: answeredCount,
  totalQuestions: totalQuestions,
  completionRate: completionRate,
  timestamp: new Date().toISOString(),
  scaleType: '通用计算'
};

// 添加统计信息
const scoreArray = Object.values(scores || {});
if (scoreArray.length > 0) {
  result.statistics = {
    min: Math.min(...scoreArray),
    max: Math.max(...scoreArray),
    avg: (scoreArray.reduce((a, b) => a + b, 0) / scoreArray.length).toFixed(2),
    count: scoreArray.length
  };
}

console.log('计算结果:', result);
return result;`

    return template
  },

  /**
   * 直接计算函数
   */
  calculate: (formData: FormData, questions: Question[]): GeneralResult => {
    let totalScore = 0
    const scores: { [key: string]: number } = {}
    let answeredCount = 0
    const scoreArray: number[] = []

    // 遍历所有题目
    questions.forEach(question => {
      const answer = formData[question.field]
      
      if (answer !== null && answer !== undefined && answer !== '') {
        answeredCount++
        
        const questionType = question.type?.toUpperCase()
        
        switch (questionType) {
          case 'RADIO':
          case 'SELECT':
            if (question.options) {
              const score = getOptionScore(question, answer)
              if (score > 0) {
                scores[question.field] = score
                totalScore += score
                scoreArray.push(score)
              }
            }
            break
            
          case 'CHECKBOX':
          case 'VOTE':
            if (Array.isArray(answer) && question.options) {
              const score = getCheckboxScore(question, answer)
              if (score > 0) {
                scores[question.field] = score
                totalScore += score
                scoreArray.push(score)
              }
            }
            break
            
          case 'RADIO_STAR':
            const starScore = Number(answer)
            if (!isNaN(starScore)) {
              scores[question.field] = starScore
              totalScore += starScore
              scoreArray.push(starScore)
            }
            break
        }
      }
    })

    // 确定等级
    let level = ''
    if (scoreArray.length > 0) {
      const avgScore = avg(scoreArray)
      const maxPossible = questions.length * 5 // 假设最高5分
      const percentage = (totalScore / maxPossible) * 100
      
      if (percentage >= 80) level = '优秀'
      else if (percentage >= 60) level = '良好'
      else if (percentage >= 40) level = '中等'
      else level = '需改进'
    }

    return {
      success: true,
      totalScore: scoreArray.length > 0 ? totalScore : undefined,
      scores: scoreArray.length > 0 ? scores : undefined,
      level: level || undefined,
      answeredCount,
      totalQuestions: questions.length,
      completionRate: calculateCompletionRate(answeredCount, questions.length),
      timestamp: generateTimestamp(),
      scaleType: '通用计算'
    }
  },

  /**
   * 验证函数（通用模板不需要特定验证）
   */
  validate: (questions: Question[]): boolean => {
    return questions.length > 0
  }
}

export default generalTemplate