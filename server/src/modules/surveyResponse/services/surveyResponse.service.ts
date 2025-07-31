import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { SurveyResponse } from 'src/models/surveyResponse.entity';
import { ConfigService } from '@nestjs/config';
import { httpPost } from 'src/utils/request';
import * as crypto from 'crypto';

function aesEncrypt(data: any, key: string) {
  const iv = Buffer.alloc(16, 0); // 16字节IV全0
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

@Injectable()
export class SurveyResponseService {
  constructor(
    @InjectRepository(SurveyResponse)
    private readonly surveyResponseRepository: MongoRepository<SurveyResponse>,
    private readonly configService: ConfigService,
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
    completeTime,
  }: {
    userId: string;
    allAnswers: string;
    assessmentId: string;
    questionId: string;
    completeTime: number;
  }) {
    const key = this.configService.get<string>(
      'EVALUATION_ADMIN_AES_ENCRYPT_SECRET_KEY',
    );
    const encryptedUserId = aesEncrypt(userId, key);
    const encryptedAnswers = aesEncrypt(allAnswers, key);
    const encryptedAssessmentId = aesEncrypt(assessmentId, key);
    const encryptedQuestionId = aesEncrypt(questionId, key);
    const baseUrl = this.configService.get<string>('EVALUATION_ADMIN_SYSTEM_URL');

    const headers = {
      'Content-Type': 'application/json',
      'tenant-id': this.configService.get<string>('EVALUATION_ADMIN_TENANT_ID'),
    };
    try {
      const res = await httpPost({
        url: `${baseUrl}/emojump/questionnaire-result/submit-answer`,
        headers,
        body: {
          encryptedUserId: encryptedUserId,
          encryptedAnswerData: encryptedAnswers,
          encryptedAssessmentId: encryptedAssessmentId,
          encryptedQuestionnaireId: encryptedQuestionId,
          completedTime: completeTime,
        },
      });
      if (res.code !== 0) {
        throw new Error(res.msg);
      }
      return res;
    } catch (error) {
      console.error('发送问卷结果失败', error);
      throw new Error(error.message);
    }
  }
}
