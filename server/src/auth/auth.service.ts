import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import type { JwtPayload } from '../shared/types';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) {
      throw new UnauthorizedException('Felaktigt användarnamn eller lösenord');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Felaktigt användarnamn eller lösenord');
    }

    return user;
  }

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);
    const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role };

    return {
      token: this.jwtService.sign(payload),
      user: this.toSnakeCase(user),
    };
  }

  async getAllUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true, username: true, displayName: true, role: true,
        agentColor: true, avatarId: true, statusText: true,
        isOnline: true, allowedViews: true,
      },
      orderBy: { displayName: 'asc' },
    });
    return users.map(u => this.toSnakeCase(u));
  }

  // Map Prisma camelCase to snake_case for frontend compatibility
  private toSnakeCase(user: Record<string, unknown>) {
    const { passwordHash, displayName, agentColor, avatarId, statusText, isOnline, lastSeen, allowedViews, createdAt, ...rest } = user;
    return {
      ...rest,
      display_name: displayName ?? null,
      agent_color: agentColor ?? '#0071e3',
      avatar_id: avatarId ?? 0,
      status_text: statusText ?? '',
      is_online: isOnline ?? false,
      last_seen: lastSeen ?? null,
      allowed_views: allowedViews ?? null,
    };
  }

  async updateProfile(userId: number, data: Record<string, unknown>) {
    const updateData: Record<string, unknown> = {};
    if (data.display_name !== undefined) updateData.displayName = data.display_name;
    if (data.agent_color !== undefined) updateData.agentColor = data.agent_color;
    if (data.avatar_id !== undefined) updateData.avatarId = data.avatar_id;
    if (data.status_text !== undefined) updateData.statusText = data.status_text;

    await this.prisma.user.update({ where: { id: userId }, data: updateData });
  }

  async changePassword(username: string, oldPassword: string, newPassword: string) {
    await this.validateUser(username, oldPassword);
    const hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { username },
      data: { passwordHash: hash },
    });
  }

  getServerVersion() {
    return { version: '4.0' };
  }
}
