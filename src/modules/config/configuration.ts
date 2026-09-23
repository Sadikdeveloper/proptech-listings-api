import { AppConfig, NodeEnv } from './config.types';

export const APP_CONFIG_NAMESPACE = 'app';

function parseCorsOrigins(value: string | undefined): string[] | '*' {
  if (!value || value.trim() === '*' || value.trim() === '') {
    return '*';
  }
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = (env.NODE_ENV as NodeEnv) ?? 'development';
  const isProduction = nodeEnv === 'production';
  const swaggerRequested = env.SWAGGER_ENABLED ?? 'true';
  const connectionLimit = Number.parseInt(env.DATABASE_CONNECTION_LIMIT ?? '10', 10);

  return {
    env: nodeEnv,
    isProduction,
    isTest: nodeEnv === 'test',
    port: Number.parseInt(env.PORT ?? '3000', 10),
    logLevel: (env.LOG_LEVEL as AppConfig['logLevel']) ?? 'log',
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
    swaggerEnabled: isProduction ? swaggerRequested === 'true' : swaggerRequested !== 'false',
    database: {
      url: env.DATABASE_URL ?? '',
      connectionLimit,
    },
  };
}

export const configuration = () => ({ [APP_CONFIG_NAMESPACE]: loadAppConfig() });
