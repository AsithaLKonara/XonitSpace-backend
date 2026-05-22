import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClockService } from '../../common/services/clock.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private prisma: PrismaService,
    private clockService: ClockService
  ) {}

  async getAdminKpis() {
    const projectsCount = await this.prisma.project.count({ where: { deletedAt: null } });
    const employeesCount = await this.prisma.employee.count({ where: { deletedAt: null } });
    const activeClientsCount = await this.prisma.customer.count();

    const revenues = await this.prisma.revenue.findMany({ orderBy: { date: 'asc' } });
    const expenses = await this.prisma.expense.findMany();
    const totalRevenue = revenues.reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = parseFloat((totalRevenue - totalExpense).toFixed(2));

    const pendingInvoicesCount = await this.prisma.invoice.count({ where: { status: 'SENT' } });

    // Build monthly chart data from actual revenue entries
    const monthlyMap = new Map<string, { revenue: number; profit: number }>();
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    for (const r of revenues) {
      const key = `${r.date.getFullYear()}-${r.date.getMonth()}`;
      const label = `${monthNames[r.date.getMonth()]} ${r.date.getFullYear()}`;
      const existing = monthlyMap.get(key) || { revenue: 0, profit: 0 };
      existing.revenue += r.amount;
      existing.profit += r.amount * 0.62; // Approx margin
      monthlyMap.set(key, existing);
    }

    // AI Statistical Forecast: weighted moving average for next 3 months
    const revenueTrend = Array.from(monthlyMap.entries()).map(([key, val]) => {
      const [year, month] = key.split('-').map(Number);
      return { month: `${monthNames[month]} ${year}`, revenue: Math.round(val.revenue), profit: Math.round(val.profit) };
    });

    // Seed with last 6 months if no real data
    const chartData = revenueTrend.length > 0 ? revenueTrend : [
      { month: 'May', revenue: 48000, profit: 29760 },
      { month: 'Jun', revenue: 62000, profit: 38440 },
      { month: 'Jul', revenue: 55000, profit: 34100 },
      { month: 'Aug', revenue: 79000, profit: 48980 },
      { month: 'Sep', revenue: 91000, profit: 56420 },
      { month: 'Oct', revenue: 84000, profit: 52080 },
    ];

    // Statistical forecast: 3-month weighted moving average
    const forecast = this._generateForecast(chartData);

    // Lead pipeline conversion data
    const leadCounts = await this.prisma.crmLead.groupBy({
      by: ['stage'],
      _count: { stage: true },
    });

    const crmPipeline = leadCounts.map(l => ({
      stage: l.stage,
      count: l._count.stage,
    }));

    // Project status breakdown
    const projectStats = await this.prisma.project.groupBy({
      by: ['status'],
      _count: { status: true },
      where: { deletedAt: null },
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
      revenueTrend: chartData,
      forecast,
      crmPipeline,
      projectStatusBreakdown: projectStats.map(p => ({
        status: p.status,
        count: p._count.status,
      })),
    };
  }

  /** Weighted Moving Average (3-period) forecast for next 3 months */
  private _generateForecast(historicalData: { month: string; revenue: number; profit: number }[]) {
    const forecast: { month: string; revenue: number; profit: number; isForecast: boolean }[] = [];
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    if (historicalData.length < 3) return forecast;

    const last3 = historicalData.slice(-3);
    const weights = [0.2, 0.3, 0.5]; // More weight on recent months

    let baseRevenue = last3.reduce((sum, d, i) => sum + d.revenue * weights[i], 0);
    let baseProfit = last3.reduce((sum, d, i) => sum + d.profit * weights[i], 0);

    // Parse last month
    const lastMonthStr = historicalData[historicalData.length - 1].month.split(' ')[0];
    const lastMonthIdx = monthNames.indexOf(lastMonthStr);

    // Simple growth factor (5% MoM)
    const growthRate = 1.05;

    for (let i = 1; i <= 3; i++) {
      const monthIdx = (lastMonthIdx + i) % 12;
      baseRevenue = Math.round(baseRevenue * growthRate);
      baseProfit = Math.round(baseProfit * growthRate);
      forecast.push({
        month: monthNames[monthIdx],
        revenue: baseRevenue,
        profit: baseProfit,
        isForecast: true,
      });
    }

    return forecast;
  }

  async getPmKpis(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('PM profile not found');

    const managedProjectsCount = await this.prisma.project.count({ where: { pmId: employee.id, deletedAt: null } });
    const activeTasksCount = await this.prisma.task.count({
      where: { project: { pmId: employee.id }, status: { in: ['TODO', 'IN_PROGRESS', 'REVIEW'] } },
    });
    const delayedTasksCount = await this.prisma.task.count({
      where: { project: { pmId: employee.id }, dueDate: { lt: this.clockService.getDate() }, status: { not: 'DONE' } },
    });

    return {
      managedProjects: managedProjectsCount,
      activeTasks: activeTasksCount,
      delayedTasks: delayedTasksCount,
    };
  }

  async getEmployeeKpis(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee record not found');

    const assignedTasks = await this.prisma.task.count({ where: { assignedToId: employee.id, status: { not: 'DONE' } } });
    const completedTasks = await this.prisma.task.count({ where: { assignedToId: employee.id, status: 'DONE' } });
    const attendance = await this.prisma.attendance.findMany({ where: { employeeId: employee.id }, take: 5, orderBy: { clockIn: 'desc' } });

    return {
      assignedTasks,
      completedTasks,
      totalHoursLogged: attendance.reduce((sum, a) => sum + (a.workHours || 0), 0),
      recentActivity: attendance.map(a => ({ date: a.clockIn.toISOString().split('T')[0], hours: a.workHours || 0 })),
    };
  }

  async getHunterKpis(userId: string) {
    const commissions = await this.prisma.commission.findMany({
      where: { hunterId: userId },
      include: { payment: { include: { invoice: { include: { project: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    const totalEarned = commissions.reduce((sum, c) => sum + c.amount, 0);
    const pendingPayout = commissions.filter(c => c.status === 'PENDING').reduce((sum, c) => sum + c.amount, 0);
    const releasedPayout = commissions.filter(c => c.status === 'RELEASED').reduce((sum, c) => sum + c.amount, 0);

    return {
      totalCommissionEarned: totalEarned,
      pendingPayout,
      releasedPayout,
      totalReferrals: commissions.length,
      referralHistory: commissions.map(c => ({
        id: c.id,
        amount: c.amount,
        rate: c.ratePercentage,
        status: c.status,
        projectName: c.payment?.invoice?.project?.name || 'N/A',
        date: c.createdAt.toISOString().split('T')[0],
      })),
    };
  }
}
