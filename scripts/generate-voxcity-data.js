#!/usr/bin/env node

/**
 * VoxCity Shadow Mask Generator
 * 
 * This script generates precomputed shadow masks for Paris café locations.
 * Run this offline to produce high-precision shadow data.
 * 
 * Usage:
 *   node scripts/generate-voxcity-data.js
 *   node scripts/generate-voxcity-data.js --tiles=10 --months=1,6,12
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  // Central Paris bounds (where cafés actually are)
  bounds: {
    north: 48.8800,  // Cover Montmartre
    south: 48.8400,  // Cover Latin Quarter  
    east: 2.3800,    // Cover Bastille area
    west: 2.3200     // Cover Trocadéro area
  },
  
  // Tile configuration  
  tileSize: 0.0008, // ~89m tiles in degrees (smaller for better coverage)
  resolution: 4, // 4 meters per pixel (higher resolution)
  pixelsPerTile: Math.floor(89 / 4), // ~22 pixels per tile
  
  // Time configuration
  timeSlots: ['morning', 'noon', 'afternoon'],
  months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  
  // Café-focused generation
  priorityAreas: [
    { name: "Le Marais", lat: 48.8566, lon: 2.3522, radius: 0.005 },
    { name: "Saint-Germain", lat: 48.8543, lon: 2.3385, radius: 0.004 },
    { name: "Montmartre", lat: 48.8867, lon: 2.3431, radius: 0.004 },
    { name: "Latin Quarter", lat: 48.8499, lon: 2.3469, radius: 0.004 },
    { name: "Bastille", lat: 48.8532, lon: 2.3691, radius: 0.003 },
    { name: "République", lat: 48.8676, lon: 2.3634, radius: 0.003 }
  ],
  
  // Output directory
  outputDir: path.join(__dirname, '..', 'public', 'vox')
};

/**
 * Generate tile grid for Paris, prioritizing café-dense areas
 */
function generateTileGrid() {
  const tiles = [];
  const parisCenter = { lat: 48.8566, lon: 2.3522 };
  
  const latRange = CONFIG.bounds.north - CONFIG.bounds.south;
  const lonRange = CONFIG.bounds.east - CONFIG.bounds.west;
  
  const tilesY = Math.ceil(latRange / CONFIG.tileSize);
  const tilesX = Math.ceil(lonRange / CONFIG.tileSize);
  
  console.log(`Generating ${tilesX} x ${tilesY} = ${tilesX * tilesY} tiles for central Paris`);
  console.log(`Coverage: ${CONFIG.bounds.south.toFixed(4)} to ${CONFIG.bounds.north.toFixed(4)} lat`);
  console.log(`Coverage: ${CONFIG.bounds.west.toFixed(4)} to ${CONFIG.bounds.east.toFixed(4)} lon`);
  
  for (let y = 0; y < tilesY; y++) {
    for (let x = 0; x < tilesX; x++) {
      const west = CONFIG.bounds.west + (x * CONFIG.tileSize);
      const east = west + CONFIG.tileSize;
      const south = CONFIG.bounds.south + (y * CONFIG.tileSize);
      const north = south + CONFIG.tileSize;
      
      const centerLat = (north + south) / 2;
      const centerLon = (east + west) / 2;
      
      // Convert to tile ID (using corrected coordinate system)
      const tileX = Math.round((centerLon - parisCenter.lon) / CONFIG.tileSize);
      const tileY = Math.round((centerLat - parisCenter.lat) / CONFIG.tileSize);
      const tileId = `${tileX}_${tileY}`;
      
      // Check if tile is in a priority area (café-dense zone)
      const isPriority = CONFIG.priorityAreas.some(area => {
        const distance = Math.sqrt(
          Math.pow(centerLat - area.lat, 2) + Math.pow(centerLon - area.lon, 2)
        );
        return distance <= area.radius;
      });
      
      tiles.push({
        tileId,
        bounds: { north, south, east, west },
        resolution: CONFIG.resolution,
        pixelWidth: CONFIG.pixelsPerTile,
        pixelHeight: CONFIG.pixelsPerTile,
        center: {
          lat: centerLat,
          lon: centerLon
        },
        priority: isPriority
      });
    }
  }
  
  console.log(`Priority tiles (café-dense areas): ${tiles.filter(t => t.priority).length}`);
  return tiles;
}

/**
 * Simulate shadow calculation for a tile
 * In a real implementation, this would use VoxCity API or 3D building data
 */
