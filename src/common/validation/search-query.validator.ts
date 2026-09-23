import { SearchQueryShape, ValidationErrorDetail } from '../types/api.types';
import { MAX_RADIUS_KM, MIN_RADIUS_KM } from '../geo/geo.util';

/**
 * Cross-field rules that single-property decorators cannot express.
 */
export function collectSearchQueryErrors(query: SearchQueryShape): ValidationErrorDetail[] {
  const details: ValidationErrorDetail[] = [];

  if (
    query.minPrice !== undefined &&
    query.maxPrice !== undefined &&
    query.minPrice > query.maxPrice
  ) {
    details.push({
      field: 'maxPrice',
      messages: ['maxPrice must be greater than or equal to minPrice'],
    });
  }

  if (
    query.minBedrooms !== undefined &&
    query.bedrooms !== undefined &&
    query.minBedrooms > query.bedrooms
  ) {
    details.push({
      field: 'bedrooms',
      messages: ['bedrooms must be greater than or equal to minBedrooms'],
    });
  }

  const hasLatitude = query.lat !== undefined;
  const hasLongitude = query.lng !== undefined;

  if (hasLatitude !== hasLongitude) {
    details.push({
      field: hasLatitude ? 'lng' : 'lat',
      messages: ['lat and lng must be provided together to search by distance'],
    });
  }

  if (query.radiusKm !== undefined && !(hasLatitude && hasLongitude)) {
    details.push({
      field: 'radiusKm',
      messages: ['radiusKm can only be used together with lat and lng'],
    });
  }

  if (
    query.radiusKm !== undefined &&
    (query.radiusKm < MIN_RADIUS_KM || query.radiusKm > MAX_RADIUS_KM)
  ) {
    details.push({
      field: 'radiusKm',
      messages: [`radiusKm must be between ${MIN_RADIUS_KM} and ${MAX_RADIUS_KM}`],
    });
  }

  return details;
}
