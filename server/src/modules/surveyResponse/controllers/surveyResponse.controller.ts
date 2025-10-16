import { Controller, Post, Body, HttpCode, UseGuards } from '@nestjs/common';
import axios from 'axios';
import { HttpException } from 'src/exceptions/httpException';
import { SurveyNotFoundException } from 'src/exceptions/surveyNotFoundException';
import { checkSign } from 'src/utils/checkSign';
import { ENCRYPT_TYPE } from 'src/enums/encrypt';
import { EXCEPTION_CODE } from 'src/enums/exceptionCode';
import { getPushingData } from 'src/utils/messagePushing';
import { RECORD_SUB_STATUS } from 'src/enums';

import { ResponseSchemaService } from '../services/responseScheme.service';
import { SurveyResponseService } from '../services/surveyResponse.service';
import { ClientEncryptService } from '../services/clientEncrypt.service';
import { MessagePushingTaskService } from '../../message/services/messagePushingTask.service';
import { CallbackQueueService } from '../services/callbackQueue.service';

import moment from 'moment';
import * as Joi from 'joi';
import * as forge from 'node-forge';
import { ApiTags } from '@nestjs/swagger';
import { pick } from 'lodash';

import { CounterService } from '../services/counter.service';
import { Logger } from 'src/logger';
import { WhitelistType } from 'src/interfaces/survey';
import { UserService } from 'src/modules/auth/services/user.service';
import { WorkspaceMemberService } from 'src/modules/workspace/services/workspaceMember.service';
import { QUESTION_TYPE } from 'src/enums/question';
import { OpenAuthGuard } from 'src/guards/openAuth.guard';
import { CalculateService } from 'src/modules/survey/services/calculate.service';

const optionQuestionType: Array<string> = [
  QUESTION_TYPE.RADIO,
  QUESTION_TYPE.CHECKBOX,
  QUESTION_TYPE.BINARY_CHOICE,
  QUESTION_TYPE.VOTE,
];

@ApiTags('surveyResponse')
@Controller('/api/surveyResponse')
export class SurveyResponseController {
  constructor(
    private readonly responseSchemaService: ResponseSchemaService,
    private readonly surveyResponseService: SurveyResponseService,
    private readonly clientEncryptService: ClientEncryptService,
    private readonly messagePushingTaskService: MessagePushingTaskService,
    private readonly counterService: CounterService,
    private readonly logger: Logger,
    private readonly userService: UserService,
    private readonly workspaceMemberService: WorkspaceMemberService,
    private readonly calculateService: CalculateService,
    private readonly callbackQueueService: CallbackQueueService,
  ) {}

