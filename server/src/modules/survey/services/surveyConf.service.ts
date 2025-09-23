import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MongoRepository } from 'typeorm';
import { SurveyConf } from 'src/models/surveyConf.entity';
import { HttpException } from 'src/exceptions/httpException';
import { SurveyNotFoundException } from 'src/exceptions/surveyNotFoundException';
import { EXCEPTION_CODE } from 'src/enums/exceptionCode';
import {
  SurveySchemaInterface,
  DataItem,
  Option,
  CascaderItem,
} from 'src/interfaces/survey';
import { getSchemaBySurveyType } from '../utils';
import { QUESTION_TYPE } from 'src/enums/question';

@Injectable()
export class SurveyConfService {
  constructor(
    @InjectRepository(SurveyConf)
    private readonly surveyConfRepository: MongoRepository<SurveyConf>,
  ) {}

  async createSurveyConf(params: {
    surveyId: string;
    surveyType: string;
    createMethod: string;
    createFrom: string;
    questionList?: Array<any>;
    code?: any;
    pageConf?: number[];
    descriptionConfig?: any;
  }) {
    const { surveyId, surveyType, createMethod, createFrom, questionList, code, pageConf, descriptionConfig } =
      params;
    let schemaData = null;
    
    // 如果直接提供了code，优先使用
    if (code) {
      schemaData = code;
    } else if (createMethod === 'copy') {
      const codeInfo = await this.getSurveyConfBySurveyId(createFrom);
      schemaData = codeInfo.code;
    } else {
      try {
        schemaData = await getSchemaBySurveyType(surveyType);
        if (questionList && questionList.length > 0) {
          schemaData.dataConf.dataList = questionList;
        }
        if (pageConf && pageConf.length > 0) {
          console.log('设置分页配置到schemaData:', pageConf);
          schemaData.pageConf = pageConf;
        }
        if (descriptionConfig && Object.keys(descriptionConfig).length > 0) {
          console.log('设置描述配置到schemaData:', descriptionConfig);
          if (!schemaData.bannerConf) {
            schemaData.bannerConf = {};
          }
          schemaData.bannerConf.descriptionConfig = descriptionConfig;
        }
      } catch (error) {
        throw new HttpException(
          error.message,
          EXCEPTION_CODE.SURVEY_TYPE_ERROR,
        );
      }
    }

    const newCode = this.surveyConfRepository.create({
      pageId: surveyId,
      code: schemaData,
    });

    return this.surveyConfRepository.save(newCode);
  }

  async getSurveyConfBySurveyId(surveyId: string) {
    const code = await this.surveyConfRepository.findOne({
      where: { pageId: surveyId },
    });
    if (!code) {
      throw new SurveyNotFoundException('问卷配置不存在');
    }
    return code;
  }

  async saveSurveyConf(params: {
    surveyId: string;
    schema: SurveySchemaInterface;
  }) {
    const codeInfo = await this.getSurveyConfBySurveyId(params.surveyId);
    if (!codeInfo) {
      throw new SurveyNotFoundException('问卷配置不存在');
    }
    // 持久化前做字段去重和修正
    const fixedSchema = this.ensureUniqueFieldsAndHashes(params.schema);
    codeInfo.code = fixedSchema;
    await this.surveyConfRepository.save(codeInfo);
  }

  async getAllSurveyConf() {
    return this.surveyConfRepository.find();
  }

  async getSurveyContentByCode(codeInfo: SurveySchemaInterface) {
    const dataList = codeInfo.dataConf.dataList;
    const arr: Array<string> = [];
    for (const item of dataList) {
      arr.push(item.title);
      if (Array.isArray(item.options)) {
        for (const option of item.options) {
          arr.push(option.text);
        }
      }
    }
    return {
      text: arr.join('\n'),
    };
  }

  async updateSimpleConf(params: {
    surveyId: string;
    beginTime: string;
    endTime: string;
  }) {
    const conf = await this.getSurveyConfBySurveyId(params.surveyId);
    if (!conf) {
      throw new SurveyNotFoundException('问卷配置不存在');
    }
    conf.code.baseConf.beginTime = params.beginTime;
    conf.code.baseConf.endTime = params.endTime;
    await this.surveyConfRepository.save(conf);
    return conf.code;
  }

