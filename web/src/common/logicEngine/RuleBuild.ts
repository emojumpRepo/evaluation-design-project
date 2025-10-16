import { nanoid } from 'nanoid'
import * as yup from 'yup'
import { type FieldTypes, PrefixID, Operator, Scope } from './BasicType'

export function generateID(prefix = PrefixID.Rule) {
  return `${prefix}-${nanoid(5)}`
}
// 定义条件规则类
export class ConditionNode {
  id: string = ''
  public field: string = ''
  public operator: Operator = Operator.Include
  public value: FieldTypes = []
  public groupId?: number
  public groupComparor?: 'and' | 'or'
  constructor(field: string = '', operator: Operator = Operator.Include, value: FieldTypes = []) {
    this.field = field
    this.operator = operator
    this.value = value
    this.id = generateID(PrefixID.Condition)
  }
  setField(field: string) {
    this.field = field
  }
  setOperator(operator: Operator) {
    this.operator = operator
  }
  setValue(value: FieldTypes) {
    this.value = value
  }
}

export class RuleNode {
  id: string = ''
  conditions: ConditionNode[] = []
  scope: string = Scope.Question
  target: string = ''
  // 条件关系：and/ or（默认 and）
  comparor: 'and' | 'or' = 'and'
  // 条件之间的连接符（按顺序，长度=conditions.length-1），允许分别设置
  joins: Array<'and' | 'or'> = []
  constructor(target: string = '', scope: string = Scope.Question, id?: string) {
    this.id = id || generateID(PrefixID.Rule)
    this.scope = scope
    this.target = target
  }
  setTarget(value: string) {
    this.target = value
  }
  addCondition(condition: ConditionNode) {
    this.conditions.push(condition)
  }
  removeCondition(id: string) {
    this.conditions = this.conditions.filter((v) => v.id !== id)
  }
  findCondition(conditionId: string) {
    return this.conditions.find((condition) => condition.id === conditionId)
  }
}

export class RuleBuild {
  rules: RuleNode[] = []
  constructor() {
    this.rules = []
  }

  // 添加条件规则到规则引擎中
  addRule(rule: RuleNode) {
    this.rules.push(rule)
  }
  removeRule(ruleId: string) {
    this.rules = this.rules.filter((rule) => rule.id !== ruleId)
  }
  clear() {
    this.rules = []
  }
  findRule(ruleId: string) {
    return this.rules.find((rule) => rule.id === ruleId)
  }
  toJson() {
    return this.rules.map((rule) => {
      return {
        target: rule.target,
        scope: rule.scope,
        comparor: rule.comparor,
        joins: rule.joins,
        conditions: rule.conditions.map((condition) => {
          return {
            field: condition.field,
            operator: condition.operator,
            value: condition.value,
            groupId: condition.groupId,
            groupComparor: condition.groupComparor
          }
        })
      }
    })
  }
  fromJson(ruleConf: any) {
    this.rules = []
    if (ruleConf instanceof Array) {
      ruleConf.forEach((rule: any) => {
        const { scope, target, comparor, joins } = rule
        const ruleNode = new RuleNode(target, scope)
        if (comparor === 'or' || comparor === 'and') {
          ruleNode.comparor = comparor
        }
        if (Array.isArray(joins)) {
          ruleNode.joins = joins.filter((j: any) => j === 'and' || j === 'or')
        }
        rule.conditions.forEach((condition: any) => {
          const { field, operator, value, groupId, groupComparor } = condition
          const conditionNode = new ConditionNode(field, operator, value)
          conditionNode.groupId = typeof groupId === 'number' ? groupId : undefined
          conditionNode.groupComparor = groupComparor === 'or' ? 'or' : (groupComparor === 'and' ? 'and' : undefined)
          ruleNode.addCondition(conditionNode)
        })
        this.addRule(ruleNode)
      })
    }
    return this
  }
  validateSchema() {
    return ruleSchema.validateSync(this.toJson())
  }
  // 实现目标选择了下拉框置灰效果
  findTargetsByScope(scope: string) {
    return this.rules.filter((rule) => rule.scope === scope).map((rule) => rule.target)
  }
  findRulesByField(field: string) {
    return this.rules.filter((rule) => {
      return rule.conditions.filter((condition) => condition.field === field).length
    })
  }
  // 实现前置题删除校验
  findTargetsByField(field: string) {
    const nodes = this.findRulesByField(field)
    return nodes.map((item: any) => {
      return item.target
    })
  }
  // 根据目标题获取关联的逻辑条件
  findConditionByTarget(target: string) {
    return this.rules.filter((rule) => rule.target === target).map((item) => item.conditions)
  }
}

export const ruleSchema = yup.array().of(
  yup.object({
    target: yup.string().required(),
    scope: yup.string().required(),
    comparor: yup.string().oneOf(['and', 'or']).notRequired(),
    joins: yup.array().of(yup.string().oneOf(['and', 'or'])).notRequired(),
    conditions: yup.array().of(
      yup.object({
        field: yup.string().required(),
        operator: yup.string().required(),
        value: yup.mixed().test('value-shape', 'invalid value', function (v) {
          const { operator } = this.parent as any
          if (operator === 'score_between') {
            if (v && typeof v === 'object') {
              const fieldsOk = Array.isArray((v as any).fields)
                && (v as any).fields.every((s: any) => typeof s === 'string')
              const minOk = (typeof (v as any).min === 'number') || typeof (v as any).min === 'undefined'
              const maxOk = (typeof (v as any).max === 'number') || typeof (v as any).max === 'undefined'
              return fieldsOk && minOk && maxOk
            }
            return false
          }
          // 默认要求为字符串数组
          return Array.isArray(v) && v.every((s) => typeof s === 'string')
        }),
        groupId: yup.number().notRequired(),
        groupComparor: yup.string().oneOf(['and', 'or']).notRequired()
      })
    )
  })
)
