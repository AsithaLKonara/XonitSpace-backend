import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { HrModule } from './modules/hr/hr.module';
import { CrmModule } from './modules/crm/crm.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { FinanceModule } from './modules/finance/finance.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { EmailModule } from './modules/email/email.module';
import { ChatModule } from './modules/chat/chat.module';
import { TicketsModule } from './modules/tickets/tickets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 100 }], // 100 req/min per IP
    }),
    PrismaModule,
    EmailModule,
    AuthModule,
    HrModule,
    CrmModule,
    ProjectsModule,
    FinanceModule,
    NotificationsModule,
    AnalyticsModule,
    UploadsModule,
    ChatModule,
    TicketsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