  /**
   * 确保 dataList 中每道题的 field 唯一，且选项 hash 非空且唯一。
   * 如发现重复/空值，将自动修正为新的随机值（仅在本次 schema 内保证唯一）。
   */
  private ensureUniqueFieldsAndHashes(schema: SurveySchemaInterface): SurveySchemaInterface {
    if (!schema?.dataConf?.dataList || !Array.isArray(schema.dataConf.dataList)) {
      return schema;
    }
    const usedFields = new Set<string>();
    const genField = () => {
      let f = '';
      do {
        f = `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      } while (usedFields.has(f));
      return f;
    };
    const fixOptionHashes = (options?: Array<Option>) => {
      if (!Array.isArray(options)) return;
      const used = new Set<string>();
      const genHash = () => {
        let h = '';
        do {
          h = Math.random().toString(36).slice(2, 8);
        } while (used.has(h));
        return h;
      };
      for (const op of options) {
        if (!op) continue;
        let h = (op as any).hash as unknown as string;
        if (typeof h !== 'string' || h.trim() === '' || used.has(h)) {
          h = genHash();
          (op as any).hash = h as any;
        }
        used.add(h);
      }
    };
    for (const item of schema.dataConf.dataList as Array<DataItem & { extraOptions?: Option[] }>) {
      if (!item) continue;
      let { field } = item as any;
      if (typeof field !== 'string' || field.trim() === '' || usedFields.has(field)) {
        field = genField();
        (item as any).field = field;
      }
      usedFields.add(field);
      // 修正选项 hash
      fixOptionHashes((item as any).options);
      fixOptionHashes((item as any).extraOptions);
    }
    return schema;
  }

  /**
   * 将题目根据类型格式化为统一清晰的 JSON
   */
  private formatQuestion(item: DataItem) {
    const base = { title: this.stripHtml(item.title), type: item.type } as any;

    const mapOptions = (options?: Option[]) => {
      if (!Array.isArray(options)) return [];
      return options.map((op) => {
        const text = this.stripHtml(op.text);
        const hasInput = op.others || !!op.othersKey;
        if (!hasInput) return text;
        return {
          text,
          input: {
            required: !!op.mustOthers,
            placeholder: this.stripHtml(op.placeholderDesc || ''),
            key: op.othersKey || 'others',
          },
        };
      });
    };

    const mapCascader = (nodes?: CascaderItem[]): any[] => {
      if (!Array.isArray(nodes)) return [];
      return nodes.map((n) => ({
        text: this.stripHtml(n.text),
        children: mapCascader(n.children),
      }));
    };

    switch (item.type) {
      case QUESTION_TYPE.RADIO:
        return { ...base, options: mapOptions(item.options) };
      case QUESTION_TYPE.CHECKBOX:
        return { ...base, options: mapOptions(item.options) };
      case QUESTION_TYPE.TEXT:
      case QUESTION_TYPE.TEXTAREA:
        return { ...base, placeholder: this.stripHtml(item.placeholder || '') };
      case QUESTION_TYPE.BINARY_CHOICE:
        return {
          ...base,
          options: mapOptions(
            item.options?.length
              ? item.options
              : ([{ text: '是' }, { text: '否' }] as any),
          ),
        };
      case QUESTION_TYPE.RADIO_STAR:
        return { ...base, max: item.star || 5 };
      case QUESTION_TYPE.RADIO_NPS:
        return {
          ...base,
          leftText: this.stripHtml(item?.nps?.leftText || '不推荐'),
          rightText: this.stripHtml(item?.nps?.rightText || '非常推荐'),
        };
      case QUESTION_TYPE.CASCADER:
        return { ...base, options: mapCascader(item?.cascaderData?.children) };
      case QUESTION_TYPE.VOTE:
        return {
          ...base,
          innerType: item.innerType,
          minNum: item.minNum,
          maxNum: item.maxNum,
          options: mapOptions(item.options),
        };
      default:
        // 未识别类型，回退到标题+原始类型
        return base;
    }
  }

  /**
   * 根据 surveyId 获取格式化的题目列表
   */
  async getFormattedQuestionsBySurveyId(surveyId: string) {
    const conf = await this.getSurveyConfBySurveyId(surveyId);
    const dataList = conf?.code?.dataConf?.dataList || [];
    return dataList.map((q) => this.formatQuestion(q));
  }

  /**
   * 去除字符串中的 HTML 标签
   */
  private stripHtml(value?: string): string {
    if (!value) return '';
    return value.replace(/<[^>]*>/g, '').trim();
  }
}
