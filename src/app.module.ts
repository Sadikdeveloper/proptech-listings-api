import { Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AgentsModule } from './agents/agents.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { createValidationPipe } from './common/validation/validation.pipe';
import { AppConfigModule } from './config/app-config.module';
import { HealthModule } from './health/health.module';
import { ListingsModule } from './listings/listings.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [AppConfigModule, PrismaModule, AgentsModule, ListingsModule, HealthModule],
  providers: [
    { provide: APP_PIPE, useValue: createValidationPipe() },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
