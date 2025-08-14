"use client";

import { useMemo } from "react";
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
  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY || "get_your_own_OpIi9ZULNHzrESv6T2vL";
  
  const mapStyle = `https://api.maptiler.com/maps/streets/style.json?key=${maptilerKey}`;

  const markers = useMemo(() => {
    const getMarkerColor = (cafe: Cafe) => {
      const label = cafe.labelByHour?.[selectedHour] || "🌫️";
      switch (label) {
        case "☀️": return "#ff6b35"; // sunny orange
        case "⛅": return "#f7931e"; // mixed yellow-orange  
        case "🌫️": return "#6c757d"; // shade gray
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

  return (
    <div className="cafe-map-container">
      <Map
        initialViewState={{
          longitude: 2.3522,
          latitude: 48.8566,
          zoom: 12
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        onClick={() => onCafeSelect(null)}
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
                  Current: {selectedCafe.labelByHour?.[selectedHour] || "▢"}
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
          <span>☀️ Sunny</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: "#f7931e" }}></div>
          <span>⛅ Mixed</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: "#6c757d" }}></div>
          <span>🌫️ Shade</span>
        </div>
      </div>
    </div>
  );
}
