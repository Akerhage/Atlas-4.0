import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class NotesService {
  constructor(private prisma: PrismaService) {}

  async getForTicket(conversationId: string) {
    return this.prisma.ticketNote.findMany({
      where: { ticketId: conversationId },
      include: { agent: { select: { username: true, displayName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async add(conversationId: string, agentUsername: string, content: string) {
    const agent = await this.prisma.user.findUnique({ where: { username: agentUsername } });
    if (!agent) throw new Error('Agent not found');
    return this.prisma.ticketNote.create({
      data: { ticketId: conversationId, agentId: agent.id, content },
    });
  }

  async update(id: number, content: string) {
    return this.prisma.ticketNote.update({ where: { id }, data: { content } });
  }

  async delete(id: number) {
    return this.prisma.ticketNote.delete({ where: { id } });
  }
}
