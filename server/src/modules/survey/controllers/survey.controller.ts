import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  UseGuards,
  Request,
  SetMetadata,
} from '@nestjs/common';
import * as Joi from 'joi';
import { ApiTags } from '@nestjs/swagger';

import { SurveyMetaService } from '../services/surveyMeta.service';
import { SurveyConfService } from '../services/surveyConf.service';
import { ResponseSchemaService } from '../../surveyResponse/services/responseScheme.service';
import { ContentSecurityService } from '../services/contentSecurity.service';
import { SurveyHistoryService } from '../services/surveyHistory.service';
import { SurveyResponseService } from '../../surveyResponse/services/surveyResponse.service';

import BannerData from '../template/banner/index.json';
import { CreateSurveyDto } from '../dto/createSurvey.dto';

import { Authentication } from 'src/guards/authentication.guard';
import { HISTORY_TYPE } from 'src/enums';
import { HttpException } from 'src/exceptions/httpException';
import { EXCEPTION_CODE } from 'src/enums/exceptionCode';
import { Logger } from 'src/logger';
import { SurveyGuard } from 'src/guards/survey.guard';
import { SURVEY_PERMISSION } from 'src/enums/surveyPermission';

import { WorkspaceGuard } from 'src/guards/workspace.guard';
import { PERMISSION as WORKSPACE_PERMISSION } from 'src/enums/workspace';
import { SessionService } from '../services/session.service';
import { UserService } from 'src/modules/auth/services/user.service';

@ApiTags('survey')
@Controller('/api/survey')
export class SurveyController {
  constructor(
    private readonly surveyMetaService: SurveyMetaService,
    private readonly surveyConfService: SurveyConfService,
    private readonly responseSchemaService: ResponseSchemaService,
    private readonly contentSecurityService: ContentSecurityService,
    private readonly surveyHistoryService: SurveyHistoryService,
    private readonly logger: Logger,
    private readonly sessionService: SessionService,
    private readonly userService: UserService,
    private readonly surveyResponseService: SurveyResponseService,
  ) {}

  @Get('/getBannerData')
  @HttpCode(200)
  async getBannerData() {
    return {
      code: 200,
      data: BannerData,
    };
  }

  @Post('/createSurvey')
  @HttpCode(200)
  @UseGuards(SurveyGuard)
  @SetMetadata('surveyId', 'body.createFrom')
  @SetMetadata('surveyPermission', [SURVEY_PERMISSION.SURVEY_CONF_MANAGE])
  @UseGuards(WorkspaceGuard)
  @SetMetadata('workspacePermissions', [WORKSPACE_PERMISSION.READ_SURVEY])
  @SetMetadata('workspaceId', { key: 'body.workspaceId', optional: true })
  @UseGuards(Authentication)
  async createSurvey(
    @Body()
    reqBody: CreateSurveyDto,
    @Request()
    req,
  ) {
    const { error, value } = CreateSurveyDto.validate(reqBody);
    if (error) {
      this.logger.error(`createSurvey_parameter error: ${error.message}`);
      throw new HttpException('参数错误', EXCEPTION_CODE.PARAMETER_ERROR);
    }

    const { title, remark, createMethod, createFrom, groupId, questionList } =
      value;

    let surveyType = '',
      workspaceId = null;
    if (createMethod === 'copy') {
      const survey = req.surveyMeta;
      surveyType = survey.surveyType;
      workspaceId = survey.workspaceId;
    } else {
      surveyType = value.surveyType;
      workspaceId = value.workspaceId;
    }

    const surveyMeta = await this.surveyMetaService.createSurveyMeta({
      title,
      remark,
      surveyType,
      username: req.user.username,
      userId: req.user._id.toString(),
      createMethod,
      createFrom,
      workspaceId,
      groupId,
    });
    await this.surveyConfService.createSurveyConf({
      surveyId: surveyMeta._id.toString(),
      surveyType: surveyType,
      createMethod: value.createMethod,
      createFrom: value.createFrom,
      questionList,
    });
    return {
      code: 200,
      data: {
        id: surveyMeta._id.toString(),
      },
    };
  }

