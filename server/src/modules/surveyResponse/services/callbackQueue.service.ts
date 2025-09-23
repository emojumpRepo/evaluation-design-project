import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export interface CallbackJobData {
  callbackConfig: any;
  callbackData: any;
  surveyPath: string;
  attempt?: number;
}

@Injectable()
export class CallbackQueueService implements OnModuleInit {
  // 使用console.log作为logger
  private log(level: string, message: string) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] [CallbackQueueService] ${message}`);
  }

  private info(message: string) {
    this.log('info', message);
  }

  private error(message: string) {
    this.log('error', message);
  }

  constructor(
    @InjectQueue('callback') private readonly callbackQueue: Queue,
  ) {}

  async onModuleInit() {
    // 清理已完成的任务
    await this.callbackQueue.clean(1000 * 60 * 60 * 24, 'completed'); // 清理24小时前完成的任务
    await this.callbackQueue.clean(1000 * 60 * 60 * 24 * 7, 'failed'); // 清理7天前失败的任务
  }

  /**
   * 添加回调任务到队列
   */
  async addCallbackJob(data: CallbackJobData, delay?: number) {
    try {
      const job = await this.callbackQueue.add('process-callback', data, {
        delay: delay || 0, // 延迟执行，单位：毫秒
        attempts: 3, // 最大重试次数
        backoff: {
          type: 'exponential',
          delay: 2000, // 初始延迟2秒
        },
        removeOnComplete: true, // 完成后自动删除
        removeOnFail: false, // 失败后保留，便于调试
      });

      this.info(`回调任务已加入队列: jobId=${job.id}, surveyPath=${data.surveyPath}`);
      return job;
    } catch (error) {
      this.error(`添加回调任务失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取队列状态
   */
  async getQueueStatus() {
    const jobCounts = await this.callbackQueue.getJobCounts();
    return {
      waiting: jobCounts.waiting,
      active: jobCounts.active,
      completed: jobCounts.completed,
      failed: jobCounts.failed,
      delayed: jobCounts.delayed,
    };
  }

  /**
   * 重试失败的任务
   */
  async retryFailedJob(jobId: string) {
    const job = await this.callbackQueue.getJob(jobId);
    if (job && job.failedReason) {
      await job.retry();
      this.info(`重试失败任务: jobId=${jobId}`);
      return true;
    }
    return false;
  }

  /**
   * 清理队列
   */
  async cleanQueue(grace: number = 1000 * 60 * 60 * 24) {
    await this.callbackQueue.clean(grace, 'completed');
    await this.callbackQueue.clean(grace * 7, 'failed');
    this.info('队列清理完成');
  }
}