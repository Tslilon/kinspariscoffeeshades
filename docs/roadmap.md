## Kin’s Paris Coffee Shades — Roadmap

### Objective
Convert the Weathergpt template into Kin’s Paris Coffee Shades:
- **Paris-only weather**: Always show Paris weather (not user location).
- **Cafés from OSM**: Fetch Paris cafés via Overpass API.
- **Sun/shade score**: Compute a simple per-café score for the next hours using sun position + a building shade heuristic (Phase 1), upgradeable to precomputed VoxCity tiles (Phase 2).
- **UI**: List + map with “☀︎ sunny / ◑ partial / ▢ shade” indicators per hour.
- **Branding**: App branded for Kin.

### Non‑negotiables
- **Free sources only**: Overpass, Open‑Meteo.
- **No paid APIs**.
- **Paris bounding box only**.
- **SSR + server routes for API calls**: Never call Overpass from the browser.

### Tech Plan

#### APIs
- **Open‑Meteo (no key)**: hourly cloud cover, direct/diffuse radiation proxies.
- **Overpass API**: cafés in Paris (`amenity=cafe`, include `name`, `addr:*`, `opening_hours`, `outdoor_seating` if present).
- **(Phase 2) VoxCity**: precompute offline → static JSON/PNG tiles in `/public/vox/...`.

#### Core idea (Phase 1 heuristic)
- Compute the sun vector per hour for Paris (lat 48.8566, lon 2.3522) using a JS solar lib (e.g., `suncalc`).
- For each café, estimate orientation using OSM data:
  - Prefer `outdoor_seating=yes` nodes with nearest building edge azimuth (query nearby building footprints via Overpass). If missing, use nearest road azimuth.
- Heuristic exposure score:

```
score = f(sun azimuth vs. terrace azimuth) × g(sun elevation) × (1 - cloud_cover)

Where f peaks when sun hits the facade/terrace head-on; g downweights when elevation < 10°.

Optional shadow penalty: if a taller building within 15–30 m exists in the sun direction, subtract a large penalty (use building height or levels×3 m; default 12 m if missing).
```

#### Data flow
1. `/api/cafes`: Overpass → normalize → cache (KV or file cache) for 24h.
2. `/api/sunscore?hours=6`: for each café, compute next N hours of scores using sun + weather.
3. Client: load Paris weather header + map + list with badges.

#### Branding
- **App name**: Kin’s Paris Coffee Shades
- **Tagline**: Beat the locals. Catch the sun.
- **Emoji scale**: ☀︎ (sunny), ◑ (mixed), ▢ (shade)

### File / Code Tasks

1) Config & deps
- Add deps: `suncalc`, `wellknown` (WKT parse if needed), `@turf/turf`.
- Env: none required (free sources). Add `PARIS_COORDS=48.8566,2.3522`.

2) Force Paris weather
- Replace geolocation usage with fixed coords.
- In the template’s weather fetcher, set `latitude=48.8566&longitude=2.3522`. Show “Paris, FR” always.

3) Overpass fetch (server)
- Create `app/api/cafes/route.ts`:
  - `POST/GET` hits Overpass with this query (Paris polygon; fallback to bbox):

```
[out:json][timeout:25];
area["name"="Paris"]["boundary"="administrative"]->.paris;
(
  node["amenity"="cafe"](area.paris);
  way["amenity"="cafe"](area.paris);
  relation["amenity"="cafe"](area.paris);
);
// nearby building polygons for shadow heuristic
(
  way["building"](area.paris);
);
out body;
>;
out skel qt;
```

- Parse to a list: `{ id, name, lat, lon, tags: { outdoor_seating, addr:… }, nearestBuildingEdges?: GeoJSON, buildingHeightsNearby?: number[] }`.
- Implement a tiny LRU or file cache (e.g., write JSON to `.vercel/cache/cafes.json`) and serve cached for 24h to avoid rate limits.

4) Sun + weather scoring (server)
- Create `app/api/sunscore/route.ts`:
  - Inputs: `hours=6` (default), `now` (optional ISO).
  - Fetch Open‑Meteo hourly for today/tomorrow (cloud_cover, direct_normal_irradiance if available).
  - Compute per‑hour sun azimuth/elevation with `suncalc.getPosition(time, 48.8566, 2.3522)`.
  - For each café:
    - Determine terrace/facade azimuth:
      - If café is a node: find nearest building edge from pre‑fetched buildings within 40 m; use edge bearing.
      - If none, use nearest road bearing (small Overpass `highway` fetch around the café if needed).
    - Exposure function:

