import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  // --- Users ---
  @Get('users')
  getUsers() { return this.adminService.getAllUsers(); }

  @Post('create-user')
  createUser(@Body() body: { username: string; password: string; display_name?: string; role?: string; agent_color?: string; avatar_id?: number; offices?: string; allowed_views?: string }) {
    return this.adminService.createUser(body);
  }

  @Post('update-user-profile')
  updateUserProfile(@Body() body: Record<string, unknown>) {
    return this.adminService.updateUserProfile(body.userId as number, body);
  }

  @Post('reset-password')
  resetPassword(@Body() body: { userId: number; password: string }) {
    return this.adminService.resetPassword(body.userId, body.password);
  }

  @Post('delete-user')
  deleteUser(@Body() body: { userId: number }) {
    return this.adminService.deleteUser(body.userId);
  }

  @Get('user-stats/:username')
  getUserStats(@Param('username') username: string) {
    return this.adminService.getUserStats(username);
  }

  @Get('agent-tickets/:username')
  getAgentTickets(@Param('username') username: string) {
    return this.adminService.getAgentTickets(username);
  }

  @Post('update-agent-color')
  updateAgentColor(@Body() body: { username: string; color: string }) {
    return this.adminService.updateAgentColor(body.username, body.color);
  }

  @Post('update-agent-offices')
  updateAgentOffices(@Body() body: { username: string; offices: string }) {
    return this.adminService.updateAgentOffices(body.username, body.offices);
  }

  @Put('user-views/:username')
  updateUserViews(@Param('username') username: string, @Body() body: { allowed_views: string | null }) {
    return this.adminService.updateUserViews(username, body.allowed_views);
  }

  // --- Offices ---
  @Get('offices')
  getOffices() { return this.adminService.getAllOffices(); }

  @Post('offices')
  createOffice(@Body() body: Record<string, unknown>) {
    return this.adminService.createOffice(body);
  }

  @Delete('office/:tag')
  deleteOffice(@Param('tag') tag: string) {
    return this.adminService.deleteOffice(tag);
  }

  @Post('update-office-color')
  updateOfficeColor(@Body() body: { routing_tag: string; color: string }) {
    return this.adminService.updateOfficeColor(body.routing_tag, body.color);
  }

  @Get('office-tickets/:tag')
  getOfficeTickets(@Param('tag') tag: string) {
    return this.adminService.getOfficeTickets(tag);
  }

  // --- System Config ---
  @Get('system-config')
  getSystemConfig() { return this.adminService.getSystemConfig(); }

  @Post('system-config')
  updateSystemConfig(@Body() body: { key: string; value: unknown }) {
    return this.adminService.updateSystemConfig(body.key, body.value);
  }

  // --- Operation Settings ---
  @Get('operation-settings')
  getOperationSettings() { return this.adminService.getOperationSettings(); }

  @Post('operation-settings')
  saveOperationSetting(@Body() body: { field: string; value: unknown }) {
    return this.adminService.saveOperationSetting(body.field, body.value);
  }

  // --- Email Blocklist ---
  @Get('email-blocklist')
  getEmailBlocklist() { return this.adminService.getEmailBlocklist(); }

  @Post('email-blocklist')
  addEmailBlocklist(@Body() body: { pattern: string }) {
    return this.adminService.addEmailBlocklist(body.pattern);
  }

  @Delete('email-blocklist/:id')
  deleteEmailBlocklist(@Param('id') id: string) {
    return this.adminService.deleteEmailBlocklist(Number(id));
  }

  // --- RAG Failures ---
  @Get('rag-failures')
  getRagFailures() { return this.adminService.getRagFailures(); }

  @Delete('rag-failures')
  clearRagFailures() { return this.adminService.clearRagFailures(); }
}
