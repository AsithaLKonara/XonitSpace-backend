import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LeaveDto } from './dto/leave.dto';
import { SalaryDto } from './dto/salary.dto';
import { LeaveStatus, SalaryStatus } from '@prisma/client';
import { ClockService } from '../../common/services/clock.service';

@Injectable()
export class HrService {
  constructor(
    private prisma: PrismaService,
    private clockService: ClockService
  ) {}

  async listEmployees() {
    return this.prisma.employee.findMany({
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
          },
        },
      },
    });
  }

  async getEmployeeProfile(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        attendance: { take: 10, orderBy: { clockIn: 'desc' } },
        leaves: { take: 10, orderBy: { startDate: 'desc' } },
        salaries: { take: 12, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee profile not found');
    }

    return employee;
  }

  async clockIn(userId: string, ipAddress?: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee record not found');

    const activeSession = await this.prisma.attendance.findFirst({
      where: { employeeId: employee.id, clockOut: null },
    });

    if (activeSession) {
      throw new BadRequestException('You are already clocked in');
    }

    return this.prisma.attendance.create({
      data: {
        employeeId: employee.id,
        clockIn: this.clockService.getDate(),
        ipAddress,
      },
    });
  }

  async clockOut(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee record not found');

    const activeSession = await this.prisma.attendance.findFirst({
      where: { employeeId: employee.id, clockOut: null },
    });

    if (!activeSession) {
      throw new BadRequestException('You are not clocked in');
    }

    const clockOutTime = this.clockService.getDate();
    const elapsedMs = clockOutTime.getTime() - activeSession.clockIn.getTime();
    const workHours = parseFloat((elapsedMs / (1000 * 60 * 60)).toFixed(2));

    return this.prisma.attendance.update({
      where: { id: activeSession.id },
      data: {
        clockOut: clockOutTime,
        workHours,
      },
    });
  }

  async getAttendanceHistory(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee record not found');

    return this.prisma.attendance.findMany({
      where: { employeeId: employee.id },
      orderBy: { clockIn: 'desc' },
      take: 30,
    });
  }

  async applyLeave(userId: string, dto: LeaveDto) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee record not found');

    return this.prisma.leave.create({
      data: {
        employeeId: employee.id,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        reason: dto.reason,
      },
    });
  }

  async listLeaves() {
    return this.prisma.leave.findMany({
      include: {
        employee: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateLeaveStatus(leaveId: string, status: LeaveStatus, approverId: string) {
    const leave = await this.prisma.leave.findUnique({ where: { id: leaveId } });
    if (!leave) throw new NotFoundException('Leave application not found');

    return this.prisma.leave.update({
      where: { id: leaveId },
      data: {
        status,
        approvedById: approverId,
      },
    });
  }

  async generateSalary(dto: SalaryDto) {
    const allowances = dto.allowances || 0;
    const deductions = dto.deductions || 0;
    const netSalary = dto.basicSalary + allowances - deductions;

    return this.prisma.salary.create({
      data: {
        employeeId: dto.employeeId,
        basicSalary: dto.basicSalary,
        allowances,
        deductions,
        netSalary,
        status: SalaryStatus.PENDING,
      },
    });
  }

  async listSalaries() {
    return this.prisma.salary.findMany({
      include: {
        employee: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async paySalary(salaryId: string) {
    const salary = await this.prisma.salary.findUnique({ where: { id: salaryId } });
    if (!salary) throw new NotFoundException('Salary record not found');
    if (salary.status === SalaryStatus.PAID) throw new BadRequestException('Salary already paid');

    // Simulate payslip generation (this will be replaced by a real S3 upload later)
    const payslipPdfUrl = `https://s3.placeholder.com/payslips/PAYSLIP-${salaryId}.pdf`;

    return this.prisma.salary.update({
      where: { id: salaryId },
      data: {
        status: SalaryStatus.PAID,
        paymentDate: new Date(),
        payslipPdfUrl,
      },
    });
  }
}
