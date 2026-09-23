import {
  boundingBox,
  clampLatitude,
  EARTH_RADIUS_KM,
  haversineKm,
  roundKm,
} from '../../src/common/geo/geo.util';
import { BoundingBox, GeoPoint } from '../../src/common/types/geo.types';

function isInsideBox(point: GeoPoint, box: BoundingBox): boolean {
  if (point.latitude < box.minLatitude || point.latitude > box.maxLatitude) {
    return false;
  }
  if (box.longitudeRanges.length === 0) {
    return true;
  }
  return box.longitudeRanges.some(
    (range) => point.longitude >= range.min && point.longitude <= range.max,
  );
}

function destination(origin: GeoPoint, distanceKm: number, bearingDeg: number): GeoPoint {
  const angular = distanceKm / EARTH_RADIUS_KM;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (origin.latitude * Math.PI) / 180;
  const lng1 = (origin.longitude * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    latitude: (lat2 * 180) / Math.PI,
    longitude: ((((lng2 * 180) / Math.PI + 540) % 360) - 180),
  };
}

describe('geo.util', () => {
  describe('haversineKm', () => {
    it('is zero for identical points', () => {
      expect(haversineKm({ latitude: 6.4281, longitude: 3.4219 }, { latitude: 6.4281, longitude: 3.4219 })).toBe(0);
    });

    it('matches a known distance (Lagos to Abuja is ~537 km)', () => {
      const distance = haversineKm(
        { latitude: 6.4281, longitude: 3.4219 },
        { latitude: 9.0765, longitude: 7.4896 },
      );

      expect(distance).toBeGreaterThan(520);
      expect(distance).toBeLessThan(560);
    });

    it('is symmetric and handles antipodal points', () => {
      const a = { latitude: 51.5074, longitude: -0.1278 };
      const b = { latitude: -33.8688, longitude: 151.2093 };

      expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);

      const antipodal = haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 });
      expect(antipodal).toBeCloseTo(Math.PI * EARTH_RADIUS_KM, 3);
    });

    it('measures 1 degree of latitude as ~111 km', () => {
      expect(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(
        111.19,
        1,
      );
    });
  });

  describe('boundingBox', () => {
    it('contains every point within the radius (property check over 500 samples)', () => {
      const centres: GeoPoint[] = [
        { latitude: 6.4281, longitude: 3.4219 }, // Lagos
        { latitude: 0, longitude: 0 }, // equator
        { latitude: 60.1699, longitude: 24.9384 }, // Helsinki
        { latitude: -41.2865, longitude: 174.7762 }, // Wellington
        { latitude: 89.5, longitude: 10 }, // close to the north pole
        { latitude: -89.7, longitude: -170 }, // close to the south pole
        { latitude: 0, longitude: 179.5 }, // dateline
      ];
      const radii = [0.5, 5, 50, 500, 2000];

      for (const centre of centres) {
        for (const radiusKm of radii) {
          const box = boundingBox(centre, radiusKm);

          for (let sample = 0; sample < 500; sample += 1) {
            const bearing = (sample / 500) * 360;
            const distance = (radiusKm * sample) / 500;
            const point = destination(centre, distance, bearing);

            const actual = haversineKm(centre, point);
            expect(actual).toBeLessThanOrEqual(radiusKm + 0.001);
            expect(isInsideBox(point, box)).toBe(true);
          }
        }
      }
    });

    it('keeps the box tight enough to be useful for a small radius', () => {
      const box = boundingBox({ latitude: 0, longitude: 0 }, 1);

      expect(box.minLatitude).toBeCloseTo(-0.008993, 5);
      expect(box.maxLatitude).toBeCloseTo(0.008993, 5);
      expect(box.longitudeRanges).toHaveLength(1);
      expect(box.longitudeRanges[0].min).toBeCloseTo(-0.008993, 4);
    });

    it('splits the longitude range across the antimeridian', () => {
      const box = boundingBox({ latitude: 0, longitude: 179.9 }, 50);

      expect(box.longitudeRanges).toHaveLength(2);
      expect(box.longitudeRanges[0].max).toBe(180);
      expect(box.longitudeRanges[1].min).toBe(-180);
      expect(isInsideBox({ latitude: 0, longitude: 179.99 }, box)).toBe(true);
      expect(isInsideBox({ latitude: 0, longitude: -179.99 }, box)).toBe(true);
      expect(isInsideBox({ latitude: 0, longitude: 0 }, box)).toBe(false);
    });

    it('drops the longitude constraint when the circle reaches a pole', () => {
      const box = boundingBox({ latitude: 89.99, longitude: 45 }, 50);

      expect(box.maxLatitude).toBe(90);
      expect(box.longitudeRanges).toEqual([]);
      expect(isInsideBox({ latitude: 90, longitude: -120 }, box)).toBe(true);
    });

    it('never exceeds the valid coordinate range', () => {
      const box = boundingBox({ latitude: 80, longitude: 170 }, 5000);

      expect(box.minLatitude).toBeGreaterThanOrEqual(-90);
      expect(box.maxLatitude).toBeLessThanOrEqual(90);
      for (const range of box.longitudeRanges) {
        expect(range.min).toBeGreaterThanOrEqual(-180);
        expect(range.max).toBeLessThanOrEqual(180);
      }
    });
  });

  it('clamps out of range latitudes and rounds distances', () => {
    expect(clampLatitude(120)).toBe(90);
    expect(clampLatitude(-120)).toBe(-90);
    expect(clampLatitude(12.5)).toBe(12.5);
    expect(roundKm(1.23456)).toBe(1.235);
    expect(roundKm(1.23456, 1)).toBe(1.2);
  });
});