  @Post('/updateConf')
  @HttpCode(200)
  @UseGuards(SurveyGuard)
  @SetMetadata('surveyId', 'body.surveyId')
  @SetMetadata('surveyPermission', [SURVEY_PERMISSION.SURVEY_CONF_MANAGE])
  @UseGuards(Authentication)
  async updateConf(
    @Body()
    surveyInfo,
    @Request()
    req,
  ) {
    const { value, error } = Joi.object({
      surveyId: Joi.string().required(),
      configData: Joi.any().required(),
      sessionId: Joi.string().required(),
    }).validate(surveyInfo);
    if (error) {
      this.logger.error(error.message);
      throw new HttpException('参数有误', EXCEPTION_CODE.PARAMETER_ERROR);
    }
    if (!surveyInfo?.configData?.dataConf?.dataList?.length) {
      this.logger.error('确少题目数据');
      throw new HttpException(
        '请添加题目后重新保存问卷',
        EXCEPTION_CODE.PARAMETER_ERROR,
      );
    }

    const sessionId = value.sessionId;
    const surveyId = value.surveyId;
    const latestEditingOne = await this.sessionService.findLatestEditingOne({
      surveyId,
    });

    if (latestEditingOne && latestEditingOne._id.toString() !== sessionId) {
      const curSession = await this.sessionService.findOne(sessionId);
      if (curSession.createdAt <= latestEditingOne.updatedAt) {
        // 在当前用户打开之后，被其他页面保存过了
        const isSameOperator =
          latestEditingOne.userId === req.user._id.toString();
        let preOperator;
        if (!isSameOperator) {
          preOperator = await this.userService.getUserById(
            latestEditingOne.userId,
          );
        }
        return {
          code: EXCEPTION_CODE.SURVEY_SAVE_CONFLICT,
          errmsg: isSameOperator
            ? '当前问卷已在其它页面开启编辑，刷新以获取最新内容'
            : `当前问卷已由 ${preOperator.username} 编辑，刷新以获取最新内容`,
        };
      }
    }
    await this.sessionService.updateSessionToEditing({ sessionId, surveyId });

    const username = req.user.username;

    const configData = value.configData;
    await this.surveyConfService.saveSurveyConf({
      surveyId,
      schema: configData,
    });
    await this.surveyHistoryService.addHistory({
      surveyId,
      schema: configData,
      type: HISTORY_TYPE.DAILY_HIS,
      user: {
        _id: req.user._id.toString(),
        username,
      },
    });
    return {
      code: 200,
    };
  }

  @Post('/updateSimpleConf')
  @HttpCode(200)
  @UseGuards(SurveyGuard)
  @UseGuards(Authentication)
  @SetMetadata('surveyId', 'body.surveyId')
  @SetMetadata('surveyPermission', [SURVEY_PERMISSION.SURVEY_CONF_MANAGE])
  async updateSimpleConf(@Body() surveyInfo, @Request() req) {
    // console.log('updateSimpleConf', req);
    const { value, error } = Joi.object({
      surveyId: Joi.string().required(),
      beginTime: Joi.string().required(),
      endTime: Joi.string().required(),
    }).validate(surveyInfo);
    if (error) {
      this.logger.error(error.message);
      throw new HttpException('参数有误', EXCEPTION_CODE.PARAMETER_ERROR);
    }
    const { surveyId, beginTime, endTime } = value;
    // 更新baseConf
    const code = await this.surveyConfService.updateSimpleConf({
      surveyId,
      beginTime,
      endTime,
    });

    const user = await this.userService.getUserByUsername(req.user?.username);
    if (!user) {
      throw new HttpException('用户不存在', EXCEPTION_CODE.USER_NOT_EXISTS);
    }

    // 保存历史
    await this.surveyHistoryService.addHistory({
      surveyId,
      schema: code,
      type: HISTORY_TYPE.DAILY_HIS,
      user: {
        _id: user._id.toString(),
        username: user.username,
      },
    });
    return { code: 200 };
  }

