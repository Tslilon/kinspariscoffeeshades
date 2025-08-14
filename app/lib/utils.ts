export async function getParisWeather() {
  const latitude = 48.8566;
  const longitude = 2.3522;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&timezone=Europe%2FParis`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  const json = await res.json();

  const tempC = json?.current?.temperature_2m ?? null;
  const tempF = typeof tempC === "number" ? tempC * 9/5 + 32 : null;

  return {
    location: { name: "Paris, FR" },
    current: { temp_c: tempC, temp_f: tempF },
    raw: json,
  } as const;
}

/**
 * Calculate the distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format distance for display
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
