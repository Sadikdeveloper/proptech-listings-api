import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginationRequest } from '../../common/types/api.types';
import { buildPaginationMeta, toSkip } from '../../common/utils/pagination.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingsQueryDto } from './dto/listings-query.dto';
import { SearchListingsQueryDto } from './dto/search-listings-query.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { toGeoSearchParams, toListingSearchFilters, toPrismaOrderBy, toPrismaWhere } from './listings.filters';
import { toListingEntity, toListingEntityFromRow, toListingCreateInput, toListingUpdateInput } from './listings.mapper';
import { buildRadiusCountQuery, buildRadiusPageQuery } from './listings.query';
import {
  ListingEntity,
  ListingRecord,
  ListingSearchFilters,
  ListingSearchRow,
  PaginatedListings,
} from './listings.types';

interface CountRow {
  total: string | number;
}

function toPagination(query: PaginationQueryDto): PaginationRequest {
  return { page: query.page, limit: query.limit };
}

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agentsService: AgentsService,
  ) {}

  async create(dto: CreateListingDto): Promise<ListingEntity> {
    await this.assertAgentExists(dto.agentId);

    const record = await this.prisma.listing.create({
      data: toListingCreateInput(dto),
      include: { agent: true },
    });

    return toListingEntity(record);
  }

  async findAll(query: ListingsQueryDto): Promise<PaginatedListings> {
    return this.runSearch(toListingSearchFilters(query), toPagination(query));
  }

  async search(query: SearchListingsQueryDto): Promise<PaginatedListings> {
    const geo = toGeoSearchParams(query);
    const filters: ListingSearchFilters = {
      ...toListingSearchFilters(query),
      ...(geo ? { geo } : {}),
    };

    return this.runSearch(filters, toPagination(query));
  }

  async findOne(id: string): Promise<ListingEntity> {
    return toListingEntity(await this.findRecordOrFail(id));
  }

  async update(id: string, dto: UpdateListingDto): Promise<ListingEntity> {
    await this.findRecordOrFail(id);

    if (dto.agentId !== undefined) {
      await this.assertAgentExists(dto.agentId);
    }

    const record = await this.prisma.listing.update({
      where: { id },
      data: toListingUpdateInput(dto),
      include: { agent: true },
    });

    return toListingEntity(record);
  }

  async remove(id: string): Promise<void> {
    await this.findRecordOrFail(id);
    await this.prisma.listing.delete({ where: { id } });
  }

  private async runSearch(
    filters: ListingSearchFilters,
    pagination: PaginationRequest,
  ): Promise<PaginatedListings> {
    return filters.geo
      ? this.searchWithinRadius(filters, pagination)
      : this.searchWithFilters(filters, pagination);
  }

  private async searchWithFilters(
    filters: ListingSearchFilters,
    { page, limit }: PaginationRequest,
  ): Promise<PaginatedListings> {
    const where = toPrismaWhere(filters);

    const [records, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        include: { agent: true },
        orderBy: toPrismaOrderBy(filters),
        skip: toSkip({ page, limit }),
        take: limit,
      }),
      this.prisma.listing.count({ where }),
    ]);

    return {
      data: records.map((record) => toListingEntity(record)),
      meta: buildPaginationMeta(total, { page, limit }),
    };
  }

  /**
   * Radius search runs as raw SQL because the distance has to be computed and
   * ordered by in the database; filtering in application code would break
   * pagination totals as soon as the result set outgrows memory.
   */
  private async searchWithinRadius(
    filters: ListingSearchFilters,
    { page, limit }: PaginationRequest,
  ): Promise<PaginatedListings> {
    const [countRows, rows] = await this.prisma.$transaction([
      this.prisma.$queryRaw<CountRow[]>(buildRadiusCountQuery(filters)),
      this.prisma.$queryRaw<ListingSearchRow[]>(
        buildRadiusPageQuery(filters, { limit, offset: toSkip({ page, limit }) }),
      ),
    ]);

    const total = Number(countRows[0]?.total ?? 0);

    return {
      data: rows.map((row) => toListingEntityFromRow(row)),
      meta: buildPaginationMeta(total, { page, limit }),
    };
  }

  private async findRecordOrFail(id: string): Promise<ListingRecord> {
    const record = await this.prisma.listing.findUnique({
      where: { id },
      include: { agent: true },
    });

    if (!record) {
      throw new NotFoundException(`Listing with id "${id}" was not found`);
    }

    return record;
  }

  private async assertAgentExists(agentId: string): Promise<void> {
    const exists = await this.agentsService.exists(agentId);
    if (!exists) {
      throw new NotFoundException(`Agent with id "${agentId}" was not found`);
    }
  }
}
