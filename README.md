# Kin's Paris Coffee Shades

> Beat the locals. Catch the sun.

A Next.js application that shows real-time sun exposure scores for Paris cafés, helping you find the perfect sunlit spot for your coffee.

## Features

- **2,640+ Paris Cafés**: Real café data from OpenStreetMap
- **High-Precision Shadow System**: VoxCity integration with 4m resolution precomputed shadow masks
- **Hybrid Sun Scoring**: Combines VoxCity precision with heuristic fallback for complete coverage
- **8-Hour Forecast**: See how sun exposure changes throughout the day
- **Rich Café Data**: Opening hours, contact info, amenities, outdoor seating
- **Interactive Map**: MapLibre GL with color-coded markers
- **Mobile-First Design**: Expandable cards, pagination, responsive layout
- **Free APIs Only**: No paid services (OpenStreetMap + Open-Meteo)

## Sun Score System

- ☀️ **Sunny** (60%+): Direct sunlight, clear skies
- ⛅ **Mixed** (30-59%): Partial sun, some clouds
- ☁️ **Shade** (<30%): Overcast or shadowed
- 🌙 **After Dark**: Post-sunset hours

### VoxCity Precision Mode
When available, uses precomputed shadow masks at 4-meter resolution for accurate building shadow calculations. Falls back to heuristic calculations for areas without coverage.

## Tech Stack

- **Frontend**: Next.js 13 App Router, React, TypeScript
- **APIs**: 
  - OpenStreetMap (Overpass API) for café data
  - Open-Meteo for weather and cloud cover
  - SunCalc for solar position calculations
- **Shadow System**: VoxCity high-precision precomputed shadow masks (4m resolution)
- **Mapping**: MapLibre GL + MapTiler tiles
- **Deployment**: Vercel with Node.js runtime
- **Smart Caching**: 14-day café cache with SWR, split sun geometry (24h) + weather (60min), adaptive golden-hour freshness

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/kinspariscoffeeshades.git
   cd kinspariscoffeeshades
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Add your MapTiler API key (free tier available):
   ```
   NEXT_PUBLIC_MAPTILER_KEY=your_key_here
   ```

4. **Run the development server**
   ```bash
   pnpm dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)** in your browser

## Environment Variables

- `PARIS_COORDS`: Paris coordinates (48.8566,2.3522)
- `KINHOUSE_COORDS`: Reference point for distance sorting
- `NEXT_PUBLIC_MAPTILER_KEY`: MapTiler API key for map tiles

## How It Works

1. **Café Data**: Fetches cafés from OpenStreetMap Overpass API
2. **Weather**: Gets hourly cloud cover from Open-Meteo
3. **Sun Position**: Calculates solar azimuth/elevation using SunCalc
4. **Shadow Calculation**: 
   - **VoxCity Mode**: Uses precomputed 4m-resolution shadow masks when available
   - **Heuristic Mode**: Falls back to building orientation and distance calculations
5. **Scoring**: Combines sun angle, elevation, cloud cover, and precise shadow data
6. **Smart Caching**: 
   - **Cafés**: 14-day TTL + 1-day SWR (static data, rare changes)
   - **Sun Geometry**: 24h TTL per date/location (astronomy changes daily)
   - **Weather**: 60min TTL + 10min SWR, hour-aligned (matches provider schedule)
   - **Adaptive**: 15min during golden hours or rapid cloud changes
   - **VoxCity**: In-memory + edge KV with content hash

## API Endpoints

- `/api/cafes` - Returns all Paris cafés with metadata
- `/api/sunscore?hours=8` - Hourly sun exposure scores
- `/api/weather` - Current Paris weather

## Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/kinspariscoffeeshades&env=NEXT_PUBLIC_MAPTILER_KEY&envDescription=Get%20your%20MapTiler%20API%20key&envLink=https://cloud.maptiler.com/account/keys/)

## Recent Updates

### ✅ VoxCity Integration Complete
- High-precision shadow calculations (4m resolution)
- 490 precomputed shadow tiles covering central Paris
- Hybrid system with heuristic fallback
- 25MB of optimized shadow mask data

## Roadmap

### Phase 2.1 - Coverage Expansion
- Expand VoxCity coverage to all Paris arrondissements
- Add seasonal shadow variations
- Optimize data loading and caching

### Phase 3 - Community Features
- Save favorite cafés
- User reviews and photos
- Social sharing and recommendations
- Real-time crowd density indicators

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.

---

Built with ❤️ for the Paris's Kin.