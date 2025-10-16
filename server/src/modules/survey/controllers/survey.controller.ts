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
  UseInterceptors,
  UploadedFiles,
  Res,
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

import { FilesInterceptor } from '@nestjs/platform-express';
import * as XLSX from 'xlsx';

interface ExcelQuestion {
  title: string;
  type: string;
  options: string;
  scores?: string;
  isRequired?: string;
  placeholder?: string;
  minNum?: string;
  maxNum?: string;
  others?: string;
  mustOthers?: string;
  othersKey?: string;
  placeholderDesc?: string;
  layout?: string;
  horizontalColumns?: string;
  quotaDisplay?: string;
  showIndex?: string;
  showType?: string;
  showSpliter?: string;
  content?: string; // 描述文本和内联填空的内容
  questionOrder?: string; // 题目在问卷中的顺序
}

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

    const {
      title,
      remark,
      surveyCode,
      createMethod,
      createFrom,
      groupId,
      questionList,
      isCollaborated,
      pageConf,
      descriptionConfig,
      skinConfig,
    } = value;

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
      surveyCode,
      surveyType,
      username: req.user.username,
      userId: req.user._id.toString(),
      createMethod,
      createFrom,
      workspaceId,
      groupId,
      isCollaborated,
    });
    await this.surveyConfService.createSurveyConf({
      surveyId: surveyMeta._id.toString(),
      surveyType: surveyType,
      createMethod: value.createMethod,
      createFrom: value.createFrom,
      questionList,
      pageConf,
      descriptionConfig,
      skinConfig,
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
  @Post('/recoverSurvey')
  @UseGuards(SurveyGuard)
  @SetMetadata('surveyId', 'body.surveyId')
  @SetMetadata('surveyPermission', [SURVEY_PERMISSION.SURVEY_CONF_MANAGE])
  @UseGuards(Authentication)
  async recoverSurvey(@Request() req) {
    const surveyMeta = req.surveyMeta;

    const delMetaRes = await this.surveyMetaService.recoverSurveyMeta({
      surveyId: surveyMeta._id.toString(),
      operator: req.user.username,
      operatorId: req.user._id.toString(),
    });
    const delResponseRes =
      await this.responseSchemaService.recoverResponseSchema({
        surveyPath: surveyMeta.surveyPath,
      });

    this.logger.info(JSON.stringify(delMetaRes));
    this.logger.info(JSON.stringify(delResponseRes));

    return {
      code: 200,
    };
  }

  @HttpCode(200)
  @Post('/completeDeleteSurvey')
  @UseGuards(SurveyGuard)
  @SetMetadata('surveyId', 'body.surveyId')
  @SetMetadata('surveyPermission', [SURVEY_PERMISSION.SURVEY_CONF_MANAGE])
  @UseGuards(Authentication)
  async completeDeleteSurvey(@Request() req) {
    const surveyMeta = req.surveyMeta;

    const delMetaRes = await this.surveyMetaService.completeDeleteSurveyMeta({
      surveyId: surveyMeta._id.toString(),
      operator: req.user.username,
      operatorId: req.user._id.toString(),
    });
    const delResponseRes =
      await this.responseSchemaService.completeDeleteResponseSchema({
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
    if (surveyMeta.isDeleted) {
      throw new HttpException(
        '问卷不存在或已删除',
        EXCEPTION_CODE.RESPONSE_SCHEMA_REMOVED,
      );
    }
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

  @Get('/getFormattedQuestions')
  @HttpCode(200)
  @UseGuards(SurveyGuard)
  @SetMetadata('surveyId', 'query.surveyId')
  @UseGuards(Authentication)
  async getFormattedQuestions(
    @Query()
    queryInfo: {
      surveyId: string;
    },
  ) {
    const { value, error } = Joi.object({
      surveyId: Joi.string().required(),
    }).validate(queryInfo);
    if (error) {
      this.logger.error(error.message);
      throw new HttpException('参数有误', EXCEPTION_CODE.PARAMETER_ERROR);
    }

    const surveyId = value.surveyId;
    const questions =
      await this.surveyConfService.getFormattedQuestionsBySurveyId(surveyId);
    return {
      code: 200,
      data: questions,
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
        surveyCode: surveyMeta?.surveyCode,
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
        surveyCode: surveyMeta.surveyCode,
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
        questionCount: surveyConf?.code?.dataConf?.dataList?.length || 0,
      };
    });

    return {
      code: 200,
      data: result,
    };
  }

  @Post('/getExcelQuestions')
  @HttpCode(200)
  @UseInterceptors(FilesInterceptor('files'))
  async getExcelQuestions(@UploadedFiles() files: Express.Multer.File[]) {
    try {
      let validationError = '';
      const allQuestions: ExcelQuestion[] = [];
      let pageConf: number[] = [];
      let descriptionConfig: any = {};
      let skinConfig: any = {
        bannerConfig: {},
        themeConf: {
          colorConf: {}
        }
      };

      // 验证每个文件
      for (const file of files) {
        validationError = this.validateExcelFile(file).errorType;
        if (validationError) {
          break;
        }

        // 解析文件内容
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        console.log(
          'getExcelQuestions - Excel工作表列表:',
          workbook.SheetNames,
        );

        // 解析分页配置
        if (workbook.SheetNames.includes('分页配置')) {
          console.log('getExcelQuestions - 找到分页配置表');
          const pageConfSheet = workbook.Sheets['分页配置'];
          const pageConfData = XLSX.utils.sheet_to_json(pageConfSheet);

          console.log('getExcelQuestions - 分页配置数据:', pageConfData);

          pageConfData.forEach((row: any) => {
            console.log('getExcelQuestions - 处理分页配置行:', row);
            if (row.字段 === '分页配置' && row.值) {
              pageConf = row.值
                .split(',')
                .map((num: string) => parseInt(num.trim()))
                .filter((num: number) => !isNaN(num));
              console.log('getExcelQuestions - 解析的分页配置:', pageConf);
            }
          });
        } else {
          console.log(
            'getExcelQuestions - 未找到分页配置表，可用工作表:',
            workbook.SheetNames,
          );
        }

        // 解析描述配置
        if (workbook.SheetNames.includes('描述配置')) {
          console.log('getExcelQuestions - 找到描述配置表');
          const descriptionSheet = workbook.Sheets['描述配置'];
          const descriptionData = XLSX.utils.sheet_to_json(descriptionSheet);

          console.log('getExcelQuestions - 描述配置数据:', descriptionData);

          descriptionData.forEach((row: any) => {
            console.log('getExcelQuestions - 处理描述配置行:', row);
            if (row.页面 && row.描述内容) {
              const pageKey = row.页面.replace('第', 'page').replace('页', '');
              descriptionConfig[pageKey] = {
                content: row.描述内容,
              };
              console.log(
                'getExcelQuestions - 解析的描述配置:',
                pageKey,
                row.描述内容,
              );
            }
          });
        } else {
          console.log(
            'getExcelQuestions - 未找到描述配置表，可用工作表:',
            workbook.SheetNames,
          );
        }

        // 解析皮肤设置
        if (workbook.SheetNames.includes('皮肤设置')) {
          console.log('getExcelQuestions - 找到皮肤设置表');
          const skinSheet = workbook.Sheets['皮肤设置'];
          const skinData = XLSX.utils.sheet_to_json(skinSheet);

          console.log('getExcelQuestions - 皮肤设置数据:', skinData);

          skinData.forEach((row: any) => {
            console.log('getExcelQuestions - 处理皮肤设置行:', row);
            const configItem = row.配置项;
            const configValue = row.配置值;
            
            if (configItem && configValue) {
              switch (configItem) {
                case '头图链接':
                  skinConfig.bannerConfig.bannerImg = configValue;
                  break;
                case '品牌Logo':
                  skinConfig.bannerConfig.logoImg = configValue;
                  break;
                case '主题色':
                  skinConfig.themeConf.colorConf.themeColor = configValue;
                  break;
                case '提交按钮颜色':
                  skinConfig.themeConf.colorConf.submitBtnColor = configValue;
                  break;
                case '背景色':
                  skinConfig.themeConf.colorConf.backgroundColor = configValue;
                  break;
                case '内容区背景色':
                  skinConfig.themeConf.colorConf.contentBackgroundColor = configValue;
                  break;
              }
              console.log('getExcelQuestions - 解析的皮肤配置:', configItem, configValue);
            }
          });
        } else {
          console.log('getExcelQuestions - 未找到皮肤设置表，使用默认皮肤配置');
        }

        // 解析题目数据
        const questions = this.parseExcelFile(file);
        allQuestions.push(...questions);
      }

      // 如果有验证错误，返回错误信息
      if (validationError) {
        return {
          code: 400,
          message: '文件不通过校验',
          error: validationError,
        };
      }

      // 返回解析结果
      return {
        code: 200,
        message: '上传成功',
        data: {
          questions: allQuestions,
          pageConf: pageConf,
          descriptionConfig: descriptionConfig,
          skinConfig: skinConfig,
        },
      };
    } catch (error) {
      this.logger.error(`getExcelQuestions error: ${error.message}`);
      return {
        code: 500,
        message: '文件处理失败',
        error: error.message,
      };
    }
  }

  @Post('/createSurveyFromExcel')
  @HttpCode(200)
  @UseInterceptors(FilesInterceptor('files'))
  @UseGuards(WorkspaceGuard)
  @SetMetadata('workspacePermissions', [WORKSPACE_PERMISSION.READ_SURVEY])
  @SetMetadata('workspaceId', { key: 'body.workspaceId', optional: true })
  @UseGuards(Authentication)
  async createSurveyFromExcel(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: any,
    @Request() req,
  ) {
    try {
      if (!files || files.length === 0) {
        return {
          code: 400,
          message: '请选择要导入的文件',
        };
      }

      const file = files[0];
      let validationError = this.validateExcelFile(file).errorType;

      if (validationError) {
        return {
          code: 400,
          message: '文件不通过校验',
          error: validationError,
        };
      }

      // 解析文件内容
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });

      console.log('Excel工作表列表:', workbook.SheetNames);

      // 解析问卷基本信息
      const surveyMeta = {
        title: body.title || '导入的问卷',
        remark: body.remark || '',
        surveyCode: body.surveyCode || `import_${Date.now()}`,
        surveyType: body.surveyType || 'normal',
      };

      // 解析分页配置
      let pageConf: number[] = [];
      if (workbook.SheetNames.includes('分页配置')) {
        console.log('找到分页配置表');
        const pageConfSheet = workbook.Sheets['分页配置'];
        const pageConfData = XLSX.utils.sheet_to_json(pageConfSheet);

        console.log('分页配置数据:', pageConfData);

        pageConfData.forEach((row: any) => {
          console.log('处理分页配置行:', row);
          if (row.字段 === '分页配置' && row.值) {
            pageConf = row.值
              .split(',')
              .map((num: string) => parseInt(num.trim()))
              .filter((num: number) => !isNaN(num));
            console.log('解析的分页配置:', pageConf);
          }
        });
      } else {
        console.log('未找到分页配置表，可用工作表:', workbook.SheetNames);
      }

      // 解析描述配置
      let descriptionConfig: any = {};
      if (workbook.SheetNames.includes('描述配置')) {
        console.log('找到描述配置表');
        const descriptionSheet = workbook.Sheets['描述配置'];
        const descriptionData = XLSX.utils.sheet_to_json(descriptionSheet);

        console.log('描述配置数据:', descriptionData);

        descriptionData.forEach((row: any) => {
          console.log('处理描述配置行:', row);
          if (row.页面 && row.描述内容) {
            const pageKey = row.页面.replace('第', 'page').replace('页', '');
            descriptionConfig[pageKey] = {
              content: row.描述内容,
            };
            console.log('解析的描述配置:', pageKey, row.描述内容);
          }
        });
      } else {
        console.log('未找到描述配置表，可用工作表:', workbook.SheetNames);
      }

      // 解析皮肤设置
      let skinConfig: any = {
        bannerConfig: {},
        themeConf: {
          colorConf: {}
        }
      };
      if (workbook.SheetNames.includes('皮肤设置')) {
        console.log('找到皮肤设置表');
        const skinSheet = workbook.Sheets['皮肤设置'];
        const skinData = XLSX.utils.sheet_to_json(skinSheet);

        console.log('皮肤设置数据:', skinData);

        skinData.forEach((row: any) => {
          console.log('处理皮肤设置行:', row);
          const configItem = row.配置项;
          const configValue = row.配置值;
          
          if (configItem && configValue) {
            switch (configItem) {
              case '头图链接':
                skinConfig.bannerConfig.bannerImg = configValue;
                break;
              case '品牌Logo':
                skinConfig.bannerConfig.logoImg = configValue;
                break;
              case '主题色':
                skinConfig.themeConf.colorConf.themeColor = configValue;
                break;
              case '提交按钮颜色':
                skinConfig.themeConf.colorConf.submitBtnColor = configValue;
                break;
              case '背景色':
                skinConfig.themeConf.colorConf.backgroundColor = configValue;
                break;
              case '内容区背景色':
                skinConfig.themeConf.colorConf.contentBackgroundColor = configValue;
                break;
            }
            console.log('解析的皮肤配置:', configItem, configValue);
          }
        });
      } else {
        console.log('未找到皮肤设置表，使用默认皮肤配置');
      }

      // 解析题目数据
      const questions = this.parseExcelFile(file);

      // 将Excel问题转换为系统题目格式
      const dataList = questions.map((excelQuestion, index) => {
        // 题型映射：中文转英文
        const typeMapping: Record<string, string> = {
          单行输入框: 'text',
          多行输入框: 'textarea',
          单选: 'radio',
          多选: 'checkbox',
          判断题: 'binary-choice',
          评分: 'radio-star',
          NPS评分: 'radio-nps',
          投票: 'vote',
          多级联动: 'cascader',
          描述文本: 'description',
          下拉单选: 'select',
          下拉多选: 'select-multiple',
          内联填空: 'inline-form',
        };

        const question: any = {
          isRequired:
            excelQuestion.isRequired === '是' ||
            excelQuestion.isRequired === 'true' ||
            excelQuestion.isRequired === '1',
          showIndex:
            excelQuestion.showIndex === '是' ||
            excelQuestion.showIndex === 'true' ||
            excelQuestion.showIndex === '1',
          showType:
            excelQuestion.showType === '是' ||
            excelQuestion.showType === 'true' ||
            excelQuestion.showType === '1',
          showSpliter:
            excelQuestion.showSpliter === '是' ||
            excelQuestion.showSpliter === 'true' ||
            excelQuestion.showSpliter === '1',
          type: typeMapping[excelQuestion.type] || excelQuestion.type,
          field: `data${Date.now()}${index}`,
          title: excelQuestion.title,
          placeholder: excelQuestion.placeholder || '',
          checked: false,
          minNum: parseInt(excelQuestion.minNum) || 0,
          maxNum: parseInt(excelQuestion.maxNum) || 0,
          star: 0,
          placeholderDesc: excelQuestion.placeholderDesc || '',
          layout: excelQuestion.layout || 'vertical',
          horizontalColumns: parseInt(excelQuestion.horizontalColumns) || 2,
          quotaDisplay:
            excelQuestion.quotaDisplay === '是' ||
            excelQuestion.quotaDisplay === 'true' ||
            excelQuestion.quotaDisplay === '1',
          cascaderData: {
            placeholder: [],
            children: [],
          },
        };

        // 处理描述文本和内联填空的内容
        if (question.type === 'description' || question.type === 'inline-form') {
          question.content = excelQuestion.content || excelQuestion.options || '';
        }

        // 处理选项
        if (excelQuestion.options) {
          const optionTexts = excelQuestion.options
            .split(';')
            .map((text: string) => text.trim())
            .filter(Boolean);
          const optionScores = excelQuestion.scores
            ? excelQuestion.scores
                .split(';')
                .map((score: string) => score.trim())
            : [];
          const othersOptions = excelQuestion.others
            ? excelQuestion.others
                .split(';')
                .map((text: string) => text.trim())
                .filter(Boolean)
            : [];
          const mustOthersOptions = excelQuestion.mustOthers
            ? excelQuestion.mustOthers
                .split(';')
                .map((text: string) => text.trim())
            : [];
          const othersKeyOptions = excelQuestion.othersKey
            ? excelQuestion.othersKey
                .split(';')
                .map((text: string) => text.trim())
            : [];
          const placeholderDescOptions = excelQuestion.placeholderDesc
            ? excelQuestion.placeholderDesc
                .split(';')
                .map((text: string) => text.trim())
            : [];

          question.options = optionTexts.map(
            (text: string, optionIndex: number) => {
              // 检查是否是"其他"选项：通过others字段或文本内容判断
              const isOthersOption =
                othersOptions.includes(text) ||
                othersOptions[optionIndex] === '是' ||
                othersOptions[optionIndex] === 'true' ||
                text.includes('其他') ||
                text.includes('填写');

              return {
                text,
                others: isOthersOption,
                mustOthers:
                  isOthersOption &&
                  (mustOthersOptions[optionIndex] === '是' ||
                    mustOthersOptions[optionIndex] === 'true'),
                othersKey: isOthersOption
                  ? othersKeyOptions[optionIndex] ||
                    `data${Date.now()}${index}_${optionIndex}`
                  : '',
                placeholderDesc: isOthersOption
                  ? placeholderDescOptions[optionIndex] || ''
                  : '',
                hash: `${Date.now()}${index}${optionIndex}`,
                score:
                  optionScores[optionIndex] && optionScores[optionIndex] !== ''
                    ? parseInt(optionScores[optionIndex])
                    : undefined,
              };
            },
          );
        }

        return question;
      });

      // 创建问卷
      const createSurveyDto = {
        title: surveyMeta.title,
        remark: surveyMeta.remark,
        surveyCode: surveyMeta.surveyCode,
        surveyType: surveyMeta.surveyType,
        createMethod: 'ExcelImport',
        createFrom: '',
        workspaceId: body.workspaceId,
        groupId: body.groupId,
        isCollaborated: false,
        questionList: dataList,
      };

      const surveyMetaResult = await this.surveyMetaService.createSurveyMeta({
        title: createSurveyDto.title,
        remark: createSurveyDto.remark,
        surveyCode: createSurveyDto.surveyCode,
        surveyType: createSurveyDto.surveyType,
        username: req.user.username,
        userId: req.user._id.toString(),
        createMethod: createSurveyDto.createMethod,
        createFrom: createSurveyDto.createFrom,
        workspaceId: createSurveyDto.workspaceId,
        groupId: createSurveyDto.groupId,
        isCollaborated: createSurveyDto.isCollaborated,
      });

      console.log('创建问卷配置，分页配置:', pageConf);
      console.log('创建问卷配置，描述配置:', descriptionConfig);
      console.log('创建问卷配置，皮肤配置:', skinConfig);
      await this.surveyConfService.createSurveyConf({
        surveyId: surveyMetaResult._id.toString(),
        surveyType: createSurveyDto.surveyType,
        createMethod: 'ExcelImport',
        createFrom: '',
        questionList: dataList,
        pageConf: pageConf,
        descriptionConfig: descriptionConfig,
        skinConfig: skinConfig,
      });

      return {
        code: 200,
        message: '问卷导入成功',
        data: {
          surveyId: surveyMetaResult._id.toString(),
          title: surveyMetaResult.title,
          surveyCode: surveyMetaResult.surveyCode,
        },
      };
    } catch (error) {
      this.logger.error(`createSurveyFromExcel error: ${error.message}`);
      return {
        code: 500,
        message: '问卷导入失败',
        error: error.message,
      };
    }
  }

  private validateExcelFile(file: Express.Multer.File): {
    errorType?: 'HEADER_FORMAT' | 'MERGED_CELLS' | 'SIZE_LIMIT' | '';
  } {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });

    // 优先查找"题目列表"表进行验证，如果没有则使用第一个表
    let sheetName =
      workbook.SheetNames.find((name) => name === '题目列表') ||
      workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // 检查文件大小限制（行数和列数）
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const rowCount = range.e.r + 1; // 总行数
    const colCount = range.e.c + 1; // 总列数

    if (rowCount > 10000) {
      return {
        errorType: 'SIZE_LIMIT',
      };
    }

    if (colCount > 20) {
      return {
        errorType: 'SIZE_LIMIT',
      };
    }

    // 检查是否有合并单元格
    if (worksheet['!merges'] && worksheet['!merges'].length > 0) {
      return {
        errorType: 'MERGED_CELLS',
      };
    }

    // 检查表头格式 - 支持多种格式
    const headerA1 = worksheet['A1']?.v?.toString().trim();
    const headerB1 = worksheet['B1']?.v?.toString().trim();
    const headerC1 = worksheet['C1']?.v?.toString().trim();

    // 添加调试日志
    console.log('Excel headers:', { headerA1, headerB1, headerC1 });

    // 如果是"分页配置"表，跳过表头验证
    if (headerA1 === '字段' && headerB1 === '值') {
      console.log('Skipping header validation for page config sheet');
      return { errorType: '' };
    }

    // 基本格式检查：支持新旧两种格式
    // 新格式：题目顺序、题目标题、题型、选项内容
    // 旧格式：题目标题、题型、选项内容
    const isNewFormat = 
      headerA1 === '题目顺序' && headerB1 === '题目标题' && headerC1 === '题型';
    const isOldFormat =
      headerA1 === '题目标题' && headerB1 === '题型' && headerC1 === '选项内容';
    
    const isValidFormat = isNewFormat || isOldFormat;

    if (!isValidFormat) {
      console.log('Header format validation failed:', {
        headerA1,
        headerB1,
        headerC1,
      });
      return {
        errorType: 'HEADER_FORMAT',
      };
    }

    return { errorType: '' };
  }

  private parseExcelFile(file: Express.Multer.File): ExcelQuestion[] {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });

    // 优先查找"题目列表"表，如果没有则使用第一个表
    let sheetName =
      workbook.SheetNames.find((name) => name === '题目列表') ||
      workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // 检查Excel格式
    const headerA1 = worksheet['A1']?.v?.toString().trim();
    const headerB1 = worksheet['B1']?.v?.toString().trim();
    const headerC1 = worksheet['C1']?.v?.toString().trim();
    
    // 判断是新格式还是旧格式
    const isNewFormat = 
      headerA1 === '题目顺序' && headerB1 === '题目标题' && headerC1 === '题型';
    
    let headerMapping: string[];
    
    if (isNewFormat) {
      // 新格式的列映射
      headerMapping = [
        'questionOrder',  // 题目顺序
        'title',         // 题目标题
        'type',          // 题型
        'options',       // 选项内容
        'scores',        // 选项分数
        'isRequired',    // 是否必填
        'placeholder',   // 占位符
        'minNum',        // 最小数量
        'maxNum',        // 最大数量
        'others',        // 其他选项
        'mustOthers',    // 其他选项必填
        'othersKey',     // 其他选项键值
        'placeholderDesc', // 提示内容
        'layout',        // 布局方式
        'horizontalColumns', // 横排每行列数
        'quotaDisplay',  // 显示配额
        'showIndex',     // 显示序号
        'showType',      // 显示类型
        'showSpliter',   // 显示分割线
        'content',       // 题目内容
      ];
    } else {
      // 旧格式的列映射
      headerMapping = [
        'title',
        'type',
        'options',
        'scores',
        'isRequired',
        'placeholder',
        'minNum',
        'maxNum',
        'others',
        'mustOthers',
        'othersKey',
        'placeholderDesc',
        'layout',
        'quotaDisplay',
        'showIndex',
        'showType',
        'showSpliter',
      ];
    }

    // 将工作表转换为JSON数组
    const jsonData = XLSX.utils.sheet_to_json<ExcelQuestion>(worksheet, {
      header: headerMapping,
      range: 1, // 从第二行开始读取数据
    });

    const questions: ExcelQuestion[] = [];

    for (const row of jsonData) {
      // 过滤空行
      if (!row.title && !row.type && !row.options) {
        continue;
      }

      questions.push({
        title: (row.title || '').toString().trim(),
        type: (row.type || '').toString().trim(),
        options: (row.options || '').toString().trim(),
        scores: (row.scores || '').toString().trim(),
        isRequired: (row.isRequired || '').toString().trim(),
        placeholder: (row.placeholder || '').toString().trim(),
        minNum: (row.minNum || '').toString().trim(),
        maxNum: (row.maxNum || '').toString().trim(),
        others: (row.others || '').toString().trim(),
        mustOthers: (row.mustOthers || '').toString().trim(),
        othersKey: (row.othersKey || '').toString().trim(),
        placeholderDesc: (row.placeholderDesc || '').toString().trim(),
        layout: (row.layout || '').toString().trim(),
        horizontalColumns: (row.horizontalColumns || '').toString().trim(),
        quotaDisplay: (row.quotaDisplay || '').toString().trim(),
        showIndex: (row.showIndex || '').toString().trim(),
        showType: (row.showType || '').toString().trim(),
        showSpliter: (row.showSpliter || '').toString().trim(),
        content: (row.content || '').toString().trim(),
        questionOrder: (row.questionOrder || '').toString().trim(),
      });
    }

    return questions;
  }

  @Get('/exportSurvey')
  @UseGuards(SurveyGuard)
  @SetMetadata('surveyId', 'query.surveyId')
  @SetMetadata('surveyPermission', [SURVEY_PERMISSION.SURVEY_CONF_MANAGE])
  @UseGuards(Authentication)
  async exportSurvey(
    @Query()
    queryInfo: { surveyId: string },
    @Request()
    req,
    @Res() res,
  ) {
    try {
      const { value, error } = Joi.object({
        surveyId: Joi.string().required(),
      }).validate(queryInfo);

      if (error) {
        this.logger.error(`exportSurvey_parameter error: ${error.message}`);
        throw new HttpException('参数错误', EXCEPTION_CODE.PARAMETER_ERROR);
      }

      const surveyId = value.surveyId;
      const surveyMeta = await this.surveyMetaService.getSurveyById({
        surveyId,
      });
      const surveyConf =
        await this.surveyConfService.getSurveyConfBySurveyId(surveyId);

      if (!surveyMeta || !surveyConf) {
        throw new HttpException(
          '问卷不存在或已删除',
          EXCEPTION_CODE.RESPONSE_SCHEMA_REMOVED,
        );
      }

      // 构建导出数据
      const exportData = {
        surveyMeta: {
          title: surveyMeta.title,
          remark: surveyMeta.remark,
          surveyCode: surveyMeta.surveyCode,
          surveyType: surveyMeta.surveyType,
          createdAt: surveyMeta.createdAt,
          updatedAt: surveyMeta.updatedAt,
        },
        surveyConf: surveyConf.code,
      };

      // 检查数据结构
      if (
        !exportData.surveyConf ||
        !exportData.surveyConf.dataConf ||
        !exportData.surveyConf.dataConf.dataList
      ) {
        this.logger.error(
          `exportSurvey data structure error: surveyConf=${JSON.stringify(exportData.surveyConf)}`,
        );
        throw new HttpException(
          '问卷数据结构错误',
          EXCEPTION_CODE.PARAMETER_ERROR,
        );
      }

      // 创建Excel文件
      const workbook = XLSX.utils.book_new();

      // 创建分页配置表
      const pageConfData = [
        {
          字段: '分页配置',
          值: (exportData.surveyConf as any).pageConf
            ? (exportData.surveyConf as any).pageConf.join(',')
            : '',
        },
        { 字段: '说明', 值: '分页配置表示在第几题后分页，用逗号分隔' },
      ];
      const pageConfSheet = XLSX.utils.json_to_sheet(pageConfData);
      XLSX.utils.book_append_sheet(workbook, pageConfSheet, '分页配置');

      // 创建描述配置表
      const descriptionConfig = (exportData.surveyConf as any).bannerConf
        ?.descriptionConfig;
      if (descriptionConfig) {
        const descriptionData = [];
        Object.keys(descriptionConfig).forEach((pageKey) => {
          const pageContent = descriptionConfig[pageKey]?.content;
          if (pageContent) {
            descriptionData.push({
              页面: pageKey.replace('page', '第') + '页',
              描述内容: pageContent,
            });
          }
        });
        if (descriptionData.length > 0) {
          const descriptionSheet = XLSX.utils.json_to_sheet(descriptionData);
          XLSX.utils.book_append_sheet(workbook, descriptionSheet, '描述配置');
        }
      }

      // 创建题目数据表 - 与导入格式保持一致
      const questionsData = exportData.surveyConf.dataConf.dataList.map(
        (question, index) => {
          // 题型映射：英文转中文
          const typeMapping: Record<string, string> = {
            text: '单行输入框',
            textarea: '多行输入框',
            radio: '单选',
            checkbox: '多选',
            'binary-choice': '判断题',
            'radio-star': '评分',
            'radio-nps': 'NPS评分',
            vote: '投票',
            cascader: '多级联动',
            description: '描述文本',
            select: '下拉单选',
            'select-multiple': '下拉多选',
            'inline-form': '内联填空',
          };

          const questionData: any = {
            题目顺序: index + 1, // 题目在问卷中的顺序
            题目标题: question.title,
            题型: typeMapping[question.type] || question.type,
            选项内容: '',
            选项分数: '',
            是否必填: question.isRequired ? '是' : '否',
            占位符: question.placeholder || '',
            最小数量: question.minNum || '',
            最大数量: question.maxNum || '',
            其他选项: '',
            其他选项必填: '',
            其他选项键值: '',
            提示内容: '',
            布局方式: (question as any).layout || 'vertical',
            横排每行列数: (question as any).horizontalColumns || 2,
            显示配额: question.quotaDisplay ? '是' : '否',
            显示序号: question.showIndex ? '是' : '否',
            显示类型: question.showType ? '是' : '否',
            显示分割线: question.showSpliter ? '是' : '否',
            题目内容: '', // 用于描述文本和内联填空
          };

          // 处理选项
          if (question.options && question.options.length > 0) {
            questionData.选项内容 = question.options
              .map((option) => option.text)
              .join('; ');
            questionData.选项分数 = question.options
              .map((option) => (option as any).score || '')
              .join('; ');

            // 处理选项的特殊字段
            const othersOptions = question.options.filter(
              (option) => option.others,
            );
            if (othersOptions.length > 0) {
              questionData.其他选项 = othersOptions
                .map((option) => option.text)
                .join('; ');
              questionData.其他选项必填 = othersOptions
                .map((option) => (option.mustOthers ? '是' : '否'))
                .join('; ');
              questionData.其他选项键值 = othersOptions
                .map((option) => option.othersKey || '')
                .join('; ');
              questionData.提示内容 = othersOptions
                .map((option) => option.placeholderDesc || '')
                .join('; ');
            }
          }

          // 处理描述文本/内联填空的内容
          if (question.type === 'description' || question.type === 'inline-form') {
            questionData.题目内容 = (question as any).content || '';
            // 为了兼容旧版本，也保留在选项内容中
            questionData.选项内容 = (question as any).content || '';
          }

          // 处理下拉框的选项
          if (question.type === 'select' || question.type === 'select-multiple') {
            if (question.options && question.options.length > 0) {
              questionData.选项内容 = question.options
                .map((option) => option.text)
                .join('; ');
            }
          }

          return questionData;
        },
      );

      const questionsSheet = XLSX.utils.json_to_sheet(questionsData);
      XLSX.utils.book_append_sheet(workbook, questionsSheet, '题目列表');

      // 创建皮肤设置表
      const skinConfig = (exportData.surveyConf as any).skinConf;
      if (skinConfig) {
        const skinData = [
          {
            配置项: '头图链接',
            配置值: skinConfig.bannerConfig?.bannerImg || '',
            说明: '问卷头部横幅图片的URL链接'
          },
          {
            配置项: '品牌Logo',
            配置值: skinConfig.bannerConfig?.logoImg || '',
            说明: '问卷品牌Logo图片的URL链接'
          },
          {
            配置项: '主题色',
            配置值: skinConfig.themeConf?.colorConf?.themeColor || '#4a4c5b',
            说明: '问卷主题颜色，支持十六进制颜色值'
          },
          {
            配置项: '提交按钮颜色',
            配置值: skinConfig.themeConf?.colorConf?.submitBtnColor || '#4a4c5b',
            说明: '提交按钮的背景颜色'
          },
          {
            配置项: '背景色',
            配置值: skinConfig.themeConf?.colorConf?.backgroundColor || '#f5f5f7',
            说明: '问卷整体背景颜色'
          },
          {
            配置项: '内容区背景色',
            配置值: skinConfig.themeConf?.colorConf?.contentBackgroundColor || '#ffffff',
            说明: '问卷内容区域背景颜色'
          }
        ];
        const skinSheet = XLSX.utils.json_to_sheet(skinData);
        XLSX.utils.book_append_sheet(workbook, skinSheet, '皮肤设置');
      }

      // 生成Excel文件
      const excelBuffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
      });

      // 设置响应头
      const filename = `${exportData.surveyMeta.title}-问卷导出-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.xlsx`;

      // 设置响应头并返回文件流
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(filename)}"`,
      );
      res.setHeader('Content-Length', excelBuffer.length);

      return res.send(excelBuffer);
    } catch (error) {
      this.logger.error(`exportSurvey error: ${error.message}`);
      this.logger.error(`exportSurvey error stack: ${error.stack}`);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException('导出失败', EXCEPTION_CODE.SERVER_ERROR);
    }
  }
}
