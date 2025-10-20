/**
 * ITS 人际信任量表（示例实现）
 * 说明：使用 5 分量表（1-5）求平均分，映射到低/中/高信任。
 */

import type { CalculateTemplate, Question, FormData } from '../types'
import { calculateCompletionRate, generateTimestamp, safeCalculate, createCalculationError, ITS_TRUST_LEVELS, getOptionScore, reverseScoreMap5 } from '../utils'

export interface ITSResult {
  success: boolean
  totalScore: number
  averageScore: number
  trustLevel: typeof ITS_TRUST_LEVELS[number]
  answeredCount: number
  completionRate: string
  timestamp: string
  scaleType: string
  itemScores: { [key: string]: number }
}

// 反向计分题号（1-based）
const REVERSE_QUESTIONS = [1,2,3,4,5,7,9,10,11,13,15,19,24]

const itsTemplate: CalculateTemplate = {
  metadata: {
    id: 'its',
    name: '人际信任量表(ITS)',
    description: '评估个体对他人的一般人际信任水平（25题版，含反向计分）',
    version: '1.0.0',
    tags: ['人际关系', '信任', 'ITS']
  },

  generateCode: (questions?: Question[]): string => {
    // 预先定义常量
    const trustLevelsJson = JSON.stringify(ITS_TRUST_LEVELS);
    const reverseQuestionsArray = REVERSE_QUESTIONS.join(',');

    return "// ITS 人际信任量表计算代码\n" +
      "// 统一辅助函数\n" +
      "const __timestamp = () => new Date().toISOString();\n" +
      "const __createCalculationError = (name, id, err) => ({ success: false, timestamp: __timestamp(), scaleType: name, error: { message: (err && err.message) || String(err) }});\n" +
      "const __safeCalculate = (name, id, fn) => { try { return fn() } catch (e) { return __createCalculationError(name, id, e) } };\n" +
      "\n" +
      "// 信任等级定义\n" +
      "const TRUST_LEVELS = " + trustLevelsJson + ";\n" +
      "const reverseScoreMap = {1:5,2:4,3:3,4:2,5:1};\n" +
      "const REVERSE_QUESTIONS = [" + reverseQuestionsArray + "];\n" +
      "\n" +
      "// 主计算逻辑\n" +
      "return __safeCalculate('人际信任量表(ITS)', 'its', () => {\n" +
      "  // 题目排序\n" +
      "  const sortedQuestions = [...questions].sort((a, b) => {\n" +
      "    const numA = parseInt(a.field.replace(/[^0-9]/g, \"\"));\n" +
      "    const numB = parseInt(b.field.replace(/[^0-9]/g, \"\"));\n" +
      "    return numA - numB;\n" +
      "  });\n" +
      "\n" +
      "  // 验证题目数量\n" +
      "  if (sortedQuestions.length !== 25) {\n" +
      "    return __createCalculationError('人际信任量表(ITS)', 'its', '题目数量应为25，实际为' + sortedQuestions.length);\n" +
      "  }\n" +
      "\n" +
      "  // 初始化变量\n" +
      "  let totalScore = 0;\n" +
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
      "    if (answer !== null && answer !== undefined && answer !== '') {\n" +
      "      answeredCount++;\n" +
      "      const questionNumber = index + 1;\n" +
      "      const isReverse = REVERSE_QUESTIONS.includes(questionNumber);\n" +
      "\n" +
      "      // 计算得分（5分制，含反向计分）\n" +
      "      if (question.options && question.options.length >= 5) {\n" +
      "        const selectedOption = question.options.find(opt => opt.hash === answer);\n" +
      "        if (selectedOption) {\n" +
      "          const optionIndex = question.options.indexOf(selectedOption) + 1;\n" +
      "          score = isReverse ? (reverseScoreMap[optionIndex] || 0) : optionIndex;\n" +
      "          userAnswer = selectedOption.hash;\n" +
      "        }\n" +
      "      } else {\n" +
      "        score = parseInt(answer) || 0;\n" +
      "        userAnswer = answer;\n" +
      "      }\n" +
      "\n" +
      "      // 限制得分范围\n" +
      "      score = Math.max(1, Math.min(5, score));\n" +
      "      itemScores[question.field] = score;\n" +
      "      totalScore += score;\n" +
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
      "      isReverse: REVERSE_QUESTIONS.includes(index + 1)\n" +
      "    });\n" +
      "  });\n" +
      "\n" +
      "  // 计算平均分\n" +
      "  const averageScore = answeredCount > 0 ? Math.round((totalScore / answeredCount) * 100) / 100 : 0;\n" +
      "\n" +
      "  // 判断信任等级\n" +
      "  let trustLevel = TRUST_LEVELS[1]; // 中等信任\n" +
      "  if (averageScore < 2.5) trustLevel = TRUST_LEVELS[0]; // 低信任\n" +
      "  else if (averageScore >= 3.5) trustLevel = TRUST_LEVELS[2]; // 高信任\n" +
      "\n" +
      "  // 生成解释和建议\n" +
      "  let interpretation = '';\n" +
      "  let recommendations = [];\n" +
      "\n" +
      "  switch (trustLevel) {\n" +
      "    case TRUST_LEVELS[0]: // 低信任\n" +
      "      interpretation = '对他人的信任度较低，可能存在较多防备心理。';\n" +
      "      recommendations = ['探索信任问题的根源', '尝试建立安全的人际关系', '考虑心理咨询'];\n" +
      "      break;\n" +
      "    case TRUST_LEVELS[1]: // 中等信任\n" +
      "      interpretation = '对他人的信任度适中，能够保持合理的信任和防备平衡。';\n" +
      "      recommendations = ['继续保持平衡的信任态度', '根据具体情境调整信任度', '发展健康的人际边界'];\n" +
      "      break;\n" +
      "    case TRUST_LEVELS[2]: // 高信任\n" +
      "      interpretation = '对他人的信任度较高，倾向于相信他人。';\n" +
      "      recommendations = ['保持积极的人际态度', '同时注意保护自己', '培养辨别能力'];\n" +
      "      break;\n" +
      "  }\n" +
      "\n" +
      "  // 返回标准格式结果\n" +
      "  const result = {\n" +
      "    success: true,\n" +
      "    totalScore: totalScore,\n" +
      "    standardScore: averageScore, // ITS使用平均分作为标准分\n" +
      "    level: trustLevel,\n" +
      "    levelArray: TRUST_LEVELS,\n" +
      "    interpretation: interpretation,\n" +
      "    recommendations: recommendations,\n" +
      "    factors: [{\n" +
      "      name: '人际信任',\n" +
      "      score: averageScore,\n" +
      "      interpretation: interpretation,\n" +
      "      level: trustLevel,\n" +
      "      levelArray: TRUST_LEVELS\n" +
      "    }],\n" +
      "    questions: questionDetails,\n" +
      "    metadata: {\n" +
      "      totalQuestions: 25,\n" +
      "      answeredQuestions: answeredCount,\n" +
      "      reverseItemsCount: REVERSE_QUESTIONS.length,\n" +
      "      completionTime: Date.now() - (formData.startTime || Date.now())\n" +
      "    },\n" +
      "    averageScore: averageScore,\n" +
      "    trustLevel: trustLevel,\n" +
      "    answeredCount: answeredCount,\n" +
      "    completionRate: Math.round((answeredCount / 25) * 100) + '%',\n" +
      "    itemScores: itemScores,\n" +
      "    timestamp: __timestamp(),\n" +
      "    scaleType: '人际信任量表(ITS)'\n" +
      "  };\n" +
      "\n" +
      "  console.log('ITS计算结果:', result);\n" +
      "  return result;\n" +
      "});"
  },

  calculate: (formData: FormData, questions: Question[]): ITSResult => {
    return safeCalculate<ITSResult>(itsTemplate.metadata, () => {
      if (!questions || questions.length === 0) {
        return createCalculationError(itsTemplate.metadata, '题目不能为空') as any
      }
      let total = 0
      let answered = 0
      const itemScores: Record<string, number> = {}

      const sorted = [...questions].sort((a,b)=>parseInt(a.field.replace(/[^0-9]/g,'')) - parseInt(b.field.replace(/[^0-9]/g,'')))
      sorted.forEach((q, idx) => {
        const ans = formData[q.field]
        if (ans !== null && ans !== undefined && ans !== '') {
          answered++
          const qn = idx + 1
          let score = 0
          if (q.options && q.options.length >= 5) {
            const isReverse = REVERSE_QUESTIONS.includes(qn)
            score = getOptionScore(q, ans, isReverse, isReverse ? reverseScoreMap5 : undefined)
          } else {
            score = parseInt(ans as string) || 0
          }
          score = Math.max(1, Math.min(5, score))
          itemScores[q.field] = score
          total += score
        }
      })

      const avgScore = answered > 0 ? total / answered : 0
      const trustLevel = avgScore < 2.5 ? ITS_TRUST_LEVELS[0] : (avgScore < 3.5 ? ITS_TRUST_LEVELS[1] : ITS_TRUST_LEVELS[2])

      return {
        success: true,
        totalScore: total,
        averageScore: Math.round(avgScore * 100) / 100,
        trustLevel,
        answeredCount: answered,
        completionRate: calculateCompletionRate(answered, questions.length || 0),
        timestamp: generateTimestamp(),
        scaleType: '人际信任量表(ITS)',
        itemScores
      }
    })
  },

  validate: (questions: Question[]): boolean => {
    if (!questions || questions.length !== 25) return false
    for (const q of questions) {
      if (!q.options || q.options.length < 5) return false
    }
    return true
  }
}

export default itsTemplate
