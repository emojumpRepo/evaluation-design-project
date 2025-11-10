import basicConfig from '@materials/questions/common/config/basicConfig'

const meta = {
  title: '内联填空',
  type: 'inline-form',
  componentName: 'InlineFormModule',
  attrs: [
    {
      name: 'field',
      propType: 'String',
      description: '这是用于描述题目id',
      defaultValue: ''
    },
    {
      name: 'type',
      propType: 'String',
      description: '这是用于描述题目类型',
      defaultValue: 'inline-form'
    },
    {
      name: 'title',
      propType: 'String',
      description: '题目标题',
      defaultValue: '标题'
    },
    {
      name: 'showIndex',
      propType: Boolean,
      description: '显示序号',
      defaultValue: true
    },
    {
      name: 'showSpliter',
      propType: Boolean,
      description: '显示分割线',
      defaultValue: false
    },
    {
      name: 'content',
      propType: String,
      description: '填空题内容（包含占位符，格式：{{input:fieldName:placeholder}} 或 {{select:fieldName:options}}）',
      defaultValue: '父母离异时，您的年龄是{{input:age:请输入年龄}}岁'
    },
    {
      name: 'value',
      propType: Object,
      description: '字段值映射对象',
      defaultValue: {}
    },
    {
      name: 'isRequired',
      propType: Boolean,
      description: '是否必填',
      defaultValue: true
    }
  ],
  formConfig: [
    basicConfig,
    {
      name: 'contentConfig',
      title: '内容配置',
      type: 'Customed',
      content: [
        {
          label: '填空内容',
          type: 'InlineFormSetter',
          key: 'content',
          value: '父母离异时，您的年龄是{{input:age:请输入年龄}}岁'
        }
      ]
    }
  ],
  editConfigure: {
    optionEdit: {
      show: false
    },
    optionEditBar: {
      show: false
    }
  }
}

export default meta
