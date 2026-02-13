/**
 * Calculate the Haversine distance between two lat/lng points in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/** Average drone speed in km/h */
const DRONE_SPEED_KMH = 60;

/**
 * Calculate estimated time of arrival in minutes.
 */
export function calculateETA(
  droneLat: number,
  droneLng: number,
  destLat: number,
  destLng: number,
): number {
  const distance = haversineDistance(droneLat, droneLng, destLat, destLng);
  const hours = distance / DRONE_SPEED_KMH;
  return Math.round(hours * 60 * 100) / 100; // minutes, rounded to 2 decimal places
}
