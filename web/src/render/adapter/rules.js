import {
  forEach as _forEach,
  get as _get,
  isArray as _isArray,
  keys as _keys,
  set as _set
} from 'lodash-es'
import { INPUT, RATES, QUESTION_TYPE } from '@/common/typeEnum.ts'
import { regexpMap } from '@/common/regexpMap.ts'

const msgMap = {
  '*': '必填',
  m: '请输入手机号',
  idcard: '请输入正确的身份证号码',
  strictIdcard: '请输入正确的身份证号码',
  n: '请输入数字',
  nd: '请输入数字',
  e: '请输入邮箱',
  licensePlate: '请输入车牌号'
}
const checkBoxTip = '至少选择#min#项，少选择了#less#项'
const checkBoxTipSame = '请选择#min#项，少选择了#less#项'
const textRangeMinTip = '至少输入#min#字'
const numberRangeMinTip = '数字最小为#min#'
const numberRangeMaxTip = '数字最大为#max#'

// 多选题的选项数目限制
export function optionValidator(value, minNum, maxNum) {
  let tip = minNum === maxNum ? checkBoxTipSame : checkBoxTip
  if (_isArray(value) && value.length < minNum) {
    const less = minNum - value.length
    tip = tip.replace(/#min#/g, minNum)
    tip = tip.replace(/#less#/g, less)
    return tip
  }
  return ''
}

// textarea最小字数检验
export function textAreaValidator(isRequired, value, textRangeMin) {
  let tip = textRangeMinTip
  if (value && value.length < parseInt(textRangeMin)) {
    tip = tip.replace(/#min#/g, textRangeMin)
    return tip
  }
  return ''
}

// 数字类的输入框，配置了最小值的，要对数值做校验
export function numberMinValidator(value, numberRangeMin) {
  let tip = numberRangeMinTip
  if (Number(value) < Number(numberRangeMin)) {
    tip = tip.replace(/#min#/g, numberRangeMin)
    return tip
  }
  return ''
}
// 数字类的输入框，配置了最大值的，要对数值做校验
export function numberMaxValidator(value, numberRangeMax) {
  let tip = numberRangeMaxTip
  if (Number(value) > Number(numberRangeMax)) {
    tip = tip.replace(/#max#/g, numberRangeMax)
    return tip
  }
  return ''
}

// 从inline-form的content中解析出所有field名称及其配置
const parseInlineFormFields = (content) => {
  if (!content) return []

  const fields = []
  const inputRegex = /\{\{input:([^:}]+):([^:}]*):([^:}]*):([^:}]*):([^:}]*):([^:}]*)\}\}/g
  const selectRegex = /\{\{select:([^:}]+):/g

  let match
  // 解析input字段：{{input:fieldName:placeholder:inputType:min:max:step}}
  while ((match = inputRegex.exec(content)) !== null) {
    const fieldName = match[1].trim()
    const inputType = match[3].trim() || 'text'
    const min = match[4] && match[4].trim() !== '' ? parseFloat(match[4].trim()) : undefined
    const max = match[5] && match[5].trim() !== '' ? parseFloat(match[5].trim()) : undefined

    if (fieldName && !fields.some(f => f.name === fieldName)) {
      fields.push({
        name: fieldName,
        type: 'input',
        inputType: inputType,
        min: min,
        max: max
      })
    }
  }

  // 解析select字段
  while ((match = selectRegex.exec(content)) !== null) {
    const fieldName = match[1].trim()
    if (fieldName && !fields.some(f => f.name === fieldName)) {
      fields.push({
        name: fieldName,
        type: 'select'
      })
    }
  }

  return fields
}

