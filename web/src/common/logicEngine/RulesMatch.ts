import { Operator, type FieldTypes, type Fact } from './BasicType'

// 定义条件规则类
export class ConditionNode<F extends string, O extends Operator> {
  // 默认显示
  public result: boolean | undefined = undefined
  constructor(
    public field: F,
    public operator: O,
    public value: FieldTypes
  ) {}

  // 计算条件规则的哈希值
  calculateHash(): string {
    // 假设哈希值计算方法为简单的字符串拼接或其他哈希算法
    return this.field + this.operator + this.value
  }

  match(facts: Fact): boolean | undefined {
    // console.log(this.calculateHash())
    // 特殊操作符（例如分数区间）不依赖 facts[field]，故跳过缺失校验
    const needFieldPresence = this.operator !== Operator.ScoreBetween
    if (needFieldPresence && !facts[this.field]) {
      this.result = false
      return this.result
    }
    const normalizeFactValue = (factValue: any): string | string[] => {
      if (Array.isArray(factValue)) {
        return factValue.map((item) => (item == null ? '' : String(item)))
      }
      if (typeof factValue === 'string') {
        return factValue
      }
      if (factValue && typeof factValue === 'object') {
        return Object.values(factValue).map((item) => (item == null ? '' : String(item)))
      }
      if (factValue === undefined || factValue === null) {
        return ''
      }
      return String(factValue)
    }

    const factValue = normalizeFactValue(facts[this.field])
    const includesValue = (source: string | string[], target: FieldTypes) => {
      const value = target == null ? '' : String(target)
      if (Array.isArray(source)) {
        return source.includes(value)
      }
      if (typeof source === 'string') {
        return source.includes(value)
      }
      return false
    }

    const arrayIncludesAll = (source: string | string[], targets: FieldTypes[]) => {
      return targets.every((item) => includesValue(source, item))
    }

    const arraySome = (source: string | string[], targets: FieldTypes[]) => {
      return targets.some((item) => includesValue(source, item))
    }

    switch (this.operator) {
      case Operator.Equal:
        if (this.value instanceof Array) {
          this.result = arrayIncludesAll(factValue, this.value)
          return this.result
        } else {
          this.result = includesValue(factValue, this.value)
          return this.result
        }
      case Operator.Include:
        if (this.value instanceof Array) {
          this.result = arraySome(factValue, this.value)
          return this.result
        } else {
          this.result = includesValue(factValue, this.value)
          return this.result
        }
      case Operator.NotInclude:
        if (this.value instanceof Array) {
          this.result = this.value.some((v) => !includesValue(factValue, v))
          return this.result
        } else {
          this.result = !includesValue(factValue, this.value)
          return this.result
        }
      case Operator.NotEqual:
        if (this.value instanceof Array) {
          this.result = this.value.every((v) => !includesValue(factValue, v))
          return this.result
        } else {
          const factString =
            Array.isArray(factValue) ? factValue.join(',') : (factValue == null ? '' : String(factValue))
          this.result = factString !== String(this.value)
          return this.result
        }
      case Operator.ScoreBetween:
        try {
          // value: { fields: string[], min?: number, max?: number }
          const { fields = [], min, max } = (this.value || {}) as any
          if (!Array.isArray(fields) || fields.length === 0) {
            this.result = false
            return this.result
          }
          // 计算指定题目分数之和
          const schema: any[] = (facts as any)['__schema'] || []
          const fieldToScoreMap = new Map<string, number>()
          schema.forEach((q: any) => {
            if (!q || !q.field || !Array.isArray(q.options)) return
            const answer = facts[q.field]
            const selected = Array.isArray(answer) ? answer : (answer ? [answer] : [])
            let sum = 0
            q.options.forEach((opt: any) => {
              if (selected.includes(opt.hash)) {
                const s = Number(opt.score || 0)
                if (Number.isFinite(s)) sum += s
              }
            })
            fieldToScoreMap.set(q.field, sum)
          })

          const total = fields.reduce((acc: number, f: string) => acc + (fieldToScoreMap.get(f) || 0), 0)
          let ok = true
          if (typeof min === 'number') ok = ok && total >= min
          if (typeof max === 'number') ok = ok && total <= max
          this.result = ok
          return this.result
        } catch (e) {
          this.result = false
          return this.result
        }
      // 其他比较操作符的判断逻辑
      default:
        return this.result
    }
  }

