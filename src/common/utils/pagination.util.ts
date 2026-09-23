import { PaginatedResult, PaginationMeta, PaginationRequest } from '../types/api.types';

export function buildPaginationMeta(total: number, { page, limit }: PaginationRequest): PaginationMeta {
  const safeTotal = Math.max(0, Math.trunc(total));
  const totalPages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / limit);

  return {
    page,
    limit,
    total: safeTotal,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && safeTotal > 0,
  };
}

export function toSkip({ page, limit }: PaginationRequest): number {
  return (page - 1) * limit;
}

export function paginate<T>(items: T[], meta: PaginationMeta): PaginatedResult<T> {
  return { data: items, meta };
}
