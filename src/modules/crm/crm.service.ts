import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerDto } from './dto/customer.dto';
import { LeadDto } from './dto/lead.dto';
import { LeadStage, MeetingStatus } from '@prisma/client';
import { ClockService } from '../../common/services/clock.service';
import { TransactionService } from '../../common/database/transaction.service';

@Injectable()
export class CrmService {
  constructor(
    private prisma: PrismaService,
    private clockService: ClockService,
    private transactionService: TransactionService
  ) {}

  async createCustomer(dto: CustomerDto) {
    return this.prisma.customer.create({
      data: {
        companyName: dto.companyName,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
      },
    });
  }

  async listCustomers() {
    return this.prisma.customer.findMany({
      include: { leads: true },
      orderBy: { companyName: 'asc' },
    });
  }

  async createLead(dto: LeadDto) {
    return this.prisma.crmLead.create({
      data: {
        title: dto.title,
        value: dto.value,
        customerId: dto.customerId,
        stage: dto.stage || LeadStage.NEW,
      },
    });
  }

  async listLeads() {
    return this.prisma.crmLead.findMany({
      include: {
        customer: true,
        notes: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateLeadStage(leadId: string, stage: LeadStage) {
    if (stage === LeadStage.WON) {
      return this.transactionService.executeIdempotent(
        `LEAD_WON_${leadId}`,
        'CONVERT_LEAD_TO_PROJECT',
        async (tx) => {
          const lead = await tx.crmLead.findUnique({ where: { id: leadId } });
          if (!lead) throw new NotFoundException('CRM Lead not found');
          if (lead.stage === LeadStage.WON) return lead; // Prevent duplicate conversion

          const updated = await tx.crmLead.update({
            where: { id: leadId },
            data: { stage },
          });

          const project = await tx.project.create({
            data: {
              name: `Project: ${lead.title}`,
              description: `Automatically created from CRM Lead conversion.`,
              budget: lead.value,
              status: 'PLANNING',
              clientPortalId: lead.customerId,
              referrerId: lead.referrerId,
              pmId: null,
            },
          });

          await tx.invoice.create({
            data: {
              projectId: project.id,
              invoiceNumber: `INV-AUTO-${this.clockService.now()}`,
              dueDate: new Date(this.clockService.now() + 30 * 24 * 60 * 60 * 1000), // Due in 30 days
              subtotal: lead.value,
              tax: 0,
              discount: 0,
              total: lead.value,
              status: 'DRAFT',
            },
          });

          return updated;
        }
      );
    } else {
      const lead = await this.prisma.crmLead.findUnique({ where: { id: leadId } });
      if (!lead) throw new NotFoundException('CRM Lead not found');

      return this.prisma.crmLead.update({
        where: { id: leadId },
        data: { stage },
      });
    }
  }

  async addNote(leadId: string, content: string, userId: string) {
    return this.prisma.crmNote.create({
      data: {
        leadId,
        content,
        createdById: userId,
      },
    });
  }

  async scheduleMeeting(dto: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    customerId?: string;
    leadId?: string;
  }) {
    return this.prisma.meeting.create({
      data: {
        title: dto.title,
        description: dto.description,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        customerId: dto.customerId,
        leadId: dto.leadId,
      },
    });
  }

  async listMeetings() {
    return this.prisma.meeting.findMany({
      include: {
        customer: true,
        lead: true,
      },
      orderBy: { startTime: 'asc' },
    });
  }
}
