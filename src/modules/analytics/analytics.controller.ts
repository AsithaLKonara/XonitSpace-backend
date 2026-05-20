import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { SystemRole } from '@prisma/client';

@ApiTags('Realtime Charts & KPI Analytics')
@Controller('api/v1/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('admin-kpis')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Get business-wide KPIs and financial graphs' })
  getAdminKpis() {
    return this.analyticsService.getAdminKpis();
  }

  @Get('pm-kpis')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Get PM workforce tracking workload logs' })
  getPmKpis(@GetUser('id') userId: string) {
    return this.analyticsService.getPmKpis(userId);
  }

  @Get('employee-kpis')
  @ApiOperation({ summary: 'Get current employee individual metrics summary' })
  getEmployeeKpis(@GetUser('id') userId: string) {
    return this.analyticsService.getEmployeeKpis(userId);
  }

  @Get('hunter-kpis')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.INFLUENCER)
  @ApiOperation({ summary: 'Get referrer commissions details feed' })
  getHunterKpis(@GetUser('id') userId: string) {
    return this.analyticsService.getHunterKpis(userId);
  }
}