  @HttpCode(200)
  @Post('/deleteSurvey')
  @UseGuards(SurveyGuard)
  @SetMetadata('surveyId', 'body.surveyId')
  @SetMetadata('surveyPermission', [SURVEY_PERMISSION.SURVEY_CONF_MANAGE])
  @UseGuards(Authentication)
  async deleteSurvey(@Request() req) {
    const surveyMeta = req.surveyMeta;

    const delMetaRes = await this.surveyMetaService.deleteSurveyMeta({
      surveyId: surveyMeta._id.toString(),
      operator: req.user.username,
      operatorId: req.user._id.toString(),
    });
    const delResponseRes =
      await this.responseSchemaService.deleteResponseSchema({
        surveyPath: surveyMeta.surveyPath,
      });

    this.logger.info(JSON.stringify(delMetaRes));
    this.logger.info(JSON.stringify(delResponseRes));

    return {
      code: 200,
    };
  }

  @HttpCode(200)
  @Post('/pausingSurvey')
  @UseGuards(SurveyGuard)
  @SetMetadata('surveyId', 'body.surveyId')
  @SetMetadata('surveyPermission', [SURVEY_PERMISSION.SURVEY_CONF_MANAGE])
  @UseGuards(Authentication)
  async pausingSurvey(@Request() req) {
    // 初始化问卷元数据
    let surveyMeta = null;
    // 如果请求中存在问卷元数据，则赋值给surveyMeta
    if (req.surveyMeta) {
      surveyMeta = req.surveyMeta;
    } else if (req.surveyId) {
      surveyMeta = await this.surveyMetaService.getSurveyById({
        surveyId: req.surveyId,
      });
    }

    if (!surveyMeta) {
      throw new HttpException('问卷不存在', EXCEPTION_CODE.SURVEY_NOT_FOUND);
    }

    await this.surveyMetaService.pausingSurveyMeta(surveyMeta);
    await this.responseSchemaService.pausingResponseSchema({
      surveyPath: surveyMeta.surveyPath,
    });

    return {
      code: 200,
    };
  }

  @Get('/getSurvey')
  @HttpCode(200)
  @UseGuards(SurveyGuard)
  @SetMetadata('surveyId', 'query.surveyId')
  @SetMetadata('surveyPermission', [
    SURVEY_PERMISSION.SURVEY_CONF_MANAGE,
    SURVEY_PERMISSION.SURVEY_COOPERATION_MANAGE,
    SURVEY_PERMISSION.SURVEY_RESPONSE_MANAGE,
  ])
  @UseGuards(Authentication)
  async getSurvey(
    @Query()
    queryInfo: {
      surveyId: string;
    },
    @Request()
    req,
  ) {
    const { value, error } = Joi.object({
      surveyId: Joi.string().required(),
    }).validate(queryInfo);

    if (error) {
      this.logger.error(error.message);
      throw new HttpException('参数有误', EXCEPTION_CODE.PARAMETER_ERROR);
    }

    const surveyId = value.surveyId;
    const surveyMeta = req.surveyMeta;
    const surveyConf =
      await this.surveyConfService.getSurveyConfBySurveyId(surveyId);

    surveyMeta.currentUserId = req.user._id.toString();
    if (req.collaborator) {
      surveyMeta.isCollaborated = true;
      surveyMeta.currentPermission = req.collaborator.permissions;
    } else {
      surveyMeta.isCollaborated = false;
    }

    return {
      code: 200,
      data: {
        surveyMetaRes: surveyMeta,
        surveyConfRes: surveyConf,
      },
    };
  }

  @Get('/getPreviewSchema')
  @HttpCode(200)
  async getPreviewSchema(
    @Query()
    queryInfo: {
      surveyPath: string;
    },
  ) {
    const { value, error } = Joi.object({
      surveyId: Joi.string().required(),
    }).validate({ surveyId: queryInfo.surveyPath });

    if (error) {
      this.logger.error(error.message);
      throw new HttpException('参数有误', EXCEPTION_CODE.PARAMETER_ERROR);
    }
    const surveyId = value.surveyId;
    const surveyConf =
      await this.surveyConfService.getSurveyConfBySurveyId(surveyId);
    const surveyMeta = await this.surveyMetaService.getSurveyById({ surveyId });
    return {
      code: 200,
      data: {
        ...surveyConf,
        title: surveyMeta?.title,
        surveyPath: surveyMeta?.surveyPath,
      },
    };
  }

