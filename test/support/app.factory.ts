import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { setupDocumentation } from '../../src/docs/swagger.setup';

/**
 * Builds the real application graph: the global validation pipe and exception
 * filter come from AppModule, and the HTTP level extras from main.ts are
 * applied here so the tests exercise the same wiring as production.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();

  setupDocumentation(app);

  await app.init();
  return app;
}
