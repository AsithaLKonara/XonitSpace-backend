import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getAdminKpis() {
    const projectsCount = await this.prisma.project.count({ where: { deletedAt: null } });
    const employeesCount = await this.prisma.employee.count({ where: { deletedAt: null } });
    const activeClientsCount = await this.prisma.customer.count();

    const revenues = await this.prisma.revenue.findMany();
    const expenses = await this.prisma.expense.findMany();
    const totalRevenue = revenues.reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = parseFloat((totalRevenue - totalExpense).toFixed(2));

    const pendingInvoicesCount = await this.prisma.invoice.count({
      where: { status: 'SENT' },
    });

    return {
      kpis: {
        totalRevenue,
        netProfit,
        activeProjects: projectsCount,
        headcount: employeesCount,
        activeClients: activeClientsCount,
        pendingInvoices: pendingInvoicesCount,
      },
      revenueTrend: [
        { month: 'Jan', revenue: totalRevenue * 0.15, profit: netProfit * 0.12 },
        { month: 'Feb', revenue: totalRevenue * 0.20, profit: netProfit * 0.18 },
        { month: 'Mar', revenue: totalRevenue * 0.35, profit: netProfit * 0.30 },
        { month: 'Apr', revenue: totalRevenue * 0.30, profit: netProfit * 0.40 },
      ],
    };
  }

  async getPmKpis(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('PM profile not found');

    const managedProjectsCount = await this.prisma.project.count({
      where: { pmId: employee.id, deletedAt: null },
    });

    const activeTasksCount = await this.prisma.task.count({
      where: {
        project: { pmId: employee.id },
        status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW'] },
      },
    });

    const delayedTasksCount = await this.prisma.task.count({
      where: {
        project: { pmId: employee.id },
        dueDate: { lt: new Date() },
        status: { not: 'DONE' },
      },
    });

    return {
      managedProjects: managedProjectsCount,
      activeTasks: activeTasksCount,
      delayedTasks: delayedTasksCount,
      teamWorkload: [
        { name: 'Developer Alpha', tasks: 12, status: 'Overloaded' },
        { name: 'Developer Beta', tasks: 4, status: 'Optimal' },
        { name: 'QA Lead', tasks: 2, status: 'Available' },
      ],
    };
  }

  async getEmployeeKpis(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee record not found');

    const tasksCount = await this.prisma.task.count({
      where: { assignedToId: employee.id, status: { not: 'DONE' } },
    });

    const completedTasksCount = await this.prisma.task.count({
      where: { assignedToId: employee.id, status: 'DONE' },
    });

    const attendanceRecords = await this.prisma.attendance.findMany({
      where: { employeeId: employee.id },
      take: 5,
      orderBy: { clockIn: 'desc' },
    });

    return {
      assignedTasks: tasksCount,
      completedTasks: completedTasksCount,
      totalHoursLogged: attendanceRecords.reduce((sum, a) => sum + (a.workHours || 0), 0),
      recentActivity: attendanceRecords.map((a) => ({
        date: a.clockIn.toISOString().split('T')[0],
        hours: a.workHours || 0,
      })),
    };
  }

  async getHunterKpis(userId: string) {
    const commissions = await this.prisma.commission.findMany({
      where: { hunterId: userId },
      include: { payment: { include: { invoice: true } } },
    });

    const totalEarned = commissions.reduce((sum, c) => sum + c.amount, 0);
    const pendingPayout = commissions
      .filter((c) => c.status === 'PENDING')
      .reduce((sum, c) => sum + c.amount, 0);

    return {
      totalCommissionEarned: totalEarned,
      pendingPayout,
      referralHistory: commissions.map((c) => ({
        id: c.id,
        amount: c.amount,
        rate: c.ratePercentage,
        status: c.status,
        date: c.createdAt.toISOString().split('T')[0],
      })),
    };
  }
}
