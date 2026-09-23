import { collectSearchQueryErrors } from '../../src/common/validation/search-query.validator';

function fields(query: Parameters<typeof collectSearchQueryErrors>[0]): string[] {
  return collectSearchQueryErrors(query).map((detail) => detail.field);
}

describe('collectSearchQueryErrors', () => {
  it('accepts a valid combination of filters', () => {
    expect(
      fields({
        minPrice: 100,
        maxPrice: 900,
        bedrooms: 3,
        minBedrooms: 2,
        lat: 6.4281,
        lng: 3.4219,
        radiusKm: 5,
      }),
    ).toEqual([]);
  });

  it('accepts an empty query', () => {
    expect(fields({})).toEqual([]);
  });

  it('flags an inverted price range', () => {
    expect(fields({ minPrice: 900, maxPrice: 100 })).toEqual(['maxPrice']);
  });

  it('allows minPrice equal to maxPrice', () => {
    expect(fields({ minPrice: 500, maxPrice: 500 })).toEqual([]);
  });

  it('flags an inverted bedroom range', () => {
    expect(fields({ minBedrooms: 4, bedrooms: 2 })).toEqual(['bedrooms']);
  });

  it('requires the coordinate pair to be complete', () => {
    expect(fields({ lat: 6.4 })).toEqual(['lng']);
    expect(fields({ lng: 3.4 })).toEqual(['lat']);
  });

  it('only allows a radius together with a centre', () => {
    expect(fields({ radiusKm: 5 })).toEqual(['radiusKm']);
    expect(fields({ lat: 6.4, radiusKm: 5 })).toEqual(['lng', 'radiusKm']);
    expect(fields({ lng: 3.4, radiusKm: 5 })).toEqual(['lat', 'radiusKm']);
    expect(fields({ lat: 6.4, lng: 3.4, radiusKm: 5 })).toEqual([]);
  });

  it('bounds the radius', () => {
    expect(fields({ lat: 6.4, lng: 3.4, radiusKm: 0.01 })).toEqual(['radiusKm']);
    expect(fields({ lat: 6.4, lng: 3.4, radiusKm: 20001 })).toEqual(['radiusKm']);
  });
});
