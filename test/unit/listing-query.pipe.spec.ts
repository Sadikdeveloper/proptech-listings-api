import { BadRequestException } from '@nestjs/common';
import { ListingQueryValidationPipe } from '../../src/common/pipes/listing-query-validation.pipe';

describe('ListingQueryValidationPipe', () => {
  const pipe = new ListingQueryValidationPipe();

  it('passes a valid query through untouched', () => {
    const query = { lat: 6.4281, lng: 3.4219, radiusKm: 5, minPrice: 100, maxPrice: 900 };

    expect(pipe.transform(query)).toBe(query);
  });

  it('rejects an inverted price range with a field level detail', () => {
    expect(() => pipe.transform({ minPrice: 900, maxPrice: 100 })).toThrow(BadRequestException);

    try {
      pipe.transform({ minPrice: 900, maxPrice: 100 });
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as {
        code: string;
        details: Array<{ field: string }>;
      };
      expect(response.code).toBe('VALIDATION_FAILED');
      expect(response.details[0].field).toBe('maxPrice');
    }
  });

  it('rejects half a coordinate pair', () => {
    expect(() => pipe.transform({ lat: 6.4 })).toThrow(BadRequestException);
    expect(() => pipe.transform({ lng: 3.4 })).toThrow(BadRequestException);
    expect(() => pipe.transform({})).not.toThrow();
  });
});
