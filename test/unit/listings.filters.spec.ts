import { Prisma } from '@prisma/client';
import {
  toGeoSearchParams,
  toListingSearchFilters,
  toPrismaOrderBy,
  toPrismaWhere,
} from '../../src/listings/listings.filters';
import { SearchListingsQueryDto } from '../../src/listings/dto/search-listings-query.dto';
import { ListingsQueryDto } from '../../src/listings/dto/listings-query.dto';

function query(overrides: Partial<ListingsQueryDto> = {}): ListingsQueryDto {
  return Object.assign(new ListingsQueryDto(), { page: 1, limit: 20, sortOrder: 'desc' }, overrides);
}

describe('listings.filters', () => {
  describe('toListingSearchFilters', () => {
    it('keeps only the provided filters', () => {
      expect(toListingSearchFilters(query())).toEqual({ sortOrder: 'desc' });

      expect(toListingSearchFilters(query({ type: 'rent', minPrice: 100, sortBy: 'price' }))).toEqual({
        type: 'rent',
        minPrice: 100,
        sortBy: 'price',
        sortOrder: 'desc',
      });
    });

    it('defaults the sort direction when it is missing', () => {
      const withoutOrder = { ...query(), sortOrder: undefined } as unknown as ListingsQueryDto;

      expect(toListingSearchFilters(withoutOrder).sortOrder).toBe('desc');
    });
  });

  describe('toGeoSearchParams', () => {
    it('returns undefined without a centre', () => {
      expect(toGeoSearchParams(new SearchListingsQueryDto())).toBeUndefined();
      expect(toGeoSearchParams(Object.assign(new SearchListingsQueryDto(), { lat: 6.4 }))).toBeUndefined();
    });

    it('applies the default radius and honours an explicit one', () => {
      expect(
        toGeoSearchParams(Object.assign(new SearchListingsQueryDto(), { lat: 6.4, lng: 3.4 })),
      ).toEqual({ center: { latitude: 6.4, longitude: 3.4 }, radiusKm: 5 });

      expect(
        toGeoSearchParams(
          Object.assign(new SearchListingsQueryDto(), { lat: 6.4, lng: 3.4, radiusKm: 2.5 }),
        ),
      ).toEqual({ center: { latitude: 6.4, longitude: 3.4 }, radiusKm: 2.5 });
    });
  });

  describe('toPrismaWhere', () => {
    it('maps every filter to its column', () => {
      const where = toPrismaWhere({
        type: 'sale',
        minPrice: 1000,
        maxPrice: 5000,
        bedrooms: 3,
        agentId: '3f1a8e42-2f4e-4b4a-9f3e-1c2b3a4d5e6f',
        sortOrder: 'asc',
      });

      expect(where).toEqual({
        type: 'SALE',
        price: { gte: new Prisma.Decimal(1000), lte: new Prisma.Decimal(5000) },
        bedrooms: 3,
        agentId: '3f1a8e42-2f4e-4b4a-9f3e-1c2b3a4d5e6f',
      });
    });

    it('combines an exact bedroom count with a lower bound', () => {
      expect(toPrismaWhere({ bedrooms: 3, minBedrooms: 2, sortOrder: 'desc' }).bedrooms).toEqual({
        equals: 3,
        gte: 2,
      });
    });

    it('produces an empty filter when nothing is set', () => {
      expect(toPrismaWhere({ sortOrder: 'desc' })).toEqual({});
    });
  });

  describe('toPrismaOrderBy', () => {
    it('always ends with id so pages stay stable', () => {
      expect(toPrismaOrderBy({ sortOrder: 'desc' })).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
      expect(toPrismaOrderBy({ sortBy: 'price', sortOrder: 'asc' })).toEqual([
        { price: 'asc' },
        { id: 'asc' },
      ]);
    });
  });
});