// 根据提醒和题目的配置，生成本题的校验规则
export function generateValidArr(
  isRequired,
  valid,
  minNum,
  textRangeMin,
  type,
  numberRangeMin,
  numberRangeMax,
  content
) {
  const validArr = []
  const isInput = INPUT.indexOf(type) !== -1
  const isInlineForm = type === QUESTION_TYPE.INLINE_FORM

  if (isRequired || valid === '*') {
    // 内联填空的必填校验：检查Object中所有field是否都填写
    if (isInlineForm) {
      validArr.push({
        required: true,
        validator(rule, value, callback) {
          let errors = []
          let tip = ''

          // 从content中解析出所有应该存在的field
          const requiredFields = parseInlineFormFields(content)

          // value应该是一个Object，例如 {name: '张三', age: '18'}
          if (!value || typeof value !== 'object') {
            tip = '此项未填，请填写完整'
          } else if (requiredFields.length === 0) {
            // 如果没有解析出任何field，说明配置有问题
            tip = '此项未填，请填写完整'
          } else {
            // 检查所有required fields是否都已填写
            const hasEmpty = requiredFields.some(fieldConfig => {
              const val = value[fieldConfig.name]
              return val === undefined || val === null || val === '' ||
                     (typeof val === 'string' && val.trim() === '')
            })

            if (hasEmpty) {
              tip = '此项未填，请填写完整'
            }
          }

          if (tip) {
            errors = [tip]
          }
          callback(errors)
        }
      })
    }
    // 输入框的必填校验做trim
    else if (!isInput) {
      validArr.push({
        required: true,
        message: '此项未填，请填写完整'
        // trigger: 'change|blur'
      })
    } else {
      validArr.push({
        required: true,
        validator(rule, value, callback) {
          let errors = []
          let tip = ''
          if (value === '' || value?.replace(/\s*/, '') === '') {
            tip = '此项未填，请填写完整'
          }
          if (tip) {
            errors = [tip]
          }
          callback(errors)
        }
        // trigger: 'change|blur'
      })
    }
  }
  if (regexpMap[valid]) {
    validArr.push({
      validator(rule, value, callback) {
        let errors = []
        let tip = ''
        if (!regexpMap[valid].test(value)) {
          tip = msgMap[valid]
        }
        if (value === '') {
          tip = ''
        }
        if (tip) {
          errors = [tip]
        }
        callback(errors)
      }
      // trigger: 'change|blur'
    })
  }

  if (minNum) {
    validArr.unshift({
      validator(rule, value, callback) {
        let errors = []
        const tip = optionValidator(value, minNum)
        if (tip) {
          errors = [tip]
        }
        callback(errors)
      }
      // trigger: 'change|blur'
    })
  }

  if (textRangeMin) {
    validArr.push({
      validator(rule, value, callback) {
        let errors = []
        const tip = textAreaValidator(isRequired, value, textRangeMin)
        if (tip) {
          errors = [tip]
        }
        callback(errors)
      }
      // trigger: 'change|blur'
    })
  }

  if (isInput && valid === 'n' && numberRangeMin) {
    validArr.push({
      validator(rule, value, callback) {
        let errors = []
        const tip = numberMinValidator(value, numberRangeMin)
        if (tip) {
          errors = [tip]
        }
        callback(errors)
      }
      // trigger: 'change|blur'
    })
  }

  if (isInput && valid === 'n' && numberRangeMax) {
    validArr.push({
      validator(rule, value, callback) {
        let errors = []
        const tip = numberMaxValidator(value, numberRangeMax)
        if (tip) {
          errors = [tip]
        }
        callback(errors)
      }
      // trigger: 'change|blur'
    })
  }

  // inline-form的数字输入框范围校验
  if (isInlineForm && content) {
    const fields = parseInlineFormFields(content)
    fields.forEach(fieldConfig => {
      if (fieldConfig.type === 'input' && fieldConfig.inputType === 'number') {
        // 添加最小值校验
        if (fieldConfig.min !== undefined) {
          validArr.push({
            validator(rule, value, callback) {
              let errors = []
              if (value && typeof value === 'object') {
                const fieldValue = value[fieldConfig.name]
                if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
                  const tip = numberMinValidator(fieldValue, fieldConfig.min)
                  if (tip) {
                    errors = [tip]
                  }
                }
              }
              callback(errors)
            }
          })
        }

        // 添加最大值校验
        if (fieldConfig.max !== undefined) {
          validArr.push({
            validator(rule, value, callback) {
              let errors = []
              if (value && typeof value === 'object') {
                const fieldValue = value[fieldConfig.name]
                if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
                  const tip = numberMaxValidator(fieldValue, fieldConfig.max)
                  if (tip) {
                    errors = [tip]
                  }
                }
              }
              callback(errors)
            }
          })
        }
      }
    })
  }

  return validArr
}

// 生成选择类或者评分类的题目的更多输入框
const generateOthersKeyMap = (question) => {
  const { type, field } = question
  let othersKeyMap = undefined

  if (RATES.includes(type)) {
    const { rangeConfig } = question
    othersKeyMap = {}
    for (const key in rangeConfig) {
      if (rangeConfig[key].isShowInput) {
        othersKeyMap[`${field}_${key}`] = key
      }
    }
  } else if (type?.includes(QUESTION_TYPE.RADIO) || type?.includes(QUESTION_TYPE.CHECKBOX)) {
    const { options } = question
    othersKeyMap = {}
    options
      .filter((op) => op.others)
      .forEach((option) => {
        othersKeyMap[`${field}_${option.hash}`] = option.text
      })
  }
  return othersKeyMap
}

// 生成所有题目的校验规则
export default function (questionConfig) {
  const dataList = _get(questionConfig, 'dataConf.dataList')
  const rules = dataList.reduce((pre, current) => {
    const {
      field,
      valid,
      minNum,
      // othersKeyMap,
      type,
      options,
      isRequired,
      textRange,
      numberRange,
      rangeConfig,
      content
    } = current
    const othersKeyMap = generateOthersKeyMap(current)
    // 部分题目不校验（包括描述组件）
    if (valid === '0' || /mobileHidden|section|hidden/.test(type) || type === 'description') {
      return pre
    }

    let validMap = {}
    const textRangeMin = _get(textRange, 'min.value')
    const numberRangeMin = _get(numberRange, 'min.value')
    const numberRangeMax = _get(numberRange, 'max.value')

    const validArr = generateValidArr(
      isRequired,
      valid,
      minNum,
      textRangeMin,
      type,
      numberRangeMin,
      numberRangeMax,
      content
    )

    validMap = { [field]: validArr }

    // 对于选择题支持填写更多信息的，需要做是否必填的校验
    if (_keys(othersKeyMap).length) {
      if (RATES.includes(type)) {
        if (rangeConfig) {
          for (const key in rangeConfig) {
            if (rangeConfig[key].isShowInput && rangeConfig[key].required) {
              _set(validMap, `${field}_${key}`, generateValidArr(true, ''))
            }
          }
        }
      } else {
        _forEach(options, (item) => {
          const othersKey = `${field}_${item.hash}`
          const { mustOthers } = item
          if (mustOthers) {
            _set(validMap, othersKey, generateValidArr(true, ''))
          }
        })
      }
    }
    return Object.assign(validMap, pre)
  }, {})
  return { rules }
}
