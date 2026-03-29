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

    const { passwordHash, ...safeUser } = user;
    return {
      token: this.jwtService.sign(payload),
      user: safeUser,
    };
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true, username: true, displayName: true, role: true,
        agentColor: true, avatarId: true, statusText: true,
        isOnline: true, allowedViews: true,
      },
      orderBy: { displayName: 'asc' },
    });
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
