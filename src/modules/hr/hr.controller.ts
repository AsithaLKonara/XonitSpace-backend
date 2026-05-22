import { Controller, Get, Post, Body, Param, Patch, UseGuards, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { HrService } from './hr.service';
import { LeaveDto } from './dto/leave.dto';
import { SalaryDto } from './dto/salary.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { SystemRole, LeaveStatus } from '@prisma/client';
import type { Request } from 'express';

@ApiTags('Human Resources (HRM)')
@Controller('api/v1/hr')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class HrController {
  constructor(private hrService: HrService) {}

  @Get('employees')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.PROJECT_MANAGER, SystemRole.HR_MANAGER, SystemRole.ACCOUNTANT)
  @ApiOperation({ summary: 'List all employees profiles' })
  listEmployees() {
    return this.hrService.listEmployees();
  }

  @Get('employee/profile')
  @ApiOperation({ summary: 'Get current employee profile details' })
  getMyProfile(@GetUser('id') userId: string) {
    return this.hrService.getEmployeeProfile(userId);
  }

  @Get('employee/:id/profile')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.HR_MANAGER)
  @ApiOperation({ summary: 'Get a specific employee profile' })
  getEmployeeProfile(@Param('id') userId: string) {
    return this.hrService.getEmployeeProfile(userId);
  }

  @Post('attendance/clock-in')
  @ApiOperation({ summary: 'Clock in attendance' })
  clockIn(@GetUser('id') userId: string, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress;
    return this.hrService.clockIn(userId, ip);
  }

  @Post('attendance/clock-out')
  @ApiOperation({ summary: 'Clock out attendance' })
  clockOut(@GetUser('id') userId: string) {
    return this.hrService.clockOut(userId);
  }

  @Get('attendance/history')
  @ApiOperation({ summary: 'Get current user attendance logs' })
  getAttendanceHistory(@GetUser('id') userId: string) {
    return this.hrService.getAttendanceHistory(userId);
  }

  @Post('leaves')
  @ApiOperation({ summary: 'Apply for leave request' })
  applyLeave(@GetUser('id') userId: string, @Body() leaveDto: LeaveDto) {
    return this.hrService.applyLeave(userId, leaveDto);
  }

  @Get('leaves')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.PROJECT_MANAGER, SystemRole.HR_MANAGER)
  @ApiOperation({ summary: 'List all leave applications' })
  listLeaves() {
    return this.hrService.listLeaves();
  }

  @Patch('leaves/:id/approve')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.PROJECT_MANAGER, SystemRole.HR_MANAGER)
  @ApiOperation({ summary: 'Approve or reject a leave request' })
  approveLeave(
    @Param('id') leaveId: string,
    @Query('status') status: LeaveStatus,
    @GetUser('id') approverId: string,
  ) {
    return this.hrService.updateLeaveStatus(leaveId, status, approverId);
  }

  @Post('salaries')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.HR_MANAGER)
  @ApiOperation({ summary: 'Generate a new salary record' })
  generateSalary(@Body() salaryDto: SalaryDto) {
    return this.hrService.generateSalary(salaryDto);
  }

  @Get('salaries')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.HR_MANAGER)
  @ApiOperation({ summary: 'List all salary records' })
  listSalaries() {
    return this.hrService.listSalaries();
  }

  @Patch('salaries/:id/pay')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.HR_MANAGER)
  @ApiOperation({ summary: 'Mark salary as paid and generate payslip' })
  paySalary(@Param('id') salaryId: string) {
    return this.hrService.paySalary(salaryId);
  }
}
