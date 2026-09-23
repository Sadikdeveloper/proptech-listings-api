import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../support/app.factory';
import { truncateTables } from '../support/database';
import { createAgent, createListing, listingPayload } from '../support/fixtures';

describe('Listings (e2e)', () => {
  let app: INestApplication;
  let agentId: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables();
    const agent = await createAgent(app);
    agentId = agent.id;
  });

  describe('POST /listings', () => {
    it('creates a listing with a nested location and returns the agent summary', async () => {
      const response = await request(app.getHttpServer())
        .post('/listings')
        .send(listingPayload(agentId))
        .expect(201);

      expect(response.body).toMatchObject({
        title: '3 bedroom flat in Ikoyi',
        price: 2500.5,
        currency: 'USD',
        type: 'rent',
        bedrooms: 3,
        agentId,
        location: { latitude: 6.4521, longitude: 3.4345 },
      });
      expect(response.body.agent).toMatchObject({ id: agentId, name: 'Ada Obi' });
      expect(response.body.distanceKm).toBeUndefined();
    });

    it('accepts an uppercase type and uppercases the currency', async () => {
      const response = await request(app.getHttpServer())
        .post('/listings')
        .send(listingPayload(agentId, { type: 'SHORTLET' as never, currency: 'ngn' }))
        .expect(201);

      expect(response.body.type).toBe('shortlet');
      expect(response.body.currency).toBe('NGN');
    });

    it.each([
      ['missing title', { title: undefined }],
      ['price with cents precision loss', { price: 10.999 }],
      ['negative price', { price: -5 }],
      ['unknown type', { type: 'lease' as never }],
      ['bedrooms above the cap', { bedrooms: 99 }],
      ['latitude out of range', { latitude: 120 }],
      ['longitude out of range', { longitude: -400 }],
      ['agentId that is not a UUID', { agentId: 'abc' }],
      ['unknown currency', { currency: 'DOLLARS' }],
    ])('rejects %s with 400', async (_label, override) => {
      const response = await request(app.getHttpServer())
        .post('/listings')
        .send({ ...listingPayload(agentId), ...override })
        .expect(400);

      expect(response.body.code).toBe('VALIDATION_FAILED');
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    it('rejects a location object with only one coordinate', async () => {
      const payload = { ...listingPayload(agentId), location: { latitude: 6.4521 } };

      const response = await request(app.getHttpServer()).post('/listings').send(payload).expect(400);

      expect(response.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'location.longitude' })]),
      );
    });

    it('returns 404 when the referenced agent does not exist', async () => {
      const response = await request(app.getHttpServer())
        .post('/listings')
        .send(listingPayload('3f1a8e42-2f4e-4b4a-9f3e-1c2b3a4d5e6f'))
        .expect(404);

      expect(response.body.message).toContain('Agent');
    });
  });

  describe('GET /listings', () => {
    beforeEach(async () => {
      await createListing(app, agentId, { title: 'Cheap rent', price: 800, type: 'rent', bedrooms: 1 });
      await createListing(app, agentId, { title: 'Mid rent', price: 2000, type: 'rent', bedrooms: 3 });
      await createListing(app, agentId, { title: 'Sale flat', price: 90000, type: 'sale', bedrooms: 4 });
      await createListing(app, agentId, {
        title: 'Shortlet studio',
        price: 150,
        type: 'shortlet',
        bedrooms: 0,
      });
    });

    it('filters by type, price range and bedrooms', async () => {
      const byType = await request(app.getHttpServer())
        .get('/listings')
        .query({ type: 'rent' })
        .expect(200);
      expect(byType.body.meta.total).toBe(2);

      const byPrice = await request(app.getHttpServer())
        .get('/listings')
        .query({ minPrice: 800, maxPrice: 2000 })
        .expect(200);
      expect(byPrice.body.data.map((item: { title: string }) => item.title).sort()).toEqual([
        'Cheap rent',
        'Mid rent',
      ]);

      const byBedrooms = await request(app.getHttpServer())
        .get('/listings')
        .query({ minBedrooms: 3 })
        .expect(200);
      expect(byBedrooms.body.meta.total).toBe(2);

      const exactBedrooms = await request(app.getHttpServer())
        .get('/listings')
        .query({ bedrooms: 3 })
        .expect(200);
      expect(exactBedrooms.body.data[0].title).toBe('Mid rent');

      const combined = await request(app.getHttpServer())
        .get('/listings')
        .query({ type: 'rent', minBedrooms: 3, minPrice: 1000 })
        .expect(200);
      expect(combined.body.data.map((item: { title: string }) => item.title)).toEqual(['Mid rent']);
    });

    it('sorts by price and paginates without repeating rows', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings')
        .query({ sortBy: 'price', sortOrder: 'asc', limit: 2 })
        .expect(200);

      expect(response.body.data.map((item: { price: number }) => item.price)).toEqual([150, 800]);
      expect(response.body.meta).toMatchObject({ total: 4, totalPages: 2, hasNextPage: true });

      const lastPage = await request(app.getHttpServer())
        .get('/listings')
        .query({ sortBy: 'price', sortOrder: 'asc', limit: 2, page: 2 })
        .expect(200);

      expect(lastPage.body.data.map((item: { price: number }) => item.price)).toEqual([2000, 90000]);
      expect(lastPage.body.meta.hasNextPage).toBe(false);
    });

    it('returns an empty page beyond the last page with the real total', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings')
        .query({ page: 5, limit: 2 })
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.meta).toMatchObject({ page: 5, total: 4, totalPages: 2 });
    });

    it('filters by agentId', async () => {
      const otherAgent = await createAgent(app, { email: 'other@agency.example' });

      const response = await request(app.getHttpServer())
        .get('/listings')
        .query({ agentId: otherAgent.id })
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.meta.total).toBe(0);
    });

    it('rejects contradictory ranges, bad enums and unknown parameters', async () => {
      const priceRange = await request(app.getHttpServer())
        .get('/listings')
        .query({ minPrice: 5000, maxPrice: 100 })
        .expect(400);
      expect(priceRange.body.details[0].field).toBe('maxPrice');

      await request(app.getHttpServer()).get('/listings').query({ type: 'lease' }).expect(400);
      await request(app.getHttpServer()).get('/listings').query({ sortBy: 'colour' }).expect(400);
      await request(app.getHttpServer()).get('/listings').query({ page: 0 }).expect(400);
      await request(app.getHttpServer()).get('/listings').query({ limit: 101 }).expect(400);

      const unknown = await request(app.getHttpServer())
        .get('/listings')
        .query({ unknown: 'value' })
        .expect(400);
      expect(unknown.body.details[0].field).toBe('unknown');
    });
  });

  describe('GET /listings/:id, PATCH and DELETE', () => {
    it('fetches a single listing', async () => {
      const listing = await createListing(app, agentId);

      const response = await request(app.getHttpServer())
        .get(`/listings/${listing.id}`)
        .expect(200);

      expect(response.body.id).toBe(listing.id);
    });

    it('returns 404 for a listing that does not exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/listings/3f1a8e42-2f4e-4b4a-9f3e-1c2b3a4d5e6f')
        .expect(404);

      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('applies a partial update', async () => {
      const listing = await createListing(app, agentId);

      const response = await request(app.getHttpServer())
        .patch(`/listings/${listing.id}`)
        .send({ price: 3100.75, bedrooms: 4, location: { latitude: 6.5, longitude: 3.4 } })
        .expect(200);

      expect(response.body).toMatchObject({
        price: 3100.75,
        bedrooms: 4,
        location: { latitude: 6.5, longitude: 3.4 },
        title: '3 bedroom flat in Ikoyi',
      });
    });

    it('rejects an update that points at an unknown agent', async () => {
      const listing = await createListing(app, agentId);

      await request(app.getHttpServer())
        .patch(`/listings/${listing.id}`)
        .send({ agentId: '3f1a8e42-2f4e-4b4a-9f3e-1c2b3a4d5e6f' })
        .expect(404);
    });

    it('deletes a listing and returns 204', async () => {
      const listing = await createListing(app, agentId);

      await request(app.getHttpServer()).delete(`/listings/${listing.id}`).expect(204);
      await request(app.getHttpServer()).get(`/listings/${listing.id}`).expect(404);
    });
  });
});
