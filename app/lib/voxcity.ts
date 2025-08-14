/**
 * VoxCity High-Precision Shadow System
 * 
 * Provides 2-5m resolution shadow calculations using precomputed shadow masks
 * for Paris cafés. Falls back to heuristic when precomputed data unavailable.
 */

export type TimeSlot = 'morning' | 'noon' | 'afternoon';

export type VoxTileInfo = {
  tileId: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  resolution: number; // meters per pixel
  pixelWidth: number;
  pixelHeight: number;
  center: {
    lat: number;
    lon: number;
  };
};

export type VoxShadowMask = {
  tileId: string;
  month: number; // 1-12
  slot: TimeSlot;
  url: string; // path to PNG file
  generated: string; // ISO timestamp
};

export type VoxMetadata = {
  version: string;
  generated: string;
  coverage: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  tiles: VoxTileInfo[];
  masks: VoxShadowMask[];
};

export type VoxShadowResult = {
  precision: 'voxcity' | 'heuristic';
  shadowValue: number; // 0-1, 0=full shadow, 1=full sun
  confidence: number; // 0-1, how confident we are in this result
  tileId?: string;
  coordinates?: {
    x: number; // pixel coordinate in tile
    y: number;
  };
};

/**
 * Convert geographic coordinates to tile ID
 */
export function coordsToTileId(lat: number, lon: number): string {
  // Paris tile grid: split into ~89m x 89m tiles  
  // Use simple grid system based on lat/lon offsets from Paris center
  const parisCenter = { lat: 48.8566, lon: 2.3522 };
  
  // Updated: 0.0008 degree ≈ 89m tiles (higher resolution)
  const tileSize = 0.0008; // ~89m tiles
  
  const tileX = Math.round((lon - parisCenter.lon) / tileSize);
  const tileY = Math.round((lat - parisCenter.lat) / tileSize);
  
  return `${tileX}_${tileY}`;
}

/**
 * Get tile bounds from tile ID
 */
export function tileIdToBounds(tileId: string): VoxTileInfo['bounds'] {
  const [tileXStr, tileYStr] = tileId.split('_');
  const tileX = parseInt(tileXStr);
  const tileY = parseInt(tileYStr);
  
  const parisCenter = { lat: 48.8566, lon: 2.3522 };
  const tileSize = 0.0008; // Updated to match generator
  
  const west = parisCenter.lon + (tileX * tileSize);
  const east = west + tileSize;
  const south = parisCenter.lat + (tileY * tileSize);
  const north = south + tileSize;
  
  return { north, south, east, west };
}

/**
 * Convert coordinates to pixel position within a tile
 */
export function coordsToPixel(
  lat: number, 
  lon: number, 
  tileInfo: VoxTileInfo
): { x: number; y: number } | null {
  const { bounds, pixelWidth, pixelHeight } = tileInfo;
  
  // Check if coordinates are within tile bounds
  if (lat < bounds.south || lat > bounds.north || 
      lon < bounds.west || lon > bounds.east) {
    return null;
  }
  
  // Convert to pixel coordinates (0,0 = top-left)
  const x = Math.floor(((lon - bounds.west) / (bounds.east - bounds.west)) * pixelWidth);
  const y = Math.floor(((bounds.north - lat) / (bounds.north - bounds.south)) * pixelHeight);
  
  return { x, y };
}

/**
 * Determine time slot based on hour (Paris time)
 */
export function hourToTimeSlot(hour: number): TimeSlot {
  if (hour >= 8 && hour <= 10) return 'morning';
  if (hour >= 11 && hour <= 13) return 'noon';
  if (hour >= 14 && hour <= 16) return 'afternoon';
  
  // Default fallback based on time of day
  if (hour < 11) return 'morning';
  if (hour < 14) return 'noon';
  return 'afternoon';
}

/**
 * Load VoxCity metadata (cached in memory)
 */
let cachedMetadata: VoxMetadata | null = null;
let metadataLoadTime = 0;
const METADATA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function loadVoxMetadata(): Promise<VoxMetadata | null> {
  const now = Date.now();
  
  // Return cached if still valid
  if (cachedMetadata && (now - metadataLoadTime) < METADATA_CACHE_TTL) {
    return cachedMetadata;
  }
  
  try {
    // In server context, read from filesystem instead of fetch
    if (typeof window === 'undefined') {
      // Server-side: read from filesystem
      const fs = require('fs');
      const path = require('path');
      const metadataPath = path.join(process.cwd(), 'public', 'vox', 'metadata.json');
      
      if (!fs.existsSync(metadataPath)) {
        console.warn('VoxCity metadata file not found:', metadataPath);
        return null;
      }
      
      const metadataText = fs.readFileSync(metadataPath, 'utf8');
      cachedMetadata = JSON.parse(metadataText);
      metadataLoadTime = now;
      return cachedMetadata;
    } else {
      // Client-side: use fetch
      const response = await fetch('/vox/metadata.json');
      if (!response.ok) {
        return null;
      }
      
      cachedMetadata = await response.json();
      metadataLoadTime = now;
      return cachedMetadata;
    }
  } catch (error) {
    console.warn('Failed to load VoxCity metadata:', error);
    return null;
  }
}

