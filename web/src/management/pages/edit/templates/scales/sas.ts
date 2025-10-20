/**
 * SAS焦虑自评量表（Self-Rating Anxiety Scale）计算模板
 */

import type { CalculateTemplate, Question, FormData } from '../types'
import { sortQuestionsByNumber, getOptionScore, calculateCompletionRate, generateTimestamp, reverseScoreMap4, safeCalculate, createCalculationError, SAS_ANXIETY_LEVELS } from '../utils'
import { SAS_NORMS } from '../norms'

/**
 * SAS结果接口
 */
export interface SASResult {
  success: boolean
  rawScore: number
  standardScore: number
  level: typeof SAS_ANXIETY_LEVELS[number]
  answeredCount: number
  completionRate: string
  timestamp: string
  scaleType: string
  itemScores: { [key: string]: number }
}

/**
 * SAS量表反向计分题目编号
 * 这些题目描述积极情绪，需要反向计分
 */
const REVERSE_QUESTIONS = [5, 9, 13, 17, 19]

/**
 * 焦虑程度评估标准
 */
const ANXIETY_THRESHOLDS = SAS_NORMS.thresholds

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
    // 预先定义常量
    const anxietyLevelsJson = JSON.stringify(SAS_ANXIETY_LEVELS);
    const reverseQuestionsArray = REVERSE_QUESTIONS.join(', ');

    return "// SAS焦虑自评量表计算代码\n" +
      "// 统一辅助函数\n" +
      "const __timestamp = () => new Date().toISOString();\n" +
      "const __createCalculationError = (name, id, err) => ({ success: false, timestamp: __timestamp(), scaleType: name, error: { message: (err && err.message) || String(err) }});\n" +
      "const __safeCalculate = (name, id, fn) => { try { return fn() } catch (e) { return __createCalculationError(name, id, e) } };\n" +
      "\n" +
      "// 焦虑等级定义\n" +
      "const ANXIETY_LEVELS = " + anxietyLevelsJson + ";\n" +
      "\n" +
      "// 反向计分映射（4分制：1->4, 2->3, 3->2, 4->1）\n" +
      "const reverseScoreMap = { 1: 4, 2: 3, 3: 2, 4: 1 };\n" +
      "\n" +
      "// 反向计分题目编号\n" +
      "const reverseQuestions = [" + reverseQuestionsArray + "];" +

