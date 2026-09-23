import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '../common/decorators/api-error-responses.decorator';
import { ErrorCode } from '../common/types/api.types';
import { PrismaService } from '../prisma/prisma.service';
import { HealthResponse } from './health.types';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe, including database connectivity' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'up',
        uptimeSeconds: 42,
        timestamp: '2026-01-01T12:00:00.000Z',
        database: { status: 'up', latencyMs: 3 },
      },
    },
  })
  @ApiErrorResponses(503)
  async check(): Promise<HealthResponse> {
    const startedAt = Date.now();

    try {
      await this.prisma.ping();
    } catch (error) {
      this.logger.error('Database health check failed', error instanceof Error ? error.stack : '');
      throw new ServiceUnavailableException({
        code: ErrorCode.ServiceUnavailable,
        message: 'Database is unreachable',
      });
    }

    return {
      status: 'up',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database: { status: 'up', latencyMs: Date.now() - startedAt },
    };
  }
}
