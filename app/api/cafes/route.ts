import fs from "fs";
import fsp from "fs/promises";
import path from "path";

export const runtime = "nodejs";

type Cafe = {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  tags: Record<string, any>;
};

const CACHE_DIR = path.join(process.cwd(), ".vercel", "cache");
const CACHE_FILE = path.join(CACHE_DIR, "cafes.json");
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

async function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    await fsp.mkdir(CACHE_DIR, { recursive: true });
  }
}

async function readCache(): Promise<any | null> {
  try {
    const stat = await fsp.stat(CACHE_FILE);
    const age = Date.now() - stat.mtimeMs;
    if (age < TTL_MS) {
      const txt = await fsp.readFile(CACHE_FILE, "utf8");
      return JSON.parse(txt);
    }
    return null;
  } catch {
    return null;
  }
}

async function writeCache(data: any) {
  await ensureCacheDir();
  await fsp.writeFile(CACHE_FILE, JSON.stringify(data), "utf8");
}

async function loadSeed(): Promise<any> {
  const seedPath = path.join(process.cwd(), "public", "cafes.seed.json");
  const seedTxt = await fsp.readFile(seedPath, "utf8");
  return JSON.parse(seedTxt);
}

// Simple Overpass query for just cafe nodes (most reliable)
async function fetchOverpassCafes(): Promise<Cafe[]> {
  const query = `
[out:json][timeout:30];
node["amenity"="cafe"](48.8156,2.2242,48.9022,2.4699);
out body;
`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35000);
  
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "User-Agent": "KinParisCoffeeShades/0.1",
      },
      body: new URLSearchParams({ data: query }),
      signal: controller.signal,
    });
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
  // 1. Check cache first
  const cached = await readCache();
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: { "content-type": "application/json", "x-cache": "HIT" },
    });
  }

  // 2. Try to fetch fresh data from Overpass
  try {
    const cafes = await fetchOverpassCafes();
    if (cafes.length > 0) {
      const payload = {
        updatedAt: new Date().toISOString(),
        count: cafes.length,
        source: "overpass",
        cafes,
      };
      await writeCache(payload);
      return new Response(JSON.stringify(payload), {
        headers: { "content-type": "application/json", "x-cache": "MISS" },
      });
    }
  } catch (err) {
    console.error("Overpass fetch failed:", err);
  }

  // 3. Fall back to seed data
  try {
    const seed = await loadSeed();
    const payload = { ...seed, source: "seed" };
    await writeCache(payload); // cache seed for next time
    return new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json", "x-cache": "SEED" },
    });
  } catch (err) {
    console.error("Seed load failed:", err);
    return new Response(JSON.stringify({ error: "no_data_available" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function POST() {
  return GET();
}