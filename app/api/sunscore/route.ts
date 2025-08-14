import { sunAt, labelFromScore, isAfterSunset, deg, clamp } from "@/app/lib/sun";
import { getVoxShadowValue, isVoxCityAvailable } from "@/app/lib/voxcity";
import type { VoxShadowResult } from "@/app/lib/voxcity";

export const runtime = "nodejs";

type SunScoreParams = {
  hours?: number;
  now?: string; // ISO string
  precision?: 'voxcity' | 'heuristic'; // calculation mode
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
  
  // Find the starting hour index based on Paris time
  const startHourParis = new Date(startTime.toLocaleString("en-US", {timeZone: "Europe/Paris"})).getHours();
  const startIndex = hourlyTimes.findIndex((time: string) => {
    // Parse the time string and get the hour
    const hour = parseInt(time.split('T')[1].split(':')[0]);
    return hour >= startHourParis;
  });
  
  if (startIndex === -1) return [];
  
  const result = [];
  for (let i = 0; i < hours && (startIndex + i) < hourlyTimes.length; i++) {
    const idx = startIndex + i;
    // Ensure the time is interpreted as Paris timezone
    const timeStr = hourlyTimes[idx];
    const parisTime = timeStr + (timeStr.includes('+') ? '' : '+02:00'); // Add timezone if missing
    
    result.push({
      time: parisTime,
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
  // Phase 1.1: improved orientation detection
  
  // If café has outdoor seating info, try to determine orientation
  if (cafe.tags?.outdoor_seating === "yes") {
    // Heuristic: cafés with outdoor seating often face main streets
    // Use location-based heuristics for Paris street grid
    
    const lat = cafe.lat;
    const lon = cafe.lon;
    
    // Major east-west boulevards (cafés likely face south/north)
    const eastWestStreets = [
      { name: "Champs-Élysées", lat: 48.8698, facingDir: 180 }, // faces south
      { name: "Boulevard Saint-Germain", lat: 48.8533, facingDir: 180 },
      { name: "Boulevard de la Bastille", lat: 48.8534, facingDir: 180 },
      { name: "Rue de Rivoli", lat: 48.8593, facingDir: 180 }
    ];
    
    // Major north-south avenues (cafés likely face east/west)  
    const northSouthStreets = [
      { name: "Boulevard Saint-Michel", lon: 2.3438, facingDir: 270 }, // faces west
      { name: "Avenue des Champs-Élysées", lon: 2.3084, facingDir: 90 }, // faces east
      { name: "Boulevard de Sébastopol", lon: 2.3483, facingDir: 270 }
    ];
    
    // Find closest major street and use its facing direction
    let closestDist = Infinity;
    let bestOrientation = 180; // default south
    
    for (const street of eastWestStreets) {
      const dist = Math.abs(lat - street.lat);
      if (dist < closestDist && dist < 0.01) { // within ~1km
        closestDist = dist;
        bestOrientation = street.facingDir;
      }
    }
    
    for (const street of northSouthStreets) {
      const dist = Math.abs(lon - street.lon);
      if (dist < closestDist && dist < 0.01) {
        closestDist = dist;
        bestOrientation = street.facingDir;
      }
    }
    
    return bestOrientation;
  }
  
  // Default heuristic based on location in Paris
  // Most cafés in central Paris face south or southwest for optimal light
  const lat = cafe.lat;
  const lon = cafe.lon;
  
  // Left Bank (south of Seine) - many face north toward river
  if (lat < 48.855) {
    return 0; // faces north
  }
  
  // Right Bank - default to south/southwest
  if (lon < 2.35) {
    return 225; // southwest
  } else {
    return 180; // south
  }
}

function computeSunScore(
  sunAzimuth: number, // radians
  sunElevation: number, // radians  
  cafeOrientation: number, // degrees
  cloudCover: number, // 0-100
  directRadiation: number, // W/m²
  cafeLat: number = 48.8566, // café latitude
  cafeLon: number = 2.3522  // café longitude
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
  
  // Phase 1.1: Enhanced shadow penalty based on location and sun angle
  let shadowPenalty = 1.0; // start with no penalty
  
  // Get café location for context
  const cafeContext = { lat: cafeLat, lon: cafeLon };
  
  // Dense urban areas have more shadow risk
  const isDenseArea = (lat: number, lon: number) => {
    // Central Paris arrondissements (1st-4th) are very dense
    const isCentral = lat > 48.85 && lat < 48.87 && lon > 2.32 && lon < 2.37;
    // Business districts (La Défense area) are tall
    const isBusinessDistrict = lat > 48.88 && lon < 2.25;
    // Montparnasse area has tall buildings
    const isMontparnasse = lat > 48.84 && lat < 48.85 && lon > 2.32 && lon < 2.33;
    
    return isCentral || isBusinessDistrict || isMontparnasse;
  };
  
  // Time-based shadow risk (early morning and late afternoon have longer shadows)
  const elevationDegrees = deg(sunElevation);
  const timeBasedShadowRisk = elevationDegrees < 20 ? 0.8 : 1.0; // low sun = more shadows
  
  // Dense area penalty
  const locationPenalty = isDenseArea(cafeContext.lat, cafeContext.lon) ? 0.85 : 0.95;
  
  // Street orientation penalty (north-facing cafés get less direct sun)
  const orientationPenalty = cafeOrientation === 0 ? 0.8 : 1.0; // north-facing penalty
  
  // Combine all shadow factors
  shadowPenalty = timeBasedShadowRisk * locationPenalty * orientationPenalty;
  
  let score = facingScore * elevScore * cloudPenalty * radiationBonus * shadowPenalty;
  
  // Sun too low = no score
  if (sunElevationDeg < 5) score = 0;
  
  return clamp(score, 0, 1);
}

/**
 * Hybrid sun score calculation using VoxCity when available, heuristic as fallback
 */
async function computeHybridSunScore(
  sunAzimuth: number,
  sunElevation: number, 
  cafeOrientation: number,
  cloudCover: number,
  directRadiation: number,
  cafeLat: number,
  cafeLon: number,
  hourTime: Date,
  usePrecision: boolean = true
): Promise<{ score: number; method: 'voxcity' | 'heuristic'; confidence: number }> {
  
  const sunElevationDeg = deg(sunElevation);
  
  // Sun too low = no score regardless of method
  if (sunElevationDeg < 5) {
    return { score: 0, method: 'heuristic', confidence: 1 };
  }
  
  let shadowFactor = 1;
  let method: 'voxcity' | 'heuristic' = 'heuristic';
  let confidence = 0.7; // default heuristic confidence
  
   // Try VoxCity precision mode first (with reduced logging)
   if (usePrecision) {
     try {
       const voxResult = await getVoxShadowValue(cafeLat, cafeLon, hourTime);
 
       if (voxResult.precision === 'voxcity') {
         shadowFactor = voxResult.shadowValue; // 0-1, already normalized
         method = 'voxcity';
         confidence = voxResult.confidence;
       }
     } catch (error) {
       // Silently fall back to heuristic
     }
   }
  
  // Fallback to heuristic shadow calculation if VoxCity unavailable
  if (method === 'heuristic') {
    const heuristicScore = computeSunScore(
      sunAzimuth,
      sunElevation,
      cafeOrientation,
      cloudCover,
      directRadiation,
      cafeLat,
      cafeLon
    );
    
    // Extract shadow component from heuristic (approximation)
    shadowFactor = heuristicScore > 0 ? 0.8 : 0.2; // simplified
  }
  
  // Common factors regardless of method
  const sunAzimuthDeg = deg(sunAzimuth);
  const cafeAzimuthRad = (cafeOrientation - 180) * Math.PI / 180;
  const azimuthDiff = Math.abs(sunAzimuth - cafeAzimuthRad);
  const normalizedDiff = Math.min(azimuthDiff, 2 * Math.PI - azimuthDiff);
  const facingScore = Math.max(0, Math.cos(normalizedDiff));
  
  const elevScore = clamp((sunElevationDeg - 8) / 20, 0, 1);
  const cloudPenalty = 1 - (cloudCover / 100);
  const radiationBonus = directRadiation > 100 ? 1.1 : 1.0;
  
  // Combine all factors
  const finalScore = clamp(
    shadowFactor * facingScore * elevScore * cloudPenalty * radiationBonus,
    0,
    1
  );
  
  return { score: finalScore, method, confidence };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const hours = parseInt(url.searchParams.get('hours') ?? '8');
  const nowParam = url.searchParams.get('now');
  const precisionParam = url.searchParams.get('precision') ?? 'voxcity';
  
  const now = nowParam ? new Date(nowParam) : new Date();
  const maxHours = Math.min(hours, 12); // cap at 12 hours
  const usePrecision = precisionParam === 'voxcity';
  
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
    let voxCityUsageCount = 0;
    let heuristicUsageCount = 0;
    
    for (const cafe of cafes) {
      const cafeOrientation = computeCafeOrientation(cafe);
      const scoreByHour: number[] = [];
      const labelByHour: string[] = [];
      
      for (let i = 0; i < weatherData.length; i++) {
        const weather = weatherData[i];
        const hourTime = new Date(weather.time);
        
        const { azimuth, elevation } = sunAt(hourTime, cafe.lat, cafe.lon);
        
        // Use hybrid scoring (VoxCity + heuristic fallback)
        const { score, method, confidence } = await computeHybridSunScore(
          azimuth,
          elevation,
          cafeOrientation,
          weather.cloudCover,
          weather.directRadiation,
          cafe.lat,
          cafe.lon,
          hourTime,
          usePrecision
        );

        
        // Track method usage for metadata
        if (method === 'voxcity') {
          voxCityUsageCount++;
        } else {
          heuristicUsageCount++;
        }
        
        const afterSunset = isAfterSunset(hourTime, cafe.lat, cafe.lon);
        

        
        scoreByHour.push(score);
        labelByHour.push(labelFromScore(score, afterSunset));
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
        orientationMethod: "street-based-v1.1",
        shadowMethod: usePrecision ? "voxcity+heuristic" : "heuristic-only",
        voxCityUsage: {
          voxCityCalculations: voxCityUsageCount,
          heuristicFallbacks: heuristicUsageCount,
          precisionCoverage: voxCityUsageCount > 0 ? 
            (voxCityUsageCount / (voxCityUsageCount + heuristicUsageCount) * 100).toFixed(1) + '%' : 
            '0%'
        }
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
