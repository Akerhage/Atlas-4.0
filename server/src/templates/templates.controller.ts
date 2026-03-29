import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('templates')
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private templatesService: TemplatesService) {}

  @Get()
  getAll() { return this.templatesService.getAll(); }

  @Post()
  save(@Body() body: Record<string, unknown>) {
    return this.templatesService.save(body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.templatesService.delete(Number(id));
  }
}
