import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';
import { EnvironmentVariables, LogLevel, NodeEnv } from './config.types';

const POSTGRES_URL_PATTERN = /^postgres(ql)?:\/\/.+@.+/i;

class EnvironmentVariablesDto implements EnvironmentVariables {
  @IsEnum(['development', 'test', 'production'])
  @IsOptional()
  NODE_ENV: NodeEnv = 'development';

  // Every property is annotated explicitly: without the annotation the
  // compiler emits `Object` as the design type and class-transformer cannot
  // coerce the string values that come from `.env`.
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  @IsEnum(['error', 'warn', 'log', 'debug', 'verbose'])
  @IsOptional()
  LOG_LEVEL: LogLevel = 'log';

  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL is required' })
  DATABASE_URL: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  DATABASE_CONNECTION_LIMIT: number = 10;

  @IsString()
  @IsOptional()
  CORS_ORIGINS: string = '*';

  @IsBoolean()
  @IsOptional()
  SWAGGER_ENABLED: boolean = true;
}

/**
 * Fails fast at boot: a missing or malformed DATABASE_URL must never reach a
 * half-initialised Prisma client.
 */
export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const config = plainToInstance(EnvironmentVariablesDto, raw, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });

  const errors = validateSync(config, { skipMissingProperties: false, whitelist: true });
  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  if (!POSTGRES_URL_PATTERN.test(config.DATABASE_URL)) {
    throw new Error(
      'Invalid environment configuration: DATABASE_URL must look like postgresql://user:password@host:5432/db',
    );
  }

  return config;
}
