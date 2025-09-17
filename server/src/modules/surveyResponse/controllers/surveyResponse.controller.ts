import { Controller, Post, Body, HttpCode, UseGuards } from '@nestjs/common';
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
  ) {}

  @Post('/createResponse')
  @HttpCode(200)
  async createResponse(@Body() reqBody) {
    const value = await this.validateParams(reqBody);
    const { encryptType, data, sessionId, userId, assessmentId, questionId } =
      value;

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
    }
    formValues = JSON.parse(JSON.stringify(result));
    originalUserId = encryptUserId;
    originalAssessmentId = encryptAssessmentId;
    originalQuestionId = encryptQuestionId;
    try {
      const responseData = await this.createResponseProcess({
        ...value,
        data: formValues,
        userId: originalUserId,
        assessmentId: originalAssessmentId,
        questionId: originalQuestionId,
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
        { ...value, data: formValues, channelId },
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
      userId: Joi.array().items(Joi.string()).allow(null, ''),
      assessmentId: Joi.array().items(Joi.string()).allow(null, ''),
      questionId: Joi.array().items(Joi.string()).allow(null, ''),
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

  static formatAllAnswers(dataList, formValues) {
    function stripHtmlTags(str) {
      return typeof str === 'string' ? str.replace(/<[^>]+>/g, '') : str;
    }
    const result = [];
    dataList.forEach((questionItem, idx) => {
      const userValue = formValues[questionItem.field];
      let answerText: string | string[] = '';
      let scoreTotal = 0;
      const titleText = stripHtmlTags(questionItem.title);
      if (userValue === undefined || userValue === null || userValue === '') {
        answerText = '';
      } else if (
        Array.isArray(questionItem.options) &&
        questionItem.options.length > 0
      ) {
        const optionMap = {} as Record<string, string>;
        const optionScoreMap = {} as Record<string, number>;
        questionItem.options.forEach((opt) => {
          optionMap[opt.hash] = opt.text;
          const num = Number(opt?.score);
          optionScoreMap[opt.hash] = Number.isFinite(num) ? num : 0;
        });
        const getOptionWithInput = (val) => {
          const baseText = stripHtmlTags(optionMap[val] || val);
          const inputKey = `${questionItem.field}_${val}`;
          const inputValue = formValues[inputKey];
          if (
            inputValue !== undefined &&
            inputValue !== null &&
            inputValue !== ''
          ) {
            return `${baseText}（${stripHtmlTags(inputValue)}）`;
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
        let optionTextMap = {};
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
        index: idx + 1,
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
    } = params;
    // 格式化所有题目和答案
    const allAnswers = SurveyResponseController.formatAllAnswers(
      responseSchema.code.dataConf.dataList,
      formValues,
    );
    console.log('用户填写的所有题目和答案：' + JSON.stringify(allAnswers));

    // 发送加密后的问卷结果
    if (
      originalUserId &&
      allAnswers &&
      originalQuestionId &&
      originalAssessmentId
    ) {
      try {
        await this.surveyResponseService.sendSurveyAnswer({
          userId: originalUserId,
          allAnswers: JSON.stringify(allAnswers),
          assessmentId: originalAssessmentId,
          questionId: originalQuestionId,
        });
      } catch (error) {
        console.error('发送问卷结果失败', error);
        // 发送问卷结果失败不应该影响问卷提交，只记录日志
        this.logger.error(`发送问卷结果失败: ${error.message}`);
      }
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

    // 执行后端回调配置（优先使用问卷独立配置）
    const callbackConfig = responseSchema?.code?.submitConf?.callbackConfig;
    if (callbackConfig?.enabled && callbackConfig?.url) {
      // 使用问卷独立配置的回调
      this.logger.info(`使用问卷独立回调配置: ${callbackConfig.url}`);
      this.executeCallback({
        callbackConfig,
        responseSchema,
        formValues,
        originalUserId,
        originalAssessmentId,
        originalQuestionId,
        surveyResponse,
        surveyPath,
      });
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
      clientTime,
    });

    // 返回responseId
    return {
      responseId: surveyResponse._id.toString(),
    };
  }

  // 执行回调函数
  async executeCallback(params) {
    const {
      callbackConfig,
      responseSchema,
      formValues,
      originalUserId,
      originalAssessmentId,
      originalQuestionId,
      surveyResponse,
      surveyPath,
    } = params;

    try {
      const callbackData = {
        surveyPath,
        surveyId: responseSchema.pageId,
        responseId: surveyResponse._id.toString(),
        userId: originalUserId,
        assessmentId: originalAssessmentId,
        questionId: originalQuestionId,
        formData: formValues,
        answers: SurveyResponseController.formatAllAnswers(
          responseSchema.code.dataConf.dataList,
          formValues,
        ),
        timestamp: Date.now(),
      };

      const headers = {
        'Content-Type': 'application/json',
      };
      
      // 如果启用了自定义headers
      if (callbackConfig.headersEnabled && callbackConfig.headers) {
        try {
          const customHeaders = JSON.parse(callbackConfig.headers);
          Object.assign(headers, customHeaders);
        } catch (e) {
          this.logger.error(`解析自定义headers失败: ${e.message}`);
        }
      }
      const timeout = (parseInt(callbackConfig.timeout) || 10) * 1000;
      const retryCount = parseInt(callbackConfig.retryCount) || 3;

      let attempt = 0;
      let lastError;

      while (attempt <= retryCount) {
        try {
          const axios = require('axios');
          const response = await axios({
            method: callbackConfig.method || 'POST',
            url: callbackConfig.url,
            data: callbackConfig.method === 'GET' ? undefined : callbackData,
            params: callbackConfig.method === 'GET' ? callbackData : undefined,
            headers,
            timeout,
          });

          if (response.status >= 200 && response.status < 300) {
            this.logger.info(
              `回调成功: surveyPath=${surveyPath}, attempt=${attempt + 1}`,
            );
            return response.data;
          }
        } catch (error) {
          lastError = error;
          attempt++;
          if (attempt <= retryCount) {
            // 等待一段时间后重试
            await new Promise((resolve) =>
              setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt), 10000)),
            );
          }
        }
      }

      this.logger.error(
        `回调失败（已重试${retryCount}次）: ${lastError?.message}`,
      );
    } catch (error) {
      // 回调失败不影响问卷提交
      this.logger.error(`执行回调时出错: ${error.message}`);
    }
  }
}
