import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsService } from './jobs.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'mail' },
      { name: 'finance' },
      { name: 'hr' }
    ),
  ],
  providers: [JobsService],
  exports: [JobsService, BullModule],
})
export class JobsModule {}
