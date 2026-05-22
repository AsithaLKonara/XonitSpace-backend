import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('mail')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing email job ${job.id} of type ${job.name}...`);
    // Example: this.emailService.sendMail(job.data)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.logger.log(`Completed email job ${job.id}`);
  }
}
