import { Injectable } from '@nestjs/common';
import * as vm from 'vm';
import { Logger } from 'src/logger';

@Injectable()
export class CalculateService {
  constructor(private readonly logger: Logger) {}

  /**
   * 安全执行用户自定义的计算代码
   * @param code 用户编写的计算代码
   * @param formData 用户提交的表单数据
   * @param questions 问卷题目信息
   * @returns 计算结果
   */
  async executeCalculation(
    code: string,
    formData: any,
    questions: any[],
  ): Promise<any> {
    if (!code || typeof code !== 'string') {
      return null;
    }

    try {
      // 创建沙箱上下文
      const sandbox = {
        formData: formData,
        questions: questions,
        // 提供一些安全的工具函数
        console: {
          log: (...args: any[]) => {
            this.logger.info(`[Calculate] ${args.join(' ')}`);
          },
        },
        Math: Math,
        Date: Date,
        JSON: JSON,
        parseInt: parseInt,
        parseFloat: parseFloat,
        isNaN: isNaN,
        isFinite: isFinite,
        // 提供一些常用的工具函数
        sum: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
        avg: (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length,
        min: (arr: number[]) => Math.min(...arr),
        max: (arr: number[]) => Math.max(...arr),
      };

      // 包装代码，确保返回值
      const wrappedCode = `
        (function() {
          ${code}
        })()
      `;

      // 创建VM脚本
      const script = new vm.Script(wrappedCode);

      // 创建上下文
      const context = vm.createContext(sandbox);

      // 执行代码
      const result = script.runInContext(context, {
        timeout: 5000,
        breakOnSigint: true,
      });

      // 验证返回值
      if (result === undefined || result === null) {
        this.logger.info('计算代码未返回有效结果');
        return null;
      }

      // 确保返回的是可序列化的对象
      try {
        JSON.stringify(result);
        return result;
      } catch (e) {
        this.logger.error(`计算结果无法序列化: ${e.message}`);
        return {
          error: '计算结果格式错误',
        };
      }
    } catch (error) {
      this.logger.error(`执行计算代码失败: ${error.message}`);
      return {
        error: error.message,
      };
    }
  }

  /**
   * 处理问卷提交时的计算
   */
  async processCalculation(
    calculateConf: any,
    formData: any,
    questions: any[],
  ): Promise<any> {
    // 检查是否启用计算
    if (!calculateConf?.enabled || !calculateConf?.code) {
      return null;
    }

    try {
      const result = await this.executeCalculation(
        calculateConf.code,
        formData,
        questions,
      );

      if (result && !result.error) {
        this.logger.info(
          `计算成功，结果: ${JSON.stringify(result).substring(0, 200)}`,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(`处理计算失败: ${error.message}`);
      return null;
    }
  }
}