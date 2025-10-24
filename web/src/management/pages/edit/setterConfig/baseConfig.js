export default [
  {
    title: '时间配置',
    key: 'timeConfig',
    formList: ['base_effectTime', 'limit_answerTime']
  },
  {
    title: '提交限制',
    key: 'limitConfig',
    formList: ['limit_tLimit', 'limit_fillAnswer', 'limit_fillSubmitAnswer']
  },
  {
    title: '作答限制',
    key: 'respondConfig',
    formList: [
      'interview_pwd_switch',
      'interview_pwd',
      'answer_type',
      'white_placeholder',
      'white_list',
      'team_list',
      'default_skip_score'
    ]
  },
  {
    title: '显隐控制词',
    key: 'displayControlConfig',
    formList: ['control_words']
  },
  {
    title: '回调配置',
    key: 'callbackConfig',
    formList: [
      'callback_enabled',
      'callback_url',
      'callback_method',
      'callback_timeout',
      'callback_retryCount',
      'callback_headers_enabled',
      'callback_headers'
    ]
  }
]
