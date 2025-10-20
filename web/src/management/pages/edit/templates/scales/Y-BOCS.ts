/**
 * Y-BOCS 耶鲁-布朗强迫症状量表（示例实现）
 * 说明：10题，每题0-4分，总分 0-40。四档严重度：轻度/中度/重度/极重。
 */

import type { CalculateTemplate, Question, FormData } from '../types'
import { calculateCompletionRate, generateTimestamp, safeCalculate, createCalculationError, YBOCS_SEVERITY_LEVELS } from '../utils'
import { YBOCS_NORMS } from '../norms'

export interface YBOCSResult {
  success: boolean
  totalScore: number
  severity: typeof YBOCS_SEVERITY_LEVELS[number]
  answeredCount: number
  completionRate: string
  timestamp: string
  scaleType: string
  itemScores: { [key: string]: number }
}

const ybocsTemplate: CalculateTemplate = {
  metadata: {
    id: 'ybocs',
    name: '耶鲁-布朗强迫症状量表(Y-BOCS)',
    description: '评估强迫症状严重程度的量表，示例实现包含10个0-4分条目',
    version: '1.0.0',
    tags: ['心理健康', '强迫', 'Y-BOCS'],
    requiredQuestions: 10
  },

  generateCode: (questions?: Question[]): string => {
    // 预先定义常量
    const severityLevelsJson = JSON.stringify(YBOCS_SEVERITY_LEVELS);

    return "// Y-BOCS 耶鲁-布朗强迫症状量表计算代码\n" +
      "// 统一辅助函数\n" +
      "const __timestamp = () => new Date().toISOString();\n" +
      "const __createCalculationError = (name, id, err) => ({ success: false, timestamp: __timestamp(), scaleType: name, error: { message: (err && err.message) || String(err) }});\n" +
      "const __safeCalculate = (name, id, fn) => { try { return fn() } catch (e) { return __createCalculationError(name, id, e) } };\n" +
      "\n" +
      "// 严重程度等级定义\n" +
      "const SEVERITY_LEVELS = " + severityLevelsJson + ";\n" +
      "\n" +
      "// 主计算逻辑\n" +
      "return __safeCalculate('耶鲁-布朗强迫症状量表(Y-BOCS)', 'ybocs', () => {\n" +
      "  // 题目排序\n" +
      "  const sortedQuestions = [...questions].sort((a, b) => {\n" +
      "    const numA = parseInt(a.field.replace(/[^0-9]/g, \"\"));\n" +
      "    const numB = parseInt(b.field.replace(/[^0-9]/g, \"\"));\n" +
      "    return numA - numB;\n" +
      "  });\n" +
      "\n" +
      "  // 验证题目数量\n" +
      "  if (sortedQuestions.length !== 10) {\n" +
      "    return __createCalculationError('耶鲁-布朗强迫症状量表(Y-BOCS)', 'ybocs', '题目数量应为10，实际为' + sortedQuestions.length);\n" +
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
      "\n" +
      "      // 计算得分\n" +
      "      if (question.options && question.options.length >= 5) {\n" +
      "        const selectedOption = question.options.find(opt => opt.hash === answer);\n" +
      "        if (selectedOption) {\n" +
      "          score = question.options.indexOf(selectedOption);\n" +
      "          userAnswer = selectedOption.hash;\n" +
      "        }\n" +
      "      } else {\n" +
      "        score = parseInt(answer) || 0;\n" +
      "        userAnswer = answer;\n" +
      "      }\n" +
      "\n" +
      "      // 限制得分范围\n" +
      "      score = Math.max(0, Math.min(4, score));\n" +
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
      "      answerScore: score\n" +
      "    });\n" +
      "  });\n" +
      "\n" +
      "  // 判断严重程度\n" +
      "  let severity = SEVERITY_LEVELS[0]; // 轻度\n" +
      "  if (totalScore >= 24) severity = SEVERITY_LEVELS[3]; // 极重\n" +
      "  else if (totalScore >= 16) severity = SEVERITY_LEVELS[2]; // 重度\n" +
      "  else if (totalScore >= 8) severity = SEVERITY_LEVELS[1]; // 中度\n" +
      "\n" +
      "  // 生成解释和建议\n" +
      "  let interpretation = '';\n" +
      "  let recommendations = [];\n" +
      "\n" +
      "  switch (severity) {\n" +
      "    case SEVERITY_LEVELS[0]: // 轻度\n" +
      "      interpretation = '强迫症状轻微，对日常生活影响较小。';\n" +
      "      recommendations = ['继续观察', '保持良好作息', '适当放松训练'];\n" +
      "      break;\n" +
      "    case SEVERITY_LEVELS[1]: // 中度\n" +
      "      interpretation = '强迫症状中等，可能对日常生活造成一定影响。';\n" +
      "      recommendations = ['建议寻求专业评估', '学习应对策略', '考虑心理治疗'];\n" +
      "      break;\n" +
      "    case SEVERITY_LEVELS[2]: // 重度\n" +
      "      interpretation = '强迫症状严重，明显影响日常生活功能。';\n" +
      "      recommendations = ['需要专业治疗', '药物治疗可能必要', '系统性心理治疗'];\n" +
      "      break;\n" +
      "    case SEVERITY_LEVELS[3]: // 极重\n" +
      "      interpretation = '强迫症状极重，严重影响日常生活功能。';\n" +
      "      recommendations = ['立即寻求专业帮助', '综合治疗方案', '密切监测病情变化'];\n" +
      "      break;\n" +
      "  }\n" +
      "\n" +
      "  // 返回标准格式结果\n" +
      "  const result = {\n" +
      "    success: true,\n" +
      "    totalScore: totalScore,\n" +
      "    standardScore: totalScore, // Y-BOCS使用原始分作为标准分\n" +
      "    level: severity,\n" +
      "    levelArray: SEVERITY_LEVELS,\n" +
      "    interpretation: interpretation,\n" +
      "    recommendations: recommendations,\n" +
      "    factors: [{\n" +
      "      name: '强迫症状',\n" +
      "      score: totalScore,\n" +
      "      interpretation: interpretation,\n" +
      "      level: severity,\n" +
      "      levelArray: SEVERITY_LEVELS\n" +
      "    }],\n" +
      "    questions: questionDetails,\n" +
      "    metadata: {\n" +
      "      totalQuestions: 10,\n" +
      "      answeredQuestions: answeredCount,\n" +
      "      completionTime: Date.now() - (formData.startTime || Date.now())\n" +
      "    },\n" +
      "    answeredCount: answeredCount,\n" +
      "    completionRate: Math.round((answeredCount / 10) * 100) + '%',\n" +
      "    itemScores: itemScores,\n" +
      "    timestamp: __timestamp(),\n" +
      "    scaleType: '耶鲁-布朗强迫症状量表(Y-BOCS)'\n" +
      "  };\n" +
      "\n" +
      "  console.log('Y-BOCS计算结果:', result);\n" +
      "  return result;\n" +
      "});"
  },

  calculate: (formData: FormData, questions: Question[]): YBOCSResult => {
    return safeCalculate<YBOCSResult>(ybocsTemplate.metadata, () => {
      if (!questions || questions.length !== 10) {
        return createCalculationError(ybocsTemplate.metadata, '题目数量应为10') as any
      }
      let total = 0
      let answered = 0
      const itemScores: Record<string, number> = {}
      const sorted = [...questions].sort((a,b)=>{
        const na=parseInt(a.field.replace(/[^0-9]/g,''));
        const nb=parseInt(b.field.replace(/[^0-9]/g,''));
        return na-nb
      })

      sorted.forEach(q => {
        const ans = formData[q.field]
        if (ans !== null && ans !== undefined && ans !== '') {
          answered++
          let score = 0
          if (q.options && q.options.length >= 5) {
            const sel = q.options.find(o => o.hash === ans)
            if (sel) score = q.options.indexOf(sel)
          } else {
            score = parseInt(ans as string) || 0
          }
          score = Math.max(0, Math.min(4, score))
          itemScores[q.field] = score
          total += score
        }
      })

      let severity: typeof YBOCS_SEVERITY_LEVELS[number] = YBOCS_SEVERITY_LEVELS[0]
      if (total >= 24) severity = YBOCS_SEVERITY_LEVELS[3]
      else if (total >= 16) severity = YBOCS_SEVERITY_LEVELS[2]
      else if (total >= 8) severity = YBOCS_SEVERITY_LEVELS[1]

      return {
        success: true,
        totalScore: total,
        severity,
        answeredCount: answered,
        completionRate: calculateCompletionRate(answered, 10),
        timestamp: generateTimestamp(),
        scaleType: '耶鲁-布朗强迫症状量表(Y-BOCS)',
        itemScores
      }
    })
  },

  validate: (questions: Question[]): boolean => {
    if (!questions || questions.length !== 10) return false
    for (const q of questions) { if (!q.options || q.options.length < 5) return false }
    return true
  }
}

export default ybocsTemplate
