import fs from "fs";
import fsp from "fs/promises";
import path from "path";

// Smart cache with SWR (Stale-While-Revalidate) support
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  swr?: number;
}

export interface CacheOptions {
  ttl: number;          // Time to live in milliseconds
  swr?: number;         // Stale-while-revalidate time in milliseconds
  dir?: string;         // Cache directory override
}

// Use /tmp for serverless environments like Vercel
const DEFAULT_CACHE_DIR = process.env.VERCEL_ENV ? "/tmp/cache" : path.join(process.cwd(), ".vercel", "cache");

class SmartCache {
  private cacheDir: string;
  private memoryCache = new Map<string, CacheEntry>();

  constructor(cacheDir = DEFAULT_CACHE_DIR) {
    this.cacheDir = cacheDir;
  }

  private async ensureCacheDir() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        await fsp.mkdir(this.cacheDir, { recursive: true });
      }
    } catch (error) {
      console.log('Cache directory creation failed, using memory only');
    }
  }

  private getFilePath(key: string): string {
    // Hash long keys to avoid filesystem issues
    const safeKey = key.length > 100 ? 
      Buffer.from(key).toString('base64').slice(0, 50) : 
      key.replace(/[^a-zA-Z0-9-_.]/g, '_');
    return path.join(this.cacheDir, `${safeKey}.json`);
  }

  async get<T>(key: string): Promise<{ data: T | null; isStale: boolean; shouldRefresh: boolean }> {
    const now = Date.now();
    
    // Try memory cache first
    const memEntry = this.memoryCache.get(key);
    if (memEntry) {
      const age = now - memEntry.timestamp;
      const isExpired = age > memEntry.ttl;
      const isStale = memEntry.swr && age > (memEntry.ttl - memEntry.swr);
      
      if (!isExpired) {
        return { data: memEntry.data, isStale: !!isStale, shouldRefresh: !!isStale };
      }
      
      // SWR: return stale data if available
      if (memEntry.swr && age < (memEntry.ttl + memEntry.swr)) {
        return { data: memEntry.data, isStale: true, shouldRefresh: true };
      }
      
      // Remove expired entry
      this.memoryCache.delete(key);
    }

    // Try file cache
    try {
      const filePath = this.getFilePath(key);
      const stat = await fsp.stat(filePath);
      const age = now - stat.mtimeMs;
      
      const content = await fsp.readFile(filePath, "utf8");
      const entry: CacheEntry<T> = JSON.parse(content);
      
      const isExpired = age > entry.ttl;
      const isStale = entry.swr && age > (entry.ttl - entry.swr);
      
      if (!isExpired) {
        // Restore to memory cache
        this.memoryCache.set(key, entry);
        return { data: entry.data, isStale: !!isStale, shouldRefresh: !!isStale };
      }
      
      // SWR: return stale data if available
      if (entry.swr && age < (entry.ttl + entry.swr)) {
        return { data: entry.data, isStale: true, shouldRefresh: true };
      }
      
    } catch (error) {
      // File doesn't exist or can't be read
    }

    return { data: null, isStale: false, shouldRefresh: false };
  }

  async set<T>(key: string, data: T, options: CacheOptions): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: options.ttl,
      swr: options.swr,
    };

    // Store in memory
    this.memoryCache.set(key, entry);

    // Store in file (async, don't block)
    try {
      await this.ensureCacheDir();
      const filePath = this.getFilePath(key);
      await fsp.writeFile(filePath, JSON.stringify(entry), "utf8");
    } catch (error) {
      console.log('File cache write failed, memory cache still available');
    }
  }

  // Clear expired entries (cleanup utility)
  async cleanup(): Promise<void> {
    const now = Date.now();
    
    // Memory cleanup
    this.memoryCache.forEach((entry, key) => {
      const maxAge = entry.ttl + (entry.swr || 0);
      if (now - entry.timestamp > maxAge) {
        this.memoryCache.delete(key);
      }
    });

    // File cleanup (optional, runs in background)
    try {
      const files = await fsp.readdir(this.cacheDir);
      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stat = await fsp.stat(filePath);
        // Remove files older than 30 days
        if (now - stat.mtimeMs > 30 * 24 * 60 * 60 * 1000) {
          await fsp.unlink(filePath);
        }
      }
    } catch (error) {
      // Cleanup failed, not critical
    }
  }
}

// Singleton instance
export const cache = new SmartCache();

// Utility functions for common cache patterns
export const CACHE_TIMES = {
  CAFES: 14 * 24 * 60 * 60 * 1000,        // 14 days
  CAFES_SWR: 24 * 60 * 60 * 1000,         // 1 day SWR
  SUN_GEOMETRY: 24 * 60 * 60 * 1000,       // 24 hours
  WEATHER: 60 * 60 * 1000,                 // 60 minutes
  WEATHER_SWR: 10 * 60 * 1000,            // 10 minutes SWR
  GOLDEN_HOUR: 15 * 60 * 1000,            // 15 minutes during golden hours
} as const;

// Golden hour detection - import from sun library when available
export function isGoldenHour(time: Date, lat: number, lon: number): boolean {
  try {
    // Try to import sun calculations dynamically to avoid circular deps
    const SunCalc = require('suncalc');
    const times = SunCalc.getTimes(time, lat, lon);
    
    // Golden hours: 90 minutes around sunrise, sunset, and solar noon
    const goldenWindow = 90 * 60 * 1000; // 90 minutes in milliseconds
    const now = time.getTime();
    
    return (
      Math.abs(now - times.sunrise.getTime()) < goldenWindow ||
      Math.abs(now - times.sunset.getTime()) < goldenWindow ||
      Math.abs(now - times.solarNoon.getTime()) < goldenWindow
    );
  } catch (error) {
    // Fallback to simple hour-based detection
    const hour = time.getHours();
    return (hour >= 6 && hour <= 8) || (hour >= 18 && hour <= 20);
  }
}

// Hour alignment utility
export function alignToHour(date: Date): Date {
  const aligned = new Date(date);
  aligned.setMinutes(0, 0, 0);
  return aligned;
}

// Cache key builders
export function buildCafeKey(query?: string): string {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  return `cafes:${params.toString()}`;
}

export function buildSunGeometryKey(lat: number, lon: number, date: Date): string {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return `sungeom:${lat.toFixed(4)}:${lon.toFixed(4)}:${dateStr}`;
}

export function buildWeatherKey(lat: number, lon: number, hourBucket: Date): string {
  const hourStr = hourBucket.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  return `weather:${lat.toFixed(4)}:${lon.toFixed(4)}:${hourStr}`;
}

export function buildSunScoreKey(precision: string, hours: number, hourBucket: Date): string {
  const hourStr = hourBucket.toISOString().slice(0, 13);
  return `sunscore:${precision}:${hours}:${hourStr}`;
}
