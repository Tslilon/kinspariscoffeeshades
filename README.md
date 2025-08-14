# Kin's Paris Coffee Shades

> Beat the locals. Catch the sun.

A Next.js application that shows real-time sun exposure scores for Paris cafés, helping you find the perfect sunlit spot for your coffee.

## Features

- **2,640+ Paris Cafés**: Real café data from OpenStreetMap
- **Sun Exposure Scoring**: Live calculations using solar position + weather data
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

## Tech Stack

- **Frontend**: Next.js 13 App Router, React, TypeScript
- **APIs**: 
  - OpenStreetMap (Overpass API) for café data
  - Open-Meteo for weather and cloud cover
  - SunCalc for solar position calculations
- **Mapping**: MapLibre GL + MapTiler tiles
- **Deployment**: Vercel with Node.js runtime
- **Caching**: 24h file cache for café data, 5min for sun scores

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
4. **Scoring**: Combines sun angle, elevation, cloud cover, and basic shadow heuristics
5. **Caching**: Café data cached 24h, sun scores cached 5min

## API Endpoints

- `/api/cafes` - Returns all Paris cafés with metadata
- `/api/sunscore?hours=8` - Hourly sun exposure scores
- `/api/weather` - Current Paris weather

## Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/kinspariscoffeeshades&env=NEXT_PUBLIC_MAPTILER_KEY&envDescription=Get%20your%20MapTiler%20API%20key&envLink=https://cloud.maptiler.com/account/keys/)

## Roadmap

### Phase 1.1 - Quality Improvements
- Better orientation detection using building edges
- Shadow penalties from nearby tall buildings
- Distance sorting from Kin House location

### Phase 2 - VoxCity Integration
- High-precision shadow calculations
- Precomputed shadow masks
- 2-5m resolution accuracy

### Phase 3 - Community Features
- Save favorite cafés
- User reviews and photos
- Social sharing and recommendations

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details.

---

Built with ❤️ for the Paris's Kin.