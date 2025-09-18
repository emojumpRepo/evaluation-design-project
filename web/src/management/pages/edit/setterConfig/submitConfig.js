export default [
  {
    title: '提交按钮文案',
    type: 'InputSetter',
    key: 'submitTitle',
    placeholder: '提交',
    value: ''
  },
  {
    title: '提交确认弹窗',
    type: 'Customed',
    key: 'confirmAgain',
    content: [
      {
        label: '是否配置该项',
        labelStyle: { width: '120px' },
        type: 'CustomedSwitch',
        key: 'confirmAgain.is_again',
        value: true
      },
      {
        label: '二次确认文案',
        labelStyle: { width: '120px' },
        type: 'InputSetter',
        key: 'confirmAgain.again_text',
        placeholder: '确认要提交吗？',
        value: '确认要提交吗？'
      }
    ]
  },
  {
    title: '提交文案配置',
    type: 'Customed',
    key: 'msgContent',
    content: [
      {
        label: '已提交',
        labelStyle: { width: '120px' },
        type: 'InputSetter',
        key: 'msgContent.msg_9002',
        placeholder: '请勿多次提交！',
        value: '请勿多次提交！'
      },
      {
        label: '提交结束',
        labelStyle: { width: '120px' },
        type: 'InputSetter',
        key: 'msgContent.msg_9003',
        placeholder: '您来晚了，已经满额！',
        value: '您来晚了，已经满额！'
      },
      {
        label: '其他提交失败',
        labelStyle: { width: '120px' },
        type: 'InputSetter',
        key: 'msgContent.msg_9004',
        placeholder: '提交失败！',
        value: '提交失败！'
      }
    ]
  },
  {
    title: '回调配置',
    type: 'Customed',
    key: 'callbackConfig',
    content: [
      {
        label: '启用回调',
        labelStyle: { width: '120px' },
        type: 'CustomedSwitch',
        key: 'callbackConfig.enabled',
        value: false
      },
      {
        label: '回调地址',
        labelStyle: { width: '120px' },
        type: 'InputSetter',
        key: 'callbackConfig.url',
        placeholder: '请输入回调地址，如：https://example.com/callback',
        value: ''
      },
      {
        label: '回调方式',
        labelStyle: { width: '120px' },
        type: 'SelectSetter',
        key: 'callbackConfig.method',
        options: [
          { label: 'POST', value: 'POST' },
          { label: 'GET', value: 'GET' }
        ],
        value: 'POST'
      },
      {
        label: '超时时间(秒)',
        labelStyle: { width: '120px' },
        type: 'InputSetter',
        key: 'callbackConfig.timeout',
        placeholder: '请输入超时时间，默认10秒',
        value: '10'
      },
      {
        label: '重试次数',
        labelStyle: { width: '120px' },
        type: 'InputSetter',
        key: 'callbackConfig.retryCount',
        placeholder: '失败后重试次数，默认3次',
        value: '3'
      },
      {
        label: '自定义Headers',
        labelStyle: { width: '120px' },
        type: 'TextAreaSetter',
        key: 'callbackConfig.headers',
        placeholder: '请输入JSON格式的headers，如：{"Authorization": "Bearer token"}',
        value: '{}'
      }
    ]
  }
]
