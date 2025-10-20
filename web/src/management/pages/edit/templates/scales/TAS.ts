/**
 * TAS 多伦多述情障碍量表（TAS-26）
 * 说明：26题，5分量表；包含4个因子：描述情感的能力、认识和区分情感与躯体感受的能力、幻想、外向性思维
 */

import type { CalculateTemplate, Question, FormData } from '../types'
import { calculateCompletionRate, generateTimestamp, safeCalculate, createCalculationError, TAS26_ALEXITHYMIA_LEVELS } from '../utils'

export interface TASResult {
  success: boolean
  totalScore: number
  factorScores: {
    describingFeelings: number      // 描述情感的能力因子 (题目4,8,12,22,23,26)
    identifyingEmotions: number    // 认识和区分情感与躯体感受的能力因子 (题目1,3,10,14,17,20,25)
    daydreaming: number             // 幻想因子 (题目2,5,15,16,18)
    externalThinking: number       // 外向性思维因子 (题目6,7,9,11,13,19,21,24)
  }
  level: typeof TAS26_ALEXITHYMIA_LEVELS[number]
  answeredCount: number
  completionRate: string
  timestamp: string
  scaleType: string
  itemScores: { [key: string]: number }
}

/**
 * TAS-26因子题目分配
 */
const FACTOR_ITEMS = {
  describingFeelings: [4, 8, 12, 22, 23, 26],        // 描述情感的能力因子 (6题)
  identifyingEmotions: [1, 3, 10, 14, 17, 20, 25], // 认识和区分情感与躯体感受的能力因子 (7题)
  daydreaming: [2, 5, 15, 16, 18],                   // 幻想因子 (5题)
  externalThinking: [6, 7, 9, 11, 13, 19, 21, 24]   // 外向性思维因子 (8题)
}

/**
 * TAS-26反向计分题目编号
 * 这些题目需要反向计分（5分制：1->5, 2->4, 3->3, 4->2, 5->1）
 */
const REVERSE_ITEMS = {
  total: [1, 5, 9, 11, 13, 15, 16, 21, 24],        // 总反向题目
  identifyingEmotions: [1],                         // 因子2的反向题目
  daydreaming: [5, 15, 16],                         // 因子3的反向题目
  externalThinking: [9, 11, 13, 21, 24]            // 因子4的反向题目
}

/**
 * 因子名称映射
 */
const FACTOR_NAMES = {
  describingFeelings: '描述情感的能力',
  identifyingEmotions: '认识和区分情感与躯体感受的能力',
  daydreaming: '幻想',
  externalThinking: '外向性思维'
}

