import { ListingType as PrismaListingType, Prisma } from '@prisma/client';
import { PaginatedResult, SortDirection } from '../common/types/api.types';
import { GeoSearchParams, GeoPoint } from '../common/types/geo.types';

export const LISTING_TYPES = ['rent', 'sale', 'shortlet'] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const LISTING_SORT_FIELDS = ['createdAt', 'updatedAt', 'price', 'bedrooms'] as const;
export type ListingSortField = (typeof LISTING_SORT_FIELDS)[number];

/** Upper bound that still fits in a `numeric(14, 2)` column. */
export const MAX_PRICE = 999_999_999_999.99;
export const MAX_BEDROOMS = 50;

export const LISTING_TYPE_TO_PRISMA: Record<ListingType, PrismaListingType> = {
  rent: 'RENT',
  sale: 'SALE',
  shortlet: 'SHORTLET',
};

export const LISTING_TYPE_FROM_PRISMA: Record<PrismaListingType, ListingType> = {
  RENT: 'rent',
  SALE: 'sale',
  SHORTLET: 'shortlet',
};

export interface ListingAgentSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface ListingEntity {
  id: string;
  title: string;
  description: string | null;
  price: number;
  currency: string;
  type: ListingType;
  bedrooms: number;
  agentId: string;
  location: GeoPoint;
  distanceKm?: number;
  agent?: ListingAgentSummary;
  createdAt: string;
  updatedAt: string;
}

export interface ListingSearchFilters {
  type?: ListingType;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  minBedrooms?: number;
  agentId?: string;
  sortBy?: ListingSortField;
  sortOrder: SortDirection;
  geo?: GeoSearchParams;
}

export type ListingRecord = Prisma.ListingGetPayload<{ include: { agent: true } }>;

/** Shape returned by the raw radius query (snake_case columns from Postgres). */
export interface ListingSearchRow {
  id: string;
  title: string;
  description: string | null;
  price: string | number;
  currency: string;
  type: PrismaListingType;
  bedrooms: number;
  latitude: number;
  longitude: number;
  agent_id: string;
  created_at: Date;
  updated_at: Date;
  agent_name: string;
  agent_email: string;
  agent_phone: string | null;
  distance_km: string | number | null;
}

export type PaginatedListings = PaginatedResult<ListingEntity>;