  @Post('/publishSurvey')
  @HttpCode(200)
  @UseGuards(SurveyGuard)
  @SetMetadata('surveyId', 'body.surveyId')
  @SetMetadata('surveyPermission', [SURVEY_PERMISSION.SURVEY_CONF_MANAGE])
  @UseGuards(Authentication)
  async publishSurvey(
    @Body()
    surveyInfo,
    @Request()
    req,
  ) {
    const { value, error } = Joi.object({
      surveyId: Joi.string().required(),
    }).validate(surveyInfo);
    if (error) {
      this.logger.error(error.message);
      throw new HttpException('参数有误', EXCEPTION_CODE.PARAMETER_ERROR);
    }
    const username = req.user.username;
    const surveyId = value.surveyId;
    let surveyMeta = req.surveyMeta;
    if (!surveyMeta) {
      surveyMeta = await this.surveyMetaService.getSurveyById({ surveyId });
    }
    if (surveyMeta.isDeleted) {
      throw new HttpException(
        '问卷已删除，无法发布',
        EXCEPTION_CODE.SURVEY_NOT_FOUND,
      );
    }
    const surveyConf =
      await this.surveyConfService.getSurveyConfBySurveyId(surveyId);

    const { text } = await this.surveyConfService.getSurveyContentByCode(
      surveyConf.code,
    );

    if (await this.contentSecurityService.isForbiddenContent({ text })) {
      throw new HttpException(
        '问卷存在非法关键字，不允许发布',
        EXCEPTION_CODE.SURVEY_CONTENT_NOT_ALLOW,
      );
    }

    await this.surveyMetaService.publishSurveyMeta({
      surveyMeta,
    });

    await this.responseSchemaService.publishResponseSchema({
      title: surveyMeta.title,
      surveyPath: surveyMeta.surveyPath,
      code: surveyConf.code,
      pageId: surveyId,
    });

    // 添加发布历史可以异步添加
    this.surveyHistoryService.addHistory({
      surveyId,
      schema: surveyConf.code,
      type: HISTORY_TYPE.PUBLISH_HIS,
      user: {
        _id: req.user._id.toString(),
        username,
      },
    });
    return {
      code: 200,
    };
  }

  @Get('/getSurveyList')
  @HttpCode(200)
  @UseGuards(Authentication)
  async getSurveyList() {
    // 查询所有 surveyConf
    const surveyConfList = await this.surveyConfService.getAllSurveyConf();
    // 查询所有 surveyMeta
    const surveyMetaList = await this.surveyMetaService.getAllSurveyMeta();

    // 构建 meta 映射表
    const metaMap = new Map(
      surveyMetaList.map((meta) => [meta._id.toString(), meta]),
    );

    // 合并
    const filteredSurveyList = surveyConfList
      .map((conf) => {
        const meta = metaMap.get(conf.pageId?.toString());
        return {
          surveyConf: conf,
          surveyMeta: meta || null,
        };
      })
      .filter((item) => item.surveyMeta);

    // 批量统计提交次数
    const submitCountMap = {};
    await Promise.all(
      filteredSurveyList.map(async (item) => {
        const surveyId = item.surveyMeta._id.toString();
        submitCountMap[surveyId] =
          await this.surveyResponseService.getSurveyResponseCountBySurveyId(
            surveyId,
          );
      }),
    );

    const result = filteredSurveyList.map((item) => {
      const { surveyConf, surveyMeta } = item;
      const surveyId = surveyMeta._id.toString();
      return {
        surveyMetaId: surveyMeta._id.toString(),
        createdAt: surveyMeta.createdAt,
        updatedAt: surveyMeta.updatedAt,
        title: surveyMeta.title,
        remark: surveyMeta.remark,
        submitCount: submitCountMap[surveyId] || 0,
        subStatus: surveyMeta.subStatus,
        surveyType: surveyMeta.surveyType,
        surveyPath: surveyMeta.surveyPath,
        curStatus: surveyMeta.curStatus,
        beginTime: surveyConf.code.baseConf.beginTime,
        endTime: surveyConf.code.baseConf.endTime,
        answerBegTime: surveyConf.code.baseConf.answerBegTime,
        answerEndTime: surveyConf.code.baseConf.answerEndTime,
        surveyConfId: surveyConf._id.toString(),
      };
    });

    return {
      code: 200,
      data: result,
    };
  }
}