const tasTemplate: CalculateTemplate = {
  metadata: {
    id: 'tas26',
    name: '多伦多述情障碍量表(TAS-26)',
    description: '评估述情障碍特质的量表，包含4个因子共26个题目',
    version: '2.0.0',
    tags: ['心理健康', '述情障碍', 'TAS'],
    requiredQuestions: 26
  },

  generateCode: (questions?: Question[]): string => {
    // 预先定义常量
    const alexithymiaLevelsJson = JSON.stringify(TAS26_ALEXITHYMIA_LEVELS);
    const factorItemsJson = JSON.stringify(FACTOR_ITEMS);
    const reverseItemsJson = JSON.stringify(REVERSE_ITEMS);
    const factorNamesJson = JSON.stringify(FACTOR_NAMES);

    return "// TAS-26 多伦多述情障碍量表计算代码\n" +
      "// 统一辅助函数\n" +
      "const __timestamp = () => new Date().toISOString();\n" +
      "const __createCalculationError = (name, id, err) => ({ success: false, timestamp: __timestamp(), scaleType: name, error: { message: (err && err.message) || String(err) }});\n" +
      "const __safeCalculate = (name, id, fn) => { try { return fn() } catch (e) { return __createCalculationError(name, id, e) } };\n" +
      "\n" +
      "// 述情障碍等级定义\n" +
      "const ALEXITHYMIA_LEVELS = " + alexithymiaLevelsJson + ";\n" +
      "\n" +
      "// 反向计分映射（5分制：1->5, 2->4, 3->3, 4->2, 5->1）\n" +
      "const reverseScoreMap = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };\n" +
      "\n" +
      "// 因子题目分配\n" +
      "const FACTOR_ITEMS = " + factorItemsJson + ";\n" +
      "\n" +
      "// 反向计分题目\n" +
      "const REVERSE_ITEMS = " + reverseItemsJson + ";\n" +
      "\n" +
      "// 因子名称\n" +
      "const FACTOR_NAMES = " + factorNamesJson + ";" +

"\n" +
      "// 主计算逻辑\n" +
      "return __safeCalculate('多伦多述情障碍量表(TAS-26)', 'tas26', () => {\n" +
      "  // 题目排序\n" +
      "  const sortedQuestions = [...questions].sort((a, b) => {\n" +
      "    const numA = parseInt(a.field.replace(/[^0-9]/g, \"\"));\n" +
      "    const numB = parseInt(b.field.replace(/[^0-9]/g, \"\"));\n" +
      "    return numA - numB;\n" +
      "  });\n" +
      "\n" +
      "  // 验证题目数量\n" +
      "  if (sortedQuestions.length !== 26) {\n" +
      "    return __createCalculationError('多伦多述情障碍量表(TAS-26)', 'tas26', '题目数量应为26，实际为' + sortedQuestions.length);\n" +
      "  }\n" +
      "\n" +
      "  // 初始化变量\n" +
      "  let totalScore = 0;\n" +
      "  let answeredCount = 0;\n" +
      "  const itemScores = {};\n" +
      "  const questionDetails = [];\n" +
      "  const factorScores = {\n" +
      "    describingFeelings: 0,\n" +
      "    identifyingEmotions: 0,\n" +
      "    daydreaming: 0,\n" +
      "    externalThinking: 0\n" +
      "  };\n" +
      "\n" +
      "  // 遍历题目计算得分\n" +
      "  sortedQuestions.forEach((question, index) => {\n" +
      "    const answer = formData[question.field];\n" +
      "    let score = 0;\n" +
      "    let userAnswer = null;\n" +
      "    const questionNumber = index + 1;\n" +
      "\n" +
      "    if (answer !== null && answer !== undefined && answer !== '') {\n" +
      "      answeredCount++;\n" +
      "\n" +
      "      // 计算得分（5分制）\n" +
      "      if (question.options && question.options.length >= 5) {\n" +
      "        const selectedOption = question.options.find(opt => opt.hash === answer);\n" +
      "        if (selectedOption) {\n" +
      "          let optionIndex = question.options.indexOf(selectedOption) + 1;\n" +
      "\n" +
      "          // 判断是否需要反向计分\n" +
      "          const isReverse = REVERSE_ITEMS.total.includes(questionNumber);\n" +
      "          if (isReverse) {\n" +
      "            optionIndex = reverseScoreMap[optionIndex] || optionIndex;\n" +
      "          }\n" +
      "\n" +
      "          score = Math.max(1, Math.min(5, optionIndex));\n" +
      "          userAnswer = selectedOption.hash;\n" +
      "        }\n" +
      "      } else {\n" +
      "        score = parseInt(answer) || 0;\n" +
      "        userAnswer = answer;\n" +
      "\n" +
      "        // 对于非选项题型，也需要检查反向计分\n" +
      "        const isReverse = REVERSE_ITEMS.total.includes(questionNumber);\n" +
      "        if (isReverse && score >= 1 && score <= 5) {\n" +
      "          score = reverseScoreMap[score] || score;\n" +
      "        }\n" +
      "\n" +
      "        score = Math.max(1, Math.min(5, score));\n" +
      "      }\n" +
      "\n" +
      "      itemScores[question.field] = score;\n" +
      "      totalScore += score;\n" +
      "\n" +
      "      // 分配到各个因子\n" +
      "      Object.entries(FACTOR_ITEMS).forEach(([factorName, items]) => {\n" +
      "        if (items.includes(questionNumber)) {\n" +
      "          factorScores[factorName] += score;\n" +
      "        }\n" +
      "      });\n" +
      "    }\n" +
      "\n" +
      "    // 记录题目详情\n" +
      "    questionDetails.push({\n" +
      "      questionId: question.field,\n" +
      "      questionText: question.title ? question.title.replace(/<[^>]*>/g, '') : '题目' + questionNumber,\n" +
      "      questionType: question.type || 'single_choice',\n" +
      "      options: question.options || [],\n" +
      "      userAnswer: userAnswer,\n" +
      "      answerScore: score,\n" +
      "      isReverse: REVERSE_ITEMS.total.includes(questionNumber)\n" +
      "    });\n" +
      "  });\n" +
      "\n" +
      "  // 判断述情障碍等级（TAS-26的评分标准可能需要调整）\n" +
      "  let level = ALEXITHYMIA_LEVELS[0]; // 无述情障碍\n" +
      "  if (totalScore >= 78) level = ALEXITHYMIA_LEVELS[2]; // 述情障碍 (26*3=78)\n" +
      "  else if (totalScore >= 65) level = ALEXITHYMIA_LEVELS[1]; // 边缘 (26*2.5=65)\n" +
      "\n" +
      "  // 生成解释和建议\n" +
      "  let interpretation = '';\n" +
      "  let recommendations = [];\n" +
      "\n" +
      "  switch (level) {\n" +
      "    case ALEXITHYMIA_LEVELS[0]: // 无述情障碍\n" +
      "      interpretation = '无明显述情障碍特征，能够较好地识别和表达情感。';\n" +
      "      recommendations = ['保持良好的情感认知能力', '继续发展情感表达技巧'];\n" +
      "      break;\n" +
      "    case ALEXITHYMIA_LEVELS[1]: // 边缘\n" +
      "      interpretation = '可能存在轻微的述情障碍倾向，情感识别和表达有一定困难。';\n" +
      "      recommendations = ['关注情感体验', '练习情感表达', '考虑心理咨询'];\n" +
      "      break;\n" +
      "    case ALEXITHYMIA_LEVELS[2]: // 述情障碍\n" +
      "      interpretation = '存在明显的述情障碍特征，难以识别和表达情感。';\n" +
      "      recommendations = ['建议寻求专业心理评估', '参加情感识别训练', '学习情感表达技巧'];\n" +
      "      break;\n" +
      "  }\n" +
      "\n" +
      "  // 生成因子信息\n" +
      "  const factors = [];\n" +
      "  Object.entries(factorScores).forEach(([factorKey, score]) => {\n" +
      "    const factorName = FACTOR_NAMES[factorKey];\n" +
      "    let factorLevel = '正常';\n" +
      "\n" +
      "    // 根据因子得分判断等级（简化的判断逻辑）\n" +
      "    const maxScore = FACTOR_ITEMS[factorKey].length * 5;\n" +
      "    if (score >= maxScore * 0.8) factorLevel = '高';\n" +
      "    else if (score >= maxScore * 0.6) factorLevel = '中等';\n" +
      "\n" +
      "    factors.push({\n" +
      "      name: factorName,\n" +
      "      score: score,\n" +
      "      interpretation: factorName + '得分为' + score + '分，最高可能' + maxScore + '分。',\n" +
      "      level: factorLevel,\n" +
      "      levelArray: ['正常', '中等', '高']\n" +
      "    });\n" +
      "  });\n" +
      "\n" +
      "  // 返回标准格式结果\n" +
      "  const result = {\n" +
      "    success: true,\n" +
      "    totalScore: totalScore,\n" +
      "    standardScore: totalScore, // TAS-26使用原始分作为标准分\n" +
      "    level: level,\n" +
      "    levelArray: ALEXITHYMIA_LEVELS,\n" +
      "    interpretation: interpretation,\n" +
      "    recommendations: recommendations,\n" +
      "    factors: factors,\n" +
      "    questions: questionDetails,\n" +
      "    metadata: {\n" +
      "      totalQuestions: 26,\n" +
      "      answeredQuestions: answeredCount,\n" +
      "      factorStructure: FACTOR_NAMES,\n" +
      "      completionTime: Date.now() - (formData.startTime || Date.now())\n" +
      "    },\n" +
      "    factorScores: factorScores,\n" +
      "    answeredCount: answeredCount,\n" +
      "    completionRate: Math.round((answeredCount / 26) * 100) + '%',\n" +
      "    itemScores: itemScores,\n" +
      "    timestamp: __timestamp(),\n" +
      "    scaleType: '多伦多述情障碍量表(TAS-26)'\n" +
      "  };\n" +
      "\n" +
      "  console.log('TAS-26计算结果:', result);\n" +
      "  return result;\n" +
      "});"
  },

  calculate: (formData: FormData, questions: Question[]): TASResult => {
    return safeCalculate<TASResult>(tasTemplate.metadata, () => {
      if (!questions || questions.length !== 26) {
        return createCalculationError(tasTemplate.metadata, '题目数量应为26') as any
      }

      // 反向计分映射
      const reverseScoreMap: Record<number, number> = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 }

      let totalScore = 0
      let answeredCount = 0
      const itemScores: Record<string, number> = {}
      const factorScores = {
        describingFeelings: 0,
        identifyingEmotions: 0,
        daydreaming: 0,
        externalThinking: 0
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

        if (answer !== null && answer !== undefined && answer !== '') {
          answeredCount++

          // 计算得分（5分制）
          if (question.options && question.options.length >= 5) {
            const selectedOption = question.options.find(opt => opt.hash === answer)
            if (selectedOption) {
              let optionIndex = question.options.indexOf(selectedOption) + 1

              // 判断是否需要反向计分
              const isReverse = REVERSE_ITEMS.total.includes(questionNumber)
              if (isReverse) {
                optionIndex = reverseScoreMap[optionIndex] || optionIndex
              }

              score = Math.max(1, Math.min(5, optionIndex))
            }
          } else {
            score = parseInt(answer as string) || 0

            // 对于非选项题型，也需要检查反向计分
            const isReverse = REVERSE_ITEMS.total.includes(questionNumber)
            if (isReverse && score >= 1 && score <= 5) {
              score = reverseScoreMap[score] || score
            }

            score = Math.max(1, Math.min(5, score))
          }

          itemScores[question.field] = score
          totalScore += score

          // 分配到各个因子
          Object.entries(FACTOR_ITEMS).forEach(([factorName, items]) => {
            if (items.includes(questionNumber)) {
              (factorScores as any)[factorName] += score
            }
          })
        }
      })

      // 判断述情障碍等级
      let level: typeof TAS26_ALEXITHYMIA_LEVELS[number] = TAS26_ALEXITHYMIA_LEVELS[0]
      if (totalScore >= 78) level = TAS26_ALEXITHYMIA_LEVELS[2] // 述情障碍 (26*3=78)
      else if (totalScore >= 65) level = TAS26_ALEXITHYMIA_LEVELS[1] // 边缘 (26*2.5=65)

      return {
        success: true,
        totalScore: totalScore,
        factorScores: factorScores,
        level,
        answeredCount: answeredCount,
        completionRate: calculateCompletionRate(answeredCount, 26),
        timestamp: generateTimestamp(),
        scaleType: '多伦多述情障碍量表(TAS-26)',
        itemScores
      }
    })
  },

  validate: (questions: Question[]): boolean => {
    if (!questions || questions.length !== 26) return false
    for (const q of questions) { if (!q.options || q.options.length < 5) return false }
    return true
  }
}

export default tasTemplate
