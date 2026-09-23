import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_CONFIG_NAMESPACE } from './configuration';
import { AppConfig, DatabaseConfig, NodeEnv } from './config.types';

/**
 * Thin typed facade over ConfigService so modules never deal with raw string
 * lookups or `undefined` results.
 */
@Injectable()
export class AppConfigService {
  private readonly app: AppConfig;

  constructor(configService: ConfigService) {
    this.app = configService.getOrThrow<AppConfig>(APP_CONFIG_NAMESPACE);
  }

  get env(): NodeEnv {
    return this.app.env;
  }

  get isProduction(): boolean {
    return this.app.isProduction;
  }

  get isTest(): boolean {
    return this.app.isTest;
  }

  get port(): number {
    return this.app.port;
  }

  get logLevel(): AppConfig['logLevel'] {
    return this.app.logLevel;
  }

  get corsOrigins(): string[] | '*' {
    return this.app.corsOrigins;
  }

  get swaggerEnabled(): boolean {
    return this.app.swaggerEnabled;
  }

  get database(): DatabaseConfig {
    return this.app.database;
  }
}