/**
 * Get shadow value from precomputed VoxCity data
 */
export async function getVoxShadowValue(
  lat: number,
  lon: number,
  date: Date
): Promise<VoxShadowResult> {
  console.log(`🔍 VoxCity lookup: lat=${lat}, lon=${lon}, date=${date.toISOString()}`);
  
  const metadata = await loadVoxMetadata();
  
  if (!metadata) {
    console.log('❌ VoxCity metadata not loaded');
    return {
      precision: 'heuristic',
      shadowValue: 0,
      confidence: 0
    };
  }
  
  console.log(`✅ VoxCity metadata loaded: ${metadata.tiles?.length || 0} tiles, ${metadata.masks?.length || 0} masks`);
  
  const tileId = coordsToTileId(lat, lon);
  console.log(`📍 Calculated tile ID: ${tileId}`);
  
  const tileInfo = metadata.tiles.find(t => t.tileId === tileId);
  
  if (!tileInfo) {
    console.log(`❌ Tile ${tileId} not found in metadata`);
    return {
      precision: 'heuristic',
      shadowValue: 0,
      confidence: 0
    };
  }
  
  console.log(`✅ Tile found: ${tileId}`);
  
  // Get pixel coordinates within tile
  const pixelCoords = coordsToPixel(lat, lon, tileInfo);
  if (!pixelCoords) {
    console.log(`❌ Pixel coordinates out of tile bounds`);
    return {
      precision: 'heuristic',
      shadowValue: 0,
      confidence: 0
    };
  }
  
  console.log(`✅ Pixel coordinates: (${pixelCoords.x}, ${pixelCoords.y})`);
  
  // Find appropriate shadow mask
  const month = date.getMonth() + 1; // 1-12
  const hour = date.getHours();
  const timeSlot = hourToTimeSlot(hour);
  
  console.log(`🕐 Time lookup: month=${month}, hour=${hour}, timeSlot=${timeSlot}`);
  
  const shadowMask = metadata.masks.find(m => 
    m.tileId === tileId && 
    m.month === month && 
    m.slot === timeSlot
  );
  
  if (!shadowMask) {
    console.log(`❌ Shadow mask not found for ${tileId}, month=${month}, slot=${timeSlot}`);
    const tileMasks = metadata.masks.filter(m => m.tileId === tileId);
    console.log(`Available masks for ${tileId}:`, tileMasks.map(m => `${m.month}-${m.slot}`).join(', '));
    return {
      precision: 'heuristic',
      shadowValue: 0,
      confidence: 0
    };
  }
  
  console.log(`✅ Shadow mask found: ${shadowMask.url}`);
  
  try {
    // Read the shadow mask JSON file
    const maskFilename = `2024-${month.toString().padStart(2, '0')}-${timeSlot}.json`;
    let maskData;
    
    if (typeof window === 'undefined') {
      // Server-side: read from filesystem
      const fs = require('fs');
      const path = require('path');
      const maskPath = path.join(process.cwd(), 'public', 'vox', 'tiles', tileId, maskFilename);
      
      if (!fs.existsSync(maskPath)) {
        throw new Error(`Shadow mask not found: ${maskPath}`);
      }
      
      const maskText = fs.readFileSync(maskPath, 'utf8');
      maskData = JSON.parse(maskText);
    } else {
      // Client-side: use fetch
      const maskUrl = `/vox/tiles/${tileId}/${maskFilename}`;
      const response = await fetch(maskUrl);
      
      if (!response.ok) {
        throw new Error(`Shadow mask not found: ${maskUrl}`);
      }
      
      maskData = await response.json();
    }
    
    // Calculate pixel index (row-major order)
    const pixelIndex = pixelCoords.y * maskData.width + pixelCoords.x;
    
    if (pixelIndex >= 0 && pixelIndex < maskData.shadows.length) {
      const shadowValue = maskData.shadows[pixelIndex] / 255; // Normalize to 0-1
      
      return {
        precision: 'voxcity',
        shadowValue,
        confidence: 0.95,
        tileId,
        coordinates: pixelCoords
      };
    } else {
      throw new Error(`Pixel coordinates out of bounds: ${pixelCoords.x}, ${pixelCoords.y}`);
    }
  } catch (error) {
    console.warn('Failed to read VoxCity shadow mask:', error);
    return {
      precision: 'heuristic',
      shadowValue: 0,
      confidence: 0
    };
  }
}

/**
 * Check if VoxCity data is available for given coordinates and time
 */
export async function isVoxCityAvailable(
  lat: number,
  lon: number,
  date: Date
): Promise<boolean> {
  const result = await getVoxShadowValue(lat, lon, date);
  return result.precision === 'voxcity';
}
