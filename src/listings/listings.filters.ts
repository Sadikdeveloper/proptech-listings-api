import { Prisma } from '@prisma/client';
import { GeoSearchParams } from '../common/types/geo.types';
import { ListingsQueryDto } from './dto/listings-query.dto';
import { DEFAULT_RADIUS_KM, SearchListingsQueryDto } from './dto/search-listings-query.dto';
import {
  LISTING_TYPE_TO_PRISMA,
  ListingSearchFilters,
  ListingSortField,
} from './listings.types';

export function toListingSearchFilters(query: ListingsQueryDto): ListingSearchFilters {
  return {
    ...(query.type !== undefined ? { type: query.type } : {}),
    ...(query.minPrice !== undefined ? { minPrice: query.minPrice } : {}),
    ...(query.maxPrice !== undefined ? { maxPrice: query.maxPrice } : {}),
    ...(query.bedrooms !== undefined ? { bedrooms: query.bedrooms } : {}),
    ...(query.minBedrooms !== undefined ? { minBedrooms: query.minBedrooms } : {}),
    ...(query.agentId !== undefined ? { agentId: query.agentId } : {}),
    ...(query.sortBy !== undefined ? { sortBy: query.sortBy } : {}),
    sortOrder: query.sortOrder ?? 'desc',
  };
}

export function toGeoSearchParams(query: SearchListingsQueryDto): GeoSearchParams | undefined {
  if (query.lat === undefined || query.lng === undefined) {
    return undefined;
  }
  return {
    center: { latitude: query.lat, longitude: query.lng },
    radiusKm: query.radiusKm ?? DEFAULT_RADIUS_KM,
  };
}

export function toPrismaWhere(filters: ListingSearchFilters): Prisma.ListingWhereInput {
  const priceFilter: Prisma.DecimalFilter | undefined =
    filters.minPrice === undefined && filters.maxPrice === undefined
      ? undefined
      : {
          ...(filters.minPrice !== undefined ? { gte: new Prisma.Decimal(filters.minPrice) } : {}),
          ...(filters.maxPrice !== undefined ? { lte: new Prisma.Decimal(filters.maxPrice) } : {}),
        };

  const bedroomsFilter: Prisma.IntFilter | number | undefined =
    filters.bedrooms !== undefined && filters.minBedrooms !== undefined
      ? { equals: filters.bedrooms, gte: filters.minBedrooms }
      : (filters.bedrooms ?? (filters.minBedrooms !== undefined ? { gte: filters.minBedrooms } : undefined));

  return {
    ...(filters.type ? { type: LISTING_TYPE_TO_PRISMA[filters.type] } : {}),
    ...(priceFilter ? { price: priceFilter } : {}),
    ...(bedroomsFilter !== undefined ? { bedrooms: bedroomsFilter } : {}),
    ...(filters.agentId !== undefined ? { agentId: filters.agentId } : {}),
  };
}

/**
 * `id` is always the last key so equal sort values keep a stable order across
 * pages (otherwise rows can repeat or disappear between requests).
 */
export function toPrismaOrderBy(
  filters: ListingSearchFilters,
): Prisma.ListingOrderByWithRelationInput[] {
  const sortBy: ListingSortField = filters.sortBy ?? 'createdAt';
  return [{ [sortBy]: filters.sortOrder }, { id: 'asc' }];
}
