import SunCalc from "suncalc";

export function sunAt(dt: Date, lat = 48.8566, lon = 2.3522) {
  const pos = SunCalc.getPosition(dt, lat, lon);
  return {
    azimuth: pos.azimuth, // radians, 0 = south in suncalc
    elevation: pos.altitude, // radians
  };
}

export function labelFromScore(s: number, isAfterSunset: boolean = false) {
  if (isAfterSunset) return "🌙"; // after sunset
  if (s >= 0.6) return "☀️"; // sunny
  if (s >= 0.3) return "⛅"; // mixed/partial
  return "☁️"; // shade/cloudy
}

export function isAfterSunset(dt: Date, lat = 48.8566, lon = 2.3522): boolean {
  const sunTimes = SunCalc.getTimes(dt, lat, lon);
  return dt > sunTimes.sunset;
}

export const deg = (r: number) => (r * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;
export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export function circDiff(a: number, b: number) {
  // radians, return [0..π]
  let d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
}


