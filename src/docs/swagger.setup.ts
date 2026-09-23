import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'docs';

export function buildOpenApiDocument(app: INestApplication) {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Property Listings API')
      .setDescription(
        'REST API for property listings (rent, sale and shortlet) with attribute and radius search.',
      )
      .setVersion('1.0.0')
      .addTag('listings', 'Create, read, update and delete property listings')
      .addTag('agents', 'Manage the agents that own listings')
      .addTag('health', 'Service liveness')
      .build(),
    { operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}` },
  );
}

/** Serves the Swagger UI at `/docs` and points the API root at it. */
export function setupDocumentation(app: INestApplication): void {
  SwaggerModule.setup(SWAGGER_PATH, app, buildOpenApiDocument(app), {
    jsonDocumentUrl: `${SWAGGER_PATH}/json`,
    customSiteTitle: 'Property Listings API',
    swaggerOptions: { docExpansion: 'list', displayRequestDuration: true, filter: true },
  });

  app
    .getHttpAdapter()
    .get('/', (_request: unknown, response: { redirect: (to: string) => void }) =>
      response.redirect(`/${SWAGGER_PATH}`),
    );
}
