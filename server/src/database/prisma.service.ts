import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';
import { join } from 'path';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const dbPath = process.env.DB_PATH || join(__dirname, '..', '..', '..', 'atlas.db');
    const adapter = new PrismaBetterSqlite3({ url: dbPath });

    super({ adapter });
    console.log(`📂 Prisma SQLite adapter: ${dbPath}`);
  }

  async onModuleInit() {
    await this.$connect();
    console.log('📂 Prisma connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
