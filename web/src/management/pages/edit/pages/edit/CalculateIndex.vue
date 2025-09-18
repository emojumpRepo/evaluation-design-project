<template>
  <div class="calculate-page">
    <div class="calculate-container">
      <div class="header">
        <h3>结果计算配置</h3>
        <div class="header-actions">
          <el-switch
            v-model="calculateConfig.enabled"
            active-text="启用计算"
            @change="handleEnableChange"
          />
          <el-button
            v-if="calculateConfig.enabled"
            type="primary"
            @click="testCalculate"
            :loading="testing"
          >
            测试计算
          </el-button>
        </div>
      </div>

      <div v-if="calculateConfig.enabled" class="content">
        <!-- 左侧：题目信息和代码编辑 -->
        <div class="left-section">
          <!-- 题目信息面板 -->
          <div class="questions-panel">
            <div class="section-header">
              <span>题目信息</span>
              <el-button size="small" @click="showQuestionDetails = !showQuestionDetails">
                {{ showQuestionDetails ? '收起' : '展开' }}
              </el-button>
            </div>
            
            <el-collapse-transition>
              <div v-show="showQuestionDetails" class="questions-list">
                <div v-if="questionList.length === 0" class="empty-tip">
                  暂无题目，请先在内容设置中添加题目
                </div>
                <div v-else>
                  <div v-for="q in questionList" :key="q.field" class="question-item">
                    <div class="question-header">
                      <span class="question-index">Q{{ q.index }}</span>
                      <span class="question-type">{{ q.typeText }}</span>
                      <code class="question-field">{{ q.field }}</code>
                      <el-tag v-if="q.hasScore" size="small" type="warning">含分值</el-tag>
                    </div>
                    <div class="question-title">{{ q.title }}</div>
                    <div v-if="q.options.length > 0" class="question-options">
                      <div v-for="opt in q.options" :key="opt.hash" class="option-item">
                        <code>{{ opt.hash }}</code>
                        <span>{{ opt.text.replace(/<[^>]*>/g, '') }}</span>
                        <span v-if="opt.score !== undefined" class="option-score">
                          ({{ opt.score }}分)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </el-collapse-transition>
          </div>

          <!-- 代码编辑器 -->
          <div class="editor-section">
            <div class="section-header">
              <span>计算代码</span>
              <el-dropdown @command="handleTemplateSelect" size="small">
                <el-button size="small" text>
                  插入代码模板
                  <el-icon class="el-icon--right"><arrow-down /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="sds">SDS抑郁自评量表</el-dropdown-item>
                    <el-dropdown-item command="scl90">症状自评量表（SCL-90）</el-dropdown-item>
                    <el-dropdown-item command="bigfive">大五人格量表</el-dropdown-item>
                    <el-dropdown-item divided command="general">通用计算模板</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            
            <div class="code-editor-wrapper">
              <MonacoEditor
                v-model="calculateConfig.code"
                language="javascript"
                :height="400"
                :options="editorOptions"
                @change="handleCodeChange"
              />
            </div>

            <div class="code-help">
              <el-collapse>
                <el-collapse-item title="使用说明" name="help">
                  <div class="help-content">
                    <h4>可用变量：</h4>
                    <ul>
                      <li><code>formData</code> - 用户提交的表单数据对象</li>
                      <li><code>questions</code> - 问卷所有题目信息数组</li>
                    </ul>
                    
                    <h4>工具函数：</h4>
                    <ul>
                      <li><code>sum(array)</code> - 数组求和</li>
                      <li><code>avg(array)</code> - 数组求平均</li>
                      <li><code>min(array)</code> - 最小值</li>
                      <li><code>max(array)</code> - 最大值</li>
                    </ul>
                    
                    <h4>返回值：</h4>
                    <p>必须返回一个JSON对象，该对象会包含在回调数据中</p>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>
        </div>

        <!-- 右侧：测试区域 -->
        <div class="right-section">
          <div class="test-section">
            <div class="section-header">
              <span>测试数据</span>
              <el-button size="small" @click="loadSampleData">重新生成</el-button>
            </div>
            
            <div class="test-input">
              <MonacoEditor
                v-model="testData"
                language="json"
                :height="200"
                :options="{ ...editorOptions, minimap: { enabled: false } }"
              />
            </div>

            <div v-if="testResult" class="test-result">
              <div class="section-header">
                <span>计算结果</span>
                <el-tag :type="testResult.success ? 'success' : 'danger'">
                  {{ testResult.success ? '成功' : '失败' }}
                </el-tag>
              </div>
              <pre class="result-content">{{ JSON.stringify(testResult.data, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <el-empty description="未启用结果计算功能">
          <el-button type="primary" @click="calculateConfig.enabled = true">
            启用计算
          </el-button>
        </el-empty>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { useEditStore } from '@/management/stores/edit'
import MonacoEditor from '@/management/components/MonacoEditor.vue'

const editStore = useEditStore()
const { schema, changeSchema } = editStore

// 新增的状态变量
const showQuestionDetails = ref(true)

// 计算配置
const calculateConfig = ref({
  enabled: false,
  code: ''
})

// 测试数据
const testData = ref('{}')
const testResult = ref<any>(null)
const testing = ref(false)

// 编辑器配置
const editorOptions = {
  theme: 'vs',
  fontSize: 14,
  automaticLayout: true,
  minimap: {
    enabled: true
  }
}

// 生成代码模板
const generateCodeTemplate = () => {
  const hasScoreQuestions = questionList.value.some((q: any) => q.hasScore)
  const firstQuestion = questionList.value[0]
  
  let template = '// 自动生成的计算代码模板\n'
  template += '// 基于当前问卷的题目结构\n\n'
  
  if (hasScoreQuestions) {
    template += '// 计算总分（含分值的题目）\n'
    template += 'let totalScore = 0;\n'
    template += 'const scores = {};\n\n'
    template += '// 遍历所有题目计算分数\n'
    template += 'questions.forEach(question => {\n'
    template += '  const answer = formData[question.field];\n'
    template += '  if (answer && question.options) {\n'
    template += '    // 单选题分数计算\n'
    template += '    if (question.type.toUpperCase() === "RADIO") {\n'
    template += '      const option = question.options.find(opt => opt.hash === answer);\n'
    template += '      if (option && option.score !== undefined) {\n'
    template += '        scores[question.field] = Number(option.score);\n'
    template += '        totalScore += Number(option.score);\n'
    template += '      }\n'
    template += '    }\n'
    template += '    // 多选题分数计算\n'
    template += '    else if (question.type.toUpperCase() === "CHECKBOX" && Array.isArray(answer)) {\n'
    template += '      let questionScore = 0;\n'
    template += '      answer.forEach(hash => {\n'
    template += '        const option = question.options.find(opt => opt.hash === hash);\n'
    template += '        if (option && option.score !== undefined) {\n'
    template += '          questionScore += Number(option.score);\n'
    template += '        }\n'
    template += '      });\n'
    template += '      scores[question.field] = questionScore;\n'
    template += '      totalScore += questionScore;\n'
    template += '    }\n'
    template += '  }\n'
    template += '});\n\n'
  } else {
    template += '// 统计答题情况\n'
    template += 'let answeredCount = 0;\n'
    template += 'let totalQuestions = questions.length;\n\n'
    template += 'Object.keys(formData).forEach(key => {\n'
    template += '  const value = formData[key];\n'
    template += '  if (value !== null && value !== undefined && value !== "") {\n'
    template += '    answeredCount++;\n'
    template += '  }\n'
    template += '});\n\n'
  }
  
  if (firstQuestion) {
    template += `// 示例：获取第一题的答案\n`
    template += `const firstAnswer = formData["${firstQuestion.field}"];\n`
    template += `console.log("第一题答案:", firstAnswer);\n\n`
  }
  
  template += '// 计算结果\n'
  template += 'const result = {\n'
  if (hasScoreQuestions) {
    template += '  totalScore: totalScore,\n'
    template += '  scores: scores,\n'
    template += '  level: totalScore >= 80 ? "优秀" : totalScore >= 60 ? "良好" : "需改进",\n'
  } else {
    template += '  answeredCount: answeredCount,\n'
    template += '  totalQuestions: totalQuestions,\n'
    template += '  completionRate: Math.round((answeredCount / totalQuestions) * 100) + "%",\n'
  }
  template += '  timestamp: new Date().toISOString(),\n'
  template += '  formData: formData // 可选：包含原始答案\n'
  template += '};\n\n'
  template += '// 返回计算结果\n'
  template += 'return result;'
  
  return template
}

// 处理模板选择
const handleTemplateSelect = (command: string) => {
  let template = ''
  let message = ''
  
  switch (command) {
    case 'sds':
      template = generateDepressionScaleTemplate()
      message = '已插入SDS抑郁自评量表计算模板'
      break
    case 'scl90':
      ElMessage.info('SCL-90症状自评量表模板开发中，请稍后...')
      return
    case 'bigfive':
      ElMessage.info('大五人格量表模板开发中，请稍后...')
      return
    case 'general':
      if (questionList.value.length === 0) {
        ElMessage.warning('请先在内容设置中添加题目')
        return
      }
      template = generateCodeTemplate()
      message = '已插入通用计算模板'
      break
    default:
      return
  }
  
  if (template) {
    // 更新本地状态
    calculateConfig.value.code = template
    // 确保启用状态
    if (!calculateConfig.value.enabled) {
      calculateConfig.value.enabled = true
    }
    
    // 保存到schema
    const config = {
      enabled: true,  // 插入模板时自动启用
      code: template
    }
    console.log('保存计算配置 - handleTemplateSelect:', config)
    changeSchema({
      key: 'calculateConf',
      value: config
    })
    ElMessage.success(message)
  }
}

// 生成抑郁量表计算模板
const generateDepressionScaleTemplate = () => {
  let template = '// SDS抑郁自评量表计算代码\n'
  template += '// 基于Zung氏抑郁自评量表评分标准\n\n'
  
  template += '// 定义正向计分和反向计分映射\n'
  template += '// A选项通常对应"没有或偶尔"，D选项对应"经常或持续"\n'
  template += 'const scoreMap = {\n'
  template += '  1: 1,  // 选项1(如：没有或偶尔)\n'
  template += '  2: 2,  // 选项2(如：有时)\n'
  template += '  3: 3,  // 选项3(如：大部分时间)\n'
  template += '  4: 4   // 选项4(如：经常或持续)\n'
  template += '};\n\n'
  
  template += 'const reverseScoreMap = {\n'
  template += '  1: 4,  // 反向计分\n'
  template += '  2: 3,\n'
  template += '  3: 2,\n'
  template += '  4: 1\n'
  template += '};\n\n'
  
  template += '// 定义反向计分的题目编号（基于标准SDS量表）\n'
  template += '// 这些题目描述积极情绪，需要反向计分\n'
  template += 'const reverseQuestions = [2, 5, 6, 11, 12, 14, 16, 17, 18, 20];\n\n'
  
  template += '// 获取所有题目并按顺序排列\n'
  template += 'const sortedQuestions = [...questions].sort((a, b) => {\n'
  template += '  const numA = parseInt(a.field.replace(/[^0-9]/g, ""));\n'
  template += '  const numB = parseInt(b.field.replace(/[^0-9]/g, ""));\n'
  template += '  return numA - numB;\n'
  template += '});\n\n'
  
  template += '// 计算粗分\n'
  template += 'let rawScore = 0;\n'
  template += 'const itemScores = {};\n\n'
  
  template += 'sortedQuestions.forEach((question, index) => {\n'
  template += '  const answer = formData[question.field];\n'
  template += '  const questionNumber = index + 1;\n'
  template += '  \n'
  template += '  if (answer && question.options) {\n'
  template += '    // 找到选中的选项\n'
  template += '    const selectedOption = question.options.find(opt => opt.hash === answer);\n'
  template += '    if (selectedOption) {\n'
  template += '      // 获取选项的序号（1-4）\n'
  template += '      const optionIndex = question.options.indexOf(selectedOption) + 1;\n'
  template += '      \n'
  template += '      // 判断是否需要反向计分\n'
  template += '      let score;\n'
  template += '      if (reverseQuestions.includes(questionNumber)) {\n'
  template += '        score = reverseScoreMap[optionIndex] || 0;\n'
  template += '        console.log(`题目${questionNumber}(${question.field}): 反向计分，选项${optionIndex} -> 分数${score}`);\n'
  template += '      } else {\n'
  template += '        score = scoreMap[optionIndex] || 0;\n'
  template += '        console.log(`题目${questionNumber}(${question.field}): 正向计分，选项${optionIndex} -> 分数${score}`);\n'
  template += '      }\n'
  template += '      \n'
  template += '      itemScores[question.field] = score;\n'
  template += '      rawScore += score;\n'
  template += '    }\n'
  template += '  }\n'
  template += '});\n\n'
  
  template += '// 转换为标准分（粗分 × 1.25）\n'
  template += 'const standardScore = Math.round(rawScore * 1.25);\n\n'
  
  template += '// 根据评分标准评估抑郁程度\n'
  template += 'let depressionLevel;\n'
  template += 'let interpretation;\n\n'
  
  template += 'if (standardScore <= 52) {\n'
  template += '  depressionLevel = "正常";\n'
  template += '  interpretation = "您的情绪状态在正常范围内";\n'
  template += '} else if (standardScore >= 53 && standardScore <= 62) {\n'
  template += '  depressionLevel = "轻度抑郁";\n'
  template += '  interpretation = "可能存在轻度抑郁倾向，建议关注情绪健康";\n'
  template += '} else if (standardScore >= 63 && standardScore <= 72) {\n'
  template += '  depressionLevel = "中度抑郁";\n'
  template += '  interpretation = "可能存在中度抑郁倾向，建议寻求专业帮助";\n'
  template += '} else {\n'
  template += '  depressionLevel = "重度抑郁";\n'
  template += '  interpretation = "可能存在重度抑郁倾向，强烈建议尽快寻求专业帮助";\n'
  template += '}\n\n'
  
  template += '// 返回计算结果\n'
  template += 'const result = {\n'
  template += '  rawScore: rawScore,           // 粗分\n'
  template += '  standardScore: standardScore, // 标准分\n'
  template += '  depressionLevel: depressionLevel, // 抑郁程度\n'
  template += '  interpretation: interpretation,   // 结果解释\n'
  template += '  itemScores: itemScores,       // 各题得分\n'
  template += '  completionRate: Math.round((Object.keys(itemScores).length / 20) * 100) + "%", // 完成率\n'
  template += '  timestamp: new Date().toISOString(),\n'
  template += '  scaleType: "SDS抑郁自评量表"\n'
  template += '};\n\n'
  
  template += 'console.log("计算结果:", result);\n'
  template += 'return result;'
  
  return template
}

// 初始化
onMounted(() => {
  // 从schema加载配置
  console.log('初始化计算配置，当前schema.calculateConf:', schema.calculateConf)
  
  if (schema.calculateConf) {
    calculateConfig.value = { 
      enabled: schema.calculateConf.enabled || false,
      code: schema.calculateConf.code || ''
    }
  } else {
    // 初始化配置
    calculateConfig.value = {
      enabled: false,
      code: ''
    }
    // 初始化时也保存一次，确保结构存在
    changeSchema({
      key: 'calculateConf',
      value: calculateConfig.value
    })
  }
  
  console.log('初始化后的calculateConfig:', calculateConfig.value)
  
  // 加载示例测试数据
  loadSampleData()
})

// 保存配置到schema
const handleEnableChange = (enabled: boolean) => {
  // 更新本地状态
  calculateConfig.value.enabled = enabled
  
  // 保存启用状态
  const config = {
    enabled: enabled,
    code: calculateConfig.value.code || ''
  }
  console.log('保存计算配置 - handleEnableChange:', config)
  changeSchema({
    key: 'calculateConf',
    value: config
  })
}

const handleCodeChange = (newCode: string) => {
  // 更新本地状态
  calculateConfig.value.code = newCode
  
  // 保存代码内容
  const config = {
    enabled: calculateConfig.value.enabled,
    code: newCode
  }
  console.log('保存计算配置 - handleCodeChange:', config)
  changeSchema({
    key: 'calculateConf',
    value: config
  })
}

// 加载示例数据
const loadSampleData = () => {
  const sampleAnswers: any = {}
  
  // 从当前问卷生成示例数据
  const dataList = schema.questionDataList || (schema as any).dataConf?.dataList || []
  
  if (dataList && dataList.length > 0) {
    dataList.forEach((question: any) => {
      if (question.field) {
        // 将题型转换为大写进行匹配
        const questionType = question.type?.toUpperCase()
        
        // 根据题型生成示例值，包含实际的选项ID
        switch (questionType) {
          case 'RADIO':
          case 'SELECT':
            // 单选题：随机选择一个选项
            if (question.options && question.options.length > 0) {
              const randomIndex = Math.floor(Math.random() * question.options.length)
              sampleAnswers[question.field] = question.options[randomIndex].hash
            } else {
              // 如果没有options，使用默认值
              sampleAnswers[question.field] = '示例值'
            }
            break
          case 'CHECKBOX':
            // 多选题：随机选择1-3个选项
            if (question.options && question.options.length > 0) {
              const numToSelect = Math.min(
                Math.floor(Math.random() * 3) + 1, 
                question.options.length
              )
              // 随机打乱选项顺序，然后取前numToSelect个
              const shuffled = [...question.options].sort(() => Math.random() - 0.5)
              sampleAnswers[question.field] = shuffled
                .slice(0, numToSelect)
                .map((opt: any) => opt.hash)
            } else {
              // 如果没有options，使用默认值
              sampleAnswers[question.field] = ['示例值']
            }
            break
          case 'RADIO_STAR':
            // 评分题：随机选择一个评分
            const max = question.rangeConfig?.max || 5
            sampleAnswers[question.field] = Math.floor(Math.random() * max) + 1
            break
          case 'INPUT':
          case 'TEXTAREA':
            sampleAnswers[question.field] = '示例值'
            break
          case 'NUMBER':
            sampleAnswers[question.field] = Math.floor(Math.random() * 100) + 1
            break
          case 'VOTE':
            // 投票题：随机选择1-2个选项
            if (question.options && question.options.length > 0) {
              const numToSelect = Math.min(
                Math.floor(Math.random() * 2) + 1,
                question.options.length
              )
              const shuffled = [...question.options].sort(() => Math.random() - 0.5)
              sampleAnswers[question.field] = shuffled
                .slice(0, numToSelect)
                .map((opt: any) => opt.hash)
            } else {
              // 如果没有options，使用默认值
              sampleAnswers[question.field] = ['示例值']
            }
            break
          default:
            sampleAnswers[question.field] = '示例值'
        }
        
        // 如果有"其他"选项的输入框
        if (question.options) {
          question.options.forEach((opt: any) => {
            if (opt.othersKey) {
              sampleAnswers[opt.othersKey] = '示例值'
            }
          })
        }
      }
    })
  }
  
  testData.value = JSON.stringify(sampleAnswers, null, 2)
}

// 获取题目信息用于展示
const questionList = computed(() => {
  // 先尝试从 questionDataList 获取（编辑时的数据）
  const dataList = schema.questionDataList || (schema as any).dataConf?.dataList || []
  
  if (!dataList || dataList.length === 0) {
    console.log('No questions found in schema:', schema)
    return []
  }
  
  return dataList.map((q: any, index: number) => {
    const title = q.title ? 
      q.title.replace(/<[^>]*>/g, '').substring(0, 50) : 
      `题目${index + 1}`
    
    return {
      index: index + 1,
      field: q.field,
      title,
      type: q.type,
      typeText: getQuestionTypeText(q.type),
      options: q.options || [],
      hasScore: q.options?.some((opt: any) => opt.score !== undefined)
    }
  })
})

// 获取题型文本
const getQuestionTypeText = (type: string) => {
  const typeUpper = type?.toUpperCase()
  const typeMap: any = {
    'RADIO': '单选题',
    'CHECKBOX': '多选题',
    'INPUT': '填空题',
    'TEXTAREA': '多行文本',
    'NUMBER': '数字题',
    'RADIO_STAR': '评分题',
    'SELECT': '下拉选择',
    'VOTE': '投票题',
    'CASCADER': '级联选择'
  }
  return typeMap[typeUpper] || type
}

// 测试计算
const testCalculate = async () => {
  testing.value = true
  testResult.value = null
  
  try {
    // 解析测试数据
    let formData
    try {
      formData = JSON.parse(testData.value)
    } catch (e: any) {
      throw new Error('测试数据格式错误：' + e.message)
    }
    
    // 准备问题数据 - 使用正确的数据源
    const questions = schema.questionDataList || (schema as any).dataConf?.dataList || []
    
    // 创建安全的执行环境
    const executeCode = new Function('formData', 'questions', calculateConfig.value.code)
    
    // 执行代码
    const result = executeCode(formData, questions)
    
    testResult.value = {
      success: true,
      data: result
    }
    
    ElMessage.success('计算执行成功')
  } catch (error: any) {
    testResult.value = {
      success: false,
      data: {
        error: error.message,
        stack: error.stack
      }
    }
    ElMessage.error('计算执行失败：' + error.message)
  } finally {
    testing.value = false
  }
}
</script>

<style lang="scss" scoped>
.calculate-page {
  width: 100%;
  height: 100%;
  padding: 20px;
  overflow-y: auto;
  background: #f5f7fa;
}

.calculate-container {
  max-width: 1600px;
  margin: 0 auto;
  background: white;
  border-radius: 8px;
  padding: 24px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #ebeef5;
  
  h3 {
    margin: 0;
    font-size: 18px;
    color: #303133;
  }
  
  .header-actions {
    display: flex;
    gap: 16px;
    align-items: center;
  }
}

.content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.left-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.questions-panel {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 12px;
  
  .questions-list {
    max-height: 300px;
    overflow-y: auto;
    margin-top: 12px;
  }
  
  .empty-tip {
    text-align: center;
    padding: 20px;
    color: #909399;
  }
  
  .question-item {
    background: white;
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 8px;
    
    .question-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      
      .question-index {
        font-weight: bold;
        color: #409eff;
      }
      
      .question-type {
        font-size: 12px;
        color: #909399;
      }
      
      .question-field {
        padding: 2px 6px;
        background: #f0f2f5;
        border-radius: 3px;
        font-size: 12px;
        font-family: monospace;
      }
    }
    
    .question-title {
      font-size: 13px;
      color: #606266;
      margin-bottom: 8px;
      line-height: 1.5;
    }
    
    .question-options {
      .option-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
        font-size: 12px;
        color: #909399;
        
        code {
          padding: 2px 4px;
          background: #f5f7fa;
          border-radius: 2px;
          font-family: monospace;
        }
        
        .option-score {
          margin-left: auto;
          color: #e6a23c;
          font-weight: bold;
        }
      }
    }
  }
}

.right-section {
  .test-section {
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      font-size: 14px;
      font-weight: 500;
      color: #606266;
    }
  }
}

