import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../support/app.factory';

describe('GET /health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports the service and database as up', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toMatchObject({
      status: 'up',
      database: { status: 'up' },
    });
    expect(typeof response.body.uptimeSeconds).toBe('number');
    expect(new Date(response.body.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('exposes the OpenAPI document', async () => {
    const response = await request(app.getHttpServer()).get('/docs/json').expect(200);

    expect(response.body.info.title).toBe('Property Listings API');
    expect(Object.keys(response.body.paths)).toEqual(
      expect.arrayContaining([
        '/agents',
        '/agents/{id}',
        '/listings',
        '/listings/search',
        '/listings/{id}',
        '/health',
      ]),
    );
  });

  it('redirects the API root to the Swagger UI', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(302);

    expect(response.headers.location).toBe('/docs');
  });

  it('returns the documented error envelope for unknown routes', async () => {
    const response = await request(app.getHttpServer()).get('/does-not-exist').expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      path: '/does-not-exist',
      method: 'GET',
    });
  });
});