  getResult() {
    return this.result
  }
}

export class RuleNode {
  conditions: Map<string, ConditionNode<string, Operator>> // 使用哈希表存储条件规则对象
  public result: boolean | undefined
  constructor(
    public target: string,
    public scope: string
  ) {
    this.conditions = new Map()
  }
  // 条件比较关系：and/or，默认 and
  public comparor: 'and' | 'or' = 'and'
  // 条件之间连接符（长度=conditions-1）
  public joins: Array<'and' | 'or'> = []
  // 添加条件规则到规则引擎中
  addCondition(condition: ConditionNode<string, Operator>) {
    const hash = condition.calculateHash()
    this.conditions.set(hash, condition)
  }

  // 匹配条件规则
  match(fact: Fact, comparor?: any) {
    // 支持条件分组：按 groupId 聚合；若无分组，逐条件按 joins 连接
    const list = Array.from(this.conditions.values())
    if (list.length === 0) {
      this.result = true
      return true
    }

    // 检测是否有显式分组
    const hasAnyGroup = list.some((c: any) => typeof c.groupId === 'number' && c.groupId !== 0)
    let res: boolean
    if (hasAnyGroup) {
      // 分组模式：按原顺序识别各组段，组内用 joins 计算，组间使用边界 join（上一段最后一条与下一段首条之间的 join）
      const joinsArr: Array<'and' | 'or'> = (this as any).joins || []
      const results = list.map((c) => !!c.match(fact))
      // 构建连续段
      const segments: Array<{ gid: number; start: number; end: number }> = []
      let start = 0
      let curGid = typeof (list[0] as any).groupId === 'number' ? (list[0] as any).groupId : 0
      for (let i = 1; i < list.length; i++) {
        const gid = typeof (list[i] as any).groupId === 'number' ? (list[i] as any).groupId : 0
        if (gid !== curGid) {
          segments.push({ gid: curGid, start, end: i - 1 })
          start = i
          curGid = gid
        }
      }
      segments.push({ gid: curGid, start, end: list.length - 1 })

      // 计算每段结果
      const segRes: boolean[] = segments.map((seg) => {
        let acc = results[seg.start]
        for (let i = seg.start + 1; i <= seg.end; i++) {
          const op = joinsArr[i - 1] === 'or' ? 'or' : 'and'
          acc = op === 'or' ? (acc || results[i]) : (acc && results[i])
        }
        return acc
      })

      // 用边界 join 连接各段
      res = segRes[0]
      for (let s = 1; s < segments.length; s++) {
        const boundaryLeftIdx = segments[s - 1].end // join 索引即为左侧条件索引
        const op = joinsArr[boundaryLeftIdx] === 'or' ? 'or' : 'and'
        res = op === 'or' ? (res || segRes[s]) : (res && segRes[s])
      }
    } else {
      // 非分组模式：依次用 joins 连接（长度 = n-1）
      const results = list.map((c) => !!c.match(fact))
      if (results.length === 1) {
        res = results[0]
      } else {
        const joins = (this as any).joins || []
        res = results[0]
        for (let i = 1; i < results.length; i++) {
          const join = joins[i - 1] === 'or' ? 'or' : 'and'
          res = join === 'or' ? (res || results[i]) : (res && results[i])
        }
      }
    }

    this.result = res
    return res
  }
  getResult() {
    const res = Array.from(this.conditions.entries()).every(([, value]) => {
      const res = value.getResult()
      return res
    })
    return res
  }

