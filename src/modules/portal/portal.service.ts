import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PortalService {
  constructor(private prisma: PrismaService) {}

  async getMyProjects(userId: string) {
    return this.prisma.project.findMany({
      where: { clientPortalId: userId },
      include: {
        tasks: { where: { status: { in: ['REVIEW', 'DONE'] } } },
        files: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyInvoices(userId: string) {
    // Invoices are linked to Projects which are linked to the user
    const projects = await this.prisma.project.findMany({
      where: { clientPortalId: userId },
      select: { id: true },
    });
    
    const projectIds = projects.map((p) => p.id);
    
    return this.prisma.invoice.findMany({
      where: { projectId: { in: projectIds } },
      include: { payments: true, project: { select: { name: true } } },
      orderBy: { issueDate: 'desc' },
    });
  }

  async getMyTickets(userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: userId },
    });
    
    if (!customer) {
      return [];
    }

    return this.prisma.supportTicket.findMany({
      where: { customerId: customer.id },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createTicket(userId: string, subject: string, description: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: userId },
    });
    
    if (!customer) {
      throw new NotFoundException('Customer profile not mapped to your user account.');
    }

    return this.prisma.supportTicket.create({
      data: {
        customerId: customer.id,
        subject,
        description,
      },
    });
  }
}