function generateShadowMask(tile, month, timeSlot) {
  console.log(`Generating shadow mask for tile ${tile.tileId}, month ${month}, slot ${timeSlot}`);
  
  // Simulate shadow calculation based on time and location
  const shadows = [];
  
  for (let y = 0; y < tile.pixelHeight; y++) {
    for (let x = 0; x < tile.pixelWidth; x++) {
      // Calculate pixel's real-world coordinates
      const lat = tile.bounds.north - (y / tile.pixelHeight) * (tile.bounds.north - tile.bounds.south);
      const lon = tile.bounds.west + (x / tile.pixelWidth) * (tile.bounds.east - tile.bounds.west);
      
      // Simulate shadow based on various factors
      let shadowValue = 255; // Start with full sun
      
      // Time-based shadows (morning/afternoon have more shadows)
      if (timeSlot === 'morning') {
        shadowValue *= 0.7; // More shadows in morning
      } else if (timeSlot === 'afternoon') {
        shadowValue *= 0.8; // Some shadows in afternoon
      }
      // noon has least shadows (shadowValue *= 1.0)
      
      // Seasonal shadows (winter has more shadows)
      const seasonMultiplier = month <= 2 || month >= 11 ? 0.6 : // Winter
                              month <= 4 || month >= 9 ? 0.8 :  // Spring/Fall
                              0.9; // Summer
      shadowValue *= seasonMultiplier;
      
      // Location-based shadows (central Paris is denser)
      const distanceFromCenter = Math.sqrt(
        Math.pow(lat - 48.8566, 2) + Math.pow(lon - 2.3522, 2)
      );
      const densityFactor = Math.max(0.4, 1 - (distanceFromCenter * 100)); // Denser = more shadows
      shadowValue *= (0.5 + 0.5 * densityFactor);
      
      // Add some random variation to simulate real building shadows
      const randomVariation = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
      shadowValue *= randomVariation;
      
      // Clamp to 0-255
      shadowValue = Math.max(0, Math.min(255, Math.floor(shadowValue)));
      shadows.push(shadowValue);
    }
  }
  
  return shadows;
}

/**
 * Save shadow mask as PNG-like data (simplified format)
 */
function saveShadowMask(tile, month, timeSlot, shadowData) {
  const tileDir = path.join(CONFIG.outputDir, 'tiles', tile.tileId);
  
  // Ensure directory exists
  if (!fs.existsSync(tileDir)) {
    fs.mkdirSync(tileDir, { recursive: true });
  }
  
  // Save as JSON for now (in real implementation, would be PNG)
  const filename = `2024-${month.toString().padStart(2, '0')}-${timeSlot}.json`;
  const filepath = path.join(tileDir, filename);
  
  const maskData = {
    tileId: tile.tileId,
    month,
    timeSlot,
    width: tile.pixelWidth,
    height: tile.pixelHeight,
    format: 'grayscale_json', // Would be 'png' in real implementation
    shadows: shadowData,
    generated: new Date().toISOString()
  };
  
  fs.writeFileSync(filepath, JSON.stringify(maskData));
  
  // Also save tile info
  const tileInfoPath = path.join(tileDir, 'tile-info.json');
  if (!fs.existsSync(tileInfoPath)) {
    fs.writeFileSync(tileInfoPath, JSON.stringify(tile, null, 2));
  }
  
  return filename;
}

/**
 * Generate metadata index
 */
