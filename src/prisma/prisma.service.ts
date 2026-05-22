import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { correlationStorage } from '../common/middleware/correlation.middleware';

@Injectable()
export class PrismaService extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'info' | 'warn' | 'error'> implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const adapter = new PrismaPg(pool);
    super({
      adapter,
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
    });

    this.$on('query', (e) => {
      const store = correlationStorage.getStore();
      this.logger.debug(`[${store?.traceId || 'SYSTEM'}] Query: ${e.query} -- Duration: ${e.duration}ms`);
    });

    this.$on('error', (e) => {
      const store = correlationStorage.getStore();
      this.logger.error(`[${store?.traceId || 'SYSTEM'}] Error: ${e.message}`);
    });

    this.$on('info', (e) => {
      const store = correlationStorage.getStore();
      this.logger.log(`[${store?.traceId || 'SYSTEM'}] Info: ${e.message}`);
    });

    this.$on('warn', (e) => {
      const store = correlationStorage.getStore();
      this.logger.warn(`[${store?.traceId || 'SYSTEM'}] Warn: ${e.message}`);
    });
  }

  async onModuleInit() {
    let retries = 5;
    while (retries > 0) {
      try {
        await this.$connect();
        this.logger.log('Successfully connected to the database');
        break;
      } catch (err: any) {
        this.logger.error(`Failed to connect to database. Retries left: ${retries - 1}`, err.stack);
        retries -= 1;
        if (retries === 0) throw err;
        await new Promise((res) => setTimeout(res, 5000));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
