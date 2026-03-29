import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';

import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { TicketsModule } from './tickets/tickets.module';
import { AdminModule } from './admin/admin.module';
import { RagModule } from './rag/rag.module';
import { MailModule } from './mail/mail.module';
import { CustomersModule } from './customers/customers.module';
import { TemplatesModule } from './templates/templates.module';
import { NotesModule } from './notes/notes.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { WebhookModule } from './webhook/webhook.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    // Environment configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '..', '..', '.env'),       // server/.env
        join(__dirname, '..', '..', '..', '.env'),  // root .env
      ],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,       // 1 minute
        limit: 30,        // 30 requests per minute (customer chat)
      },
      {
        name: 'medium',
        ttl: 900000,      // 15 minutes
        limit: 5,         // 5 requests per 15 min (form submissions)
      },
      {
        name: 'long',
        ttl: 3600000,     // 1 hour
        limit: 20,        // 20 requests per hour (file uploads)
      },
    ]),

    // Serve React frontend (client/dist)
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'client', 'dist'),
      exclude: ['/api/(.*)', '/team/(.*)', '/webhook/(.*)', '/socket.io/(.*)'],
    }),

    // Core modules
    DatabaseModule,
    AuthModule,
    TicketsModule,
    AdminModule,
    RagModule,
    MailModule,
    CustomersModule,
    TemplatesModule,
    NotesModule,
    KnowledgeModule,
    WebhookModule,
    UploadModule,
  ],
})
export class AppModule {}
