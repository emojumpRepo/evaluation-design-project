import basicConfig from '@materials/questions/common/config/basicConfig'

const meta = {
  title: '下拉选择',
  type: 'select',
  componentName: 'SelectModule',
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
      description: '这是用于描述题目标题',
      defaultValue: '标题一'
    },
    {
      name: 'type',
      propType: 'String',
      description: '这是用于描述题目类型',
      defaultValue: 'select'
    },
    {
      name: 'isRequired',
      propType: Boolean,
      description: '是否必填',
      defaultValue: true
    },
    {
      name: 'showIndex',
      propType: Boolean,
      description: '显示序号',
      defaultValue: true
    },
    {
      name: 'showType',
      propType: Boolean,
      description: '显示类型',
      defaultValue: true
    },
    {
      name: 'showSpliter',
      propType: Boolean,
      description: '显示分割线',
      defaultValue: false
    },
    {
      name: 'options',
      propType: Array,
      description: '这是用于描述选项',
      defaultValue: [
        {
          text: "选项1",
          others: false,
          mustOthers: false,
          othersKey: "",
          placeholderDesc: "",
          hash: "115019",
          score: 0
        },
        {
          text: "选项2",
          others: false,
          mustOthers: false,
          othersKey: "",
          placeholderDesc: "",
          hash: "115020",
          score: 0
        }
      ]
    },
    {
      name: 'multiple',
      propType: Boolean,
      description: '是否多选',
      defaultValue: false
    },
    {
      name: 'minNum',
      propType: Number,
      description: '最少选择数(多选时)',
      defaultValue: 0
    },
    {
      name: 'maxNum',
      propType: Number,
      description: '最多选择数(多选时)',
      defaultValue: 0
    },
    {
      name: 'placeholder',
      propType: String,
      description: '占位提示文本',
      defaultValue: '请选择'
    }
  ],
  formConfig: [
    basicConfig,
    {
      name: 'selectConfig',
      title: '选择配置',
      type: 'Customed',
      content: [
        {
          label: '选择模式',
          type: 'RadioGroup',
          key: 'multiple',
          value: false,
          options: [
            {
              label: '单选',
              value: false
            },
            {
              label: '多选',
              value: true
            }
          ],
          // 当multiple值改变时,同时更新type字段
          valueSetter(data) {
            return [
              {
                key: 'multiple',
                value: data.value
              },
              {
                key: 'type',
                value: data.value ? 'select-multiple' : 'select'
              }
            ]
          }
        },
        {
          label: '占位提示',
          type: 'InputSetter',
          key: 'placeholder',
          value: '请选择',
          placeholder: '请输入占位提示文本'
        },
        {
          label: '至少选择数',
          type: 'InputNumber',
          key: 'minNum',
          value: 0,
          min: 0,
          max: (moduleConfig) => { return moduleConfig?.maxNum || 999 },
          contentClass: 'input-number-config',
          relyFunc: (moduleConfig) => {
            return moduleConfig?.multiple === true
          }
        },
        {
          label: '最多选择数',
          type: 'InputNumber',
          key: 'maxNum',
          value: 0,
          min: (moduleConfig) => { return moduleConfig?.minNum || 0 },
          max: (moduleConfig) => { return moduleConfig?.options?.length || 999 },
          contentClass: 'input-number-config',
          relyFunc: (moduleConfig) => {
            return moduleConfig?.multiple === true
          }
        }
      ]
    }
  ],
  editConfigure: {
    optionEdit: {
      show: true
    },
    optionEditBar: {
      show: true,
      configure: {
        showOthers: false,
        showAdvancedConfig: true
      }
    }
  }
}

export default meta
