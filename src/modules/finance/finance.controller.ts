import { Controller, Get, Post, Body, Param, Patch, UseGuards, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { InvoiceDto } from './dto/invoice.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SystemRole, PaymentMethod } from '@prisma/client';

@ApiTags('Finance & Invoicing')
@Controller('api/v1/finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class FinanceController {
  constructor(private financeService: FinanceService) {}

  @Post('invoices')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Generate a new invoice' })
  createInvoice(@Body() invoiceDto: InvoiceDto) {
    return this.financeService.createInvoice(invoiceDto);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List all invoices' })
  listInvoices() {
    return this.financeService.listInvoices();
  }

  @Post('invoices/:id/create-payment-intent')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.ACCOUNTANT, SystemRole.CUSTOMER)
  @ApiOperation({ summary: 'Create a Stripe Payment Intent for an invoice' })
  createPaymentIntent(@Param('id') invoiceId: string) {
    return this.financeService.createPaymentIntent(invoiceId);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Record/Process a client payment' })
  processPayment(
    @Body() dto: {
      invoiceId: string;
      amount: number;
      method: PaymentMethod;
      transactionId?: string;
    },
  ) {
    return this.financeService.processPayment(dto);
  }

  @Get('commissions')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.ACCOUNTANT)
  @ApiOperation({ summary: 'List all Hunter referral commissions' })
  listCommissions() {
    return this.financeService.listCommissions();
  }

  @Patch('commissions/:id/release')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Approve and release a referral payout' })
  releaseCommission(@Param('id') commissionId: string) {
    return this.financeService.releaseCommission(commissionId);
  }

  @Get('transactions')
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.ADMIN, SystemRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Retrieve ledgers for revenue and expense entries' })
  listTransactions() {
    return this.financeService.listTransactions();
  }

  @Post('stripe/webhook')
  @ApiOperation({ summary: 'Stripe Webhook for payment events' })
  async handleStripeWebhook(@Req() req: any, @Headers('stripe-signature') signature: string) {
    return this.financeService.handleWebhook(req.rawBody, signature);
  }
}