"\n" +
      "// 主计算逻辑\n" +
      "return __safeCalculate('SAS焦虑自评量表', 'sas', () => {\n" +
      "  // 题目排序\n" +
      "  const sortedQuestions = [...questions].sort((a, b) => {\n" +
      "    const numA = parseInt(a.field.replace(/[^0-9]/g, \"\"));\n" +
      "    const numB = parseInt(b.field.replace(/[^0-9]/g, \"\"));\n" +
      "    return numA - numB;\n" +
      "  });\n" +
      "\n" +
      "  // 验证题目数量\n" +
      "  if (sortedQuestions.length !== 20) {\n" +
      "    return __createCalculationError('SAS焦虑自评量表', 'sas', '题目数量应为20，实际为' + sortedQuestions.length);\n" +
      "  }\n" +
      "\n" +
      "  // 验证选项数量\n" +
      "  for (const q of sortedQuestions) {\n" +
      "    if (!q.options || q.options.length !== 4) {\n" +
      "      return __createCalculationError('SAS焦虑自评量表', 'sas', '题目' + q.field + '需有4个选项');\n" +
      "    }\n" +
      "  }\n" +
      "\n" +
      "  // 初始化变量\n" +
      "  let rawScore = 0;\n" +
      "  let answeredCount = 0;\n" +
      "  const itemScores = {};\n" +
      "  const questionDetails = [];\n" +
      "\n" +
      "  // 遍历题目计算得分\n" +
      "  sortedQuestions.forEach((question, index) => {\n" +
      "    const answer = formData[question.field];\n" +
      "    let score = 0;\n" +
      "    let userAnswer = null;\n" +
      "\n" +
      "    if (answer && question.options) {\n" +
      "      const selectedOption = question.options.find(opt => opt.hash === answer);\n" +
      "      if (selectedOption) {\n" +
      "        const optionIndex = question.options.indexOf(selectedOption) + 1;\n" +
      "        const questionNumber = index + 1;\n" +
      "\n" +
      "        // 判断是否需要反向计分\n" +
      "        const isReverse = reverseQuestions.includes(questionNumber);\n" +
      "        score = isReverse ? (reverseScoreMap[optionIndex] || 0) : optionIndex;\n" +
      "\n" +
      "        if (score > 0) {\n" +
      "          answeredCount++;\n" +
      "          userAnswer = selectedOption.hash;\n" +
      "          itemScores[question.field] = score;\n" +
      "          rawScore += score;\n" +
      "        }\n" +
      "      }\n" +
      "    }\n" +
      "\n" +
      "    // 记录题目详情\n" +
      "    questionDetails.push({\n" +
      "      questionId: question.field,\n" +
      "      questionText: question.title ? question.title.replace(/<[^>]*>/g, '') : '题目' + (index + 1),\n" +
      "      questionType: question.type || 'single_choice',\n" +
      "      options: question.options || [],\n" +
      "      userAnswer: userAnswer,\n" +
      "      answerScore: score,\n" +
      "      isReverse: reverseQuestions.includes(index + 1)\n" +
      "    });\n" +
      "  });\n" +
      "\n" +
      "  // 计算标准分（粗分 × 1.25）\n" +
      "  const standardScore = Math.round(rawScore * 1.25);\n" +
      "\n" +
      "  // 判断焦虑等级\n" +
      "  let level = ANXIETY_LEVELS[0]; // 正常\n" +
      "  let interpretation = '';\n" +
      "  let recommendations = [];\n" +
      "\n" +
      "  if (standardScore < 50) {\n" +
      "    level = ANXIETY_LEVELS[0]; // 正常\n" +
      "    interpretation = '无明显焦虑症状，心理状态良好。';\n" +
      "    recommendations = ['保持良好的心理状态', '继续关注情绪变化', '适当运动和放松'];\n" +
      "  } else if (standardScore >= 50 && standardScore <= 59) {\n" +
      "    level = ANXIETY_LEVELS[1]; // 轻度焦虑\n" +
      "    interpretation = '可能存在轻度焦虑，建议适当调节。';\n" +
      "    recommendations = ['学习放松技巧', '调整作息时间', '与亲友交流', '必要时寻求咨询'];\n" +
      "  } else if (standardScore >= 60 && standardScore <= 69) {\n" +
      "    level = ANXIETY_LEVELS[2]; // 中度焦虑\n" +
      "    interpretation = '存在中度焦虑症状，建议寻求专业帮助。';\n" +
      "    recommendations = ['建议寻求心理咨询', '学习压力管理技巧', '考虑专业评估', '调整生活方式'];\n" +
      "  } else {\n" +
      "    level = ANXIETY_LEVELS[3]; // 重度焦虑\n" +
      "    interpretation = '存在重度焦虑症状，强烈建议立即寻求专业帮助。';\n" +
      "    recommendations = ['立即寻求专业心理治疗', '可能需要药物治疗', '进行全面心理健康评估', '建立支持系统'];\n" +
      "  }\n" +
      "\n" +
      "  // 返回标准格式结果\n" +
      "  const result = {\n" +
      "    success: true,\n" +
      "    rawScore: rawScore,\n" +
      "    standardScore: standardScore,\n" +
      "    level: level,\n" +
      "    levelArray: ANXIETY_LEVELS,\n" +
      "    interpretation: interpretation,\n" +
      "    recommendations: recommendations,\n" +
      "    factors: [{\n" +
      "      name: '焦虑症状',\n" +
      "      score: standardScore,\n" +
      "      interpretation: interpretation,\n" +
      "      level: level,\n" +
      "      levelArray: ANXIETY_LEVELS\n" +
      "    }],\n" +
      "    questions: questionDetails,\n" +
      "    metadata: {\n" +
      "      totalQuestions: 20,\n" +
      "      answeredQuestions: answeredCount,\n" +
      "      reverseItemsCount: reverseQuestions.length,\n" +
      "      completionTime: Date.now() - (formData.startTime || Date.now())\n" +
      "    },\n" +
      "    answeredCount: answeredCount,\n" +
      "    completionRate: Math.round((answeredCount / 20) * 100) + '%',\n" +
      "    itemScores: itemScores,\n" +
      "    timestamp: __timestamp(),\n" +
      "    scaleType: 'SAS焦虑自评量表'\n" +
      "  };\n" +
      "\n" +
      "  console.log('SAS计算结果:', result);\n" +
      "  return result;\n" +
      "});"
  },

  /**
   * 直接计算函数（用于服务端计算）
   */
  calculate: (formData: FormData, questions: Question[]): SASResult => {
    return safeCalculate<SASResult>(sasTemplate.metadata, () => {
      if (!sasTemplate.validate?.(questions)) {
        return createCalculationError(sasTemplate.metadata, '问卷不符合SAS要求') as any
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

      const standardScore = Math.round(rawScore * 1.25)

      // 判断焦虑等级
      let level: typeof SAS_ANXIETY_LEVELS[number] = SAS_ANXIETY_LEVELS[0]
      if (standardScore < 50) {
        level = SAS_ANXIETY_LEVELS[0] // 正常
      } else if (standardScore >= 50 && standardScore <= 59) {
        level = SAS_ANXIETY_LEVELS[1] // 轻度焦虑
      } else if (standardScore >= 60 && standardScore <= 69) {
        level = SAS_ANXIETY_LEVELS[2] // 中度焦虑
      } else {
        level = SAS_ANXIETY_LEVELS[3] // 重度焦虑
      }

      return {
        success: true,
        rawScore,
        standardScore,
        level,
        answeredCount,
        completionRate: calculateCompletionRate(answeredCount, 20),
        timestamp: generateTimestamp(),
        scaleType: 'SAS焦虑自评量表',
        itemScores
      }
    })
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
