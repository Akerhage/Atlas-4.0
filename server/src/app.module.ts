import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
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

@Module({
  imports: [
    // Environment configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '..', '.env'),
    }),

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
  ],
})
export class AppModule {}
