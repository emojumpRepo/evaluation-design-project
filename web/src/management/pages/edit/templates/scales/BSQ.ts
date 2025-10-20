/**
 * BSQ（12题，0-5计分）
 * 计分：答案0→0分，…，5→5分；总分=12题得分和（范围0-60）
 * 分级：
 *   - 0-15：可能单相抑郁
 *   - 16-24：可能抑郁或轻双相（重抑郁轻躁狂）
 *   - 25-60：可能双相情感障碍
 * 输出：总分、分级、>=阈值(默认4)的高分题目列表（题号、field、答案、得分）
 */

import type { CalculateTemplate, Question, FormData } from '../types'
import { calculateCompletionRate, generateTimestamp, safeCalculate, createCalculationError, BSQ12_LEVELS } from '../utils'

export interface BSQ12Result {
  success: boolean
  totalScore: number
  category: typeof BSQ12_LEVELS[number]
  highItemThreshold: number
  highItems: Array<{ index: number; field: string; answer: string; score: number }>
  answeredCount: number
  completionRate: string
  timestamp: string
  scaleType: string
  itemScores: { [key: string]: number }
}

const HIGH_ITEM_THRESHOLD = 4 // 可按需调整

const scoreFromAnswer = (q: Question, ans: any): number => {
  if (ans === null || ans === undefined || ans === '') return 0
  if (q.options && q.options.length >= 6) {
    const sel = q.options.find(o => o.hash === ans)
    if (sel) return Math.max(0, Math.min(5, q.options.indexOf(sel)))
  }
  const n = parseInt(ans as string)
  if (!isNaN(n)) return Math.max(0, Math.min(5, n))
  return 0
}

