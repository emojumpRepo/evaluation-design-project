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
    // 自定义未作答分数（直接作为顶层条目渲染，避免嵌套 Customed 无法渲染组件）
    {
      label: '启用题目级未作答分数',
      type: 'CustomedSwitch',
      key: 'overrideSkipScore',
      value: false,
      // 开启时确保写入 skipScore=0（即使未手动改动输入框），避免未持久化导致后端读取为 undefined
      valueSetter({ key, value }) {
        if (value) {
          return [
            { key, value },
            { key: 'skipScore', value: 0 }
          ]
        }
        return { key, value }
      }
    },
    {
      label: '未作答分数',
      type: 'InputNumber',
      key: 'skipScore',
      value: 0,
      min: 0,
      disabled: (data) => !data?.overrideSkipScore,
      contentClass: 'input-number-config'
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
