# Scales 生成规则标准文档

## 概述

本文档定义了心理量表（Scales）模板的统一生成规则和标准，用于规范后续所有 scales 自检清单的创建。基于 `BFI.ts`（大五人格量表）的成功实现，制定了一套完整的开发标准。

## 1. 标准模板结构

### 1.1 基础接口规范

所有 scales 模板必须实现 `CalculateTemplate` 接口：

```typescript
export interface CalculateTemplate {
  metadata: TemplateMetadata
  generateCode: (questions?: Question[]) => string
  calculate?: (formData: FormData, questions: Question[]) => CalculateResult
  validate?: (questions: Question[]) => boolean
}
```

### 1.2 元数据标准

```typescript
const metadata: TemplateMetadata = {
  id: 'scale_id',                    // 唯一标识符，小写字母+下划线
  name: '量表中文名称',               // 完整的量表名称
  description: '量表描述和用途',      // 详细描述量表功能和适用场景
  version: '1.0.0',                  // 版本号，遵循语义化版本
  author: '量表作者或机构',           // 可选，量表原作者信息
  tags: ['标签1', '标签2'],          // 分类标签，便于检索
  requiredQuestions: 60              // 必需题目数量
}
```

### 1.3 文件结构模板

```typescript
/**
 * [量表名称]计算模板
 */

import type { CalculateTemplate, Question, FormData, [ResultType] } from '../types'
import { 
  sortQuestionsByNumber, 
  getOptionScore, 
  calculateCompletionRate, 
  generateTimestamp,
  reverseScoreMap5,
  normalScoreMap5
} from '../utils'

// 1. 常量定义区域
const DIMENSION_ITEMS = { /* 维度题目分配 */ }
const REVERSE_ITEMS = { /* 反向计分题目 */ }
const DIMENSION_NAMES = { /* 维度名称映射 */ }
const SCORE_LEVELS = [ /* 分数等级标准 */ ]

// 2. 辅助函数区域
const calculateTScore = (rawScore: number, mean: number, sd: number): number => {
  // T分数计算逻辑
}

const getLevel = (score: number): { level: string; description: string } => {
  // 等级判定逻辑
}

// 3. 主模板对象
const scaleTemplate: CalculateTemplate = {
  metadata: { /* 元数据 */ },
  generateCode: (questions?: Question[]): string => { /* 代码生成 */ },
  calculate: (formData: FormData, questions: Question[]): ResultType => { /* 直接计算 */ },
  validate: (questions: Question[]): boolean => { /* 验证逻辑 */ }
}

export default scaleTemplate
```

## 2. 计分映射规范

### 2.1 标准计分映射实现

**必须采用 index 映射方式**，确保与选项序号的一致性：

```typescript
// 正向计分映射（5分制）
const scoreMap = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }

// 反向计分映射（5分制）
const reverseScoreMap = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 }

// 4分制示例
const scoreMap4 = { 1: 1, 2: 2, 3: 3, 4: 4 }
const reverseScoreMap4 = { 1: 4, 2: 3, 3: 2, 4: 1 }
```

### 2.2 计分映射使用规范

1. **优先使用工具函数**：
   ```typescript
   import { normalScoreMap5, reverseScoreMap5 } from '../utils'
   
   // 使用工具函数进行计分
   const score = getOptionScore(question, answer, isReverse, isReverse ? reverseScoreMap5 : undefined)
   ```

2. **自定义计分映射**：
   ```typescript
   // 特殊计分需求时定义自定义映射
   const CUSTOM_SCORE_MAP: Record<number, number> = {
     1: 0,  // 从不
     2: 1,  // 很少
     3: 2,  // 有时
     4: 3,  // 经常
     5: 4   // 总是
   }
   ```

### 2.3 反向计分处理

```typescript
// 定义反向计分题目
const REVERSE_ITEMS = {
  dimension1: [1, 5, 9],    // 维度1的反向题目
  dimension2: [3, 7, 11]    // 维度2的反向题目
}

// 判断是否需要反向计分
const isReverse = REVERSE_ITEMS[dimension].includes(questionNumber)
const score = getOptionScore(question, answer, isReverse, isReverse ? reverseScoreMap5 : undefined)
```

