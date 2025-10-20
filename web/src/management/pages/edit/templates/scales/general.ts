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

    let template = "// 通用计算模板\n" +
      "// 基于当前问卷的题目结构自动生成\n" +
      "\n" +
      "// 工具函数\n" +
      "const sum = (array) => array.reduce((acc, val) => acc + val, 0);\n" +
      "const avg = (array) => array.length === 0 ? 0 : sum(array) / array.length;\n" +
      "const min = (array) => array.length === 0 ? 0 : Math.min(...array);\n" +
      "const max = (array) => array.length === 0 ? 0 : Math.max(...array);\n" +
      "\n"

    if (hasScoreQuestions || hasRadioStar) {
      template += "// 初始化分数统计\n" +
        "let totalScore = 0;\n" +
        "const scores = {};\n" +
        "const categoryScores = {}; // 分类分数\n" +
        "let answeredCount = 0;\n" +
        "\n" +
        "// 遍历所有题目计算分数\n" +
        "questions.forEach(question => {\n" +
        "  const answer = formData[question.field];\n" +
        "  \n" +
        "  if (answer !== null && answer !== undefined && answer !== \"\") {\n" +
        "    answeredCount++;\n" +
        "    \n" +
        "    // 处理不同题型\n" +
        "    const questionType = question.type?.toUpperCase();\n" +
        "    \n" +
        "    switch (questionType) {\n" +
        "      case 'RADIO':\n" +
        "      case 'SELECT':\n" +
        "        // 单选题分数计算\n" +
        "        if (question.options) {\n" +
        "          const option = question.options.find(opt => opt.hash === answer);\n" +
        "          if (option && option.score !== undefined) {\n" +
        "            const score = Number(option.score);\n" +
        "            scores[question.field] = score;\n" +
        "            totalScore += score;\n" +
        "          }\n" +
        "        }\n" +
        "        break;\n" +
        "        \n" +
        "      case 'CHECKBOX':\n" +
        "      case 'VOTE':\n" +
        "        // 多选题分数计算\n" +
        "        if (Array.isArray(answer) && question.options) {\n" +
        "          let questionScore = 0;\n" +
        "          answer.forEach(hash => {\n" +
        "            const option = question.options.find(opt => opt.hash === hash);\n" +
        "            if (option && option.score !== undefined) {\n" +
        "              questionScore += Number(option.score);\n" +
        "            }\n" +
        "          });\n" +
        "          scores[question.field] = questionScore;\n" +
        "          totalScore += questionScore;\n" +
        "        }\n" +
        "        break;\n" +
        "        \n" +
        "      case 'RADIO_STAR':\n" +
        "        // 评分题直接取值\n" +
        "        const starScore = Number(answer);\n" +
        "        scores[question.field] = starScore;\n" +
        "        totalScore += starScore;\n" +
        "        break;\n" +
        "    }\n" +
        "  }\n" +
        "});\n" +
        "\n" +
        "// 计算平均分\n" +
        "const avgScore = answeredCount > 0 ? (totalScore / answeredCount).toFixed(2) : 0;\n" +
        "\n" +
        "// 分数等级判定\n" +
        "let level = '';\n" +
        "let interpretation = '';\n" +
        "\n" +
        "if (totalScore >= 80) {\n" +
        "  level = '优秀';\n" +
        "  interpretation = '表现非常出色';\n" +
        "} else if (totalScore >= 60) {\n" +
        "  level = '良好';\n" +
        "  interpretation = '表现良好';\n" +
        "} else if (totalScore >= 40) {\n" +
        "  level = '中等';\n" +
        "  interpretation = '表现一般';\n" +
        "} else {\n" +
        "  level = '需改进';\n" +
        "  interpretation = '还有提升空间';\n" +
        "}\n"
    } else {
      template += "// 统计答题情况\n" +
        "let answeredCount = 0;\n" +
        "const answers = {};\n" +
        "\n" +
        "// 遍历所有题目\n" +
        "questions.forEach(question => {\n" +
        "  const answer = formData[question.field];\n" +
        "  \n" +
        "  if (answer !== null && answer !== undefined && answer !== \"\") {\n" +
        "    answeredCount++;\n" +
        "    answers[question.field] = answer;\n" +
        "    \n" +
        "    // 处理不同题型的答案\n" +
        "    const questionType = question.type?.toUpperCase();\n" +
        "    \n" +
        "    if (questionType === 'CHECKBOX' || questionType === 'VOTE') {\n" +
        "      // 多选题统计每个选项的选择情况\n" +
        "      if (Array.isArray(answer) && question.options) {\n" +
        "        console.log('题目 ' + question.field + ' 选择了 ' + answer.length + ' 个选项');\n" +
        "      }\n" +
        "    }\n" +
        "  }\n" +
        "});\n"
    }

    template += "\n" +
      "// 计算完成率\n" +
      "const totalQuestions = questions.length;\n" +
      "const completionRate = Math.round((answeredCount / totalQuestions) * 100) + '%';\n" +
      "\n" +
      "// 构建返回结果\n" +
      "const result = {\n" +
      "  success: true,"

    if (hasScoreQuestions || hasRadioStar) {
      template += "\n" +
        "  totalScore: totalScore,\n" +
        "  avgScore: avgScore,\n" +
        "  scores: scores,\n" +
        "  level: level,\n" +
        "  interpretation: interpretation,"
    }

    template += "\n" +
      "  answeredCount: answeredCount,\n" +
      "  totalQuestions: totalQuestions,\n" +
      "  completionRate: completionRate,\n" +
      "  timestamp: new Date().toISOString(),\n" +
      "  scaleType: '通用计算'\n" +
      "};\n" +
      "\n" +
      "// 添加统计信息\n" +
      "const scoreArray = Object.values(scores || {});\n" +
      "if (scoreArray.length > 0) {\n" +
      "  result.statistics = {\n" +
      "    min: Math.min(...scoreArray),\n" +
      "    max: Math.max(...scoreArray),\n" +
      "    avg: (scoreArray.reduce((a, b) => a + b, 0) / scoreArray.length).toFixed(2),\n" +
      "    count: scoreArray.length\n" +
      "  };\n" +
      "}\n" +
      "\n" +
      "console.log('计算结果:', result);\n" +
      "return result;"

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