import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller()
export class KnowledgeController {
  constructor(private knowledgeService: KnowledgeService) {}

  @Get('knowledge/:routingTag')
  @UseGuards(JwtAuthGuard)
  getByTag(@Param('routingTag') tag: string) {
    return this.knowledgeService.getByTag(tag);
  }

  @Put('knowledge/:routingTag')
  @UseGuards(JwtAuthGuard)
  updateByTag(@Param('routingTag') tag: string, @Body() body: unknown) {
    return this.knowledgeService.updateByTag(tag, body);
  }

  @Get('admin/basfakta-list')
  @UseGuards(JwtAuthGuard)
  getBasfaktaList() {
    return this.knowledgeService.getBasfaktaList();
  }

  @Get('admin/basfakta/:filename')
  @UseGuards(JwtAuthGuard)
  getBasfaktaFile(@Param('filename') filename: string) {
    return this.knowledgeService.getBasfaktaFile(filename);
  }

  @Put('admin/basfakta/:filename')
  @UseGuards(JwtAuthGuard)
  saveBasfaktaFile(@Param('filename') filename: string, @Body() body: unknown) {
    return this.knowledgeService.saveBasfaktaFile(filename, body);
  }
}