## 3. 代码生成规范

### 3.1 generateCode 方法标准

```typescript
generateCode: (questions?: Question[]): string => {
  return `// [量表名称]计算代码
// [量表描述和评估内容]

// 定义计分映射
const scoreMap = ${JSON.stringify(scoreMap, null, 2)};
const reverseScoreMap = ${JSON.stringify(reverseScoreMap, null, 2)};

// 定义维度配置
const dimensionItems = ${JSON.stringify(DIMENSION_ITEMS, null, 2)};
const reverseItems = ${JSON.stringify(REVERSE_ITEMS, null, 2)};

// 排序题目
const sortedQuestions = [...questions].sort((a, b) => {
  const numA = parseInt(a.field.replace(/[^0-9]/g, ""));
  const numB = parseInt(b.field.replace(/[^0-9]/g, ""));
  return numA - numB;
});

// 初始化计分变量
let totalScore = 0;
const itemScores = {};
const dimensionScores = {};
let answeredCount = 0;

// 计算逻辑
sortedQuestions.forEach((question, index) => {
  const answer = formData[question.field];
  const questionNumber = index + 1;
  
  if (answer && question.options) {
    answeredCount++;
    const selectedOption = question.options.find(opt => opt.hash === answer);
    
    if (selectedOption) {
      const optionIndex = question.options.indexOf(selectedOption) + 1;
      
      // 判断维度和是否反向计分
      const dimension = getDimension(questionNumber);
      const isReverse = isReverseItem(dimension, questionNumber);
      const score = isReverse ? reverseScoreMap[optionIndex] : scoreMap[optionIndex];
      
      itemScores[question.field] = score;
      // 累加到相应维度
    }
  }
});

// 计算结果
const result = {
  success: true,
  // ... 其他结果字段
  timestamp: new Date().toISOString(),
  scaleType: '[量表名称]'
};

console.log('[量表名称]计算结果:', result);
return result;`
}
```

### 3.2 代码生成最佳实践

1. **包含完整的计算逻辑**：生成的代码应该是完全可执行的
2. **保持与 calculate 方法一致**：确保两种计算方式结果相同
3. **添加详细的注释**：帮助理解计算过程
4. **包含错误处理**：处理异常情况和边界条件
5. **输出调试信息**：便于问题排查

## 4. 直接计算规范

### 4.1 calculate 方法标准

```typescript
calculate: (formData: FormData, questions: Question[]): ResultType => {
  // 1. 题目排序和验证
  const sortedQuestions = sortQuestionsByNumber(questions)
  
  // 2. 初始化计分变量
  const dimensionScores: { [key: string]: number[] } = {}
  const itemScores: { [key: string]: number } = {}
  let answeredCount = 0

  // 3. 遍历题目计算得分
  sortedQuestions.forEach((question, index) => {
    const answer = formData[question.field]
    const questionNumber = index + 1
    
    if (answer && question.options) {
      answeredCount++
      
      // 判断维度和反向计分
      const dimension = getDimension(questionNumber)
      const isReverse = isReverseItem(dimension, questionNumber)
      const score = getOptionScore(question, answer, isReverse, isReverse ? reverseScoreMap5 : undefined)
      
      if (score > 0) {
        itemScores[question.field] = score
        dimensionScores[dimension].push(score)
      }
    }
  })

  // 4. 计算各维度结果
  const dimensions = {}
  Object.entries(dimensionScores).forEach(([dim, scores]) => {
    const rawScore = scores.reduce((sum, score) => sum + score, 0)
    const tScore = calculateTScore(rawScore)
    const levelInfo = getLevel(tScore)
    
    dimensions[dim] = {
      name: DIMENSION_NAMES[dim].name,
      score: tScore,
      level: levelInfo.level,
      description: levelInfo.description
    }
  })

  // 5. 返回标准结果
  return {
    success: true,
    dimensions,
    itemScores,
    completionRate: calculateCompletionRate(answeredCount, questions.length),
    timestamp: generateTimestamp(),
    scaleType: metadata.name
  }
}
```