  @Post('/createResponse')
  @HttpCode(200)
  async createResponse(@Body() reqBody) {
    const value = await this.validateParams(reqBody);
    const {
      encryptType,
      data,
      sessionId,
      userId,
      assessmentId,
      questionId,
      tenantId,
    } = value;

    // 检查签名
    checkSign(reqBody);

    // 解密数据
    let result = data;
    let formValues: Record<string, any> = {};
    let encryptUserId = '';
    let originalUserId = '';
    let encryptAssessmentId = '';
    let originalAssessmentId = '';
    let encryptQuestionId = '';
    let originalQuestionId = '';
    let encryptTenantId = '';
    let originalTenantId = '';

    // 处理加密数据（数组格式）
    if (
      encryptType === ENCRYPT_TYPE.RSA &&
      Array.isArray(data) &&
      Array.isArray(userId) &&
      Array.isArray(assessmentId) &&
      Array.isArray(questionId)
    ) {
      result = await this.getDecryptedDataRSA(data, sessionId);
      encryptUserId = await this.getDecryptedDataRSA(userId, sessionId);
      encryptAssessmentId = await this.getDecryptedDataRSA(
        assessmentId,
        sessionId,
      );
      encryptQuestionId = await this.getDecryptedDataRSA(questionId, sessionId);
      encryptTenantId = await this.getDecryptedDataRSA(tenantId, sessionId);
      formValues = JSON.parse(JSON.stringify(result));
      originalUserId = encryptUserId;
      originalAssessmentId = encryptAssessmentId;
      originalQuestionId = encryptQuestionId;
      // 非加密通道时，直接透传字符串 tenantId
      originalTenantId = encryptTenantId || (value as any)?.tenantId || '';
    } else {
      // 处理非加密数据（字符串格式）
      formValues = JSON.parse(JSON.stringify(result));
      originalUserId = userId || '';
      originalAssessmentId = assessmentId || '';
      originalQuestionId = questionId || '';
    }
    try {
      const responseData = await this.createResponseProcess({
        ...value,
        data: formValues,
        userId: originalUserId,
        assessmentId: originalAssessmentId,
        questionId: originalQuestionId,
        tenantId: originalTenantId,
      });
      return {
        code: 200,
        msg: '提交成功',
        data: {
          responseId: responseData?.responseId,
        },
      };
    } catch (error) {
      this.logger.error(`createResponse error: ${error.message}`);
      throw error;
    }
  }
  @Post('/createResponseWithOpen')
  @UseGuards(OpenAuthGuard)
  @HttpCode(200)
  async createResponseWithOpen(@Body() reqBody) {
    if (!reqBody.channelId) {
      throw new HttpException('缺少渠道参数', EXCEPTION_CODE.PARAMETER_ERROR);
    }
    const value = await this.validateParams(reqBody);
    const { data } = value;
    const channelId = reqBody.channelId;

    // 解密数据
    let formValues: Record<string, any> = {};

    formValues =
      typeof data === 'string'
        ? JSON.parse(data)
        : JSON.parse(JSON.stringify(data));
    try {
      const responseData = await this.createResponseProcess(
        {
          ...value,
          data: formValues,
          channelId,
          tenantId: (reqBody as any)?.tenantId,
        },
        false,
      );
      return {
        code: 200,
        msg: '提交成功',
        data: {
          responseId: responseData?.responseId,
        },
      };
    } catch (error) {
      this.logger.error(`createResponse error: ${error.message}`);
      throw error;
    }
  }
  private async validateParams(reqBody) {
    // 校验参数
    const { value, error } = Joi.object({
      surveyPath: Joi.string().required(),
      data: Joi.any().required(),
      encryptType: Joi.string(),
      sessionId: Joi.string(),
      clientTime: Joi.number().required(),
      diffTime: Joi.number(),
      password: Joi.string().allow(null, ''),
      whitelist: Joi.string().allow(null, ''),
      userId: Joi.alternatives().try(
        Joi.array().items(Joi.string()),
        Joi.string().allow(null, ''),
      ),
      assessmentId: Joi.alternatives().try(
        Joi.array().items(Joi.string()),
        Joi.string().allow(null, ''),
      ),
      questionId: Joi.alternatives().try(
        Joi.array().items(Joi.string()),
        Joi.string().allow(null, ''),
      ),
      tenantId: Joi.array().items(Joi.string()).allow(null, ''),
    }).validate(reqBody, { allowUnknown: true });

    if (error) {
      this.logger.error(`updateMeta_parameter error: ${error.message}`);
      console.log('error', error);
      throw new HttpException('参数错误', EXCEPTION_CODE.PARAMETER_ERROR);
    }
    return value;
  }
  private async getDecryptedDataRSA(data, sessionId) {
    const sessionData =
      await this.clientEncryptService.getEncryptInfoById(sessionId);
    try {
      const privateKeyObject = forge.pki.privateKeyFromPem(
        sessionData.data.privateKey,
      );
      let concatStr = '';
      for (const item of data) {
        concatStr += privateKeyObject.decrypt(
          forge.util.decode64(item),
          'RSA-OAEP',
        );
      }

      const plainText = decodeURIComponent(concatStr);
      try {
        return JSON.parse(plainText);
      } catch (e) {
        // 如果不是合法JSON，则返回原始明文（用于userId/assessmentId/questionId等纯文本）
        return plainText;
      }
    } catch (error) {
      throw new HttpException(
        '数据解密失败',
        EXCEPTION_CODE.RESPONSE_DATA_DECRYPT_ERROR,
      );
    }
  }

