import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async getAll(search?: string, page = 1, limit = 50) {
    const where: any = {};
    if (search) {
      where.OR = [
        { customerName: { contains: search } },
        { customerEmail: { contains: search } },
        { customerPhone: { contains: search } },
      ];
    }

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        select: {
          id: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: (page - 1) * limit,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      customers: tickets.map(t => ({
        conversation_id: t.id,
        name: t.customerName,
        email: t.customerEmail,
        phone: t.customerPhone,
        last_activity: t.updatedAt.toISOString(),
      })),
      total,
    };
  }

  async getHistory(conversationId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return ticket;
  }
}
