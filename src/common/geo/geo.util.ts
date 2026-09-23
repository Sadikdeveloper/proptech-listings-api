import { BoundingBox, GeoPoint, LongitudeRange } from '../types/geo.types';

export const EARTH_RADIUS_KM = 6371.0088;

/** Mean length of one degree of latitude/hongitude at the equator, in km. */
export const KM_PER_DEGREE = (Math.PI / 180) * EARTH_RADIUS_KM;

export const MAX_RADIUS_KM = 20000;
export const MIN_RADIUS_KM = 0.1;

const DEGREE_EPSILON = 1e-9;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampLatitude(latitude: number): number {
  return clamp(latitude, -90, 90);
}

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in kilometres (haversine). */
export function haversineKm(from: GeoPoint, to: GeoPoint): number {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLng = toRadians(to.longitude - from.longitude);

  const h =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function roundKm(value: number, precision = 3): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

/**
 * Bounding box that fully contains the circle. It is deliberately generous:
 * a superset is safe, a subset would silently drop valid listings.
 */
export function boundingBox(center: GeoPoint, radiusKm: number): BoundingBox {
  const latitude = clampLatitude(center.latitude);
  const latitudeDelta = radiusKm / KM_PER_DEGREE;

  const minLatitude = clampLatitude(latitude - latitudeDelta);
  const maxLatitude = clampLatitude(latitude + latitudeDelta);

  // Widen the longitude span using the edge of the box that is closest to a
  // pole, where a degree of longitude covers the fewest kilometres.
  const worstLatitude = Math.max(Math.abs(minLatitude), Math.abs(maxLatitude));
  const kmPerDegreeLongitude = KM_PER_DEGREE * Math.cos(toRadians(worstLatitude));

  if (kmPerDegreeLongitude <= DEGREE_EPSILON || minLatitude <= -90 || maxLatitude >= 90) {
    return { minLatitude, maxLatitude, longitudeRanges: [] };
  }

  const longitudeDelta = Math.min(180, radiusKm / kmPerDegreeLongitude);
  if (longitudeDelta >= 180) {
    return { minLatitude, maxLatitude, longitudeRanges: [] };
  }

  const minLongitude = center.longitude - longitudeDelta;
  const maxLongitude = center.longitude + longitudeDelta;

  let longitudeRanges: LongitudeRange[];
  if (maxLongitude > 180) {
    longitudeRanges = [
      { min: minLongitude, max: 180 },
      { min: -180, max: maxLongitude - 360 },
    ];
  } else if (minLongitude < -180) {
    longitudeRanges = [
      { min: minLongitude + 360, max: 180 },
      { min: -180, max: maxLongitude },
    ];
  } else {
    longitudeRanges = [{ min: minLongitude, max: maxLongitude }];
  }

  return { minLatitude, maxLatitude, longitudeRanges };
}
