import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from '../support/app.factory';
import { truncateTables } from '../support/database';
import { createAgent, createListing } from '../support/fixtures';

// Victoria Island, Lagos - the centre every radius assertion below is relative to.
const CENTRE = { lat: 6.4281, lng: 3.4219 };

const IN_RANGE = { location: { latitude: 6.4521, longitude: 3.4345 } }; // ~3.0 km from the centre
const TOO_FAR = { location: { latitude: 9.0765, longitude: 7.4896 } }; // Abuja, ~600 km away

describe('GET /listings/search (e2e)', () => {
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
    agentId = (await createAgent(app)).id;

    await createListing(app, agentId, {
      title: 'At the centre',
      price: 1000,
      type: 'rent',
      bedrooms: 1,
      location: { latitude: CENTRE.lat, longitude: CENTRE.lng },
    });
    await createListing(app, agentId, {
      title: 'Within 5 km',
      price: 2500,
      type: 'sale',
      bedrooms: 3,
      ...IN_RANGE,
    });
    await createListing(app, agentId, {
      title: 'Far away',
      price: 90000,
      type: 'sale',
      bedrooms: 5,
      ...TOO_FAR,
    });
  });

  it('returns listings inside the radius with the distance and orders by proximity', async () => {
    const response = await request(app.getHttpServer())
      .get('/listings/search')
      .query({ ...CENTRE, radiusKm: 10 })
      .expect(200);

    expect(response.body.meta.total).toBe(2);
    expect(response.body.data.map((item: { title: string }) => item.title)).toEqual([
      'At the centre',
      'Within 5 km',
    ]);
    expect(response.body.data[0].distanceKm).toBeCloseTo(0, 3);
    expect(response.body.data[1].distanceKm).toBeGreaterThan(2.9);
    expect(response.body.data[1].distanceKm).toBeLessThan(3.2);
    expect(response.body.data[1].agent).toMatchObject({ id: agentId });
  });

  it('excludes listings outside the radius', async () => {
    const response = await request(app.getHttpServer())
      .get('/listings/search')
      .query({ ...CENTRE, radiusKm: 40 })
      .expect(200);

    expect(response.body.data.map((item: { title: string }) => item.title)).not.toContain('Far away');

    const wide = await request(app.getHttpServer())
      .get('/listings/search')
      .query({ ...CENTRE, radiusKm: 700, limit: 50 })
      .expect(200);

    expect(wide.body.meta.total).toBe(3);
    expect(wide.body.data[2].title).toBe('Far away');
  });

  it('defaults the radius to 5 km', async () => {
    const response = await request(app.getHttpServer())
      .get('/listings/search')
      .query(CENTRE)
      .expect(200);

    expect(response.body.meta.total).toBe(2);
  });

  it('combines the radius with attribute filters', async () => {
    const response = await request(app.getHttpServer())
      .get('/listings/search')
      .query({ ...CENTRE, radiusKm: 10, type: 'sale', minBedrooms: 3, maxPrice: 5000 })
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe('Within 5 km');
  });

  it('paginates the radius result set', async () => {
    const firstPage = await request(app.getHttpServer())
      .get('/listings/search')
      .query({ ...CENTRE, radiusKm: 10, limit: 1 })
      .expect(200);

    expect(firstPage.body.meta).toMatchObject({ total: 2, totalPages: 2, hasNextPage: true });
    expect(firstPage.body.data).toHaveLength(1);

    const secondPage = await request(app.getHttpServer())
      .get('/listings/search')
      .query({ ...CENTRE, radiusKm: 10, limit: 1, page: 2 })
      .expect(200);

    expect(secondPage.body.data[0].title).toBe('Within 5 km');
    expect(secondPage.body.meta.hasNextPage).toBe(false);
  });

  it('behaves like the filtered list endpoint when no centre is given', async () => {
    const search = await request(app.getHttpServer())
      .get('/listings/search')
      .query({ type: 'sale' })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/listings')
      .query({ type: 'sale' })
      .expect(200);

    expect(search.body.meta.total).toBe(list.body.meta.total);
    expect(search.body.data.map((item: { id: string }) => item.id).sort()).toEqual(
      list.body.data.map((item: { id: string }) => item.id).sort(),
    );
    expect(search.body.data[0].distanceKm).toBeUndefined();
  });

  it('honours an explicit sort when a centre is supplied', async () => {
    const response = await request(app.getHttpServer())
      .get('/listings/search')
      .query({ ...CENTRE, radiusKm: 700, sortBy: 'price', sortOrder: 'desc', limit: 50 })
      .expect(200);

    expect(response.body.data.map((item: { title: string }) => item.title)).toEqual([
      'Far away',
      'Within 5 km',
      'At the centre',
    ]);
  });

  it('still returns distanceKm under an explicit sort', async () => {
    const response = await request(app.getHttpServer())
      .get('/listings/search')
      .query({ ...CENTRE, radiusKm: 700, sortBy: 'price', sortOrder: 'asc', limit: 50 })
      .expect(200);

    expect(response.body.data[2].distanceKm).toBeGreaterThan(500);
  });

  it.each([
    ['lat without lng', { lat: 6.4 }],
    ['lng without lat', { lng: 3.4 }],
    ['radius without a centre', { radiusKm: 5 }],
    ['latitude out of range', { lat: 95, lng: 3.4 }],
    ['longitude out of range', { lat: 6.4, lng: 200 }],
    ['radius below the minimum', { ...CENTRE, radiusKm: 0.01 }],
    ['radius above the maximum', { ...CENTRE, radiusKm: 25000 }],
    ['non numeric radius', { ...CENTRE, radiusKm: 'five' }],
  ])('rejects %s with 400', async (_label, query) => {
    const response = await request(app.getHttpServer())
      .get('/listings/search')
      .query(query)
      .expect(400);

    expect(response.body.code).toBe('VALIDATION_FAILED');
    expect(response.body.details.length).toBeGreaterThan(0);
  });

  it('includes listings right on the radius boundary and excludes the ones just outside', async () => {
    const exact = await request(app.getHttpServer())
      .get('/listings/search')
      .query({ ...CENTRE, radiusKm: 10 })
      .expect(200);

    const farthest = exact.body.data[exact.body.data.length - 1].distanceKm;

    const boundary = await request(app.getHttpServer())
      .get('/listings/search')
      .query({ ...CENTRE, radiusKm: farthest + 0.001 })
      .expect(200);
    expect(boundary.body.meta.total).toBe(2);

    // A distance is rounded to 3 decimals in the response, so stepping just
    // below the reported value must drop the listing again.
    const justInside = await request(app.getHttpServer())
      .get('/listings/search')
      .query({ ...CENTRE, radiusKm: farthest - 0.001 })
      .expect(200);
    expect(justInside.body.meta.total).toBe(1);
  });
});
