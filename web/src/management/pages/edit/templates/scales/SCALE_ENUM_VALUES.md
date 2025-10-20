# 心理评估量表枚举值完整文档

## 📋 文档说明

本文档包含所有心理评估量表中使用的枚举值定义，供前端开发、数据分析和系统集成使用。


## 🎯 一、通用等级枚举

### 1. 三档通用等级（用于人格特质、能力评估等）
```typescript
export const FACTOR_LEVELS_3 = ['低', '中', '高'] as const
export type FactorLevel3 = typeof FACTOR_LEVELS_3[number]
```

**使用量表：**
- BFI 大五人格量表
- EPQ 埃森克人格问卷
- 其他需要三档评估的量表

---

## 😊 二、情绪相关量表枚举

### 1. 抑郁程度等级

#### SDS 抑郁自评量表（4档）
```typescript
export const SDS_DEPRESSION_LEVELS = ['正常', '轻度抑郁', '中度抑郁', '重度抑郁'] as const
export type SDSDepressionLevel = typeof SDS_DEPRESSION_LEVELS[number]
```

#### PHQ-9 抑郁症患者健康问卷（5档）
```typescript
export const PHQ9_DEPRESSION_LEVELS = ['无抑郁', '轻微抑郁', '中度抑郁', '中重度抑郁', '重度抑郁'] as const
export type Phq9DepressionLevel = typeof PHQ9_DEPRESSION_LEVELS[number]
```

### 2. 焦虑程度等级

#### SAS 焦虑自评量表（4档）
```typescript
export const SAS_ANXIETY_LEVELS = ['正常', '轻度焦虑', '中度焦虑', '重度焦虑'] as const
export type SASAnxietyLevel = typeof SAS_ANXIETY_LEVELS[number]
```

### 3. 焦虑抑郁混合等级

#### HADS 医院焦虑抑郁量表（4档）
```typescript
export const HADS_SEVERITY_LEVELS = ['正常', '轻度', '中度', '重度'] as const
export type HADSSeverityLevel = typeof HADS_SEVERITY_LEVELS[number]
```

---

## 🏥 三、症状筛查量表枚举

### 1. SCL-90 症状自评量表（5档严重度）
```typescript
export const SCL90_SEVERITY_LEVELS = ['正常', '轻度', '中度', '重度', '极重度'] as const
export type Scl90SeverityLevel = typeof SCL90_SEVERITY_LEVELS[number]
```

**适用因子：**
- 躯体化 (Somatization)
- 强迫 (Obsessive-Compulsive)
- 人际敏感 (Interpersonal Sensitivity)
- 抑郁 (Depression)
- 焦虑 (Anxiety)
- 敌对 (Hostility)
- 恐怖 (Phobic Anxiety)
- 偏执 (Paranoid Ideation)
- 精神病性 (Psychoticism)
- 其他 (Additional)

---

## 🧠 四、专项评估量表枚举

### 1. 强迫症状等级

#### Y-BOCS 耶鲁-布朗强迫症状量表（4档）
```typescript
export const YBOCS_SEVERITY_LEVELS = ['轻度', '中度', '重度', '极重'] as const
export type YbocsSeverity = typeof YBOCS_SEVERITY_LEVELS[number]
```

### 2. 述情障碍等级

#### TAS-20 述情障碍量表（3档）
```typescript
export const TAS_ALEXITHYMIA_LEVELS = ['无述情障碍', '边缘', '述情障碍'] as const
export type TasAlexithymiaLevel = typeof TAS_ALEXITHYMIA_LEVELS[number]
```

#### TAS-26 述情障碍量表（3档）
```typescript
export const TAS26_ALEXITHYMIA_LEVELS = ['无述情障碍', '边缘', '述情障碍'] as const
export type TAS26AlexithymiaLevel = typeof TAS26_ALEXITHYMIA_LEVELS[number]
```

### 3. 人际信任等级

#### ITS 人际信任量表（3档）
```typescript
export const ITS_TRUST_LEVELS = ['低信任', '中等信任', '高信任'] as const
export type ITSTrustLevel = typeof ITS_TRUST_LEVELS[number]
```

---

## ⚠️ 五、风险评估量表枚举

### 1. BSQ-12 双相情感障碍筛查量表（3档）
```typescript
export const BSQ12_LEVELS = ['可能单相抑郁', '可能抑郁或轻双相', '可能双相情感障碍'] as const
export type BSQ12Level = typeof BSQ12_LEVELS[number]
```

### 2. BSQ 通用风险等级（3档）
```typescript
export const BSQ_RISK_LEVELS = ['低风险', '中等风险', '高风险'] as const
export type BsqriskLevel = typeof BSQ_RISK_LEVELS[number]
```

---

## 📊 六、枚举值使用指南

### 1. 严重程度排序（从轻到重）

| 等级数 | 轻度 | 中度 | 重度 | 极重度 |
|--------|------|------|------|--------|
| **3档** | 低/正常 | 中 | 高 | - |
| **4档** | 正常 | 轻度 | 中度 | 重度 |
| **5档** | 正常 | 轻度 | 中度 | 重度/极重度 |

### 2. 量表适用场景

| 量表类型 | 推荐枚举 | 适用场景 |
|----------|----------|----------|
| **人格评估** | `FACTOR_LEVELS_3` | BFI, EPQ |
| **情绪状态** | `SDS_DEPRESSION_LEVELS`, `SAS_ANXIETY_LEVELS` | SDS, SAS |
| **症状筛查** | `SCL90_SEVERITY_LEVELS` | SCL-90 |
| **临床诊断** | `PHQ9_DEPRESSION_LEVELS` | PHQ-9 |
| **医院筛查** | `HADS_SEVERITY_LEVELS` | HADS |
| **专项评估** | 对应专用枚举 | Y-BOCS, TAS, ITS |

### 3. 枚举值映射关系

| 通用级别 | 抑郁量表 | 焦虑量表 | 症状量表 |
|----------|----------|----------|----------|
| **低/正常** | 正常/无抑郁 | 正常 | 正常 |
| **中/轻度** | 轻度抑郁/轻微抑郁 | 轻度焦虑 | 轻度 |
| **高/中度** | 中度抑郁 | 中度焦虑 | 中度 |
| **-** | 重度抑郁 | 重度焦虑 | 重度/极重度 |

---

## 🔧 七、开发使用示例

### 1. TypeScript 类型定义
```typescript
import { FACTOR_LEVELS_3, type FactorLevel3 } from './utils'

const level: FactorLevel3 = FACTOR_LEVELS_3[1] // '中'
```

### 2. 等级判断函数
```typescript
const getLevel = (score: number): FactorLevel3 => {
  if (score <= 30) return FACTOR_LEVELS_3[0]  // 低
  if (score <= 60) return FACTOR_LEVELS_3[1]  // 中
  return FACTOR_LEVELS_3[2]                     // 高
}
```

### 3. 响应数据结构
```typescript
interface ScaleResult {
  level: string
  levelArray: readonly string[]
  interpretation: string
  recommendations: string[]
}
```