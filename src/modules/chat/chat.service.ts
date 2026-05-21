import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async saveMessage(senderId: string, content: string) {
    return this.prisma.chatMessage.create({
      data: { senderId, content },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });
  }

  async getHistory(limit = 50) {
    const messages = await this.prisma.chatMessage.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });
    return messages.reverse(); // Return in chronological order
  }
}