### 4.2 计算方法最佳实践

1. **使用工具函数**：充分利用 utils 中的通用函数
2. **错误处理**：妥善处理缺失数据和异常情况
3. **数据验证**：验证输入数据的有效性
4. **性能优化**：避免不必要的计算和循环
5. **结果一致性**：确保与 generateCode 生成的代码结果一致

### 4.3 回调返回格式标准

为确保前端、后端与外部系统对接的稳定性，`calculate` 方法的直接返回值与 `generateCode` 生成的脚本回调结果必须遵循统一的数据契约。

#### 4.3.1 TypeScript 数据契约

```typescript
export interface ScaleCallbackPayload {
  eventId: string
  questionnaireId: string
  questionnaireType: string
  user: {
    userId: string
    phoneNumber: string
  }
  result: {
    status: 'completed' | 'partial' | 'failed'
    rawScore?: number
    standardScore?: number
    level?: string
    levelArray?: string[]
    interpretation?: string
    recommendations?: string[]
    factors?: Array<{
      name: string
      score: number
      interpretation?: string
      level?: string
      levelArray?: string[]
    }>
    questions?: Array<{
      questionId: string
      questionText: string
      questionType: string
      options?: Array<unknown>
      userAnswer?: string | string[]
      answerScore?: number
    }>
    metadata?: Record<string, unknown>
  }
  completedAt?: string
  createdAt?: string
  updatedAt?: string
}
```

#### 4.3.2 JSON 结构示例

