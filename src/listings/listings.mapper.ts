import { Prisma } from '@prisma/client';
import { roundKm } from '../common/geo/geo.util';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import {
  LISTING_TYPE_FROM_PRISMA,
  LISTING_TYPE_TO_PRISMA,
  ListingEntity,
  ListingRecord,
  ListingSearchRow,
} from './listings.types';

function toNumber(price: Prisma.Decimal | string | number): number {
  return typeof price === 'number' ? price : Number(price.toString());
}

export function toListingCreateInput(dto: CreateListingDto): Prisma.ListingUncheckedCreateInput {
  return {
    title: dto.title,
    description: dto.description ?? null,
    price: new Prisma.Decimal(dto.price),
    currency: dto.currency ?? 'USD',
    type: LISTING_TYPE_TO_PRISMA[dto.type],
    bedrooms: dto.bedrooms,
    latitude: dto.location.latitude,
    longitude: dto.location.longitude,
    agentId: dto.agentId,
  };
}

export function toListingUpdateInput(dto: UpdateListingDto): Prisma.ListingUncheckedUpdateInput {
  return {
    ...(dto.title !== undefined ? { title: dto.title } : {}),
    ...(dto.description !== undefined ? { description: dto.description } : {}),
    ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
    ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
    ...(dto.type !== undefined ? { type: LISTING_TYPE_TO_PRISMA[dto.type] } : {}),
    ...(dto.bedrooms !== undefined ? { bedrooms: dto.bedrooms } : {}),
    ...(dto.location !== undefined
      ? { latitude: dto.location.latitude, longitude: dto.location.longitude }
      : {}),
    ...(dto.agentId !== undefined ? { agentId: dto.agentId } : {}),
  };
}

export function toListingEntity(record: ListingRecord, distanceKm?: number): ListingEntity {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    price: toNumber(record.price),
    currency: record.currency,
    type: LISTING_TYPE_FROM_PRISMA[record.type],
    bedrooms: record.bedrooms,
    agentId: record.agentId,
    location: { latitude: record.latitude, longitude: record.longitude },
    ...(distanceKm !== undefined ? { distanceKm: roundKm(distanceKm) } : {}),
    agent: {
      id: record.agent.id,
      name: record.agent.name,
      email: record.agent.email,
      phone: record.agent.phone,
    },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toListingEntityFromRow(row: ListingSearchRow): ListingEntity {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: toNumber(row.price),
    currency: row.currency,
    type: LISTING_TYPE_FROM_PRISMA[row.type],
    bedrooms: row.bedrooms,
    agentId: row.agent_id,
    location: { latitude: row.latitude, longitude: row.longitude },
    ...(row.distance_km !== null && row.distance_km !== undefined
      ? { distanceKm: roundKm(Number(row.distance_km)) }
      : {}),
    agent: {
      id: row.agent_id,
      name: row.agent_name,
      email: row.agent_email,
      phone: row.agent_phone,
    },
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
