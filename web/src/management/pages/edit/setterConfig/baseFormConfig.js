// 问卷设置，定义了字段和对应的设置器
export default {
  base_effectTime: {
    keys: ['beginTime', 'endTime'],
    label: '答题有效期',
    type: 'QuestionTime',
    placeholder: 'yyyy-MM-dd hh:mm:ss'
  },
  limit_tLimit: {
    key: 'tLimit',
    label: '问卷回收总数',
    type: 'InputNumber',
    tip: '0为无限制，此功能用于限制该问卷总提交的数据量。当数据量达到限额时，该问卷将不能继续提交',
    tipShow: true,
    placement: 'top',
    min: 0
  },
  limit_answerTime: {
    keys: ['answerBegTime', 'answerEndTime'],
    label: '答题时段',
    tip: '问卷仅在指定时间段内可填写',
    type: 'QuestionTimeHour',
    placement: 'top'
  },
  limit_fillAnswer: {
    key: 'fillAnswer',
    label: '允许断点续答',
    tip: '回填前一次作答中的内容（注：更换设备/浏览器/清除缓存/更改内容重新发布则此功能失效）',
    placement: 'top',
    type: 'CustomedSwitch'
  },
  limit_fillSubmitAnswer: {
    key: 'fillSubmitAnswer',
    label: '自动填充上次提交内容',
    tip: '回填前一次提交的内容（注：更换设备/浏览器/清除缓存/更改内容重新发布则此功能失效）',
    placement: 'top',
    type: 'CustomedSwitch'
  },
  interview_pwd_switch: {
    key: 'passwordSwitch',
    label: '访问密码',
    type: 'CustomedSwitch'
  },
  interview_pwd: {
    key: 'password',
    type: 'InputSetter',
    placeholder: '请输入6位字符串类型访问密码 ',
    maxLength: 6,
    relyFunc: (data) => {
      return !!data?.passwordSwitch
    }
  },
  answer_type: {
    key: 'whitelistType',
    label: '答题名单',
    type: 'RadioGroup',
    options: [
      {
        label: '所有人',
        value: 'ALL'
      },
      {
        label: '空间成员',
        value: 'MEMBER'
      },
      {
        label: '白名单',
        value: 'CUSTOM'
      }
    ],
    // 批量修改value
    valueSetter(data) {
      return [
        data,
        {
          key: 'whitelistTip', // 切换tab清空名单登录提示语
          value: ''
        },
        {
          key: 'whitelist', // 切换tab清空名单列表
          value: []
        },
        {
          key: 'memberType',
          value: ''
        }
      ]
    }
  },
  white_placeholder: {
    key: 'whitelistTip',
    label: '名单登录提示语',
    placeholder: '请输入名单提示语',
    type: 'InputSetter',
    maxLength: 40,
    relyFunc: (data) => {
      return ['CUSTOM', 'MEMBER'].includes(data.whitelistType)
    }
  },
  white_list: {
    keys: ['whitelist', 'memberType'],
    label: '白名单列表',
    type: 'WhiteList',
    custom: true, // 自定义导入高级组件
    relyFunc: (data) => {
      return data.whitelistType === 'CUSTOM'
    }
  },
  team_list: {
    key: 'whitelist',
    label: '团队空间成员选择',
    type: 'TeamMemberList',
    custom: true, // 自定义导入高级组件
    relyFunc: (data) => {
      return data.whitelistType === 'MEMBER'
    }
  },
  callback_enabled: {
    key: 'callbackConfig.enabled',
    label: '启用回调',
    tip: '问卷提交成功后，将向配置的URL发送回调请求',
    placement: 'top',
    type: 'CustomedSwitch',
    value: false
  },
  callback_url: {
    key: 'callbackConfig.url',
    label: '回调地址',
    type: 'InputSetter',
    placeholder: '请输入回调地址，如：https://example.com/callback',
    tip: '问卷提交数据将发送到此地址',
    placement: 'top',
    value: '',
    relyFunc: (data) => {
      return !!data?.callbackConfig?.enabled
    }
  },
  callback_method: {
    key: 'callbackConfig.method',
    label: '请求方式',
    type: 'RadioGroup',
    value: 'POST',
    options: [
      {
        label: 'POST',
        value: 'POST'
      },
      {
        label: 'GET',
        value: 'GET'
      }
    ],
    relyFunc: (data) => {
      return !!data?.callbackConfig?.enabled
    }
  },
  callback_timeout: {
    key: 'callbackConfig.timeout',
    label: '超时时间(秒)',
    type: 'InputNumber',
    min: 1,
    max: 60,
    value: 10,
    placeholder: '请输入超时时间，默认10秒',
    tip: '回调请求的超时时间，范围1-60秒',
    placement: 'top',
    relyFunc: (data) => {
      return !!data?.callbackConfig?.enabled
    }
  },
  callback_retryCount: {
    key: 'callbackConfig.retryCount',
    label: '重试次数',
    type: 'InputNumber',
    min: 0,
    max: 10,
    value: 3,
    placeholder: '失败后重试次数，默认3次',
    tip: '回调失败后的重试次数，范围0-10次',
    placement: 'top',
    relyFunc: (data) => {
      return !!data?.callbackConfig?.enabled
    }
  },
  callback_headers_enabled: {
    key: 'callbackConfig.headersEnabled',
    label: '启用自定义Headers',
    type: 'CustomedSwitch',
    value: false,
    tip: '开启后可自定义HTTP请求头',
    placement: 'top',
    relyFunc: (data) => {
      return !!data?.callbackConfig?.enabled
    }
  },
  callback_headers: {
    key: 'callbackConfig.headers',
    label: '请求头配置',
    type: 'JsonTextarea',
    value: '{\n  "Content-Type": "application/json"\n}',
    placeholder: '请输入JSON格式的headers',
    tip: '必须是有效的JSON格式，例如：{"Authorization": "Bearer token", "X-Custom-Header": "value"}',
    placement: 'top',
    rows: 6,
    relyFunc: (data) => {
      return !!data?.callbackConfig?.enabled && !!data?.callbackConfig?.headersEnabled
    }
  },
  control_words: {
    key: 'controlWords',
    label: '显隐控制词',
    type: 'Customed',
    title: '',
    tip: '设置问卷接收的题目显隐控制词，可在问卷编辑——逻辑设置模块根据显隐控制词控制题目的显示逻辑',
    tipShow: true,
    content: [
      {
        key: 'controlWords',
        label: '显隐控制词',
        type: 'MultiSelect',
        placeholder: '请选择或输入控制词后回车添加',
        allowCreate: true,
        tip: '设置问卷接收的题目显隐控制词，可在“问卷编辑” — “逻辑设置”根据显隐控制词控制题目的显示逻辑',
        tipShow: true,
        placement: 'top',
        filterable: true,
        optionsKey: 'controlWords', // 从当前值渲染为可选项，亦可直接输入新词
        contentClass: 'w-100'
      }
    ],
    placement: 'top'
  }
}