```json
{
  "eventId": "event-001",
  "questionnaireId": "bfi-202501",
  "questionnaireType": "BFI",
  "user": {
    "userId": "user-123",
    "phoneNumber": "13800138000"
  },
  "result": {
    "status": "completed",
    "rawScore": 45,
    "standardScore": 62.5,
    "level": "中风险",
    "levelArray": ["正常", "低风险", "中风险", "高风险"],
    "interpretation": "总体得分处于中等风险，需要持续关注。",
    "recommendations": ["保持良好作息", "建议两周后复测"],
    "factors": [
      {
        "name": "神经质",
        "score": 62.5,
        "interpretation": "情绪波动较大",
        "level": "高",
        "levelArray": ["高", "中", "低"]
      }
    ],
    "questions": [
      {
        "questionId": "Q1",
        "questionText": "我能快速平静下来",
        "questionType": "single_choice",
        "options": [],
        "userAnswer": "A",
        "answerScore": 4
      }
    ],
    "metadata": {
      "duration": 360,
      "totalQuestions": 60
    }
  },
  "completedAt": "2025-01-01T00:00:00.000Z",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

#### 4.3.3 字段约束

- `eventId`：string，长度 ≤ 64，必填
- `questionnaireId`：string，长度 ≤ 64，必填
- `questionnaireType`：string，问卷类型（SAS/SDS/EPO/PSQI/SCL90/PH99/DISC/大五人格等），必填
- `user.userId`：string，长度 ≤ 64，必填
- `user.phoneNumber`：string，中国大陆 11 位，必填
- `result.status`：enum=`completed|partial|failed`
- `result.rawScore`：number，原始分数
- `result.standardScore`：number，标准分数（如适用）
- `result.level`：string，结果等级/程度，≤ 32
- `result.levelArray`：array，等级枚举集合（示例 ['正常','低风险','中风险','高风险']，不同量表可自定义）
- `result.interpretation`：string，结果解释说明，≤ 500
- `result.recommendations`：array，建议列表（可选）
- `result.factors`：array，因子列表
- `result.factors[].name`：string，因子名称，≤ 32
- `result.factors[].score`：number，因子分数
- `result.factors[].interpretation`：string，因子结果解释说明，≤ 500
- `result.factors[].level`：string，因子等级/程度，≤ 32
- `result.factors[].levelArray`：array，因子等级枚举集合（示例 ['正常','低风险','中风险','高风险']，不同量表可自定义）
- `result.questions`：array，题目详情数组（可选）
  - `questionId`：string，题目ID
  - `questionText`：string，题目内容
  - `questionType`：string，题目类型（single_choice/multiple_choice/text 等）
  - `options`：array，选项列表
  - `userAnswer`：string/array，用户答案
  - `answerScore`：number，该题得分
- `result.metadata`：object，元数据信息（完成时间、题目数等）
- `completedAt`/`createdAt`/`updatedAt`：ISO8601 UTC 时间

> 约束中的可选字段需在缺省时省略，而不是返回 `null`，以保持接口简洁（KISS）。所有枚举集合必须复用在模板常量区域声明的 `as const` 数组（DRY），避免重复定义。

## 5. 验证机制规范

### 5.1 validate 方法标准

```typescript
validate: (questions: Question[]): boolean => {
  // 1. 题目数量验证
  if (questions.length !== metadata.requiredQuestions) {
    console.warn(`${metadata.name}应该有${metadata.requiredQuestions}道题，当前有${questions.length}道题`)
    return false
  }

  // 2. 选项数量验证
  for (const question of questions) {
    if (!question.options || question.options.length !== expectedOptionCount) {
      console.warn(`题目${question.field}应该有${expectedOptionCount}个选项`)
      return false
    }
  }

  // 3. 选项内容验证（可选）
  for (const question of questions) {
    if (!validateOptionContent(question)) {
      console.warn(`题目${question.field}选项内容不符合要求`)
      return false
    }
  }

  return true
}
```

### 5.2 验证规则

1. **题目数量**：必须与 requiredQuestions 一致
2. **选项数量**：每道题的选项数量必须符合量表要求
3. **选项内容**：验证选项文本和分值的合理性
4. **题目顺序**：确保题目编号的连续性
5. **必填字段**：验证必要字段的完整性

## 6. 错误处理标准

### 6.1 错误处理策略

所有量表模板必须实现完整的错误处理机制，包括运行时验证和异常捕获。

#### 6.1.1 运行时验证（Runtime Validation）

在 `calculate` 方法中使用 `validateFormData` 进行输入验证：

```typescript
calculate: (formData: FormData, questions: Question[]): ScaleResult => {
  // 运行时验证
  const validation = validateFormData(formData, questions)
  if (!validation.isValid) {
    console.error('量表数据验证失败:', validation.errors)
    return createCalculationError(validation.errors[0], metadata.name, metadata.id)
  }

  return safeCalculate(() => {
    // 实际计算逻辑
    // ...
  }, metadata.name, metadata.id)
}
```

#### 6.1.2 代码生成错误处理

在 `generateCode` 方法中添加运行时验证和异常捕获：

```typescript
generateCode: (questions?: Question[]): string => {
  // 运行时验证
  if (!questions || questions.length === 0) {
    return `
console.error('量表题目数组为空');
return {
  error: true,
  message: '量表题目数组为空',
  scaleName: '${metadata.name}',
  scaleId: '${metadata.id}'
};`;
  }

  try {
    // 生成计算代码
    return `
// 计算逻辑代码
try {
  // 实际计算过程
  // ...
  console.log('${metadata.name}计算结果:', result);
  return result;
} catch (error) {
  console.error('${metadata.name}计算过程中发生错误:', error);
  return {
    error: true,
    message: '${metadata.name}计算过程中发生错误: ' + (error?.message || '未知错误'),
    scaleName: '${metadata.name}',
    scaleId: '${metadata.id}'
  };
}`;
  } catch (error) {
    console.error('代码生成过程中发生错误:', error);
    return `
console.error('代码生成过程中发生错误:', ${JSON.stringify(error?.message || '未知错误')});
return {
  error: true,
  message: '代码生成失败',
  scaleName: '${metadata.name}',
  scaleId: '${metadata.id}'
};`;
  }
}
```

#### 6.1.3 传统错误处理（保持兼容性）

```typescript
// 1. 输入验证错误
if (!formData || Object.keys(formData).length === 0) {
  return {
    success: false,
    error: '表单数据为空',
    timestamp: generateTimestamp(),
    scaleType: metadata.name
  }
}

