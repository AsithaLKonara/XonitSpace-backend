import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';

@Injectable()
@Processor('dlq', {
  maxStalledCount: 3,
  stalledInterval: 30000,
})
export class DlqProcessor extends WorkerHost {
  private readonly logger = new Logger(DlqProcessor.name);

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.warn(`Processing dead letter job: ${job.id} of type ${job.name}`);
    // Here we could persist the job data to a long-term storage or alert the team.
    // For now, we just acknowledge receipt in the DLQ.
    return { status: 'recorded_in_dlq' };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`DLQ Job ${job.id} failed: ${error.message}`);
  }
}
