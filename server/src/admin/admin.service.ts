import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // --- Users ---
  async getAllUsers() {
    const users = await this.prisma.user.findMany({
      select: { id: true, username: true, displayName: true, role: true, agentColor: true, avatarId: true, statusText: true, isOnline: true, allowedViews: true },
      orderBy: { displayName: 'asc' },
    });
    return users.map(u => ({
      id: u.id, username: u.username, role: u.role,
      display_name: u.displayName, agent_color: u.agentColor, avatar_id: u.avatarId,
      status_text: u.statusText, is_online: u.isOnline, allowed_views: u.allowedViews,
    }));
  }

  async createUser(data: { username: string; password: string; display_name?: string; role?: string; agent_color?: string; avatar_id?: number; offices?: string; allowed_views?: string }) {
    const hash = await bcrypt.hash(data.password, 12);
    return this.prisma.user.create({
      data: {
        username: data.username,
        passwordHash: hash,
        displayName: data.display_name || data.username,
        role: data.role || 'agent',
        agentColor: data.agent_color || '#0071e3',
        avatarId: data.avatar_id || 0,
        allowedViews: data.allowed_views || null,
      },
    });
  }

  async updateUserProfile(userId: number, data: Record<string, unknown>) {
    const updateData: Record<string, unknown> = {};
    if (data.display_name !== undefined) updateData.displayName = data.display_name;
    if (data.agent_color !== undefined) updateData.agentColor = data.agent_color;
    if (data.avatar_id !== undefined) updateData.avatarId = data.avatar_id;
    if (data.status_text !== undefined) updateData.statusText = data.status_text;
    if (data.allowed_views !== undefined) updateData.allowedViews = data.allowed_views;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password as string, 12);
    }
    return this.prisma.user.update({ where: { id: userId }, data: updateData });
  }

  async resetPassword(userId: number, password: string) {
    const hash = await bcrypt.hash(password, 12);
    return this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
  }

  async deleteUser(userId: number) {
    return this.prisma.user.delete({ where: { id: userId } });
  }

  async getUserStats(username: string) {
    const agent = await this.prisma.user.findUnique({ where: { username } });
    if (!agent) return { active_tickets: 0, archived_tickets: 0, mail_handled: 0, internal_sent: 0 };

    const [active, archived, mail] = await Promise.all([
      this.prisma.ticket.count({ where: { ownerId: agent.id, status: { in: ['open', 'claimed'] } } }),
      this.prisma.ticket.count({ where: { ownerId: agent.id, status: 'closed' } }),
      this.prisma.ticket.count({ where: { ownerId: agent.id, channel: 'mail', status: 'closed' } }),
    ]);

    return { active_tickets: active, archived_tickets: archived, mail_handled: mail, internal_sent: 0 };
  }

  async updateAgentOffices(username: string, _offices: string) {
    // TODO: implement many-to-many UserOffice updates
    return { success: true };
  }

  async getAgentTickets(username: string) {
    const agent = await this.prisma.user.findUnique({ where: { username } });
    if (!agent) return [];
    const tickets = await this.prisma.ticket.findMany({
      where: { ownerId: agent.id, status: { in: ['open', 'claimed'] } },
      include: { office: { select: { routingTag: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    return tickets.map(t => ({
      conversation_id: t.id, channel: t.channel, status: t.status,
      routing_tag: t.office?.routingTag, owner: username,
      customer_name: t.customerName, customer_email: t.customerEmail,
      updated_at: t.updatedAt.toISOString(),
    }));
  }

  async updateAgentColor(username: string, color: string) {
    return this.prisma.user.update({ where: { username }, data: { agentColor: color } });
  }

  async updateUserViews(username: string, allowedViews: string | null) {
    return this.prisma.user.update({ where: { username }, data: { allowedViews } });
  }

  // --- Offices ---
  async getAllOffices() {
    return this.prisma.office.findMany({ orderBy: [{ city: 'asc' }, { area: 'asc' }] });
  }

  async createOffice(data: Record<string, unknown>) {
    return this.prisma.office.create({
      data: {
        name: data.name as string,
        routingTag: data.routing_tag as string,
        city: data.city as string,
        area: (data.area as string) || '',
        officeColor: (data.office_color as string) || '#0071e3',
        phone: (data.phone as string) || '',
        email: (data.email as string) || '',
      },
    });
  }

  async deleteOffice(tag: string) {
    return this.prisma.office.delete({ where: { routingTag: tag } });
  }

  async updateOfficeColor(routingTag: string, color: string) {
    return this.prisma.office.update({ where: { routingTag }, data: { officeColor: color } });
  }

  async getOfficeTickets(tag: string) {
    const office = await this.prisma.office.findUnique({ where: { routingTag: tag } });
    if (!office) return [];
    return this.prisma.ticket.findMany({
      where: { officeId: office.id, status: { in: ['open', 'claimed'] } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // --- Settings ---
  async getSystemConfig() {
    const rows = await this.prisma.setting.findMany();
    const config: Record<string, unknown> = {};
    for (const row of rows) {
      try { config[row.key] = JSON.parse(row.value); } catch { config[row.key] = row.value; }
    }
    return config;
  }

  async updateSystemConfig(key: string, value: unknown) {
    const val = typeof value === 'string' ? value : JSON.stringify(value);
    return this.prisma.setting.upsert({ where: { key }, update: { value: val }, create: { key, value: val } });
  }

  async getOperationSettings() { return this.getSystemConfig(); }
  async saveOperationSetting(field: string, value: unknown) { return this.updateSystemConfig(field, value); }

  // --- Email Blocklist ---
  async getEmailBlocklist() {
    return this.prisma.emailBlocklist.findMany({ orderBy: { id: 'desc' } });
  }

  async addEmailBlocklist(pattern: string) {
    return this.prisma.emailBlocklist.create({ data: { pattern } });
  }

  async deleteEmailBlocklist(id: number) {
    return this.prisma.emailBlocklist.delete({ where: { id } });
  }

  // --- RAG Failures ---
  async getRagFailures() {
    return this.prisma.ragFailure.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async clearRagFailures() {
    return this.prisma.ragFailure.deleteMany();
  }
}
