/**
 * SDS抑郁自评量表计算模板
 */

import type { CalculateTemplate, Question, FormData, SDSResult } from '../types'
import { sortQuestionsByNumber, getOptionScore, calculateCompletionRate, generateTimestamp, reverseScoreMap4, safeCalculate, createCalculationError, SDS_DEPRESSION_LEVELS, type SDSDepressionLevel } from '../utils'
import { SDS_NORMS } from '../norms'

/**
 * SDS量表反向计分题目编号
 * 这些题目描述积极情绪，需要反向计分
 */
const REVERSE_QUESTIONS = [2, 5, 6, 11, 12, 14, 16, 17, 18, 20]

/**
 * 抑郁程度评估标准
 */
const DEPRESSION_THRESHOLDS = SDS_NORMS.thresholds

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
    return `// SDS抑郁自评量表计算代码
// 统一辅助函数
const __timestamp = () => new Date().toISOString();
const __createCalculationError = (name, id, err) => ({ success: false, timestamp: __timestamp(), scaleType: name, error: { message: (err && err.message) || String(err) }});
const __safeCalculate = (name, id, fn) => { try { return fn() } catch (e) { return __createCalculationError(name, id, e) } };

// 抑郁等级定义
const DEPRESSION_LEVELS = ${JSON.stringify(SDS_DEPRESSION_LEVELS)};

// 反向计分映射（4分制：1->4, 2->3, 3->2, 4->1）
const reverseScoreMap = { 1: 4, 2: 3, 3: 2, 4: 1 };

// 反向计分题目编号
const reverseQuestions = [${REVERSE_QUESTIONS.join(', ')}];

// 主计算逻辑
return __safeCalculate('SDS抑郁自评量表', 'sds', () => {
  // 题目排序
  const sortedQuestions = [...questions].sort((a, b) => {
    const numA = parseInt(a.field.replace(/[^0-9]/g, ""));
    const numB = parseInt(b.field.replace(/[^0-9]/g, ""));
    return numA - numB;
  });

  // 验证题目数量
  if (sortedQuestions.length !== 20) {
    return __createCalculationError('SDS抑郁自评量表', 'sds', '题目数量应为20，实际为' + sortedQuestions.length);
  }

  // 验证选项数量
  for (const q of sortedQuestions) {
    if (!q.options || q.options.length !== 4) {
      return __createCalculationError('SDS抑郁自评量表', 'sds', '题目' + q.field + '需有4个选项');
    }
  }

  // 初始化变量
  let rawScore = 0;
  let answeredCount = 0;
  const itemScores = {};
  const questionDetails = [];

  // 遍历题目计算得分
  sortedQuestions.forEach((question, index) => {
    const answer = formData[question.field];
    let score = 0;
    let userAnswer = null;

    if (answer && question.options) {
      const selectedOption = question.options.find(opt => opt.hash === answer);
      if (selectedOption) {
        const optionIndex = question.options.indexOf(selectedOption) + 1;
        const questionNumber = index + 1;

        // 判断是否需要反向计分
        const isReverse = reverseQuestions.includes(questionNumber);
        score = isReverse ? (reverseScoreMap[optionIndex] || 0) : optionIndex;

        if (score > 0) {
          answeredCount++;
          userAnswer = selectedOption.hash;
          itemScores[question.field] = score;
          rawScore += score;
        }
      }
    }

    // 记录题目详情
    questionDetails.push({
      questionId: question.field,
      questionText: question.title ? question.title.replace(/<[^>]*>/g, '') : \`题目\${index + 1}\`,
      questionType: question.type || 'single_choice',
      options: question.options || [],
      userAnswer: userAnswer,
      answerScore: score,
      isReverse: reverseQuestions.includes(index + 1)
    });
  });

  // 计算标准分（粗分 × 1.25）
  const standardScore = Math.round(rawScore * 1.25);

  // 判断抑郁等级
  let level = DEPRESSION_LEVELS[0]; // 正常
  let interpretation = '';
  let recommendations = [];

  if (standardScore < 50) {
    level = DEPRESSION_LEVELS[0]; // 正常
    interpretation = '您的情绪状态在正常范围内，无明显抑郁症状。';
    recommendations = ['保持良好心态', '规律作息时间', '适度运动锻炼', '维持社交活动'];
  } else if (standardScore >= 50 && standardScore <= 59) {
    level = DEPRESSION_LEVELS[1]; // 轻度抑郁
    interpretation = '可能存在轻度抑郁倾向，建议关注情绪健康。';
    recommendations = ['学习放松技巧', '调整生活节奏', '增加户外活动', '与亲友多交流'];
  } else if (standardScore >= 60 && standardScore <= 69) {
    level = DEPRESSION_LEVELS[2]; // 中度抑郁
    interpretation = '可能存在中度抑郁倾向，建议寻求专业帮助。';
    recommendations = ['寻求心理咨询', '学习应对策略', '考虑专业治疗', '建立支持系统'];
  } else {
    level = DEPRESSION_LEVELS[3]; // 重度抑郁
    interpretation = '可能存在重度抑郁倾向，强烈建议尽快寻求专业帮助。';
    recommendations = ['立即寻求专业治疗', '可能需要药物干预', '密切监护安全', '综合治疗干预'];
  }

  // 返回标准格式结果
  const result = {
    success: true,
    rawScore: rawScore,
    standardScore: standardScore,
    level: level,
    levelArray: DEPRESSION_LEVELS,
    interpretation: interpretation,
    recommendations: recommendations,
    factors: [{
      name: '抑郁症状',
      score: standardScore,
      interpretation: interpretation,
      level: level,
      levelArray: DEPRESSION_LEVELS
    }],
    questions: questionDetails,
    metadata: {
      totalQuestions: 20,
      answeredQuestions: answeredCount,
      reverseItemsCount: reverseQuestions.length,
      completionTime: Date.now() - (formData.startTime || Date.now())
    },
    answeredCount: answeredCount,
    completionRate: Math.round((answeredCount / 20) * 100) + '%',
    itemScores: itemScores,
    timestamp: __timestamp(),
    scaleType: 'SDS抑郁自评量表'
  };

  console.log('SDS计算结果:', result);
  return result;
});`
  },

  /**
   * 直接计算函数（可选，用于服务端计算）
   */
  calculate: (formData: FormData, questions: Question[]): SDSResult => {
    return safeCalculate<SDSResult>(sdsTemplate.metadata, (): SDSResult => {
      // 校验
      if (!sdsTemplate.validate?.(questions)) {
        return createCalculationError(sdsTemplate.metadata, '问卷不符合SDS要求') as SDSResult
      }

      const sortedQuestions = sortQuestionsByNumber(questions)
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

      // 计算标准分
      const standardScore = Math.round(rawScore * 1.25)

      // 判断抑郁等级
      let level: SDSDepressionLevel = SDS_DEPRESSION_LEVELS[0] // 正常
      let interpretation = ''
      let recommendations = []

      if (standardScore < 50) {
        level = SDS_DEPRESSION_LEVELS[0] // 正常
        interpretation = '您的情绪状态在正常范围内，无明显抑郁症状。'
        recommendations = ['保持良好心态', '规律作息时间', '适度运动锻炼', '维持社交活动']
      } else if (standardScore <= 59) {
        level = SDS_DEPRESSION_LEVELS[1] // 轻度抑郁
        interpretation = '可能存在轻度抑郁倾向，建议关注情绪健康。'
        recommendations = ['学习放松技巧', '调整生活节奏', '增加户外活动', '与亲友多交流']
      } else if (standardScore <= 69) {
        level = SDS_DEPRESSION_LEVELS[2] // 中度抑郁
        interpretation = '可能存在中度抑郁倾向，建议寻求专业帮助。'
        recommendations = ['寻求心理咨询', '学习应对策略', '考虑专业治疗', '建立支持系统']
      } else {
        level = SDS_DEPRESSION_LEVELS[3] // 重度抑郁
        interpretation = '可能存在重度抑郁倾向，强烈建议尽快寻求专业帮助。'
        recommendations = ['立即寻求专业治疗', '可能需要药物干预', '密切监护安全', '综合治疗干预']
      }

      return {
        success: true,
        rawScore,
        standardScore,
        level,
        levelArray: SDS_DEPRESSION_LEVELS,
        interpretation,
        recommendations,
        factors: [{
          name: '抑郁症状',
          score: standardScore,
          interpretation,
          level,
          levelArray: SDS_DEPRESSION_LEVELS
        }],
        questions: sortedQuestions.map((question, index) => ({
          questionId: question.field,
          questionText: question.title ? question.title.replace(/<[^>]*>/g, '') : `题目${index + 1}`,
          questionType: question.type || 'single_choice',
          options: question.options || [],
          userAnswer: formData[question.field] || null,
          answerScore: itemScores[question.field] || 0,
          isReverse: REVERSE_QUESTIONS.includes(index + 1)
        })),
        metadata: {
          totalQuestions: 20,
          answeredQuestions: answeredCount,
          reverseItemsCount: REVERSE_QUESTIONS.length,
          completionTime: Date.now() - (formData.startTime || Date.now())
        },
        answeredCount,
        completionRate: calculateCompletionRate(answeredCount, 20),
        itemScores,
        timestamp: generateTimestamp(),
        scaleType: 'SDS抑郁自评量表'
      }
    })
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