// 2. 题目数量错误
if (questions.length !== metadata.requiredQuestions) {
  return {
    success: false,
    error: `题目数量不正确，期望${metadata.requiredQuestions}道题，实际${questions.length}道题`,
    timestamp: generateTimestamp(),
    scaleType: metadata.name
  }
}

// 3. 数据缺失处理
const missingAnswers = []
questions.forEach(question => {
  if (!formData[question.field]) {
    missingAnswers.push(question.field)
  }
})

if (missingAnswers.length > 0) {
  console.warn(`以下题目未回答：${missingAnswers.join(', ')}`)
}
```

### 6.2 错误类型定义

1. **验证错误**：输入数据不符合要求
   - 表单数据为空或格式错误
   - 题目数量不匹配
   - 必填字段缺失

2. **计算错误**：计算过程中出现异常
   - 数值计算溢出
   - 除零错误
   - 类型转换错误

3. **配置错误**：量表配置不正确
   - 计分映射缺失
   - 维度定义错误
   - 等级阈值配置错误

4. **运行时错误**：代码执行过程中的异常
   - 函数调用错误
   - 对象属性访问错误
   - 数组越界错误

### 6.3 错误信息规范

- **语言**：使用中文错误信息，便于理解
- **具体性**：提供具体的错误原因和位置
- **建设性**：包含修复建议或解决方案
- **可追踪性**：记录到控制台便于调试
- **结构化**：使用统一的错误对象格式

### 6.4 错误处理工具函数

项目提供了以下工具函数用于标准化错误处理：

- `validateFormData(formData, questions)`: 验证表单数据
- `safeCalculate(calculationFn, scaleName, scaleId)`: 安全执行计算
- `createCalculationError(message, scaleName, scaleId)`: 创建标准错误对象

## 7. 结果接口规范

### 7.1 基础结果接口

```typescript
export interface ScaleResult extends CalculateResult {
  success: boolean           // 计算是否成功
  timestamp: string         // 计算时间戳
  scaleType: string        // 量表类型名称
  completionRate: string   // 完成率
  itemScores: { [key: string]: number }  // 各题得分
}
```

### 7.2 扩展结果接口

根据量表特点扩展结果接口：

```typescript
export interface CustomScaleResult extends ScaleResult {
  totalScore: number        // 总分
  dimensions: {             // 各维度得分
    [key: string]: {
      name: string
      score: number
      level: string
      description: string
    }
  }
  level: string            // 总体等级
  interpretation: string   // 结果解释
  profile: string         // 人格剖面（可选）
}
```

### 7.3 结果枚举值规范

为解决结果值不一致、难以校验的问题，所有量表必须统一以“枚举值”形式输出等级相关字段。不得返回自由文本，必须从枚举列表中选择。

1. 通用要求
- 所有 `level`、`riskLevel`、`factors[...].level` 等字段必须返回预先定义的枚举值
- 在模板常量区域用 `as const` 定义枚举列表，并在计算与代码生成中统一引用
- 多因子量表（如 BFI）每个因子也必须返回枚举值（高/中/低）

2. 推荐实现模式（TypeScript）
```typescript
// 多因子量表通用维度等级（BFI / EPQ 等）
export const FACTOR_LEVELS = ['高', '中', '低'] as const
export type FactorLevel = typeof FACTOR_LEVELS[number]

export const getDimensionLevel = (tScore: number): FactorLevel => {
  if (tScore >= 56) return '高'
  if (tScore >= 45 && tScore <= 55) return '中'
  return '低'
}

// BSQ 风险等级（示例）
export const BSQ_RISK_LEVELS = ['低风险', '中等风险', '高风险'] as const
export type BSQRiskLevel = typeof BSQ_RISK_LEVELS[number]

export const getBSQRiskLevel = (totalScore: number): BSQRiskLevel => {
  if (totalScore <= 15) return '低风险'
  if (totalScore <= 24) return '中等风险'
  return '高风险'
}

