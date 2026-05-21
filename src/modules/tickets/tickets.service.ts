import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TicketStatus } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async create(customerId: string, subject: string, description: string) {
    return this.prisma.supportTicket.create({
      data: { customerId, subject, description },
      include: { customer: true },
    });
  }

  async findAll(status?: TicketStatus) {
    return this.prisma.supportTicket.findMany({
      where: status ? { status } : {},
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }

  async updateStatus(id: string, status: TicketStatus) {
    await this.findOne(id);
    return this.prisma.supportTicket.update({
      where: { id },
      data: { status },
      include: { customer: true },
    });
  }

  async getStats() {
    const [open, inProgress, resolved, closed] = await Promise.all([
      this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
      this.prisma.supportTicket.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
      this.prisma.supportTicket.count({ where: { status: 'CLOSED' } }),
    ]);
    return { open, inProgress, resolved, closed, total: open + inProgress + resolved + closed };
  }
}
