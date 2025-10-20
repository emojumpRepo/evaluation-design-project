/**
 * HADS医院焦虑抑郁量表（Hospital Anxiety and Depression Scale）
 * 说明：14题，4分量表；包含焦虑和抑郁两个因子，各7题
 */

import type { CalculateTemplate, Question, FormData } from '../types'
import { calculateCompletionRate, generateTimestamp, safeCalculate, createCalculationError, HADS_SEVERITY_LEVELS } from '../utils'

export interface HADSResult {
  success: boolean
  rawScore: number                        // 原始总分（焦虑+抑郁分总和，0-42分）
  standardScore: number                   // 标准分（使用焦虑分作为主要指标，0-21分）
  anxietyScore: number                     // 焦虑因子得分 (0-21) - 保留向后兼容
  depressionScore: number                  // 抑郁因子得分 (0-21) - 保留向后兼容
  level: typeof HADS_SEVERITY_LEVELS[number]        // 总体严重程度等级
  levelArray: readonly typeof HADS_SEVERITY_LEVELS[]   // 等级枚举数组
  interpretation: string                       // 结果解释
  recommendations: string[]                    // 建议列表
  factors: Array<{
    name: string
    rawScore: number        // 因子原始分
    standardScore: number   // 因子标准分
    interpretation: string
    level: typeof HADS_SEVERITY_LEVELS[number]
    levelArray: readonly typeof HADS_SEVERITY_LEVELS[]
  }>
  highScoreItems: {          // 得分≥3分的题目列表
    anxiety: Array<{
      questionNumber: number
      field: string
      answer: string
      score: number
      questionText: string
    }>
    depression: Array<{
      questionNumber: number
      field: string
      answer: string
      score: number
      questionText: string
    }>
  }
  questions?: Array<{
    questionId: string
    questionText: string
    questionType: string
    options: any[]
    userAnswer: any
    answerScore: number
    isReverse?: boolean
  }>
  metadata?: {
    totalQuestions: number
    answeredQuestions: number
    completionTime: number
  }
  answeredCount: number
  completionRate: string
  itemScores: { [key: string]: number }
  timestamp: string
  scaleType: string
}

/**
 * HADS因子题目分配
 */
const FACTOR_ITEMS = {
  anxiety: [1, 3, 5, 7, 9, 11, 13],     // 焦虑因子 (7题)
  depression: [2, 4, 6, 8, 10, 12, 14]  // 抑郁因子 (7题)
}

/**
 * HADS反向计分题目编号
 * 4分制：答案1=0分、2=1分、3=2分、4=3分
 * 反向计分：1=3分、2=2分、3=1分、4=0分
 */
const REVERSE_ITEMS = {
  anxiety: [1, 3, 5, 9, 11],      // 焦虑因子反向题目
  depression: [6, 8, 12]          // 抑郁因子反向题目
}

/**
 * 因子名称映射
 */
const FACTOR_NAMES = {
  anxiety: '焦虑',
  depression: '抑郁'
}

/**
 * 根据得分判断严重程度
 */
const getSeverityLevel = (score: number): typeof HADS_SEVERITY_LEVELS[number] => {
  if (score <= 7) return HADS_SEVERITY_LEVELS[0]  // 正常
  if (score <= 10) return HADS_SEVERITY_LEVELS[1] // 轻度
  if (score <= 14) return HADS_SEVERITY_LEVELS[2] // 中度
  return HADS_SEVERITY_LEVELS[3]                     // 重度
}

/**
 * 生成解释和建议
 */
