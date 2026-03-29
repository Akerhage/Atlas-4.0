import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class TicketsService {
  constructor(private prisma: PrismaService) {}

  async getInbox() {
    const tickets = await this.prisma.ticket.findMany({
      where: { status: { in: ['open', 'claimed'] } },
      include: { owner: { select: { username: true } }, office: { select: { routingTag: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    return tickets.map(t => ({
      conversation_id: t.id,
      channel: t.channel,
      status: t.status,
      routing_tag: t.office?.routingTag || null,
      owner: t.owner?.username || null,
      customer_name: t.customerName,
      customer_email: t.customerEmail,
      customer_phone: t.customerPhone,
      last_message: t.lastMessage,
      human_mode: t.humanMode,
      created_at: t.createdAt.toISOString(),
      updated_at: t.updatedAt.toISOString(),
    }));
  }

  async getTicket(conversationId: string) {
    const t = await this.prisma.ticket.findUnique({
      where: { id: conversationId },
      include: { owner: { select: { username: true } }, office: { select: { routingTag: true } } },
    });
    if (!t) return null;

    return {
      conversation_id: t.id,
      channel: t.channel,
      status: t.status,
      routing_tag: t.office?.routingTag || null,
      owner: t.owner?.username || null,
      customer_name: t.customerName,
      customer_email: t.customerEmail,
      customer_phone: t.customerPhone,
      last_message: t.lastMessage,
      human_mode: t.humanMode,
      created_at: t.createdAt.toISOString(),
      updated_at: t.updatedAt.toISOString(),
    };
  }

  async getMessages(conversationId: string) {
    return this.prisma.message.findMany({
      where: { ticketId: conversationId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true, createdAt: true, isEmail: true },
    });
  }

  async claimTicket(conversationId: string, agentUsername: string) {
    const agent = await this.prisma.user.findUnique({ where: { username: agentUsername } });
    if (!agent) throw new Error('Agent not found');

    const ticket = await this.prisma.ticket.findUnique({ where: { id: conversationId }, include: { owner: true } });
    const previousOwner = ticket?.owner?.username || null;

    await this.prisma.ticket.update({
      where: { id: conversationId },
      data: { ownerId: agent.id, status: 'claimed' },
    });

    return { success: true, previousOwner };
  }

  async assignTicket(conversationId: string, targetUsername: string) {
    const agent = await this.prisma.user.findUnique({ where: { username: targetUsername } });
    if (!agent) throw new Error('Agent not found');

    await this.prisma.ticket.update({
      where: { id: conversationId },
      data: { ownerId: agent.id, status: 'claimed' },
    });

    return { success: true };
  }

  async archiveTicket(conversationId: string) {
    await this.prisma.ticket.update({
      where: { id: conversationId },
      data: { status: 'closed', archivedAt: new Date() },
    });
    return { success: true };
  }

  async deleteTicket(conversationId: string) {
    await this.prisma.ticket.delete({ where: { id: conversationId } });
    return { success: true };
  }

  async restoreTicket(conversationId: string) {
    await this.prisma.ticket.update({
      where: { id: conversationId },
      data: { status: 'open', ownerId: null, archivedAt: null },
    });
    return { success: true };
  }

  async searchInbox(query: string) {
    return this.prisma.ticket.findMany({
      where: {
        status: { in: ['open', 'claimed'] },
        OR: [
          { lastMessage: { contains: query } },
          { customerName: { contains: query } },
          { customerEmail: { contains: query } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getArchive(search?: string, limit = 50, offset = 0) {
    const where: any = { status: 'closed' };
    if (search) {
      where.OR = [
        { lastMessage: { contains: search } },
        { customerName: { contains: search } },
        { customerEmail: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        include: { owner: { select: { username: true } }, office: { select: { routingTag: true } } },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      items: items.map(t => ({
        conversation_id: t.id,
        channel: t.channel,
        status: t.status,
        routing_tag: t.office?.routingTag || null,
        owner: t.owner?.username || null,
        customer_name: t.customerName,
        customer_email: t.customerEmail,
        last_message: t.lastMessage,
        created_at: t.createdAt.toISOString(),
        updated_at: t.updatedAt.toISOString(),
      })),
      total,
    };
  }
}
