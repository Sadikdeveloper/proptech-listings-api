import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAgentDto } from '../../src/agents/dto/create-agent.dto';
import { AgentQueryDto } from '../../src/agents/dto/agent-query.dto';
import { CreateListingDto } from '../../src/listings/dto/create-listing.dto';
import { ListingsQueryDto } from '../../src/listings/dto/listings-query.dto';
import { SearchListingsQueryDto } from '../../src/listings/dto/search-listings-query.dto';
import { UpdateListingDto } from '../../src/listings/dto/update-listing.dto';

const AGENT_ID = '3f1a8e42-2f4e-4b4a-9f3e-1c2b3a4d5e6f';

async function transform<T extends object>(cls: new () => T, payload: unknown): Promise<T> {
  const instance = plainToInstance(cls, payload, { exposeDefaultValues: true });
  return instance;
}

async function errorFields(instance: object): Promise<string[]> {
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((error) => error.property).sort();
}

function validListing(overrides: Record<string, unknown> = {}) {
  return {
    title: '3 bedroom flat in Ikoyi',
    price: 2500.5,
    type: 'rent',
    bedrooms: 3,
    location: { latitude: 6.4521, longitude: 3.4345 },
    agentId: AGENT_ID,
    ...overrides,
  };
}

describe('DTOs', () => {
  describe('CreateListingDto', () => {
    it('transforms incoming values', async () => {
      const dto = await transform(
        CreateListingDto,
        validListing({ title: '  Ikoyi flat  ', type: 'SHORTLET', currency: 'ngn', description: ' Nice ' }),
      );

      expect(dto.title).toBe('Ikoyi flat');
      expect(dto.type).toBe('shortlet');
      expect(dto.currency).toBe('NGN');
      expect(dto.description).toBe('Nice');
      expect(await validate(dto)).toHaveLength(0);
    });

    it('defaults the currency to USD', async () => {
      const dto = await transform(CreateListingDto, validListing());

      expect(dto.currency).toBe('USD');
    });

    it.each([
      ['title', { title: 'ab' }],
      ['title', { title: undefined }],
      ['price', { price: 0 }],
      ['price', { price: 'free' }],
      ['price', { price: 10.123 }],
      ['type', { type: 'lease' }],
      ['type', { type: undefined }],
      ['bedrooms', { bedrooms: -1 }],
      ['bedrooms', { bedrooms: 2.5 }],
      ['agentId', { agentId: 'not-a-uuid' }],
      ['location', { location: undefined }],
      ['location', { location: { latitude: 91, longitude: 3.4 } }],
      ['location', { location: { latitude: 6.4, longitude: 181 } }],
      ['location', { location: { latitude: 6.4 } }],
      ['currency', { currency: 'US' }],
    ])('rejects a bad %s', async (field, override) => {
      const dto = await transform(CreateListingDto, validListing(override));

      expect(await errorFields(dto)).toContain(field);
    });

    it('rejects unknown properties', async () => {
      const dto = await transform(CreateListingDto, validListing({ verified: true }));

      expect(await errorFields(dto)).toContain('verified');
    });
  });

  describe('UpdateListingDto', () => {
    it('accepts a single field', async () => {
      const dto = await transform(UpdateListingDto, { price: 1200 });

      expect(await validate(dto, { whitelist: true })).toHaveLength(0);
    });

    it('still requires both coordinates when a location is sent', async () => {
      const dto = await transform(UpdateListingDto, { location: { latitude: 6.4 } });

      expect(await errorFields(dto)).toContain('location');
    });
  });

  describe('ListingsQueryDto', () => {
    it('coerces query strings into numbers with defaults', async () => {
      const dto = await transform(ListingsQueryDto, { page: '3', limit: '10', minPrice: '100.5', bedrooms: '2' });

      expect(dto).toMatchObject({ page: 3, limit: 10, minPrice: 100.5, bedrooms: 2, sortOrder: 'desc' });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('applies the default page size', async () => {
      const dto = await transform(ListingsQueryDto, {});

      expect(dto).toMatchObject({ page: 1, limit: 20 });
    });

    it.each([
      ['page', { page: 'abc' }],
      ['page', { page: 0 }],
      ['limit', { limit: 0 }],
      ['limit', { limit: 101 }],
      ['type', { type: 'lease' }],
      ['minPrice', { minPrice: -1 }],
      ['maxPrice', { maxPrice: 1e15 }],
      ['bedrooms', { bedrooms: 51 }],
      ['agentId', { agentId: 'nope' }],
      ['sortBy', { sortBy: 'name' }],
      ['sortOrder', { sortOrder: 'sideways' }],
    ])('rejects a bad %s', async (field, override) => {
      const dto = await transform(ListingsQueryDto, override);

      expect(await errorFields(dto)).toContain(field);
    });

    it('normalises the type casing', async () => {
      const dto = await transform(ListingsQueryDto, { type: 'RENT' });

      expect(dto.type).toBe('rent');
    });
  });

  describe('SearchListingsQueryDto', () => {
    it('accepts a full geo query', async () => {
      const dto = await transform(SearchListingsQueryDto, { lat: '6.4281', lng: '3.4219', radiusKm: '2.5' });

      expect(dto).toMatchObject({ lat: 6.4281, lng: 3.4219, radiusKm: 2.5 });
      expect(await validate(dto)).toHaveLength(0);
    });

    it.each([
      ['lat', { lat: 95, lng: 3.4 }],
      ['lng', { lat: 6.4, lng: 181 }],
      ['radiusKm', { lat: 6.4, lng: 3.4, radiusKm: 0.001 }],
      ['radiusKm', { lat: 6.4, lng: 3.4, radiusKm: 20001 }],
      ['radiusKm', { lat: 6.4, lng: 3.4, radiusKm: 'far' }],
    ])('rejects a bad %s', async (field, override) => {
      const dto = await transform(SearchListingsQueryDto, override);

      expect(await errorFields(dto)).toContain(field);
    });
  });

  describe('agent DTOs', () => {
    it('normalises agent input', async () => {
      const dto = await transform(CreateAgentDto, {
        name: '  Ada Obi ',
        email: ' ADA@Agency.Example ',
        phone: ' +2348031234567 ',
      });

      expect(dto).toMatchObject({
        name: 'Ada Obi',
        email: 'ada@agency.example',
        phone: '+2348031234567',
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it.each([
      ['name', { name: 'A' }],
      ['email', { email: 'nope' }],
      ['phone', { phone: 'call me' }],
    ])('rejects a bad %s', async (field, override) => {
      const dto = await transform(CreateAgentDto, {
        name: 'Ada Obi',
        email: 'ada@agency.example',
        ...override,
      });

      expect(await errorFields(dto)).toContain(field);
    });

    it('defaults the agent sort options', async () => {
      const dto = await transform(AgentQueryDto, {});

      expect(dto).toMatchObject({ page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' });
    });
  });
});
