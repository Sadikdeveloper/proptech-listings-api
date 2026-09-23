export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface LongitudeRange {
  min: number;
  max: number;
}

/**
 * Index friendly envelope around a radius search. `longitudeRanges` is empty
 * when the circle reaches a pole, in which case every longitude is valid.
 */
export interface BoundingBox {
  minLatitude: number;
  maxLatitude: number;
  longitudeRanges: LongitudeRange[];
}

export interface GeoSearchParams {
  center: GeoPoint;
  radiusKm: number;
}
