import { sunAt, labelFromScore, deg, clamp } from "@/app/lib/sun";

export const runtime = "nodejs";

type SunScoreParams = {
  hours?: number;
  now?: string; // ISO string
};

type CafeWithScores = {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  labelByHour: string[];
  scoreByHour: number[];
};

async function fetchParisWeatherHourly(startTime: Date, hours: number) {
  const startISO = startTime.toISOString().split('T')[0]; // YYYY-MM-DD
  const endDate = new Date(startTime.getTime() + hours * 60 * 60 * 1000);
  const endISO = endDate.toISOString().split('T')[0];
  
  const url = `https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&hourly=cloudcover,direct_radiation&timezone=Europe%2FParis&start_date=${startISO}&end_date=${endISO}`;
  
  const res = await fetch(url);
  const data = await res.json();
  
  const hourlyTimes = data.hourly?.time ?? [];
  const cloudCover = data.hourly?.cloudcover ?? [];
  const directRadiation = data.hourly?.direct_radiation ?? [];
  
  // Find the starting hour index
  const startHour = startTime.getHours();
  const startIndex = hourlyTimes.findIndex((time: string) => {
    const hour = new Date(time).getHours();
    return hour >= startHour;
  });
  
  if (startIndex === -1) return [];
  
  const result = [];
  for (let i = 0; i < hours && (startIndex + i) < hourlyTimes.length; i++) {
    const idx = startIndex + i;
    result.push({
      time: hourlyTimes[idx],
      cloudCover: cloudCover[idx] ?? 0,
      directRadiation: directRadiation[idx] ?? 0,
    });
  }
  
  return result;
}

async function fetchCafes() {
  // Use internal API call in development
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'http://localhost:3000';
  
  try {
    const res = await fetch(`${baseUrl}/api/cafes`);
    if (!res.ok) throw new Error(`Cafes API ${res.status}`);
    const data = await res.json();
    return data.cafes ?? [];
  } catch (err) {
    console.error('Failed to fetch cafes:', err);
    // Fallback to empty array rather than failing
    return [];
  }
}

function computeCafeOrientation(cafe: any): number {
  // Phase 1 heuristic: basic orientation guess
  // For now, assume most Parisian cafés face south/southwest (good sun exposure)
  // In Phase 1.1, we'll use building edges and road bearings
  
  // Simple heuristic based on location:
  // - Cafés near major boulevards often face the street
  // - Most Paris streets run roughly E-W or N-S
  // - Default to south-facing (180°) for best sun exposure
  
  const defaultAzimuth = 180; // degrees, facing south
  return defaultAzimuth;
}

function computeSunScore(
  sunAzimuth: number, // radians
  sunElevation: number, // radians  
  cafeOrientation: number, // degrees
  cloudCover: number, // 0-100
  directRadiation: number // W/m²
): number {
  const sunAzimuthDeg = deg(sunAzimuth);
  const sunElevationDeg = deg(sunElevation);
  
  // Convert cafe orientation to match sun azimuth convention
  // suncalc: 0 = south, π = north, -π/2 = east, π/2 = west
  const cafeAzimuthRad = (cafeOrientation - 180) * Math.PI / 180;
  
  // How well-aligned is the cafe with the sun?
  const azimuthDiff = Math.abs(sunAzimuth - cafeAzimuthRad);
  const normalizedDiff = Math.min(azimuthDiff, 2 * Math.PI - azimuthDiff); // [0, π]
  const facingScore = Math.max(0, Math.cos(normalizedDiff)); // 1 = perfect alignment, 0 = perpendicular
  
  // Sun elevation factor (low sun = less useful)
  const elevScore = clamp((sunElevationDeg - 8) / 20, 0, 1); // fade in above 8°, cap around 28°
  
  // Cloud penalty (100% clouds = no direct sun)
  const cloudPenalty = 1 - (cloudCover / 100);
  
  // Direct radiation bonus (if available)
  const radiationBonus = directRadiation > 100 ? 1.1 : 1.0;
  
  // Basic shadow penalty (Phase 1: very simple)
  // In dense Paris areas, assume some shadow risk
  const shadowPenalty = 0.9; // 10% penalty for potential shadows
  
  let score = facingScore * elevScore * cloudPenalty * radiationBonus * shadowPenalty;
  
  // Sun too low = no score
  if (sunElevationDeg < 5) score = 0;
  
  return clamp(score, 0, 1);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hours = parseInt(url.searchParams.get('hours') ?? '8');
  const nowParam = url.searchParams.get('now');
  
  const now = nowParam ? new Date(nowParam) : new Date();
  const maxHours = Math.min(hours, 12); // cap at 12 hours
  
  try {
    // Fetch weather and cafes in parallel
    const [weatherData, cafes] = await Promise.all([
      fetchParisWeatherHourly(now, maxHours),
      fetchCafes()
    ]);
    
    if (weatherData.length === 0) {
      throw new Error('No weather data available');
    }
    
    const hourlyISO = weatherData.map(w => w.time);
    const cafesWithScores: CafeWithScores[] = [];
    
    for (const cafe of cafes) {
      const cafeOrientation = computeCafeOrientation(cafe);
      const scoreByHour: number[] = [];
      const labelByHour: string[] = [];
      
      for (let i = 0; i < weatherData.length; i++) {
        const weather = weatherData[i];
        const hourTime = new Date(weather.time);
        
        const { azimuth, elevation } = sunAt(hourTime);
        const score = computeSunScore(
          azimuth,
          elevation,
          cafeOrientation,
          weather.cloudCover,
          weather.directRadiation
        );
        
        scoreByHour.push(score);
        labelByHour.push(labelFromScore(score));
      }
      
      cafesWithScores.push({
        id: cafe.id,
        name: cafe.name,
        lat: cafe.lat,
        lon: cafe.lon,
        labelByHour,
        scoreByHour,
      });
    }
    
    const response = {
      updatedAt: new Date().toISOString(),
      hours: hourlyISO,
      cafes: cafesWithScores,
      meta: {
        totalCafes: cafesWithScores.length,
        hoursComputed: maxHours,
        weatherSource: "open-meteo",
        orientationMethod: "heuristic-v1"
      }
    };
    
    return new Response(JSON.stringify(response), {
      headers: { 
        "content-type": "application/json",
        "cache-control": "public, max-age=300" // 5min cache
      },
    });
    
  } catch (err: any) {
    console.error("Sunscore API error:", err);
    return new Response(JSON.stringify({ 
      error: "sunscore_failed", 
      message: err.message 
    }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
