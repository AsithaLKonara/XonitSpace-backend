import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerDto } from './dto/customer.dto';
import { LeadDto } from './dto/lead.dto';
import { LeadStage, MeetingStatus } from '@prisma/client';

@Injectable()
export class CrmService {
  constructor(private prisma: PrismaService) {}

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
    const lead = await this.prisma.crmLead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException('CRM Lead not found');

    const updated = await this.prisma.crmLead.update({
      where: { id: leadId },
      data: { stage },
    });

    // If stage becomes WON, we auto-create a Project for them
    if (stage === LeadStage.WON) {
      await this.prisma.project.create({
        data: {
          name: `Project: ${lead.title}`,
          description: `Automatically created from CRM Lead conversion.`,
          budget: lead.value,
          status: 'PLANNING',
        },
      });
    }

    return updated;
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
