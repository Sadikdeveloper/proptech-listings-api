import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { redactConnectionString } from './common/utils/redact.util';
import { AppConfigService } from './config/app-config.service';
import { setupDocumentation } from './docs/swagger.setup';

const HOST = '0.0.0.0';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

  // CSP is disabled so the Swagger UI can render its inline bundle; the API
  // itself only serves JSON.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.enableCors({
    origin: config.corsOrigins === '*' ? true : config.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86_400,
  });
  app.enableShutdownHooks();

  if (config.swaggerEnabled) {
    setupDocumentation(app);
  }

  await app.listen(config.port, HOST);

  logger.log(`Environment: ${config.env}`);
  logger.log(`Database: ${redactConnectionString(config.database.url)}`);
  logger.log(`Listening on http://${HOST}:${config.port}`);
  if (config.swaggerEnabled) {
    logger.log('Swagger UI available at /docs');
  }
}

bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(
    'Failed to start the application',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