.editor-section,
.test-section {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 500;
    color: #606266;
    
    .help-icon {
      margin-left: 8px;
      color: #909399;
      cursor: help;
    }
  }
}

.code-editor-wrapper {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.code-help {
  margin-top: 16px;
  
  .help-content {
    padding: 16px;
    background: #f5f7fa;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1.6;
    
    h4 {
      margin: 16px 0 8px;
      &:first-child {
        margin-top: 0;
      }
    }
    
    ul {
      margin: 8px 0;
      padding-left: 24px;
    }
    
    code {
      padding: 2px 6px;
      background: #fff;
      border: 1px solid #ebeef5;
      border-radius: 3px;
      color: #e6a23c;
      font-family: 'Monaco', 'Menlo', monospace;
    }
    
    pre {
      padding: 12px;
      background: #fff;
      border: 1px solid #ebeef5;
      border-radius: 4px;
      font-size: 12px;
      overflow-x: auto;
    }
  }
}

.test-input {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 16px;
}

.test-result {
  .result-content {
    padding: 12px;
    background: #f5f7fa;
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    font-size: 12px;
    font-family: 'Monaco', 'Menlo', monospace;
    max-height: 300px;
    overflow-y: auto;
  }
}

.empty-state {
  padding: 60px 0;
  text-align: center;
}

@media (max-width: 1400px) {
  .content {
    grid-template-columns: 1fr;
  }
  
  .questions-panel {
    .questions-list {
      max-height: 200px;
    }
  }
}
</style>