// Y-BOCS 严重程度（总体与因子）
export const YBOCS_SEVERITY_LEVELS = ['轻度', '中度', '重度', '极重'] as const
export type YBOCSSeverity = typeof YBOCS_SEVERITY_LEVELS[number]

// ITS 人际信任等级
export const ITS_TRUST_LEVELS = ['低信任', '中等信任', '高信任'] as const
export type ITSTrustLevel = typeof ITS_TRUST_LEVELS[number]

// SAS 焦虑等级
export const SAS_ANXIETY_LEVELS = ['轻度焦虑', '中度焦虑', '重度焦虑'] as const
export type SASAnxietyLevel = typeof SAS_ANXIETY_LEVELS[number]

// SDS 抑郁等级
export const SDS_DEPRESSION_LEVELS = ['轻度抑郁', '中度抑郁', '重度抑郁'] as const
export type SDSDepressionLevel = typeof SDS_DEPRESSION_LEVELS[number]

// 统一校验（可选）
export const assertEnum = <T extends readonly string[]>(value: string, enumList: T): T[number] => {
  if (enumList.includes(value as any)) return value as T[number]
  throw new Error(`枚举值非法: ${value}`)
}
```

3. 返回值要求
- `calculate` 与 `generateCode` 的返回对象中，等级相关字段仅可取自对应枚举列表
- 示例（BFI）：`dimensions[dim].level` 类型为 `FactorLevel`，取自 `FACTOR_LEVELS`
- 示例（BSQ）：`level` 类型为 `BSQRiskLevel`，值由 `getBSQRiskLevel` 返回

4. 错误处理
- 当计算得到的等级不在枚举列表中，应抛出“枚举值非法”错误或回退为默认值（如 `'未知等级'`），并记录日志
- 建议在单元测试中对所有枚举边界进行覆盖验证

## 8. 开发检查清单

### 8.1 代码质量检查

- [ ] 实现了完整的 CalculateTemplate 接口
- [ ] 使用了标准的计分映射方式
- [ ] generateCode 和 calculate 方法结果一致
- [ ] 包含完整的错误处理逻辑
- [ ] 添加了详细的代码注释
- [ ] 遵循了 TypeScript 类型规范

### 8.2 功能完整性检查

- [ ] 元数据信息完整准确
- [ ] 计分逻辑正确实现
- [ ] 反向计分处理正确
- [ ] 维度计算准确
- [ ] 等级判定合理
- [ ] 结果解释有意义
- [ ] 结果等级枚举值已定义并使用（`level`/`riskLevel`）
- [ ] 多因子量表各因子等级返回枚举值（如 BFI 的 N/E/O/A/C）

### 8.3 测试验证检查

- [ ] 通过了基础功能测试
- [ ] 验证了边界条件处理
- [ ] 测试了错误情况处理
- [ ] 确认了计算结果准确性
- [ ] 检查了性能表现

### 8.4 文档规范检查

- [ ] 代码注释完整清晰
- [ ] 变量命名规范统一
- [ ] 函数职责单一明确
- [ ] 导入导出规范正确
- [ ] 符合项目代码风格

## 9. 最佳实践总结

### 9.1 基于 BFI.ts 的成功经验

1. **清晰的结构组织**：常量定义、辅助函数、主模板对象分离
2. **标准的计分实现**：使用 index 映射确保准确性
3. **完善的错误处理**：覆盖各种异常情况
4. **详细的结果输出**：包含完整的计算信息
5. **一致的代码风格**：遵循项目规范

### 9.2 开发建议

1. **参考 BFI.ts 实现**：作为标准模板进行参考
2. **充分利用工具函数**：减少重复代码，提高可维护性
3. **注重测试验证**：确保计算结果的准确性
4. **保持代码简洁**：避免过度复杂的逻辑
5. **及时更新文档**：保持文档与代码同步

## 10. 版本控制

- **文档版本**：1.0.0
- **创建日期**：2024年12月
- **基于版本**：BFI.ts v1.0.0
- **适用范围**：所有新开发的 scales 模板

---

**注意**：本文档将随着项目发展持续更新，请定期检查最新版本。如有疑问或建议，请及时反馈。
