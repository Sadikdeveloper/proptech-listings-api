import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../support/app.factory';
import { agentPayload, createAgent, createListing } from '../support/fixtures';
import { truncateTables } from '../support/database';

describe('Agents (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables();
  });

  describe('POST /agents', () => {
    it('creates an agent and normalises the email', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents')
        .send(agentPayload({ email: '  ADA.Obi@Agency.Example ' }))
        .expect(201);

      expect(response.body).toMatchObject({ name: 'Ada Obi', email: 'ada.obi@agency.example' });
      expect(response.body.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(response.body.listingsCount).toBe(0);
    });

    it('rejects an invalid email with field level details', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents')
        .send(agentPayload({ email: 'not-an-email' }))
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
      );
    });

    it('rejects unknown properties', async () => {
      const response = await request(app.getHttpServer())
        .post('/agents')
        .send({ ...agentPayload(), role: 'admin' })
        .expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'role' })]),
      );
    });

    it('returns 409 for a duplicate email', async () => {
      const payload = agentPayload({ email: 'duplicate@agency.example' });
      await request(app.getHttpServer()).post('/agents').send(payload).expect(201);

      const response = await request(app.getHttpServer()).post('/agents').send(payload).expect(409);

      expect(response.body.code).toBe('CONFLICT');
    });
  });

  describe('GET /agents', () => {
    it('paginates and searches by name or email', async () => {
      await createAgent(app, { name: 'Ada Obi', email: 'ada@agency.example' });
      await createAgent(app, { name: 'Tunde Bakare', email: 'tunde@agency.example' });

      const firstPage = await request(app.getHttpServer())
        .get('/agents')
        .query({ limit: 1, sortBy: 'name', sortOrder: 'asc' })
        .expect(200);

      expect(firstPage.body.meta).toEqual({
        page: 1,
        limit: 1,
        total: 2,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
      });
      expect(firstPage.body.data[0].name).toBe('Ada Obi');

      const secondPage = await request(app.getHttpServer())
        .get('/agents')
        .query({ page: 2, limit: 1, sortBy: 'name', sortOrder: 'asc' })
        .expect(200);

      expect(secondPage.body.data[0].name).toBe('Tunde Bakare');
      expect(secondPage.body.meta.hasPreviousPage).toBe(true);

      const search = await request(app.getHttpServer())
        .get('/agents')
        .query({ search: 'TUNDE' })
        .expect(200);

      expect(search.body.data).toHaveLength(1);
      expect(search.body.data[0].email).toBe('tunde@agency.example');
    });

    it('rejects a page size above the cap', async () => {
      const response = await request(app.getHttpServer())
        .get('/agents')
        .query({ limit: 500 })
        .expect(400);

      expect(response.body.details[0].field).toBe('limit');
    });
  });

  describe('GET /agents/:id', () => {
    it('returns the agent with the listing count', async () => {
      const agent = await createAgent(app);
      await createListing(app, agent.id);

      const response = await request(app.getHttpServer()).get(`/agents/${agent.id}`).expect(200);

      expect(response.body).toMatchObject({ id: agent.id, listingsCount: 1 });
    });

    it('returns 404 for an unknown id', async () => {
      const response = await request(app.getHttpServer())
        .get('/agents/3f1a8e42-2f4e-4b4a-9f3e-1c2b3a4d5e6f')
        .expect(404);

      expect(response.body).toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    });

    it('returns 400 for an id that is not a UUID', async () => {
      await request(app.getHttpServer()).get('/agents/not-a-uuid').expect(400);
    });
  });

  describe('PATCH /agents/:id', () => {
    it('updates the phone number', async () => {
      const agent = await createAgent(app);

      const response = await request(app.getHttpServer())
        .patch(`/agents/${agent.id}`)
        .send({ phone: '+2348090000001' })
        .expect(200);

      expect(response.body.phone).toBe('+2348090000001');
      expect(response.body.email).toBe(agent.email);
    });

    it('rejects an email already used by another agent', async () => {
      const first = await createAgent(app, { email: 'first@agency.example' });
      await createAgent(app, { email: 'second@agency.example' });

      await request(app.getHttpServer())
        .patch(`/agents/${first.id}`)
        .send({ email: 'second@agency.example' })
        .expect(409);
    });

    it('returns 404 when the agent does not exist', async () => {
      await request(app.getHttpServer())
        .patch('/agents/3f1a8e42-2f4e-4b4a-9f3e-1c2b3a4d5e6f')
        .send({ name: 'Ghost Agent' })
        .expect(404);
    });
  });

  describe('DELETE /agents/:id', () => {
    it('deletes an agent without listings', async () => {
      const agent = await createAgent(app);

      await request(app.getHttpServer()).delete(`/agents/${agent.id}`).expect(204);
      await request(app.getHttpServer()).get(`/agents/${agent.id}`).expect(404);
    });

    it('refuses to delete an agent that still owns listings', async () => {
      const agent = await createAgent(app);
      await createListing(app, agent.id);

      const response = await request(app.getHttpServer()).delete(`/agents/${agent.id}`).expect(409);

      expect(response.body.message).toContain('listing');
      await request(app.getHttpServer()).get(`/agents/${agent.id}`).expect(200);
    });
  });
});
