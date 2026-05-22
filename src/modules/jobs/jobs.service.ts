import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceStatus } from '@prisma/client';
import { ClockService } from '../../common/services/clock.service';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private prisma: PrismaService,
    private clockService: ClockService
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleOverdueInvoices() {
    this.logger.log('Running CRON Job: Checking for overdue invoices');
    
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.DRAFT, // OR PENDING if used
        dueDate: { lt: this.clockService.getDate() },
      },
    });

    for (const invoice of overdueInvoices) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.OVERDUE },
      });
      this.logger.log(`Marked Invoice ${invoice.id} as OVERDUE`);
    }
  }

  @Cron(CronExpression.EVERY_WEEK)
  async handleExpiredSessions() {
    this.logger.log('Running CRON Job: Clearing expired sessions');
    
    const { count } = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: this.clockService.getDate() } },
    });
    
    this.logger.log(`Cleared ${count} expired sessions`);
  }
}

