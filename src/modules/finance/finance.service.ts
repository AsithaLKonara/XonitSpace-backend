import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceDto } from './dto/invoice.dto';
import { PaymentMethod, InvoiceStatus, PaymentStatus, CommissionStatus } from '@prisma/client';
import Stripe from 'stripe';
import { TransactionService } from '../../common/database/transaction.service';
import { IdService } from '../../common/services/id.service';
import { ClockService } from '../../common/services/clock.service';

@Injectable()
export class FinanceService {
  private stripe: any;

  constructor(
    private prisma: PrismaService,
    private transactionService: TransactionService,
    private idService: IdService,
    private clockService: ClockService
  ) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is missing in environment configuration.');
    }
    
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      // Allow library to use default API version
    } as any);
  }

  async createPaymentIntent(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { project: true },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.PAID) throw new BadRequestException('Invoice is already paid');

    // Amount should be in cents for Stripe (assuming invoice.total is in dollars)
    const amountInCents = Math.round(invoice.total * 100);

    const idempotencyKey = `pi_${invoiceId}_${amountInCents}`;

    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: amountInCents,
        currency: 'usd',
        metadata: { invoiceId: invoice.id, projectId: invoice.projectId },
      },
      { idempotencyKey }
    );

    return {
      clientSecret: paymentIntent.client_secret,
      invoiceId: invoice.id,
      amount: invoice.total,
    };
  }

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
    const key = dto.transactionId ? `PAYMENT_${dto.transactionId}` : `PAYMENT_${this.idService.generateUuid()}`;

    return this.transactionService.executeIdempotent(
      key,
      'PROCESS_PAYMENT',
      async (tx) => {
        const invoice = await tx.invoice.findUnique({
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
        const payment = await tx.payment.create({
          data: {
            invoiceId: dto.invoiceId,
            amount: dto.amount,
            method: dto.method,
            transactionId: dto.transactionId,
            status: PaymentStatus.SUCCESS,
          },
        });

        // Update invoice status to PAID
        await tx.invoice.update({
          where: { id: dto.invoiceId },
          data: { status: InvoiceStatus.PAID },
        });

        // Log this transaction inside Revenues ledger
        await tx.revenue.create({
          data: {
            amount: dto.amount,
            source: `Client Payment: Invoice #${invoice.invoiceNumber}`,
            category: 'Project Revenue',
            description: `Revenue captured for project ${invoice.project.name}`,
          },
        });

        // Automatically check for referral payouts (influencers / project hunters)
        if (invoice.project.referrerId) {
          const projectIntroducer = await tx.user.findUnique({
            where: { id: invoice.project.referrerId },
          });

          if (projectIntroducer && projectIntroducer.isActive) {
            const ratePercentage = 10.0; // 10% Referral Reward
            const commissionAmount = parseFloat((dto.amount * (ratePercentage / 100)).toFixed(2));

            await tx.commission.create({
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
    );
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

  async handleWebhook(rawBody: Buffer, signature: string) {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) throw new Error('Stripe webhook secret is missing');

    let event;
    try {
      const timestampStr = signature.split(',').find((s) => s.startsWith('t='))?.split('=')[1];
      if (!timestampStr) throw new Error('Missing timestamp in signature');
      
      const timestamp = parseInt(timestampStr, 10);
      const now = Math.floor(this.clockService.now() / 1000);
      
      if (Math.abs(now - timestamp) > 300) {
        throw new Error('Webhook signature timestamp is outside the tolerated window (5 minutes max).');
      }

      event = this.stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
    } catch (err: any) {
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as any;
      const invoiceId = paymentIntent.metadata.invoiceId;
      if (invoiceId) {
        await this.processPayment({
          invoiceId,
          amount: paymentIntent.amount / 100,
          method: PaymentMethod.STRIPE,
          transactionId: paymentIntent.id,
        });
      }
    }

    return { received: true };
  }
}
