import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import type { User, JwtPayload } from '../shared/types';

@Injectable()
export class AuthService {
  constructor(
    private db: DatabaseService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<User> {
    const user = this.db.getUserByUsername(username);
    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Felaktigt användarnamn eller lösenord');
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedException('Felaktigt användarnamn eller lösenord');
    }

    return user;
  }

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);
    const payload: JwtPayload = { sub: user.id, username: user.username, role: user.role };
    const { password_hash, ...safeUser } = user;

    return {
      token: this.jwtService.sign(payload),
      user: safeUser,
    };
  }

  getAllUsers(): Omit<User, 'password_hash'>[] {
    return this.db.getAllUsers();
  }

  async updateProfile(userId: number, data: Record<string, unknown>) {
    this.db.updateUser(userId, data);
  }

  async changePassword(username: string, oldPassword: string, newPassword: string) {
    const user = await this.validateUser(username, oldPassword);
    const hash = await bcrypt.hash(newPassword, 12);
    this.db.updateUserPassword(username, hash);
  }

  getServerVersion() {
    return { version: '4.0' };
  }
}
