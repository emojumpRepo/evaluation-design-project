import { pick as _pick } from 'lodash-es'

export default {
  name: 'basicConfig',
  title: '基础配置',
  type: 'Customed',
  content: [
    {
      label: '题目选项',
      type: 'CheckboxGroup',
      key: 'basicConfigOptions',
      options: [
        {
          label: '必填',
          key: 'isRequired'
        },
        {
          label: '显示类型',
          key: 'showType'
        },
        {
          label: '显示序号',
          key: 'showIndex'
        },
        {
          label: '显示分割线',
          key: 'showSpliter',
          tip: '题目下方分割线，仅在移动端展示。'
        }
      ],
      valueGetter({ moduleConfig }) {
        return _pick(
          moduleConfig,
          this.options.map((item) => item.key)
        )
      }
    },
    {
      label: '每行题目数',
      type: 'RadioGroup',
      key: 'columnsPerRow',
      value: 1,
      tip: '设置一行显示几个题目（网格布局）',
      options: [
        { label: '1列（默认）', value: 1 },
        { label: '2列', value: 2 },
        { label: '3列', value: 3 },
        { label: '4列', value: 4 }
      ],
      valueGetter({ moduleConfig }) {
        return moduleConfig.columnsPerRow || 1
      }
    }
  ]
}
