import {
  haversineDistance,
  calculateETA,
} from '../../src/common/utils/geo.utils';

describe('Geo Utils', () => {
  describe('haversineDistance', () => {
    it('should return 0 for same point', () => {
      const distance = haversineDistance(24.7136, 46.6753, 24.7136, 46.6753);
      expect(distance).toBe(0);
    });

    it('should calculate correct approximate distance (Riyadh to Jeddah ~949km)', () => {
      const distance = haversineDistance(24.7136, 46.6753, 21.3891, 39.8579);
      expect(distance).toBeGreaterThan(700);
      expect(distance).toBeLessThan(1000);
    });

    it('should be symmetric', () => {
      const d1 = haversineDistance(24.7136, 46.6753, 21.3891, 39.8579);
      const d2 = haversineDistance(21.3891, 39.8579, 24.7136, 46.6753);
      expect(d1).toBeCloseTo(d2, 5);
    });
  });

  describe('calculateETA', () => {
    it('should return 0 for same location', () => {
      const eta = calculateETA(24.7136, 46.6753, 24.7136, 46.6753);
      expect(eta).toBe(0);
    });

    it('should return positive ETA for different locations', () => {
      const eta = calculateETA(24.7136, 46.6753, 21.3891, 39.8579);
      expect(eta).toBeGreaterThan(0);
    });

    it('should return value in minutes', () => {
      // At 60 km/h, 60 km should take ~60 minutes
      // approx 1 degree latitude ≈ 111 km
      const eta = calculateETA(0, 0, 0.54, 0); // ~60 km
      expect(eta).toBeGreaterThan(50);
      expect(eta).toBeLessThan(70);
    });
  });
});