```ts
// angles in radians
const facingScore = Math.max(0, Math.cos(azimuthDiff)); // head-on best
const elevScore = clamp((sunElevationDeg - 8) / 20, 0, 1); // fade in above ~8°, cap ~28°
const cloudPenalty = 1 - (cloudCover / 100); // 1 clear, 0 fully overcast
let score = facingScore * elevScore * cloudPenalty;

// Shadow penalty: taller building in sun direction within 15–30m?
if (likelyShadow) score *= 0.2;
```

  - Bucket to label:
    - `score >= 0.6` → ☀︎ Sunny
    - `0.3–0.59` → ◑ Mixed
    - `< 0.3` → ▢ Shade

  - Return shape:
    - `{ updatedAt, hours: [ISO], cafes: [{id, name, lat, lon, labelByHour: string[], scoreByHour: number[]}] }`.

5) UI
- Replace template’s page with a two‑pane layout: - top left: Paris weather header (icon, temp, cloud cover), time slider (next 6–8h). - bottom left: café list with the details we have and if we have links perfect, search bar, pill badges for each hour, sortable by distance from a given coord (we'll use the env's KINHOUSE_COORDS variable + sun score filtering 
- Right expendable: Map (MapLibre GL + OSM tiles). Café markers colored by the selected hour’s label; click = detail card with hour chips. 
- Top bar branding: “Kin’s Paris Coffee Shades — Beat the locals. Catch the sun.” (ALREADY IN PLACE)

6) Performance & DX
- Cache Overpass & cafés processing.
- Add `/api/health` for simple checks.
- Add e2e smoke tests (Playwright) to assert list renders with labels.

7) (Phase 2 – Optional) VoxCity integration
- Run VoxCity offline to produce per‑tile hourly shadow masks at 2–5 m resolution for 3 timeslots (morning/noon/afternoon) per month.
- Store masks in `/public/vox/{tileId}/{month}-{slot}.png` + metadata JSON.
- In sunscore, if a café falls in a precomputed tile/hour slot, override the heuristic with the mask lookup (exact sun/no‑sun), still scaled by cloud cover.

8) Copy tweaks
- Empty state: “Loading the best suntraps in Paris…”.
- Café card footer: “For Kin ❤️”

### Minimal Code Stubs

Sun position helper `app/lib/sun.ts`

```ts
import SunCalc from "suncalc";

export function sunAt(dt: Date, lat = 48.8566, lon = 2.3522) {
  const pos = SunCalc.getPosition(dt, lat, lon);
  return {
    azimuth: pos.azimuth,   // radians, 0 = south in suncalc; adjust if needed
    elevation: pos.altitude // radians
  };
}
```

Score bucketing

```ts
export function labelFromScore(s: number) {
  if (s >= 0.6) return "☀︎";
  if (s >= 0.3) return "◑";
  return "▢";
}
```

Angle utils

```ts
export const deg = (r: number) => (r * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;
export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export function circDiff(a: number, b: number) {
  // radians, return [0..π]
  let d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
}
```

### Lean, realistic phases

**Phase 0 — Rebrand & Paris weather (0.5 day)**
- Hardcode Paris coords; rename UI; remove geolocation.
- Deploy and verify perf on Vercel.

**Phase 1 — Cafés + Heuristic Sun Score (1–2 days)**
- `/api/cafes` (Overpass + cache).
- `/api/sunscore` (sun + weather heuristic, building/road bearings).
- List + map + hour slider; labels per café.
- Smoke tests.

**Phase 1.1 — Quality pass (0.5 day)**
- Better bearing picking (choose street edge closest to café).
- Shadow penalty via nearby building heights.

**Phase 2 — VoxCity Precompute (when you have time)**
- Offline run for 10–20 favorite arrondissements; export masks to `/public/vox`.
- API override to use masks when available.
- Toggle in settings: “Use high‑precision shadows where available.”

**Phase 3 — Nice‑to‑haves**
- Save favorites, shareable deep links.
- Filter: outdoor seating only.
- Cluster markers; neighborhood filters.

### Acceptance criteria
- Visiting `/` shows Paris weather, not my location.
- Café list loads under 2s (after first cache warm).
- Each café shows 6–8 hour labels (☀︎/◑/▢).
- Map markers reflect the selected hour.
- No client‑side calls to Overpass.
- App runs on Vercel without paid keys.

### Maintenance
- Cache invalidation daily.
- Backoff/retry on Overpass; fail gracefully to cached.


