"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Map, { Marker, Popup } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

type Cafe = {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  labelByHour?: string[];
  scoreByHour?: number[];
};

type CafeMapProps = {
  cafes: Cafe[];
  selectedHour: number;
  selectedCafe: Cafe | null;
  onCafeSelect: (cafe: Cafe | null) => void;
};

export function CafeMap({ cafes, selectedHour, selectedCafe, onCafeSelect }: CafeMapProps) {
  const [mapError, setMapError] = useState<string | null>(null);
  const [viewState, setViewState] = useState({
    longitude: 2.3522,
    latitude: 48.8566,
    zoom: 12
  });
  const mapRef = useRef<any>(null);
  
  // Always use OpenStreetMap due to MapTiler CORS issues
  const mapStyle = {
    "version": 8 as const,
    "sources": {
      "osm": {
        "type": "raster" as const,
        "tiles": ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        "tileSize": 256,
        "attribution": "© OpenStreetMap contributors"
      }
    },
    "layers": [
      {
        "id": "osm",
        "type": "raster" as const,
        "source": "osm"
      }
    ]
  };

  // Auto-focus on selected café
  useEffect(() => {
    if (selectedCafe && mapRef.current) {
      const map = mapRef.current.getMap();
      map.flyTo({
        center: [selectedCafe.lon, selectedCafe.lat],
        zoom: 16,
        duration: 1000,
        essential: true
      });
    }
  }, [selectedCafe]);

  const markers = useMemo(() => {
    const getMarkerColor = (cafe: Cafe) => {
      const label = cafe.labelByHour?.[selectedHour] || "☁️";
      switch (label) {
        case "☀️": return "#ff6b35"; // sunny orange
        case "⛅": return "#f7931e"; // mixed yellow-orange  
        case "☁️": return "#6c757d"; // shade gray
        case "🌙": return "#4a4a4a"; // after dark
        default: return "#6c757d";
      }
    };

    return cafes.map((cafe) => (
      <Marker
        key={cafe.id}
        longitude={cafe.lon}
        latitude={cafe.lat}
        onClick={(e) => {
          e.originalEvent.stopPropagation();
          onCafeSelect(cafe);
        }}
      >
        <div
          className="map-marker"
          style={{
            backgroundColor: getMarkerColor(cafe),
            width: selectedCafe?.id === cafe.id ? 16 : 12,
            height: selectedCafe?.id === cafe.id ? 16 : 12,
            borderRadius: "50%",
            border: selectedCafe?.id === cafe.id ? "2px solid white" : "1px solid white",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
          }}
        />
      </Marker>
    ));
  }, [cafes, selectedHour, selectedCafe, onCafeSelect]);

  if (mapError) {
    return (
      <div className="cafe-map-container">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          textAlign: 'center',
          color: 'var(--accents-5)',
          padding: '20px'
        }}>
          <div>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
            <div style={{ marginBottom: '8px' }}>Map unavailable</div>
            <div style={{ fontSize: '12px' }}>{mapError}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cafe-map-container">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        onClick={() => onCafeSelect(null)}
        onError={(error) => {
          console.error("Map error:", error);
          setMapError("Map temporarily unavailable. Showing café list only.");
        }}
      >
        {markers}
        
        {selectedCafe && (
          <Popup
            longitude={selectedCafe.lon}
            latitude={selectedCafe.lat}
            onClose={() => onCafeSelect(null)}
            closeButton={true}
            closeOnClick={false}
            className="cafe-popup"
          >
            <div className="popup-content">
              <h4>{selectedCafe.name || "Unnamed Café"}</h4>
              <div className="popup-details">
                <div className="sun-info">
                  Current: {selectedCafe.labelByHour?.[selectedHour] || "☁️"}
                  {selectedCafe.scoreByHour?.[selectedHour] && (
                    <span className="score">
                      ({(selectedCafe.scoreByHour[selectedHour] * 100).toFixed(0)}%)
                    </span>
                  )}
                </div>
                {selectedCafe.labelByHour && (
                  <div className="hourly-preview">
                    {selectedCafe.labelByHour.map((label, index) => (
                      <span
                        key={index}
                        className={`mini-badge ${index === selectedHour ? 'current' : ''}`}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Popup>
        )}
      </Map>
      
      <div className="map-legend">
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: "#ff6b35" }}></div>
          <span>Sunny</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: "#f7931e" }}></div>
          <span>Mixed</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: "#6c757d" }}></div>
          <span>Shade</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: "#4a4a4a" }}></div>
          <span>After Dark</span>
        </div>
      </div>
    </div>
  );
}
