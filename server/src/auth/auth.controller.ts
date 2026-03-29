import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../database/prisma.service';

@Controller()
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  @Post('auth/login')
  async login(@Body() body: { username: string; password: string }) {
    return this.authService.login(body.username, body.password);
  }

  @Get('auth/users')
  @UseGuards(JwtAuthGuard)
  getUsers() {
    return this.authService.getAllUsers();
  }

  @Post('auth/update-profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req, @Body() body: Record<string, unknown>) {
    await this.authService.updateProfile(req.user.sub, body);
    return { success: true };
  }

  @Post('auth/change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Request() req, @Body() body: { old_password: string; new_password: string }) {
    await this.authService.changePassword(req.user.username, body.old_password, body.new_password);
    return { success: true };
  }

  @Get('public/version')
  getVersion() {
    return this.authService.getServerVersion();
  }

  @Get('public/offices')
  async getOffices() {
    return this.prisma.office.findMany({ orderBy: [{ city: 'asc' }, { area: 'asc' }] });
  }
}