function generateMetadata(tiles, masks) {
  const metadata = {
    version: "1.0.0",
    generated: new Date().toISOString(),
    coverage: CONFIG.bounds,
    tileSystem: {
      tileSize: CONFIG.tileSize,
      resolution: CONFIG.resolution,
      pixelsPerTile: CONFIG.pixelsPerTile
    },
    tiles: tiles,
    masks: masks.map(mask => ({
      tileId: mask.tileId,
      month: mask.month,
      slot: mask.timeSlot,
      url: `/vox/tiles/${mask.tileId}/${mask.filename}`,
      generated: mask.generated
    }))
  };
  
  const metadataPath = path.join(CONFIG.outputDir, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  
  console.log(`Saved metadata to ${metadataPath}`);
  return metadata;
}

/**
 * Generate tiles for specific café locations
 */
function generateCafeTargetedTiles(maxTiles = 100) {
  const parisCenter = { lat: 48.8566, lon: 2.3522 };
  
  // Known café coordinate ranges (from debug analysis)
  const cafeRanges = {
    lat: { min: 48.84, max: 48.88 },  // Covers actual café latitudes
    lon: { min: 2.32, max: 2.38 }     // Covers actual café longitudes
  };
  
  // Convert to tile coordinate ranges
  const tileRanges = {
    x: {
      min: Math.round((cafeRanges.lon.min - parisCenter.lon) / CONFIG.tileSize),
      max: Math.round((cafeRanges.lon.max - parisCenter.lon) / CONFIG.tileSize)
    },
    y: {
      min: Math.round((cafeRanges.lat.min - parisCenter.lat) / CONFIG.tileSize),
      max: Math.round((cafeRanges.lat.max - parisCenter.lat) / CONFIG.tileSize)
    }
  };
  
  console.log(`Tile coordinate ranges: X(${tileRanges.x.min} to ${tileRanges.x.max}), Y(${tileRanges.y.min} to ${tileRanges.y.max})`);
  
  const tiles = [];
  let tileCount = 0;
  
  for (let tileY = tileRanges.y.min; tileY <= tileRanges.y.max && tileCount < maxTiles; tileY++) {
    for (let tileX = tileRanges.x.min; tileX <= tileRanges.x.max && tileCount < maxTiles; tileX++) {
      // Convert tile coordinates back to geographic bounds
      const centerLat = parisCenter.lat + (tileY * CONFIG.tileSize);
      const centerLon = parisCenter.lon + (tileX * CONFIG.tileSize);
      
      const bounds = {
        north: centerLat + (CONFIG.tileSize / 2),
        south: centerLat - (CONFIG.tileSize / 2),
        east: centerLon + (CONFIG.tileSize / 2),
        west: centerLon - (CONFIG.tileSize / 2)
      };
      
      const tileId = `${tileX}_${tileY}`;
      
      tiles.push({
        tileId,
        bounds,
        resolution: CONFIG.resolution,
        pixelWidth: CONFIG.pixelsPerTile,
        pixelHeight: CONFIG.pixelsPerTile,
        center: {
          lat: centerLat,
          lon: centerLon
        },
        priority: true // All these tiles are café-targeted
      });
      
      tileCount++;
    }
  }
  
  console.log(`Generated ${tiles.length} café-targeted tiles`);
  return tiles;
}

/**
 * Main generation function
 */
async function generateVoxCityData(options = {}) {
  console.log('🏗️  VoxCity Shadow Mask Generator');
  console.log('================================');
  
  // Parse options
  const maxTiles = options.tiles || 100;
  const targetMonths = options.months || CONFIG.months;
  
  console.log(`Target months: ${targetMonths.join(', ')}`);
  console.log(`Max tiles: ${maxTiles}`);
  
  // Ensure output directory exists
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
  
  // Generate café-targeted tiles instead of grid-based tiles
  const tiles = generateCafeTargetedTiles(maxTiles);
  
  console.log(`Processing ${tiles.length} tiles...`);
  
  // Generate shadow masks
  const masks = [];
  let processed = 0;
  const total = tiles.length * targetMonths.length * CONFIG.timeSlots.length;
  
  for (const tile of tiles) {
    for (const month of targetMonths) {
      for (const timeSlot of CONFIG.timeSlots) {
        const shadowData = generateShadowMask(tile, month, timeSlot);
        const filename = saveShadowMask(tile, month, timeSlot, shadowData);
        
        masks.push({
          tileId: tile.tileId,
          month,
          timeSlot,
          filename,
          generated: new Date().toISOString()
        });
        
        processed++;
        if (processed % 10 === 0) {
          console.log(`Progress: ${processed}/${total} (${(processed/total*100).toFixed(1)}%)`);
        }
      }
    }
  }
  
  // Generate metadata
  const metadata = generateMetadata(tiles, masks);
  
  console.log('✅ VoxCity data generation complete!');
  console.log(`📁 Output directory: ${CONFIG.outputDir}`);
  console.log(`📊 Generated ${masks.length} shadow masks for ${tiles.length} tiles`);
  console.log(`💾 Total file size: ~${(masks.length * 2).toFixed(1)} KB (simulated)`);
  
  return metadata;
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (const arg of args) {
    if (arg.startsWith('--tiles=')) {
      options.tiles = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--months=')) {
      options.months = arg.split('=')[1].split(',').map(m => parseInt(m.trim()));
    }
  }
  
  return options;
}

/**
 * Run if called directly
 */
if (require.main === module) {
  const options = parseArgs();
  
  generateVoxCityData(options).catch(error => {
    console.error('❌ Generation failed:', error);
    process.exit(1);
  });
}

module.exports = { generateVoxCityData, CONFIG };