  // 辅助方法：去除HTML标签
  private stripHtmlTags(str: string): string {
    return typeof str === 'string' ? str.replace(/<[^>]+>/g, '') : str;
  }

  // 辅助方法：映射题目类型
  private mapQuestionType(type: string): string {
    const typeMap = {
      RADIO: 'single_choice',
      radio: 'single_choice',
      CHECKBOX: 'multiple_choice',
      checkbox: 'multiple_choice',
      INPUT: 'text',
      input: 'text',
      TEXTAREA: 'textarea',
      textarea: 'textarea',
      NUMBER: 'number',
      number: 'number',
      RADIO_STAR: 'rating',
      radio_star: 'rating',
    };
    return typeMap[type] || 'other';
  }

  // 辅助方法：提取量表类型
  private extractScaleType(scaleType: string): string {
    if (scaleType?.includes('SDS')) return 'SDS';
    if (scaleType?.includes('SCL')) return 'SCL90';
    if (scaleType?.includes('大五')) return 'BIGFIVE';
    return 'GENERAL';
  }

  // 辅助方法：生成建议
  private generateRecommendations(calculationResult: any): string[] {
    if (!calculationResult) return [];

    const recommendations = [];
    const level =
      calculationResult?.depressionLevel || calculationResult?.level;

    if (level === '轻度抑郁') {
      recommendations.push('建议关注情绪健康');
      recommendations.push('保持规律作息');
      recommendations.push('适当运动锻炼');
    } else if (level === '中度抑郁') {
      recommendations.push('建议寻求专业心理咨询');
      recommendations.push('保持规律作息');
      recommendations.push('加强社交活动');
    } else if (level === '重度抑郁') {
      recommendations.push('强烈建议尽快寻求专业帮助');
      recommendations.push('联系心理医生或精神科医生');
      recommendations.push('保持与亲友的联系');
    }

    return recommendations;
  }

