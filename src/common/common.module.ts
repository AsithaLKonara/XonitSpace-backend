import { Global, Module } from '@nestjs/common';
import { ClockService } from './services/clock.service';
import { IdService } from './services/id.service';
import { TransactionService } from './database/transaction.service';
import { DlqProcessor } from './queues/dlq.processor';
import { BullModule } from '@nestjs/bullmq';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: 'dlq' }),
  ],
  providers: [ClockService, IdService, TransactionService, DlqProcessor],
  exports: [ClockService, IdService, TransactionService, BullModule],
})
export class CommonModule {}
