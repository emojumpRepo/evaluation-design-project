import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { SurveyResponse } from 'src/models/surveyResponse.entity';
import { ConfigService } from '@nestjs/config';
import { httpPost } from 'src/utils/request';
import { ObjectId } from 'mongodb';
import { Logger } from 'src/logger';

@Injectable()
export class SurveyResponseService {
  constructor(
    @InjectRepository(SurveyResponse)
    private readonly surveyResponseRepository: MongoRepository<SurveyResponse>,
    private readonly configService: ConfigService,
    private readonly logger: Logger,
  ) {}

  async createSurveyResponse({
    data,
    clientTime,
    diffTime,
    surveyId,
    surveyPath,
    optionTextAndId,
    channelId = undefined,
  }) {
    const newSubmitData = this.surveyResponseRepository.create({
      surveyPath,
      data,
      secretKeys: [],
      clientTime,
      diffTime,
      pageId: surveyId,
      optionTextAndId,
      channelId,
    });

    // 提交问卷
    const res = await this.surveyResponseRepository.save(newSubmitData);
    // res是加密后的数据，需要手动调用loaded才会触发解密
    res.onDataLoaded();
    return res;
  }

  async getSurveyResponseTotalByPath(surveyPath: string) {
    const data = await this.surveyResponseRepository.find({
      where: {
        surveyPath,
      },
    });
    return (data || []).length;
  }
  async getSurveyResponseTotalByChannel({ channelId }) {
    const data = await this.surveyResponseRepository.find({
      where: {
        channelId: channelId,
      },
    });
    return (data || []).length;
  }

  async getSurveyResponseCountBySurveyId(surveyId: string) {
    return this.surveyResponseRepository.count({
      pageId: surveyId,
      isDeleted: { $ne: true },
    });
  }

  // 发送问卷答案到管理后台
  async sendSurveyAnswer({
    userId,
    allAnswers,
    assessmentId,
    questionId,
    tenantId,
  }: {
    userId: string;
    allAnswers: string;
    assessmentId: string;
    questionId: string;
    tenantId: string;
  }) {
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

    // 如果任何必需参数无效，不发送请求
    if (
      !isValidParam(userId) ||
      !isValidParam(assessmentId) ||
      !isValidParam(questionId)
    ) {
      console.log(
        `跳过发送问卷结果，参数无效: userId=${userId}, assessmentId=${assessmentId}, questionId=${questionId}`,
      );
      return;
    }

    // 检查必要的配置是否存在
    const baseUrl = this.configService.get<string>(
      'EVALUATION_ADMIN_SYSTEM_URL',
    );

    console.log('tenantId', tenantId);

    // 如果配置缺失，跳过发送，不抛出错误
    if (!baseUrl || !tenantId) {
      console.log('管理后台配置缺失，跳过发送问卷结果');
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'tenant-id': tenantId,
    };
    const body = {
      userId,
      answers: allAnswers,
      taskNo: assessmentId,
      questionnaireId: questionId,
    };
    console.log('sendSurveyAnswer', body);
    try {
      const res = await httpPost({
        url: `${baseUrl}/psychology/assessment-participant/submit`,
        headers,
        body,
      });
      if (res.code !== 0) {
        throw new Error(res.msg);
      }
      return res;
    } catch (error) {
      console.error('发送问卷结果失败', error);
      // 如果是网络错误或配置错误，抛出更具体的错误信息
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('无法连接到管理后台系统');
      }
      if (error.message) {
        throw new Error(error.message);
      }
      throw new Error('发送问卷结果失败');
    }
  }

  // 更新计算结果到响应记录
  async updateCalculationResult(
    responseId: string,
    calculationResult: any,
  ): Promise<void> {
    try {
      await this.surveyResponseRepository.update(
        { _id: new ObjectId(responseId) } as any,
        {
          calculationResult,
          calculatedAt: new Date(),
        } as any,
      );
      this.logger.info(`已保存计算结果到响应ID: ${responseId}`);
    } catch (error) {
      this.logger.error(`保存计算结果失败: ${error.message}`);
    }
  }
}