const generateInterpretation = (factor: string, level: string, score: number) => {
  const interpretations: Record<string, Record<string, string>> = {
    anxiety: {
      [HADS_SEVERITY_LEVELS[0]]: `焦虑得分为${score}分，在正常范围内。无明显焦虑症状，心理状态良好。`,
      [HADS_SEVERITY_LEVELS[1]]: `焦虑得分为${score}分，存在轻度焦虑症状。建议关注情绪变化，学习放松技巧。`,
      [HADS_SEVERITY_LEVELS[2]]: `焦虑得分为${score}分，存在中度焦虑症状。建议寻求专业心理咨询。`,
      [HADS_SEVERITY_LEVELS[3]]: `焦虑得分为${score}分，存在重度焦虑症状。强烈建议立即寻求专业帮助。`
    },
    depression: {
      [HADS_SEVERITY_LEVELS[0]]: `抑郁得分为${score}分，在正常范围内。无明显抑郁症状，情绪状态良好。`,
      [HADS_SEVERITY_LEVELS[1]]: `抑郁得分为${score}分，存在轻度抑郁症状。建议适当运动，保持社交活动。`,
      [HADS_SEVERITY_LEVELS[2]]: `抑郁得分为${score}分，存在中度抑郁症状。建议寻求专业心理评估。`,
      [HADS_SEVERITY_LEVELS[3]]: `抑郁得分为${score}分，存在重度抑郁症状。强烈建议立即寻求专业治疗。`
    }
  }

  return interpretations[factor]?.[level] || ''
}

/**
 * 生成建议
 */
const generateRecommendations = (factor: string, level: string) => {
  const recommendations: Record<string, Record<string, string[]>> = {
    anxiety: {
      [HADS_SEVERITY_LEVELS[0]]: ['保持良好心态', '继续关注情绪健康', '适度运动放松'],
      [HADS_SEVERITY_LEVELS[1]]: ['学习深呼吸放松法', '规律作息时间', '与亲友交流感受', '减少压力源'],
      [HADS_SEVERITY_LEVELS[2]]: ['寻求心理咨询', '学习认知行为疗法', '考虑正念冥想', '调整工作生活平衡'],
      [HADS_SEVERITY_LEVELS[3]]: ['立即寻求专业治疗', '可能需要药物治疗', '进行全面心理评估', '建立社会支持系统']
    },
    depression: {
      [HADS_SEVERITY_LEVELS[0]]: ['保持积极心态', '规律运动锻炼', '维持社交活动'],
      [HADS_SEVERITY_LEVELS[1]]: ['增加户外活动', '保持规律作息', '培养兴趣爱好', '与朋友家人多交流'],
      [HADS_SEVERITY_LEVELS[2]]: ['寻求专业心理咨询', '参加支持小组', '考虑心理治疗', '调整生活方式'],
      [HADS_SEVERITY_LEVELS[3]]: ['立即寻求精神科帮助', '可能需要抗抑郁药物', '密切监护安全状况', '综合治疗干预']
    }
  }

  return recommendations[factor]?.[level] || []
}

