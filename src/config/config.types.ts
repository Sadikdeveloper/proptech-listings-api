export type NodeEnv = 'development' | 'test' | 'production';

export type LogLevel = 'error' | 'warn' | 'log' | 'debug' | 'verbose';

export interface DatabaseConfig {
  url: string;
  connectionLimit: number;
}

export interface AppConfig {
  env: NodeEnv;
  isProduction: boolean;
  isTest: boolean;
  port: number;
  logLevel: LogLevel;
  corsOrigins: string[] | '*';
  swaggerEnabled: boolean;
  database: DatabaseConfig;
}

export interface EnvironmentVariables {
  NODE_ENV: NodeEnv;
  PORT: number;
  LOG_LEVEL: LogLevel;
  DATABASE_URL: string;
  DATABASE_CONNECTION_LIMIT: number;
  CORS_ORIGINS: string;
  SWAGGER_ENABLED: boolean;
}
