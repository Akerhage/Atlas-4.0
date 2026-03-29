import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { NotesService } from './notes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notes')
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private notesService: NotesService) {}

  @Get(':conversationId')
  getForTicket(@Param('conversationId') id: string) {
    return this.notesService.getForTicket(id);
  }

  @Post()
  add(@Body() body: { ticketId: string; content: string }, @Request() req) {
    return this.notesService.add(body.ticketId, req.user.username, body.content);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: { content: string }) {
    return this.notesService.update(Number(id), body.content);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.notesService.delete(Number(id));
  }
}