const hadsTemplate: CalculateTemplate = {
  metadata: {
    id: 'hads',
    name: '医院焦虑抑郁量表(HADS)',
    description: '14题版本，评估焦虑和抑郁症状，适用于综合医院患者',
    version: '1.0.0',
    author: 'Zigmond & Snaith',
    tags: ['心理健康', '焦虑', '抑郁', '医院筛查'],
    requiredQuestions: 14
  },

  generateCode: (questions?: Question[]): string => {
    return `// HADS医院焦虑抑郁量表计算代码
// 统一辅助函数
const __timestamp = () => new Date().toISOString();
const __createCalculationError = (name, id, err) => ({ success: false, timestamp: __timestamp(), scaleType: name, error: { message: (err && err.message) || String(err) }});
const __safeCalculate = (name, id, fn) => { try { return fn() } catch (e) { return __createCalculationError(name, id, e) } };

// 严重程度等级定义
const SEVERITY_LEVELS = ${JSON.stringify(HADS_SEVERITY_LEVELS)};

// 因子题目分配
const FACTOR_ITEMS = ${JSON.stringify(FACTOR_ITEMS)};

// 反向计分题目
const REVERSE_ITEMS = ${JSON.stringify(REVERSE_ITEMS)};

// 正向计分映射（4分制：1->0, 2->1, 3->2, 4->3）
const normalScoreMap = { 1: 0, 2: 1, 3: 2, 4: 3 };

// 反向计分映射（4分制：1->3, 2->2, 3->1, 4->0）
const reverseScoreMap = { 1: 3, 2: 2, 3: 1, 4: 0 };

// 根据得分判断严重程度
const getSeverityLevel = (score) => {
  if (score <= 7) return SEVERITY_LEVELS[0];  // 正常
  if (score <= 10) return SEVERITY_LEVELS[1]; // 轻度
  if (score <= 14) return SEVERITY_LEVELS[2]; // 中度
  return SEVERITY_LEVELS[3];                     // 重度
};

// 因子名称映射
const FACTOR_NAMES = {
  anxiety: '焦虑',
  depression: '抑郁'
};

// 生成解释和建议
const generateInterpretation = (factor, level, score) => {
  const interpretations = {
    anxiety: {
      [SEVERITY_LEVELS[0]]: "焦虑得分为" + score + "分，在正常范围内。无明显焦虑症状，心理状态良好。",
      [SEVERITY_LEVELS[1]]: "焦虑得分为" + score + "分，存在轻度焦虑症状。建议关注情绪变化，学习放松技巧。",
      [SEVERITY_LEVELS[2]]: "焦虑得分为" + score + "分，存在中度焦虑症状。建议寻求专业心理咨询。",
      [SEVERITY_LEVELS[3]]: "焦虑得分为" + score + "分，存在重度焦虑症状。强烈建议立即寻求专业帮助。"
    },
    depression: {
      [SEVERITY_LEVELS[0]]: "抑郁得分为" + score + "分，在正常范围内。无明显抑郁症状，情绪状态良好。",
      [SEVERITY_LEVELS[1]]: "抑郁得分为" + score + "分，存在轻度抑郁症状。建议适当运动，保持社交活动。",
      [SEVERITY_LEVELS[2]]: "抑郁得分为" + score + "分，存在中度抑郁症状。建议寻求专业心理评估。",
      [SEVERITY_LEVELS[3]]: "抑郁得分为" + score + "分，存在重度抑郁症状。强烈建议立即寻求专业治疗。"
    }
  };
  return interpretations[factor]?.[level] || '';
};

const generateRecommendations = (factor, level) => {
  const recommendations = {
    anxiety: {
      [SEVERITY_LEVELS[0]]: ['保持良好心态', '继续关注情绪健康', '适度运动放松'],
      [SEVERITY_LEVELS[1]]: ['学习深呼吸放松法', '规律作息时间', '与亲友交流感受', '减少压力源'],
      [SEVERITY_LEVELS[2]]: ['寻求心理咨询', '学习认知行为疗法', '考虑正念冥想', '调整工作生活平衡'],
      [SEVERITY_LEVELS[3]]: ['立即寻求专业治疗', '可能需要药物治疗', '进行全面心理评估', '建立社会支持系统']
    },
    depression: {
      [SEVERITY_LEVELS[0]]: ['保持积极心态', '规律运动锻炼', '维持社交活动'],
      [SEVERITY_LEVELS[1]]: ['增加户外活动', '保持规律作息', '培养兴趣爱好', '与朋友家人多交流'],
      [SEVERITY_LEVELS[2]]: ['寻求专业心理咨询', '参加支持小组', '考虑心理治疗', '调整生活方式'],
      [SEVERITY_LEVELS[3]]: ['立即寻求精神科帮助', '可能需要抗抑郁药物', '密切监护安全状况', '综合治疗干预']
    }
  };
  return recommendations[factor]?.[level] || [];
};

// 主计算逻辑
return __safeCalculate('医院焦虑抑郁量表(HADS)', 'hads', () => {
  // 题目排序
  const sortedQuestions = [...questions].sort((a, b) => {
    const numA = parseInt(a.field.replace(/[^0-9]/g, ""));
    const numB = parseInt(b.field.replace(/[^0-9]/g, ""));
    return numA - numB;
  });

  // 验证题目数量
  if (sortedQuestions.length !== 14) {
    return __createCalculationError('医院焦虑抑郁量表(HADS)', 'hads', '题目数量应为14，实际为' + sortedQuestions.length);
  }

  // 验证选项数量
  for (const q of sortedQuestions) {
    if (!q.options || q.options.length !== 4) {
      return __createCalculationError('医院焦虑抑郁量表(HADS)', 'hads', '题目' + q.field + '需有4个选项');
    }
  }

  // 初始化变量
  let answeredCount = 0;
  const itemScores = {};
  const questionDetails = [];
  const factorScores = {
    anxiety: 0,
    depression: 0
  };
  const highScoreItems = {
    anxiety: [],
    depression: []
  };

  // 遍历题目计算得分
  sortedQuestions.forEach((question, index) => {
    const answer = formData[question.field];
    let score = 0;
    let userAnswer = null;
    const questionNumber = index + 1;

    if (answer && question.options) {
      const selectedOption = question.options.find(opt => opt.hash === answer);
      if (selectedOption) {
        const optionIndex = question.options.indexOf(selectedOption) + 1;

        // 判断因子和是否反向计分
        let factor = null;
        let isReverse = false;

        if (FACTOR_ITEMS.anxiety.includes(questionNumber)) {
          factor = 'anxiety';
          isReverse = REVERSE_ITEMS.anxiety.includes(questionNumber);
        } else if (FACTOR_ITEMS.depression.includes(questionNumber)) {
          factor = 'depression';
          isReverse = REVERSE_ITEMS.depression.includes(questionNumber);
        }

        // 计算得分
        if (isReverse) {
          score = reverseScoreMap[optionIndex] || 0;
        } else {
          score = normalScoreMap[optionIndex] || 0;
        }

        answeredCount++;
        userAnswer = selectedOption.hash;
        itemScores[question.field] = score;

        // 累加到因子得分
        if (factor) {
          factorScores[factor] += score;

          // 检查是否为高得分题目（≥3分）
          if (score >= 3) {
            highScoreItems[factor].push({
              questionNumber: questionNumber,
              field: question.field,
              answer: userAnswer,
              score: score,
              questionText: question.title ? question.title.replace(/<[^>]*>/g, '') : '题目' + questionNumber
            });
          }
        }
      }
    }

    // 记录题目详情
    questionDetails.push({
      questionId: question.field,
      questionText: question.title ? question.title.replace(/<[^>]*>/g, '') : '题目' + questionNumber,
      questionType: question.type || 'single_choice',
      options: question.options || [],
      userAnswer: userAnswer,
      answerScore: score,
      isReverse: REVERSE_ITEMS.anxiety.includes(questionNumber) || REVERSE_ITEMS.depression.includes(questionNumber)
    });
  });

  // 判断严重程度等级
  const anxietyLevel = getSeverityLevel(factorScores.anxiety);
  const depressionLevel = getSeverityLevel(factorScores.depression);

  // 生成解释和建议
  const anxietyInterpretation = generateInterpretation('anxiety', anxietyLevel, factorScores.anxiety);
  const depressionInterpretation = generateInterpretation('depression', depressionLevel, factorScores.depression);

  const anxietyRecommendations = generateRecommendations('anxiety', anxietyLevel);
  const depressionRecommendations = generateRecommendations('depression', depressionLevel);

  // 生成因子信息
  const factors = [
    {
      name: '焦虑症状',
      rawScore: factorScores.anxiety,
      standardScore: factorScores.anxiety, // HADS焦虑分即作为标准分
      interpretation: anxietyInterpretation,
      level: anxietyLevel,
      levelArray: SEVERITY_LEVELS
    },
    {
      name: '抑郁症状',
      rawScore: factorScores.depression,
      standardScore: factorScores.depression, // HADS抑郁分即作为标准分
      interpretation: depressionInterpretation,
      level: depressionLevel,
      levelArray: SEVERITY_LEVELS
    }
  ];

  // 计算总分
  const totalRawScore = factorScores.anxiety + factorScores.depression;
  const overallLevel = factorScores.anxiety >= factorScores.depression ? anxietyLevel : depressionLevel;

  // 生成总体解释和建议
  const overallInterpretation = totalRawScore <= 14
    ? "HADS总分为" + totalRawScore + "分，整体心理状态良好。焦虑" + (anxietyInterpretation.split('，')[1] || '') + "，抑郁" + (depressionInterpretation.split('，')[1] || '') + "。"
    : totalRawScore <= 21
      ? "HADS总分为" + totalRawScore + "分，存在轻度心理症状。" + anxietyInterpretation + " " + depressionInterpretation
      : totalRawScore <= 28
        ? "HADS总分为" + totalRawScore + "分，存在中度心理症状。" + anxietyInterpretation + " " + depressionInterpretation
        : "HADS总分为" + totalRawScore + "分，存在明显心理症状。" + anxietyInterpretation + " " + depressionInterpretation;

  const overallRecommendations = [...anxietyRecommendations, ...depressionRecommendations];

  // 返回标准格式结果
  const result = {
    success: true,
    rawScore: totalRawScore,
    standardScore: factorScores.anxiety, // 使用焦虑分作为主要标准分
    anxietyScore: factorScores.anxiety,     // 保留向后兼容
    depressionScore: factorScores.depression, // 保留向后兼容
    level: overallLevel,
    levelArray: SEVERITY_LEVELS,
    interpretation: overallInterpretation,
    recommendations: overallRecommendations,
    highScoreItems: highScoreItems,
    factors: factors,
    questions: questionDetails,
    metadata: {
      totalQuestions: 14,
      answeredQuestions: answeredCount,
      factorStructure: FACTOR_NAMES,
      highScoreThreshold: 3,
      completionTime: Date.now() - (formData.startTime || Date.now())
    },
    answeredCount: answeredCount,
    completionRate: Math.round((answeredCount / 14) * 100) + '%',
    itemScores: itemScores,
    timestamp: __timestamp(),
    scaleType: '医院焦虑抑郁量表(HADS)'
  };

  console.log('HADS计算结果:', result);
  return result;
});`
  },

  calculate: (formData: FormData, questions: Question[]): HADSResult => {
    return safeCalculate<HADSResult>(hadsTemplate.metadata, () => {
      if (!questions || questions.length !== 14) {
        return createCalculationError(hadsTemplate.metadata, '题目数量应为14') as any
      }

      // 正向计分映射（4分制：1->0, 2->1, 3->2, 4->3）
      const normalScoreMap: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3 }
      // 反向计分映射（4分制：1->3, 2->2, 3->1, 4->0）
      const reverseScoreMap: Record<number, number> = { 1: 3, 2: 2, 3: 1, 4: 0 }

      let answeredCount = 0
      const itemScores: Record<string, number> = {}
      const factorScores = {
        anxiety: 0,
        depression: 0
      }
      const highScoreItems = {
        anxiety: [] as Array<{questionNumber: number; field: string; answer: string; score: number; questionText: string}>,
        depression: [] as Array<{questionNumber: number; field: string; answer: string; score: number; questionText: string}>
      }

      const sortedQuestions = [...questions].sort((a,b)=>{
        const na=parseInt(a.field.replace(/[^0-9]/g,''));
        const nb=parseInt(b.field.replace(/[^0-9]/g,''));
        return na-nb
      })

      sortedQuestions.forEach((question, index) => {
        const answer = formData[question.field]
        const questionNumber = index + 1
        let score = 0
        let userAnswer = null

        if (answer && question.options) {
          const selectedOption = question.options.find(opt => opt.hash === answer)
          if (selectedOption) {
            const optionIndex = question.options.indexOf(selectedOption) + 1

            // 判断因子和是否反向计分
            let factor = null
            let isReverse = false

            if (FACTOR_ITEMS.anxiety.includes(questionNumber)) {
              factor = 'anxiety'
              isReverse = REVERSE_ITEMS.anxiety.includes(questionNumber)
            } else if (FACTOR_ITEMS.depression.includes(questionNumber)) {
              factor = 'depression'
              isReverse = REVERSE_ITEMS.depression.includes(questionNumber)
            }

            // 计算得分
            if (isReverse) {
              score = reverseScoreMap[optionIndex] || 0
            } else {
              score = normalScoreMap[optionIndex] || 0
            }

            answeredCount++
            userAnswer = selectedOption.hash
            itemScores[question.field] = score

            // 累加到因子得分
            if (factor) {
              (factorScores as any)[factor] += score

              // 检查是否为高得分题目（≥3分）
              if (score >= 3) {
                (highScoreItems as any)[factor].push({
                  questionNumber: questionNumber,
                  field: question.field,
                  answer: userAnswer,
                  score: score,
                  questionText: question.title ? question.title.replace(/<[^>]*>/g, '') : `题目${questionNumber}`
                })
              }
            }
          }
        }
      })

      // 判断严重程度等级
      const anxietyLevel = getSeverityLevel(factorScores.anxiety)
      const depressionLevel = getSeverityLevel(factorScores.depression)

      // 生成解释和建议
      const anxietyInterpretation = generateInterpretation('anxiety', anxietyLevel, factorScores.anxiety)
      const depressionInterpretation = generateInterpretation('depression', depressionLevel, factorScores.depression)
      const anxietyRecommendations = generateRecommendations('anxiety', anxietyLevel)
      const depressionRecommendations = generateRecommendations('depression', depressionLevel)

      // 计算总分和总体等级
      const totalRawScore = factorScores.anxiety + factorScores.depression
      const overallLevel = factorScores.anxiety >= factorScores.depression ? anxietyLevel : depressionLevel

      // 生成总体解释和建议
      const overallInterpretation = totalRawScore <= 14
        ? "HADS总分为" + totalRawScore + "分，整体心理状态良好。"
        : totalRawScore <= 21
          ? "HADS总分为" + totalRawScore + "分，存在轻度心理症状。"
          : totalRawScore <= 28
            ? "HADS总分为" + totalRawScore + "分，存在中度心理症状。"
            : "HADS总分为" + totalRawScore + "分，存在明显心理症状。"

      const overallRecommendations = [...anxietyRecommendations, ...depressionRecommendations]

      // 构建factors数组
      const factors = [
        {
          name: '焦虑症状',
          rawScore: factorScores.anxiety,
          standardScore: factorScores.anxiety, // HADS焦虑分即作为标准分
          interpretation: anxietyInterpretation,
          level: anxietyLevel,
          levelArray: HADS_SEVERITY_LEVELS
        },
        {
          name: '抑郁症状',
          rawScore: factorScores.depression,
          standardScore: factorScores.depression, // HADS抑郁分即作为标准分
          interpretation: depressionInterpretation,
          level: depressionLevel,
          levelArray: HADS_SEVERITY_LEVELS
        }
      ]

      return {
        success: true,
        rawScore: totalRawScore,
        standardScore: factorScores.anxiety, // 使用焦虑分作为主要标准分
        anxietyScore: factorScores.anxiety,     // 保留向后兼容
        depressionScore: factorScores.depression, // 保留向后兼容
        level: overallLevel,
        levelArray: HADS_SEVERITY_LEVELS,
        interpretation: overallInterpretation,
        recommendations: overallRecommendations,
        factors,
        highScoreItems,
        questions: sortedQuestions.map((question, index) => ({
          questionId: question.field,
          questionText: question.title ? question.title.replace(/<[^>]*>/g, '') : '题目' + (index + 1),
          questionType: question.type || 'single_choice',
          options: question.options || [],
          userAnswer: formData[question.field] || null,
          answerScore: itemScores[question.field] || 0,
          isReverse: REVERSE_ITEMS.anxiety.includes(index + 1) || REVERSE_ITEMS.depression.includes(index + 1)
        })),
        metadata: {
          totalQuestions: 14,
          answeredQuestions: answeredCount,
          completionTime: Date.now() - (formData.startTime || Date.now())
        },
        answeredCount,
        completionRate: calculateCompletionRate(answeredCount, 14),
        itemScores,
        timestamp: generateTimestamp(),
        scaleType: '医院焦虑抑郁量表(HADS)'
      }
    })
  },

  validate: (questions: Question[]): boolean => {
    if (!questions || questions.length !== 14) return false
    for (const q of questions) {
      if (!q.options || q.options.length !== 4) return false
    }
    return true
  }
}

export default hadsTemplate