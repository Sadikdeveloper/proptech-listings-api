import { Prisma } from '@prisma/client';
import { boundingBox, EARTH_RADIUS_KM } from '../../common/geo/geo.util';
import { LISTING_TYPE_TO_PRISMA, ListingSearchFilters, ListingSortField } from './listings.types';

const EARTH_RADIUS_SQL = Prisma.raw(EARTH_RADIUS_KM.toFixed(4));

const LISTING_COLUMNS_SQL = Prisma.raw(
  [
    'l."id"',
    'l."title"',
    'l."description"',
    'l."price"',
    'l."currency"',
    'l."type"',
    'l."bedrooms"',
    'l."latitude"',
    'l."longitude"',
    'l."agent_id"',
    'l."created_at"',
    'l."updated_at"',
    'a."name" AS agent_name',
    'a."email" AS agent_email',
    'a."phone" AS agent_phone',
  ].join(', '),
);

const SORT_COLUMNS: Record<ListingSortField, Prisma.Sql> = {
  createdAt: Prisma.raw('l."created_at"'),
  updatedAt: Prisma.raw('l."updated_at"'),
  price: Prisma.raw('l."price"'),
  bedrooms: Prisma.raw('l."bedrooms"'),
};

/** Haversine distance in km between the centre and each listing. */
function distanceExpression(latitude: number, longitude: number): Prisma.Sql {
  return Prisma.sql`(
    ${EARTH_RADIUS_SQL} * 2 * asin(least(1, sqrt(
      power(sin(radians(${latitude}::float8 - l."latitude") / 2), 2) +
      cos(radians(${latitude}::float8)) * cos(radians(l."latitude")) *
      power(sin(radians(${longitude}::float8 - l."longitude") / 2), 2)
    )))
  )::float8`;
}

function buildConditions(filters: ListingSearchFilters, distance?: Prisma.Sql): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];

  if (filters.type) {
    conditions.push(Prisma.sql`l."type" = ${LISTING_TYPE_TO_PRISMA[filters.type]}::"ListingType"`);
  }
  if (filters.minPrice !== undefined) {
    conditions.push(Prisma.sql`l."price" >= ${filters.minPrice}::numeric`);
  }
  if (filters.maxPrice !== undefined) {
    conditions.push(Prisma.sql`l."price" <= ${filters.maxPrice}::numeric`);
  }
  if (filters.bedrooms !== undefined) {
    conditions.push(Prisma.sql`l."bedrooms" = ${filters.bedrooms}::int`);
  }
  if (filters.minBedrooms !== undefined) {
    conditions.push(Prisma.sql`l."bedrooms" >= ${filters.minBedrooms}::int`);
  }
  if (filters.agentId !== undefined) {
    conditions.push(Prisma.sql`l."agent_id" = ${filters.agentId}::uuid`);
  }

  if (filters.geo) {
    const { center, radiusKm } = filters.geo;
    const box = boundingBox(center, radiusKm);

    // Index friendly pre-filter; the exact circle test below still decides.
    conditions.push(
      Prisma.sql`l."latitude" BETWEEN ${box.minLatitude}::float8 AND ${box.maxLatitude}::float8`,
    );

    if (box.longitudeRanges.length === 1) {
      const [range] = box.longitudeRanges;
      conditions.push(
        Prisma.sql`l."longitude" BETWEEN ${range.min}::float8 AND ${range.max}::float8`,
      );
    } else if (box.longitudeRanges.length > 1) {
      conditions.push(
        Prisma.sql`(${Prisma.join(
          box.longitudeRanges.map(
            (range) =>
              Prisma.sql`l."longitude" BETWEEN ${range.min}::float8 AND ${range.max}::float8`,
          ),
          ' OR ',
        )})`,
      );
    }

    if (distance) {
      conditions.push(Prisma.sql`${distance} <= ${radiusKm}::float8`);
    }
  }

  return conditions;
}

function buildWhereClause(filters: ListingSearchFilters, distance?: Prisma.Sql): Prisma.Sql {
  const conditions = buildConditions(filters, distance);
  return conditions.length > 0
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;
}

function buildOrderBy(filters: ListingSearchFilters, hasDistance: boolean): Prisma.Sql {
  const direction = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';

  if (!filters.sortBy && hasDistance) {
    return Prisma.raw('ORDER BY distance_km ASC, l."id" ASC');
  }

  const column = SORT_COLUMNS[filters.sortBy ?? 'createdAt'];
  return Prisma.sql`ORDER BY ${column} ${Prisma.raw(direction)}, l."id" ASC`;
}

export function buildRadiusCountQuery(filters: ListingSearchFilters): Prisma.Sql {
  const distance = filters.geo
    ? distanceExpression(filters.geo.center.latitude, filters.geo.center.longitude)
    : Prisma.empty;

  return Prisma.sql`SELECT count(*)::bigint AS total FROM "listings" l ${buildWhereClause(filters, distance)}`;
}

export function buildRadiusPageQuery(
  filters: ListingSearchFilters,
  { limit, offset }: { limit: number; offset: number },
): Prisma.Sql {
  if (!filters.geo) {
    throw new Error('buildRadiusPageQuery requires a geo filter');
  }

  const distance = distanceExpression(filters.geo.center.latitude, filters.geo.center.longitude);

  return Prisma.sql`
    SELECT ${LISTING_COLUMNS_SQL}, ${distance} AS distance_km
    FROM "listings" l
    JOIN "agents" a ON a."id" = l."agent_id"
    ${buildWhereClause(filters, distance)}
    ${buildOrderBy(filters, true)}
    LIMIT ${limit} OFFSET ${offset}
  `;
}