const bsqTemplate: CalculateTemplate = {
  metadata: {
    id: 'bsq',
    name: '双相情感障碍筛查（12题版）',
    description: '0-5计分，总分0-60；按指定阈值分级并列出高分题目',
    version: '1.1.0',
    tags: ['心理健康', '双相', '筛查'],
    requiredQuestions: 12
  },

  generateCode: (questions?: Question[]): string => {
    // 预先定义常量
    const riskLevelsJson = JSON.stringify(BSQ12_LEVELS);
    const highItemThresholdValue = HIGH_ITEM_THRESHOLD;

    return "// BSQ 双相情感障碍筛查量表计算代码\n" +
      "// 统一辅助函数\n" +
      "const __timestamp = () => new Date().toISOString();\n" +
      "const __createCalculationError = (name, id, err) => ({ success: false, timestamp: __timestamp(), scaleType: name, error: { message: (err && err.message) || String(err) }});\n" +
      "const __safeCalculate = (name, id, fn) => { try { return fn() } catch (e) { return __createCalculationError(name, id, e) } };\n" +
      "\n" +
      "// 风险等级定义\n" +
      "const RISK_LEVELS = " + riskLevelsJson + ";\n" +
      "const HIGH_ITEM_THRESHOLD = " + highItemThresholdValue + ";\n" +
      "\n" +
      "// 主计算逻辑\n" +
      "return __safeCalculate('双相情感障碍筛查（12题版）', 'bsq', () => {\n" +
      "  // 题目排序\n" +
      "  const sortedQuestions = [...questions].sort((a, b) => {\n" +
      "    const numA = parseInt(a.field.replace(/[^0-9]/g, \"\"));\n" +
      "    const numB = parseInt(b.field.replace(/[^0-9]/g, \"\"));\n" +
      "    return numA - numB;\n" +
      "  });\n" +
      "\n" +
      "  // 验证题目数量\n" +
      "  if (sortedQuestions.length !== 12) {\n" +
      "    return __createCalculationError('双相情感障碍筛查（12题版）', 'bsq', '题目数量应为12，实际为' + sortedQuestions.length);\n" +
      "  }\n" +
      "\n" +
      "  // 初始化变量\n" +
      "  let totalScore = 0;\n" +
      "  let answeredCount = 0;\n" +
      "  const itemScores = {};\n" +
      "  const highItems = [];\n" +
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
      "\n" +
      "      // 计算得分（0-5分制）\n" +
      "      if (question.options && question.options.length >= 6) {\n" +
      "        const selectedOption = question.options.find(opt => opt.hash === answer);\n" +
      "        if (selectedOption) {\n" +
      "          score = Math.max(0, Math.min(5, question.options.indexOf(selectedOption)));\n" +
      "          userAnswer = selectedOption.hash;\n" +
      "        }\n" +
      "      } else {\n" +
      "        score = Math.max(0, Math.min(5, parseInt(answer) || 0));\n" +
      "        userAnswer = answer;\n" +
      "      }\n" +
      "\n" +
      "      itemScores[question.field] = score;\n" +
      "      totalScore += score;\n" +
      "\n" +
      "      // 记录高分题目\n" +
      "      if (score >= HIGH_ITEM_THRESHOLD) {\n" +
      "        highItems.push({\n" +
      "          index: index + 1,\n" +
      "          field: question.field,\n" +
      "          answer: userAnswer,\n" +
      "          score: score\n" +
      "        });\n" +
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
      "      answerScore: score\n" +
      "    });\n" +
      "  });\n" +
      "\n" +
      "  // 判断风险等级\n" +
      "  let category = RISK_LEVELS[0]; // 可能单相抑郁\n" +
      "  if (totalScore >= 25) category = RISK_LEVELS[2]; // 可能双相情感障碍\n" +
      "  else if (totalScore >= 16) category = RISK_LEVELS[1]; // 可能抑郁或轻双相\n" +
      "\n" +
      "  // 生成解释和建议\n" +
      "  let interpretation = '';\n" +
      "  let recommendations = [];\n" +
      "\n" +
      "  switch (category) {\n" +
      "    case RISK_LEVELS[0]: // 可能单相抑郁\n" +
      "      interpretation = '得分较低，主要表现为单相抑郁特征。';\n" +
      "      recommendations = ['关注抑郁症状', '定期情绪评估', '保持良好作息'];\n" +
      "      break;\n" +
      "    case RISK_LEVELS[1]: // 可能抑郁或轻双相\n" +
      "      interpretation = '得分中等，可能存在抑郁或轻双相情感障碍特征。';\n" +
      "      recommendations = ['建议专业心理评估', '监测情绪波动', '考虑心理咨询'];\n" +
      "      break;\n" +
      "    case RISK_LEVELS[2]: // 可能双相情感障碍\n" +
      "      interpretation = '得分较高，存在双相情感障碍的可能性较大。';\n" +
      "      recommendations = ['建议精神科专业评估', '系统治疗方案', '密切监测病情变化'];\n" +
      "      break;\n" +
      "  }\n" +
      "\n" +
      "  // 返回标准格式结果\n" +
      "  const result = {\n" +
      "    success: true,\n" +
      "    totalScore: totalScore,\n" +
      "    standardScore: totalScore, // BSQ使用原始分作为标准分\n" +
      "    level: category,\n" +
      "    levelArray: RISK_LEVELS,\n" +
      "    interpretation: interpretation,\n" +
      "    recommendations: recommendations,\n" +
      "    factors: [{\n" +
      "      name: '双相风险',\n" +
      "      score: totalScore,\n" +
      "      interpretation: interpretation,\n" +
      "      level: category,\n" +
      "      levelArray: RISK_LEVELS\n" +
      "    }],\n" +
      "    questions: questionDetails,\n" +
      "    metadata: {\n" +
      "      totalQuestions: 12,\n" +
      "      answeredQuestions: answeredCount,\n" +
      "      highItemThreshold: HIGH_ITEM_THRESHOLD,\n" +
      "      highItemsCount: highItems.length,\n" +
      "      completionTime: Date.now() - (formData.startTime || Date.now())\n" +
      "    },\n" +
      "    highItemThreshold: HIGH_ITEM_THRESHOLD,\n" +
      "    highItems: highItems,\n" +
      "    answeredCount: answeredCount,\n" +
      "    completionRate: Math.round((answeredCount / 12) * 100) + '%',\n" +
      "    itemScores: itemScores,\n" +
      "    timestamp: __timestamp(),\n" +
      "    scaleType: '双相情感障碍筛查（12题版）'\n" +
      "  };\n" +
      "\n" +
      "  console.log('BSQ计算结果:', result);\n" +
      "  return result;\n" +
      "});"
  },

  calculate: (formData: FormData, questions: Question[]): BSQ12Result => {
    return safeCalculate<BSQ12Result>(bsqTemplate.metadata, () => {
      if (!Array.isArray(questions) || questions.length !== 12) {
        return createCalculationError(bsqTemplate.metadata, '题目数量应为12') as any
      }
      let total = 0
      let answered = 0
      const itemScores: Record<string, number> = {}
      const highItems: Array<{ index: number; field: string; answer: string; score: number }> = []

      questions.forEach((q, idx) => {
        const ans = formData[q.field]
        const score = scoreFromAnswer(q, ans)
        if (ans !== null && ans !== undefined && ans !== '') answered++
        itemScores[q.field] = score
        total += score
        if (score >= HIGH_ITEM_THRESHOLD) {
          const answerText = (q.options && q.options.find(o=>o.hash===ans)?.text) || String(ans ?? '')
          highItems.push({ index: idx + 1, field: q.field, answer: answerText, score })
        }
      })

      let category: typeof BSQ12_LEVELS[number] = BSQ12_LEVELS[0]
      if (total >= 25) category = BSQ12_LEVELS[2]
      else if (total >= 16) category = BSQ12_LEVELS[1]

      return {
        success: true,
        totalScore: total,
        category,
        highItemThreshold: HIGH_ITEM_THRESHOLD,
        highItems,
        answeredCount: answered,
        completionRate: calculateCompletionRate(answered, 12),
        timestamp: generateTimestamp(),
        scaleType: '双相情感障碍筛查（12题版）',
        itemScores
      }
    })
  },

  validate: (questions: Question[]): boolean => {
    if (!Array.isArray(questions) || questions.length !== 12) return false
    // 允许：6选项(0-5)或可解析为0-5的自由输入
    return true
  }
}

export default bsqTemplate