  static formatAllAnswers(dataList, formValues) {
    function stripHtmlTags(str) {
      if (typeof str !== 'string') return str;
      // 仅移除看起来像 HTML 标签/注释的结构：
      // - 标签以字母开头，如 <b>、</div>、<img ...>
      // - HTML 注释 <!-- ... -->
      // 保留普通小于/大于号，如 "1 < 2"、"a > b"。
      const removeHtmlLike = str
        // 去掉注释
        .replace(/<!--([\s\S]*?)-->/g, '')
        // 去掉以字母开头的标签（含关闭标签）
        .replace(/<\/?[a-zA-Z][^>]*>/g, '');

      // 将常见 HTML 实体还原为字符，避免 &lt; 被误认为标签后残留
      return removeHtmlLike
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim();
    }
    const result = [];
    let questionIndex = 1; // 题目序号计数器
    dataList.forEach((questionItem) => {
      // 跳过描述组件，不计入结果
      if (questionItem.type === 'description') {
        return;
      }
      const userValue = formValues[questionItem.field];
      let answerText: string | string[] = '';
      let scoreTotal = 0;
      let titleText = stripHtmlTags(questionItem.title);

      if (userValue === undefined || userValue === null || userValue === '') {
        answerText = '';
      } else if (questionItem.type === QUESTION_TYPE.SELECT) {
        // 下拉单选: answer为字符串
        if (
          Array.isArray(questionItem.options) &&
          questionItem.options.length > 0
        ) {
          const option = questionItem.options.find((opt) => opt.hash === userValue);
          answerText = option ? stripHtmlTags(option.text) : stripHtmlTags(String(userValue));
          const num = Number(option?.score);
          scoreTotal = Number.isFinite(num) ? num : 0;
        } else {
          answerText = stripHtmlTags(String(userValue));
        }
      } else if (questionItem.type === QUESTION_TYPE.SELECT_MULTIPLE) {
        // 下拉多选: answer为字符串数组
        if (
          Array.isArray(userValue) &&
          Array.isArray(questionItem.options) &&
          questionItem.options.length > 0
        ) {
          const optionScoreMap = {} as Record<string, number>;
          questionItem.options.forEach((opt) => {
            const num = Number(opt?.score);
            optionScoreMap[opt.hash] = Number.isFinite(num) ? num : 0;
          });
          answerText = userValue.map((hash) => {
            const option = questionItem.options.find((opt) => opt.hash === hash);
            return option ? stripHtmlTags(option.text) : stripHtmlTags(String(hash));
          });
          scoreTotal = userValue.reduce(
            (sum, hash) => sum + (optionScoreMap[hash] || 0),
            0,
          );
        } else {
          answerText = Array.isArray(userValue)
            ? userValue.map((v) => stripHtmlTags(String(v)))
            : [stripHtmlTags(String(userValue))];
        }
      } else if (questionItem.type === QUESTION_TYPE.INLINE_FORM) {
        // 内联填空: content作为title，答案根据field数量处理
        if (questionItem.content) {
          // 使用content替换placeholders为{{answer}}
          titleText = stripHtmlTags(questionItem.content).replace(
            /\{\{(input|select):[^}]+\}\}/g,
            '{{answer}}'
          );
        }

        if (typeof userValue === 'object' && userValue !== null) {
          const fieldValues = Object.values(userValue).filter(
            (v) => v !== undefined && v !== null && v !== ''
          );
          if (fieldValues.length === 1) {
            // 单个field: answer为字符串
            answerText = stripHtmlTags(String(fieldValues[0]));
          } else if (fieldValues.length > 1) {
            // 多个field: answer为字符串数组，按顺序保存field的值
            answerText = fieldValues.map((v) => stripHtmlTags(String(v)));
          } else {
            answerText = '';
          }
        } else {
          // 兼容旧数据（字符串类型）
          answerText = stripHtmlTags(String(userValue));
        }
      } else if (
        Array.isArray(questionItem.options) &&
        questionItem.options.length > 0
      ) {
        const optionMap = {} as Record<string, string>;
        const optionScoreMap = {} as Record<string, number>;
        questionItem.options.forEach((opt) => {
          optionMap[opt.hash] = stripHtmlTags(opt.text);
          const num = Number(opt?.score);
          optionScoreMap[opt.hash] = Number.isFinite(num) ? num : 0;
        });
        const getOptionWithInput = (val) => {
          const baseText = optionMap[val] || val;
          const inputKey = `${questionItem.field}_${val}`;
          const inputValue = formValues[inputKey];
          if (
            inputValue !== undefined &&
            inputValue !== null &&
            inputValue !== ''
          ) {
            return `${baseText}{{${stripHtmlTags(inputValue)}}}`;
          }
          return baseText;
        };
        if (Array.isArray(userValue)) {
          answerText = userValue.map(getOptionWithInput);
          scoreTotal = userValue.reduce(
            (sum, hash) => sum + (optionScoreMap[hash] || 0),
            0,
          );
        } else {
          answerText = getOptionWithInput(userValue);
          scoreTotal = optionScoreMap[userValue] || 0;
        }
      } else if (
        questionItem.type === QUESTION_TYPE.CASCADER &&
        questionItem.cascaderData
      ) {
        const optionTextMap = {} as Record<string, string>;
        let currentLevel = questionItem.cascaderData.children;
        const path = String(userValue).split(',');
        const arr = path.map((hash) => {
          const found = (currentLevel || []).find((opt) => opt.hash === hash);
          if (found) {
            optionTextMap[hash] = found.text;
            currentLevel = found.children;
            return stripHtmlTags(found.text);
          } else {
            return stripHtmlTags(hash);
          }
        });
        answerText = arr.length === 1 ? arr[0] : arr;
      } else {
        answerText = stripHtmlTags(userValue);
      }
      result.push({
        title: titleText,
        answer: answerText,
        index: questionIndex++, // 使用独立的题目计数器并递增
        score: scoreTotal,
      });
    });
    return result;
  }

  async sendSurveyAnswer(params) {
    const {
      responseSchema,
      formValues,
      originalUserId,
      originalQuestionId,
      originalAssessmentId,
      originalTenantId,
    } = params;
    // 格式化所有题目和答案
    const allAnswers = SurveyResponseController.formatAllAnswers(
      responseSchema.code.dataConf.dataList,
      formValues,
    );
    console.log('用户填写的所有题目和答案：' + JSON.stringify(allAnswers));

    // 检查参数是否有效（排除字符串'undefined'和空值）
    const isValidParam = (param: any) => {
      return (
        param &&
        param !== 'undefined' &&
        param !== undefined &&
        param !== null &&
        param !== ''
      );
    };

    // 发送加密后的问卷结果
    if (
      isValidParam(originalUserId) &&
      allAnswers &&
      isValidParam(originalQuestionId) &&
      isValidParam(originalAssessmentId)
    ) {
      try {
        await this.surveyResponseService.sendSurveyAnswer({
          userId: originalUserId,
          allAnswers: JSON.stringify(allAnswers),
          assessmentId: originalAssessmentId,
          questionId: originalQuestionId,
          tenantId: originalTenantId,
        });
      } catch (error) {
        console.error('发送问卷结果失败', error);
        // 发送问卷结果失败不应该影响问卷提交，只记录日志
        this.logger.error(`发送问卷结果失败: ${error.message}`);
      }
    } else {
      // 如果参数无效，只记录日志，不发送
      this.logger.info(
        `跳过发送问卷结果，参数无效: userId=${originalUserId}, assessmentId=${originalAssessmentId}, questionId=${originalQuestionId}`,
      );
    }
  }

  async createResponseProcess(params, canPush = true) {
    const {
      surveyPath,
      sessionId,
      clientTime,
      diffTime,
      password,
      whitelist: whitelistValue,
      data: formValues,
      userId: originalUserId,
      assessmentId: originalAssessmentId,
      questionId: originalQuestionId,
      tenantId: originalTenantId,
    } = params;

    // 查询schema
    const responseSchema =
      await this.responseSchemaService.getResponseSchemaByPath(surveyPath);
    if (!responseSchema || responseSchema.isDeleted) {
      throw new SurveyNotFoundException('该问卷不存在,无法提交');
    }
    if (responseSchema?.subStatus?.status === RECORD_SUB_STATUS.PAUSING) {
      throw new HttpException(
        '该问卷已暂停，无法提交',
        EXCEPTION_CODE.RESPONSE_PAUSING,
      );
    }

    // 白名单的verifyId校验
    const baseConf = responseSchema.code.baseConf;

    // 密码校验
    if (baseConf?.passwordSwitch && baseConf.password) {
      if (baseConf.password !== password) {
        throw new HttpException(
          '白名单验证失败',
          EXCEPTION_CODE.WHITELIST_ERROR,
        );
      }
    }

    // 名单校验（手机号/邮箱）
    if (baseConf?.whitelistType === WhitelistType.CUSTOM) {
      if (!baseConf.whitelist.includes(whitelistValue)) {
        throw new HttpException(
          '白名单验证失败',
          EXCEPTION_CODE.WHITELIST_ERROR,
        );
      }
    }

    // 团队成员昵称校验
    if (baseConf?.whitelistType === WhitelistType.MEMBER) {
      const user = await this.userService.getUserByUsername(whitelistValue);
      if (!user) {
        throw new HttpException(
          '白名单验证失败',
          EXCEPTION_CODE.WHITELIST_ERROR,
        );
      }

      const workspaceMember = await this.workspaceMemberService.findAllByUserId(
        { userId: user._id.toString() },
      );
      if (!workspaceMember.length) {
        throw new HttpException(
          '白名单验证失败',
          EXCEPTION_CODE.WHITELIST_ERROR,
        );
      }
    }

    const now = Date.now();
    // 提交时间限制
    const beginTime = responseSchema.code?.baseConf?.beginTime || 0;
    const endTime = responseSchema?.code?.baseConf?.endTime || 0;
    if (beginTime && endTime) {
      const beginTimeStamp = new Date(beginTime).getTime();
      const endTimeStamp = new Date(endTime).getTime();
      if (now < beginTimeStamp || now > endTimeStamp) {
        throw new HttpException(
          '不在答题有效期内',
          EXCEPTION_CODE.RESPONSE_CURRENT_TIME_NOT_ALLOW,
        );
      }
    }

    // 提交时间段限制
    const answerBegTime =
      responseSchema?.code?.baseConf?.answerBegTime || '00:00:00';
    const answerEndTime =
      responseSchema?.code?.baseConf?.answerEndTime || '00:00:00';
    if (answerBegTime && answerEndTime && answerBegTime !== answerEndTime) {
      const ymdString = moment().format('YYYY-MM-DD');
      const answerBegTimeStamp = new Date(
        `${ymdString} ${answerBegTime}`,
      ).getTime();
      const answerEndTimeStamp = new Date(
        `${ymdString} ${answerEndTime}`,
      ).getTime();
      if (now < answerBegTimeStamp || now > answerEndTimeStamp) {
        throw new HttpException(
          '不在答题时段内',
          EXCEPTION_CODE.RESPONSE_CURRENT_TIME_NOT_ALLOW,
        );
      }
    }

    // 提交总数限制
    const tLimit = responseSchema?.code?.baseConf?.tLimit || 0;
    if (tLimit > 0) {
      const nowSubmitCount =
        (await this.surveyResponseService.getSurveyResponseTotalByPath(
          surveyPath,
        )) || 0;
      if (nowSubmitCount >= tLimit) {
        throw new HttpException(
          '超出提交总数限制',
          EXCEPTION_CODE.RESPONSE_OVER_LIMIT,
        );
      }
    }

    // 生成一个optionTextAndId字段，因为选项文本可能会改，该字段记录当前提交的文本
    const dataList = responseSchema.code.dataConf.dataList;
    const optionTextAndId: Record<
      string,
      Array<{ hash: string; text: string }>
    > = {};
    const optionInfoWithId = dataList
      .filter((questionItem) => {
        return (
          optionQuestionType.includes(questionItem.type) &&
          Array.isArray(questionItem.options) &&
          questionItem.options.length > 0 &&
          formValues[questionItem.field]
        );
      })
      .reduce((pre, cur) => {
        const arr = cur.options.map((optionItem) => ({
          title: cur.title,
          hash: optionItem.hash,
          text: optionItem.text,
          quota: optionItem.quota ? Number(optionItem.quota) : 0,
        }));
        pre[cur.field] = arr;
        optionTextAndId[cur.field] = arr.map((item) =>
          pick(item, ['hash', 'text']),
        );
        return pre;
      }, {});

    await this.counterService.checkAndUpdateOptionCount({
      optionInfoWithId,
      userAnswer: formValues,
      surveyPath,
    });

    const surveyId = responseSchema.pageId;

    // 入库
    const model: any = {
      surveyPath: surveyPath,
      data: formValues,
      clientTime,
      diffTime,
      surveyId: responseSchema.pageId,
      optionTextAndId,
      channelId: params.channelId,
    };
    const surveyResponse =
      await this.surveyResponseService.createSurveyResponse(model);

    // 执行结果计算
    let calculationResult = null;
    const calculateConf = (responseSchema?.code as any)?.calculateConf;

    // 添加详细的调试日志
    console.log('=== 计算配置调试 ===');
    console.log('calculateConf:', calculateConf);
    console.log(`enabled: ${calculateConf?.enabled}`);
    console.log(`hasCode: ${!!calculateConf?.code}`);
    console.log(`codeLength: ${calculateConf?.code?.length || 0}`);
    if (calculateConf?.code) {
      console.log(`code preview: ${calculateConf.code.substring(0, 100)}...`);
    }

    this.logger.info(
      `计算配置调试: enabled=${calculateConf?.enabled}, hasCode=${!!calculateConf?.code}, codeLength=${calculateConf?.code?.length || 0}`,
    );

    if (calculateConf?.enabled && calculateConf?.code) {
      console.log('开始执行结果计算...');
      this.logger.info('开始执行结果计算');
      // 使用正确的题目数据源
      const questionList =
        (responseSchema?.code as any)?.questionDataList ||
        responseSchema?.code?.dataConf?.dataList ||
        [];

      console.log(`题目列表长度: ${questionList.length}`);
      this.logger.info(`题目列表长度: ${questionList.length}`);

      try {
        calculationResult = await this.calculateService.processCalculation(
          calculateConf,
          formValues,
          questionList,
        );

        console.log('计算结果:', calculationResult);
        this.logger.info(
          `计算结果: ${JSON.stringify(calculationResult).substring(0, 200)}`,
        );
      } catch (calcError) {
        console.error('计算执行错误:', calcError);
        this.logger.error(`计算执行错误: ${calcError.message}`);
      }

      // 如果有计算结果，保存到响应记录中
      if (calculationResult && !calculationResult.error) {
        await this.surveyResponseService.updateCalculationResult(
          surveyResponse._id.toString(),
          calculationResult,
        );
      }
    } else {
      console.log('未启用计算或代码为空');
      console.log('calculateConf?.enabled:', calculateConf?.enabled);
      console.log('calculateConf?.code:', !!calculateConf?.code);
      this.logger.info('未启用计算或代码为空');
    }
    console.log('=== 计算配置调试结束 ===');

    // 执行后端回调配置（优先使用问卷独立配置）
    const submitConf = responseSchema?.code?.submitConf;
    const callbackConfig = (submitConf as any)?.callbackConfig;

    this.logger.info(
      `回调配置调试信息: submitConf=${JSON.stringify((submitConf as any)?.callbackConfig || {})}`,
    );
    this.logger.info(
      `回调启用状态: enabled=${callbackConfig?.enabled}, url=${callbackConfig?.url}`,
    );

    if (callbackConfig?.enabled && callbackConfig?.url) {
      // 使用问卷独立配置的回调
      this.logger.info(`使用问卷独立回调配置: ${callbackConfig.url}`);

      // 使用队列处理回调，支持延迟重试
      await this.callbackQueueService.addCallbackJob({
        callbackConfig,
        callbackData: await this.buildCallbackData({
          responseSchema,
          formValues,
          originalUserId,
          originalAssessmentId,
          originalQuestionId,
          surveyResponse,
          surveyPath,
          calculationResult,
        }),
        surveyPath,
      });

      this.logger.info(`回调任务已加入队列: surveyPath=${surveyPath}`);
    } else if (canPush) {
      // 没有独立配置时，使用全局回调配置
      this.logger.info(`使用全局回调配置`);
      const sendData = getPushingData({
        surveyResponse,
        questionList: responseSchema?.code?.dataConf?.dataList || [],
        surveyId,
        surveyPath: responseSchema.surveyPath,
      });

      // 异步执行全局推送任务
      this.messagePushingTaskService.runResponseDataPush({
        surveyId,
        sendData,
      });
    } else {
      this.logger.info(`未配置任何回调`);
    }

    // 入库成功后，要把密钥删掉，防止被重复使用
    if (sessionId) {
      this.clientEncryptService.deleteEncryptInfo(sessionId);
    }

    // 最后发送问卷结果
    this.sendSurveyAnswer({
      responseSchema,
      formValues,
      originalUserId,
      originalQuestionId,
      originalAssessmentId,
      originalTenantId,
      clientTime,
    });

    // 返回responseId
    return {
      responseId: surveyResponse._id.toString(),
    };
  }

  // 构建回调数据
  async buildCallbackData(params) {
    const {
      responseSchema,
      formValues,
      originalUserId,
      originalAssessmentId,
      originalQuestionId,
      surveyResponse,
      surveyPath,
      calculationResult,
    } = params;

    // 格式化题目和答案数据，过滤掉描述组件
    const dataList = responseSchema.code.dataConf.dataList;
    const questions = dataList
      .filter((questionItem) => questionItem.type !== 'description') // 过滤掉描述组件
      .map((questionItem) => {
      const userValue = formValues[questionItem.field];
      const questionData = {
        questionId: questionItem.field,
        questionText: this.stripHtmlTags(questionItem.title),
        questionType: this.mapQuestionType(questionItem.type),
        options: [],
        userAnswer: null,
        answerScore: 0,
      };

      // 处理选项类题目
      if (questionItem.options && questionItem.options.length > 0) {
        questionData.options = questionItem.options.map((opt, optIdx) => ({
          optionId: String.fromCharCode(65 + optIdx), // A, B, C, D...
          optionText: this.stripHtmlTags(opt.text),
          score: opt.score || 0,
        }));

        // 获取用户答案
        if (userValue) {
          if (Array.isArray(userValue)) {
            // 多选题
            questionData.userAnswer = userValue.map((hash) => {
              const optIdx = questionItem.options.findIndex(
                (opt) => opt.hash === hash,
              );
              return optIdx >= 0 ? String.fromCharCode(65 + optIdx) : hash;
            });
            questionData.answerScore = userValue.reduce((sum, hash) => {
              const opt = questionItem.options.find((o) => o.hash === hash);
              return sum + (opt?.score || 0);
            }, 0);
          } else {
            // 单选题
            const optIdx = questionItem.options.findIndex(
              (opt) => opt.hash === userValue,
            );
            questionData.userAnswer =
              optIdx >= 0 ? String.fromCharCode(65 + optIdx) : userValue;
            const selectedOpt = questionItem.options.find(
              (opt) => opt.hash === userValue,
            );
            questionData.answerScore = selectedOpt?.score || 0;
          }
        }
      } else {
        // 非选项题目
        questionData.userAnswer = userValue || '';
      }

      return questionData;
    });

    // 构建回调数据
    const now = Date.now();
    const callbackData = {
      eventId: `evt_${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      questionnaireName: responseSchema.title || '问卷调查',
      questionnaireId: surveyPath || responseSchema.pageId || '',
      questionnaireType: calculationResult?.scaleType
        ? this.extractScaleType(calculationResult.scaleType)
        : 'GENERAL',
      user: {
        userId: originalUserId || 'anonymous',
      },
      result: {
        status: 'completed',
        rawScore: calculationResult?.rawScore || 0,
        standardScore: calculationResult?.standardScore || 0,
        level:
          calculationResult?.depressionLevel ||
          calculationResult?.level ||
          '未评级',
        interpretation: calculationResult?.interpretation || '',
        recommendations: this.generateRecommendations(calculationResult),
        dimensions: calculationResult?.dimensions || [],
        questions: questions,
      },
      completedAt: now,
      createdAt: surveyResponse.createDate?.getTime() || now,
      updatedAt: now,
    };

    return callbackData;
  }
}
