import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import axios from 'axios';
import { CallbackJobData } from './callbackQueue.service';

/**
 * 回调成功响应结构
 */
interface CallbackSuccessResponse {
  code?: number;
  success?: boolean;
  status?: string;
  message?: string;
}

@Processor('callback')
export class CallbackProcessor {
  // 使用console.log作为logger，因为Processor不在Request范围内
  private log(level: string, message: string) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] [CallbackProcessor] ${message}`);
  }

  private info(message: string) {
    this.log('info', message);
  }

  private error(message: string) {
    this.log('error', message);
  }

  private warn(message: string) {
    this.log('warn', message);
  }

  @Process('process-callback')
  async handleCallback(job: Job<CallbackJobData>) {
    const { callbackConfig, callbackData, surveyPath } = job.data;
    
    this.info(
      `开始处理回调任务: jobId=${job.id}, attempt=${job.attemptsMade + 1}/${job.opts.attempts}, surveyPath=${surveyPath}`,
    );

    try {
      // 构建请求头
      const headers = {
        'Content-Type': 'application/json',
      };

      // 如果启用了自定义headers
      if (callbackConfig.headersEnabled && callbackConfig.headers) {
        try {
          const customHeaders = JSON.parse(callbackConfig.headers);
          Object.assign(headers, customHeaders);
        } catch (e) {
          this.error(`解析自定义headers失败: ${e.message}`);
        }
      }

      const timeout = (parseInt(callbackConfig.timeout) || 10) * 1000;

      // 发送HTTP请求
      const response = await axios({
        method: callbackConfig.method || 'POST',
        url: callbackConfig.url,
        data: callbackConfig.method === 'GET' ? undefined : callbackData,
        params: callbackConfig.method === 'GET' ? callbackData : undefined,
        headers,
        timeout,
        validateStatus: () => true, // 接受所有状态码，自行处理
      });

      // 检查HTTP状态码
      const httpSuccess = response.status >= 200 && response.status < 300;
      
      // 检查响应体格式
      let bodySuccess = false;
      if (httpSuccess && response.data) {
        const responseData = response.data as CallbackSuccessResponse;
        
        // 支持多种成功响应格式
        bodySuccess = 
          (responseData.code === 200 || responseData.code === 0) ||
          (responseData.success === true) ||
          (responseData.status === 'success' || responseData.status === 'ok');
      }

      // 判断是否成功
      if (httpSuccess && bodySuccess) {
        this.info(
          `回调成功: jobId=${job.id}, surveyPath=${surveyPath}, ` +
          `status=${response.status}, responseCode=${response.data?.code}`,
        );
        return {
          success: true,
          status: response.status,
          data: response.data,
          timestamp: Date.now(),
        };
      } else {
        // 回调失败，抛出错误触发重试
        const errorMsg = 
          `回调响应不符合预期: status=${response.status}, ` +
          `body=${JSON.stringify(response.data).substring(0, 200)}`;
        
        this.warn(errorMsg);
        
        // 如果是客户端错误（4xx），不再重试
        if (response.status >= 400 && response.status < 500) {
          this.error(`客户端错误，停止重试: status=${response.status}`);
          return {
            success: false,
            status: response.status,
            data: response.data,
            error: '客户端错误，停止重试',
            timestamp: Date.now(),
          };
        }
        
        // 服务端错误或响应格式不正确，抛出异常触发重试
        throw new Error(errorMsg);
      }
    } catch (error) {
      // 记录错误日志
      this.error(
        `回调处理失败: jobId=${job.id}, surveyPath=${surveyPath}, ` +
        `attempt=${job.attemptsMade + 1}, error=${error.message}`,
      );
      
      // 如果是最后一次尝试，记录详细错误
      if (job.attemptsMade + 1 >= job.opts.attempts) {
        this.error(
          `回调最终失败: jobId=${job.id}, surveyPath=${surveyPath}, ` +
          `totalAttempts=${job.opts.attempts}, finalError=${error.message}`,
        );
      }
      
      // 重新抛出错误，让Bull处理重试逻辑
      throw error;
    }
  }

  /**
   * 任务完成时的处理
   */
  @Process('completed')
  async onCompleted(job: Job<CallbackJobData>) {
    this.info(`回调任务完成: jobId=${job.id}, surveyPath=${job.data.surveyPath}`);
  }

  /**
   * 任务失败时的处理
   */
  @Process('failed')
  async onFailed(job: Job<CallbackJobData>) {
    this.error(
      `回调任务最终失败: jobId=${job.id}, surveyPath=${job.data.surveyPath}, ` +
      `failedReason=${job.failedReason}`,
    );
    
    // 这里可以添加额外的失败处理逻辑
    // 例如：发送通知、记录到数据库等
  }
}