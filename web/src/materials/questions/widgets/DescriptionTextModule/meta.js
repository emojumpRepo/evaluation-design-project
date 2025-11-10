import basicConfig from '@materials/questions/common/config/basicConfig'

export const meta = {
  title: '描述文本',
  type: 'description',
  componentName: 'DescriptionTextModule',
  isQuestion: false, // 标记这不是一道题目，不计入题目编号
  attrs: [
    {
      name: 'field',
      propType: 'String',
      description: '这是用于描述题目id',
      defaultValue: ''
    },
    {
      name: 'title',
      propType: 'String',
      description: '这是用于描述标题(通常不显示)',
      defaultValue: '描述文本'
    },
    {
      name: 'type',
      propType: 'String',
      description: '这是用于描述题目类型',
      defaultValue: 'description'
    },
    {
      name: 'content',
      propType: 'String',
      description: '描述文本内容',
      defaultValue: '<p>请输入描述文本内容</p>'
    },
    {
      name: 'showIndex',
      propType: Boolean,
      description: '显示序号',
      defaultValue: false
    },
    {
      name: 'showType',
      propType: Boolean,
      description: '显示类型',
      defaultValue: false
    },
    {
      name: 'showSpliter',
      propType: Boolean,
      description: '显示分割线',
      defaultValue: false
    },
    {
      name: 'isRequired',
      propType: Boolean,
      description: '是否必填(描述文本不需要必填)',
      defaultValue: false
    }
  ],
  formConfig: [
    basicConfig,
    {
      name: 'content',
      title: '描述内容',
      type: 'RichText',
      key: 'content',
      placeholder: '请输入描述文本内容'
    }
  ]
}

export default meta
