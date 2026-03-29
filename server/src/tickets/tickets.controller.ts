import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  // Team routes (no /api prefix — matches legacy paths)
  @Get('team/inbox')
  @UseGuards(JwtAuthGuard)
  getInbox() {
    return this.ticketsService.getInbox();
  }

  @Get('team/inbox/search')
  @UseGuards(JwtAuthGuard)
  searchInbox(@Query('q') query: string) {
    return this.ticketsService.searchInbox(query || '');
  }

  @Post('team/claim')
  @UseGuards(JwtAuthGuard)
  claimTicket(@Body() body: { conversationId: string }, @Request() req) {
    return this.ticketsService.claimTicket(body.conversationId, req.user.username);
  }

  @Post('team/assign')
  @UseGuards(JwtAuthGuard)
  assignTicket(@Body() body: { conversationId: string; targetAgent: string }) {
    return this.ticketsService.assignTicket(body.conversationId, body.targetAgent);
  }

  @Get('team/ticket/:conversationId')
  @UseGuards(JwtAuthGuard)
  getTicket(@Param('conversationId') id: string) {
    return this.ticketsService.getTicket(id);
  }

  @Get('team/messages/:conversationId')
  @UseGuards(JwtAuthGuard)
  getMessages(@Param('conversationId') id: string) {
    return this.ticketsService.getMessages(id);
  }

  // API routes (with /api prefix)
  @Post('inbox/archive')
  @UseGuards(JwtAuthGuard)
  archiveTicket(@Body() body: { conversationId: string }) {
    return this.ticketsService.archiveTicket(body.conversationId);
  }

  @Post('inbox/delete')
  @UseGuards(JwtAuthGuard)
  deleteTicketLegacy(@Body() body: { conversationId: string }) {
    return this.ticketsService.deleteTicket(body.conversationId);
  }

  @Delete('team/delete/:conversationId')
  @UseGuards(JwtAuthGuard)
  deleteTicket(@Param('conversationId') id: string) {
    return this.ticketsService.deleteTicket(id);
  }

  @Post('team/restore')
  @UseGuards(JwtAuthGuard)
  restoreTicket(@Body() body: { conversationId: string }) {
    return this.ticketsService.restoreTicket(body.conversationId);
  }

  @Get('archive')
  @UseGuards(JwtAuthGuard)
  getArchive(@Query('search') search: string, @Query('page') page: string, @Query('limit') limit: string) {
    return this.ticketsService.getArchive(search, Number(limit) || 50, ((Number(page) || 1) - 1) * (Number(limit) || 50));
  }
}
