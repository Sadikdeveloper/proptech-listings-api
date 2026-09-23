import { buildPaginationMeta, toSkip } from '../../src/common/utils/pagination.util';

describe('pagination.util', () => {
  it('computes meta for a middle page', () => {
    expect(buildPaginationMeta(42, { page: 2, limit: 20 })).toEqual({
      page: 2,
      limit: 20,
      total: 42,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('handles an empty result set', () => {
    expect(buildPaginationMeta(0, { page: 1, limit: 20 })).toMatchObject({
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('does not report a previous page on the first page', () => {
    expect(buildPaginationMeta(10, { page: 1, limit: 5 }).hasPreviousPage).toBe(false);
  });

  it('reports no next page on the last page', () => {
    expect(buildPaginationMeta(10, { page: 2, limit: 5 }).hasNextPage).toBe(false);
  });

  it('ignores nonsense totals instead of producing NaN', () => {
    expect(buildPaginationMeta(-5, { page: 1, limit: 10 }).total).toBe(0);
  });

  it('translates page numbers into offsets', () => {
    expect(toSkip({ page: 1, limit: 20 })).toBe(0);
    expect(toSkip({ page: 3, limit: 15 })).toBe(30);
  });
});
