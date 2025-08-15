import fsp from "fs/promises";
import path from "path";
import { cache, CACHE_TIMES, buildCafeKey } from "@/app/lib/cache";

export const runtime = "nodejs";

type Cafe = {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  tags: Record<string, any>;
};

async function loadSeed(): Promise<any> {
  const seedPath = path.join(process.cwd(), "public", "cafes.seed.json");
  const seedTxt = await fsp.readFile(seedPath, "utf8");
  return JSON.parse(seedTxt);
}

// Simple Overpass query for cafes (back to working version)
async function fetchOverpassCafes(): Promise<Cafe[]> {
  const query = `
[out:json][timeout:30];
node["amenity"="cafe"](48.8156,2.2242,48.9022,2.4699);
out body;
`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000); // Reduced for Vercel
  
  try {
    // Try primary Overpass API, fallback to alternative
    let res;
    try {
      res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "User-Agent": "KinParisCoffeeShades/0.1",
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });
    } catch (error) {
      console.warn("Primary Overpass API failed, trying fallback:", error);
      res = await fetch("https://lz4.overpass-api.de/api/interpreter", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "User-Agent": "KinParisCoffeeShades/0.1",
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });
    }
    clearTimeout(timeout);
    
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const json = await res.json();
    
    const cafes: Cafe[] = (json?.elements ?? [])
      .filter((el: any) => el.type === "node" && el.tags?.amenity === "cafe")
      .map((el: any) => ({
        id: `node/${el.id}`,
        name: el.tags?.name ?? null,
        lat: el.lat,
        lon: el.lon,
        tags: el.tags,
      }));
      
    return cafes;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const cacheKey = buildCafeKey();
  
  // 1. Check smart cache with SWR support
  const { data: cached, isStale, shouldRefresh } = await cache.get(cacheKey);
  
  // 2. If we have fresh data, return it immediately
  if (cached && !isStale) {
    return new Response(JSON.stringify(cached), {
      headers: { 
        "content-type": "application/json", 
        "x-cache": "HIT",
        "x-cache-status": "fresh"
      },
    });
  }
  
  // 3. If we have stale data but should refresh in background
  if (cached && isStale && shouldRefresh) {
    // Return stale data immediately for best UX
    const response = new Response(JSON.stringify(cached), {
      headers: { 
        "content-type": "application/json", 
        "x-cache": "HIT",
        "x-cache-status": "stale-while-revalidate"
      },
    });
    
    // Background refresh (don't await)
    refreshCafesInBackground(cacheKey);
    
    return response;
  }

  // 4. No cached data or expired - fetch fresh
  return await fetchFreshCafes(cacheKey);
}

async function refreshCafesInBackground(cacheKey: string) {
  try {
    console.log('🔄 Background refresh started for cafés');
    await fetchFreshCafes(cacheKey, true);
    console.log('✅ Background refresh completed');
  } catch (error) {
    console.error('❌ Background refresh failed:', error);
  }
}

async function fetchFreshCafes(cacheKey: string, isBackgroundRefresh = false) {
  // Try to fetch fresh data from Overpass
  try {
    const cafes = await fetchOverpassCafes();
    if (cafes.length > 0) {
      const payload = {
        updatedAt: new Date().toISOString(),
        count: cafes.length,
        source: "overpass",
        cafes,
      };
      
      // Cache with 14-day TTL + 1-day SWR
      await cache.set(cacheKey, payload, {
        ttl: CACHE_TIMES.CAFES,
        swr: CACHE_TIMES.CAFES_SWR
      });
      
      if (isBackgroundRefresh) return; // Don't return response for background refresh
      
      return new Response(JSON.stringify(payload), {
        headers: { 
          "content-type": "application/json", 
          "x-cache": "MISS",
          "x-cache-status": "fresh-fetch"
        },
      });
    }
  } catch (err) {
    console.error("Overpass fetch failed:", err);
  }

  // Fall back to seed data
  try {
    const seed = await loadSeed();
    const payload = { ...seed, source: "seed" };
    
    // Cache seed data with shorter TTL (1 day)
    await cache.set(cacheKey, payload, {
      ttl: 24 * 60 * 60 * 1000, // 1 day for seed data
      swr: 6 * 60 * 60 * 1000   // 6 hours SWR
    });
    
    if (isBackgroundRefresh) return;
    
    return new Response(JSON.stringify(payload), {
      headers: { 
        "content-type": "application/json", 
        "x-cache": "SEED",
        "x-cache-status": "fallback"
      },
    });
  } catch (err) {
    console.error("Seed load failed:", err);
    if (isBackgroundRefresh) return;
    
    return new Response(JSON.stringify({ error: "no_data_available" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function POST() {
  return GET();
}