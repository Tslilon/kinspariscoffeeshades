# VoxCity High-Precision Shadow Data

This directory contains precomputed shadow masks for Paris cafés, providing 2-5m resolution shadow calculations.

## Structure

```
/vox/
├── metadata.json           # Global index of all tiles and masks
├── tiles/
│   ├── {tileId}/
│   │   ├── tile-info.json  # Tile boundaries and metadata
│   │   ├── 2024-01-morning.json    # January morning shadows
│   │   ├── 2024-01-noon.json       # January noon shadows
│   │   ├── 2024-01-afternoon.json  # January afternoon shadows
│   │   └── ... (all months/slots)
└── README.md              # This file
```

## Generation

Shadow masks are generated using the offline VoxCity generator:

```bash
# Generate all data
node scripts/generate-voxcity-data.js

# Generate limited dataset for testing
node scripts/generate-voxcity-data.js --tiles=10 --months=1,6,12
```

## Data Format

### metadata.json
```json
{
  "version": "1.0.0",
  "generated": "2024-01-01T00:00:00.000Z",
  "coverage": {
    "north": 48.9022,
    "south": 48.8156,
    "east": 2.4699,
    "west": 2.2242
  },
  "tiles": [...],
  "masks": [...]
}
```

### Shadow Masks
Each mask contains grayscale shadow values:
- **0**: Complete shadow
- **255**: Full sunlight
- **128**: Partial shadow

## Usage

The application automatically uses VoxCity data when:
1. Precision mode is enabled
2. VoxCity data exists for the café location and time
3. Falls back to heuristic calculations otherwise

## Vercel Deployment

These static files are served directly by Vercel from `/public/vox/`.
Total data size should be kept under 100MB for optimal performance.

## Performance

- **Tile size**: ~111m × 111m (0.001° × 0.001°)
- **Resolution**: 5m per pixel (~22×22 pixels per tile)
- **Coverage**: All of Paris (~2,600 tiles)
- **Time slots**: 3 per month × 12 months = 36 masks per tile
- **File size**: ~2KB per mask (JSON format)

## Future Improvements

1. **PNG Format**: Convert to actual PNG files for smaller size
2. **Compression**: Use gzip or brotli compression
3. **Selective Loading**: Load only needed tiles on demand
4. **Real Building Data**: Integrate with actual 3D building models
5. **Sun Position**: Account for exact sun angles per hour