  // 计算条件规则的哈希值
  calculateHash(): string {
    // 假设哈希值计算方法为简单的字符串拼接或其他哈希算法
    return this.target + this.scope
  }
  toJson() {
    return {
      target: this.target,
      scope: this.scope,
      conditions: Object.fromEntries(
        Array.from(this.conditions, ([key, value]) => [key, value.getResult()])
      )
    }
  }
}

export class RuleMatch {
  rules: Map<string, RuleNode>
  // static instance: any
  constructor() {
    this.rules = new Map()
    // if (!RuleMatch.instance) {
    //   RuleMatch.instance = this
    // }

    // return RuleMatch.instance
  }
  fromJson(ruleConf: any) {
    if (ruleConf instanceof Array) {
      ruleConf.forEach((rule: any) => {
        const ruleNode = new RuleNode(rule.target, rule.scope)
        if (rule.comparor === 'or' || rule.comparor === 'and') {
          // @ts-ignore
          ruleNode.comparor = rule.comparor
        }
        if (Array.isArray(rule.joins)) {
          // @ts-ignore
          ruleNode.joins = rule.joins.filter((j: any) => j === 'and' || j === 'or')
        }
        rule.conditions.forEach((condition: any) => {
          const { field, operator, value, groupId, groupComparor } = condition
          const conditionNode = new ConditionNode(field, operator, value)
          // 挂载分组信息到运行时条件节点
          ;(conditionNode as any).groupId = typeof groupId === 'number' ? groupId : undefined
          ;(conditionNode as any).groupComparor = groupComparor === 'or' ? 'or' : (groupComparor === 'and' ? 'and' : undefined)
          ruleNode.addCondition(conditionNode)
        })
        this.addRule(ruleNode)
      })
    }
    return this
  }

  // 添加条件规则到规则引擎中
  addRule(rule: RuleNode) {
    const hash = rule.calculateHash()
    if (this.rules.has(hash)) {
      const existRule: any = this.rules.get(hash)
      existRule.conditions.forEach((item: ConditionNode<string, Operator>) => {
        rule.addCondition(item)
      })
    }

    this.rules.set(hash, rule)
  }

  // 特定目标题规则匹配
  match(target: string, scope: string, fact: Fact, comparor?: any) {
    const hash = this.calculateHash(target, scope)

    const rule = this.rules.get(hash)
    if (rule) {
      const result = rule.match(fact, comparor || rule.comparor)
      return result
    } else {
      // 默认显示
      return true
    }
  }
  /* 获取条件题关联的多个目标题匹配情况 */
  getResultsByField(field: string, fact: Fact) {
    const rules = this.findRulesByField(field)
    return rules.map(([, rule]) => {
      return {
        target: rule.target,
        result: this.match(rule.target, 'question', fact, 'or')
      }
    })
  }
  /* 获取目标题的规则是否匹配 */
  getResultByTarget(target: string, scope: string) {
    const hash = this.calculateHash(target, scope)
    const rule = this.rules.get(hash)
    if (rule) {
      const result = rule.getResult()
      return result
    } else {
      // 默认显示
      return true
    }
  }
  // 计算哈希值的方法
  calculateHash(target: string, scope: string): string {
    // 假设哈希值计算方法为简单的字符串拼接或其他哈希算法
    return target + scope
  }
  // 查找条件题的规则
  findRulesByField(field: string) {
    const list = [...this.rules.entries()]
    const match = list.filter(([, ruleValue]) => {
      const list = [...ruleValue.conditions.entries()]
      const res = list.filter(([, conditionValue]) => {
        const hit = conditionValue.field === field
        return hit
      })
      return res.length
    })
    return match
  }
  toJson() {
    return Array.from(this.rules.entries()).map(([, value]) => {
      return value.toJson()
    })
  }
}
