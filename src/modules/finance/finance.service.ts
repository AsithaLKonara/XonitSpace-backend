import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceDto } from './dto/invoice.dto';
import { InvoiceStatus, PaymentMethod, PaymentStatus, CommissionStatus } from '@prisma/client';

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  async createInvoice(dto: InvoiceDto) {
    const subtotal = dto.subtotal;
    const tax = dto.tax || 0;
    const discount = dto.discount || 0;
    const total = parseFloat((subtotal + tax - discount).toFixed(2));

    return this.prisma.invoice.create({
      data: {
        projectId: dto.projectId,
        invoiceNumber: dto.invoiceNumber,
        dueDate: new Date(dto.dueDate),
        subtotal,
        tax,
        discount,
        total,
        status: InvoiceStatus.DRAFT,
      },
    });
  }

  async listInvoices() {
    return this.prisma.invoice.findMany({
      include: { project: true, payments: true },
      orderBy: { issueDate: 'desc' },
    });
  }

  async processPayment(dto: {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    transactionId?: string;
  }) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
      include: { project: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already paid');
    }

    // Record the payment
    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: dto.invoiceId,
        amount: dto.amount,
        method: dto.method,
        transactionId: dto.transactionId,
        status: PaymentStatus.SUCCESS,
      },
    });

    // Update invoice status to PAID
    await this.prisma.invoice.update({
      where: { id: dto.invoiceId },
      data: { status: InvoiceStatus.PAID },
    });

    // Log this transaction inside Revenues ledger
    await this.prisma.revenue.create({
      data: {
        amount: dto.amount,
        source: `Client Payment: Invoice #${invoice.invoiceNumber}`,
        category: 'Project Revenue',
        description: `Revenue captured for project ${invoice.project.name}`,
      },
    });

    // Automatically check for referral payouts (influencers / project hunters)
    // If the project clientPortalId is referred or introduced, compute commission
    if (invoice.project.clientPortalId) {
      // Find commissions that might map to this project or user introduction
      // For this MVP, we assume a hunter represents 10% commission on the project payment
      // Let's search if a commission record was pre-allocated or let's create a new one:
      const projectIntroducer = await this.prisma.user.findFirst({
        where: { role: 'INFLUENCER', isActive: true },
      });

      if (projectIntroducer) {
        const ratePercentage = 10.0; // 10% Referral Reward
        const commissionAmount = parseFloat((dto.amount * (ratePercentage / 100)).toFixed(2));

        await this.prisma.commission.create({
          data: {
            hunterId: projectIntroducer.id,
            amount: commissionAmount,
            ratePercentage,
            projectId: invoice.project.id,
            paymentId: payment.id,
            status: CommissionStatus.PENDING,
          },
        });
      }
    }

    return payment;
  }

  async listCommissions() {
    return this.prisma.commission.findMany({
      include: {
        hunter: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        payment: { include: { invoice: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async releaseCommission(commissionId: string) {
    const commission = await this.prisma.commission.findUnique({ where: { id: commissionId } });
    if (!commission) throw new NotFoundException('Commission payout record not found');

    if (commission.status !== CommissionStatus.PENDING) {
      throw new BadRequestException('Commission is already processed or cancelled');
    }

    // Release payout
    const updated = await this.prisma.commission.update({
      where: { id: commissionId },
      data: { status: CommissionStatus.RELEASED },
    });

    // Log inside Expenses ledger
    await this.prisma.expense.create({
      data: {
        amount: commission.amount,
        recipient: `Referrer Hunter Payout`,
        category: 'Referral Commission Payout',
        description: `Released commission for Project Hunter introducing clients.`,
      },
    });

    return updated;
  }

  async listTransactions() {
    const revenues = await this.prisma.revenue.findMany({ orderBy: { date: 'desc' } });
    const expenses = await this.prisma.expense.findMany({ orderBy: { date: 'desc' } });
    
    return {
      revenues,
      expenses,
      totalRevenue: revenues.reduce((sum, r) => sum + r.amount, 0),
      totalExpense: expenses.reduce((sum, e) => sum + e.amount, 0),
    };
  }
}
