import { Controller, Post, Body, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadService } from './upload.service';

@Controller()
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File, @Body() body: { conversationId?: string }) {
    if (!file) {
      return { success: false, error: 'Ingen fil bifogad' };
    }

    const conversationId = body.conversationId || 'unknown';
    const isInternal = conversationId.startsWith('INTERNAL_');
    const ttlDays = isInternal ? 1 : 90;

    this.uploadService.registerUpload({
      conversationId,
      filename: file.filename,
      originalName: file.originalname,
      filepath: file.path,
      ttlDays,
    });

    return {
      success: true,
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      type: file.mimetype,
      originalName: file.originalname,
    };
  }

  @Post('upload/patch-conversation')
  @UseGuards(JwtAuthGuard)
  patchConversation(@Body() body: { filename: string; conversationId: string }) {
    this.uploadService.patchConversation(body.filename, body.conversationId);
    return { success: true };
  }
}
