import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { redactConnectionString } from '../../common/utils/redact.util';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly target: string;

  constructor(appConfig: AppConfigService) {
    // A driver adapter keeps the query engine out of the deployment artifact
    // and gives us control over the pool, which matters on serverless runtimes.
    super({
      adapter: new PrismaPg({
        connectionString: appConfig.database.url,
        max: appConfig.database.connectionLimit,
      }),
      log:
        appConfig.logLevel === 'debug' || appConfig.logLevel === 'verbose'
          ? ['warn', 'error', 'query']
          : ['warn', 'error'],
    });
    this.target = redactConnectionString(appConfig.database.url);
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log(`Database connection established (${this.target})`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Lightweight liveness probe used by the health endpoint. */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
