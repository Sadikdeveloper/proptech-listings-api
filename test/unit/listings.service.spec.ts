import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AgentsService } from '../../src/agents/agents.service';
import { CreateListingDto } from '../../src/listings/dto/create-listing.dto';
import { ListingsQueryDto } from '../../src/listings/dto/listings-query.dto';
import { SearchListingsQueryDto } from '../../src/listings/dto/search-listings-query.dto';
import { ListingsService } from '../../src/listings/listings.service';
import { ListingRecord, ListingSearchRow } from '../../src/listings/listings.types';
import { PrismaService } from '../../src/prisma/prisma.service';

const AGENT_ID = '3f1a8e42-2f4e-4b4a-9f3e-1c2b3a4d5e6f';

function record(overrides: Partial<ListingRecord> = {}): ListingRecord {
  return {
    id: '11111111-2222-4333-8444-555555555555',
    title: '3 bedroom flat in Ikoyi',
    description: null,
    price: new Prisma.Decimal('2500.50'),
    currency: 'USD',
    type: 'RENT',
    bedrooms: 3,
    latitude: 6.4521,
    longitude: 3.4345,
    agentId: AGENT_ID,
    createdAt: new Date('2026-01-01T10:00:00.000Z'),
    updatedAt: new Date('2026-01-02T10:00:00.000Z'),
    agent: {
      id: AGENT_ID,
      name: 'Ada Obi',
      email: 'ada@agency.example',
      phone: '+2348031234567',
      createdAt: new Date('2026-01-01T09:00:00.000Z'),
      updatedAt: new Date('2026-01-01T09:00:00.000Z'),
    },
    ...overrides,
  } as ListingRecord;
}

function searchRow(overrides: Partial<ListingSearchRow> = {}): ListingSearchRow {
  return {
    id: '11111111-2222-4333-8444-555555555555',
    title: '3 bedroom flat in Ikoyi',
    description: null,
    price: '2500.50',
    currency: 'USD',
    type: 'RENT',
    bedrooms: 3,
    latitude: 6.4521,
    longitude: 3.4345,
    agent_id: AGENT_ID,
    created_at: new Date('2026-01-01T10:00:00.000Z'),
    updated_at: new Date('2026-01-02T10:00:00.000Z'),
    agent_name: 'Ada Obi',
    agent_email: 'ada@agency.example',
    agent_phone: '+2348031234567',
    distance_km: 3.010005145598206,
    ...overrides,
  };
}

describe('ListingsService', () => {
  let service: ListingsService;
  let prisma: {
    listing: Record<'create' | 'findUnique' | 'findMany' | 'count' | 'update' | 'delete', jest.Mock>;
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  };
  let agents: { exists: jest.Mock };

  beforeEach(() => {
    prisma = {
      listing: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
    };
    agents = { exists: jest.fn() };
    service = new ListingsService(prisma as unknown as PrismaService, agents as unknown as AgentsService);
  });

  describe('create', () => {
    it('rejects a listing that points at a missing agent', async () => {
      agents.exists.mockResolvedValue(false);

      await expect(
        service.create({
          title: 'Flat',
          price: 100,
          type: 'rent',
          bedrooms: 1,
          location: { latitude: 6.4, longitude: 3.4 },
          agentId: AGENT_ID,
          currency: 'USD',
        } as CreateListingDto),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.listing.create).not.toHaveBeenCalled();
    });

    it('stores the price as a decimal and maps the enum', async () => {
      agents.exists.mockResolvedValue(true);
      prisma.listing.create.mockResolvedValue(record());

      const result = await service.create({
        title: 'Flat',
        price: 2500.5,
        type: 'rent',
        bedrooms: 3,
        location: { latitude: 6.4521, longitude: 3.4345 },
        agentId: AGENT_ID,
        currency: 'USD',
      } as CreateListingDto);

      const data = prisma.listing.create.mock.calls[0][0].data;
      expect(data.type).toBe('RENT');
      expect(data.price).toBeInstanceOf(Prisma.Decimal);
      expect(data.price.toString()).toBe('2500.5');

      expect(result).toMatchObject({
        price: 2500.5,
        type: 'rent',
        location: { latitude: 6.4521, longitude: 3.4345 },
        createdAt: '2026-01-01T10:00:00.000Z',
        agent: { email: 'ada@agency.example' },
      });
      expect(result.distanceKm).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('returns the page plus pagination meta', async () => {
      prisma.$transaction.mockResolvedValue([[record()], 21]);

      const result = await service.findAll(
        Object.assign(new ListingsQueryDto(), { page: 2, limit: 20, sortOrder: 'desc' }),
      );

      expect(prisma.listing.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
      expect(result.meta).toMatchObject({ page: 2, total: 21, totalPages: 2, hasNextPage: false });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('search', () => {
    it('uses the raw radius query when a centre is provided', async () => {
      prisma.$queryRaw.mockImplementation((query: unknown) => query);
      prisma.$transaction.mockResolvedValue([[{ total: '2' }], [searchRow()]]);

      const result = await service.search(
        Object.assign(new SearchListingsQueryDto(), { lat: 6.4281, lng: 3.4219, page: 1, limit: 20 }),
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.listing.findMany).not.toHaveBeenCalled();
      expect(result.meta.total).toBe(2);
      expect(result.data[0].distanceKm).toBe(3.01);
      expect(result.data[0].agent).toMatchObject({ id: AGENT_ID });
    });

    it('falls back to the typed query when there is no centre', async () => {
      prisma.$transaction.mockResolvedValue([[record()], 1]);

      const result = await service.search(
        Object.assign(new SearchListingsQueryDto(), { type: 'rent', page: 1, limit: 20 }),
      );

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.listing.findMany).toHaveBeenCalled();
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne / update / remove', () => {
    it('throws 404 when the listing is missing', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(service.findOne(AGENT_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('checks the new agent before an update', async () => {
      prisma.listing.findUnique.mockResolvedValue(record());
      agents.exists.mockResolvedValue(false);

      await expect(service.update(AGENT_ID, { agentId: AGENT_ID })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.listing.update).not.toHaveBeenCalled();
    });

    it('only sends the fields that were provided on update', async () => {
      prisma.listing.findUnique.mockResolvedValue(record());
      prisma.listing.update.mockResolvedValue(record({ bedrooms: 5 }));

      const result = await service.update(AGENT_ID, { bedrooms: 5 });

      expect(prisma.listing.update.mock.calls[0][0].data).toEqual({ bedrooms: 5 });
      expect(result.bedrooms).toBe(5);
    });

    it('deletes an existing listing', async () => {
      prisma.listing.findUnique.mockResolvedValue(record());

      await service.remove(AGENT_ID);

      expect(prisma.listing.delete).toHaveBeenCalledWith({ where: { id: AGENT_ID } });
    });
  });
});
