"use client";

import { useState } from "react";

type Cafe = {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  labelByHour?: string[];
  scoreByHour?: number[];
  tags?: Record<string, any>;
};

type CafeListProps = {
  cafes: Cafe[];
  selectedHour: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: "name" | "distance" | "score";
  onSortChange: (sort: "name" | "distance" | "score") => void;
  onCafeSelect: (cafe: Cafe | null) => void;
  selectedCafe: Cafe | null;
};

const ITEMS_PER_PAGE = 10;

export function CafeList({
  cafes,
  selectedHour,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  onCafeSelect,
  selectedCafe
}: CafeListProps) {
  
  const [expandedCafes, setExpandedCafes] = useState<Set<string>>(new Set());
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  
  const getScoreDisplay = (cafe: Cafe) => {
    const label = cafe.labelByHour?.[selectedHour] || "cloudOn";
    const score = cafe.scoreByHour?.[selectedHour];
    return { label, score };
  };

  const formatOpeningHours = (hours: string) => {
    if (!hours) return null;
    // Simplify common patterns
    if (hours.includes("Mo-Su")) {
      const timeMatch = hours.match(/(\d{2}:\d{2})-(\d{2}:\d{2})/);
      if (timeMatch) {
        return `Daily ${timeMatch[1]}-${timeMatch[2]}`;
      }
    }
    return hours.length > 30 ? hours.substring(0, 30) + "..." : hours;
  };

  const getAddress = (cafe: Cafe) => {
    const tags = cafe.tags || {};
    const parts = [];
    if (tags["addr:housenumber"]) parts.push(tags["addr:housenumber"]);
    if (tags["addr:street"]) parts.push(tags["addr:street"]);
    if (tags["addr:postcode"]) parts.push(tags["addr:postcode"]);
    return parts.join(" ");
  };

  const getAmenities = (cafe: Cafe) => {
    const amenities = [];
    const tags = cafe.tags || {};
    
    if (tags.outdoor_seating === "yes") amenities.push("🪑 Outdoor");
    if (tags.indoor_seating === "yes") amenities.push("🏠 Indoor");
    if (tags.air_conditioning === "yes") amenities.push("❄️ AC");
    if (tags.wheelchair === "yes") amenities.push("♿ Accessible");
    if (tags.internet_access === "yes") amenities.push("📶 WiFi");
    if (tags["diet:vegan"] === "yes") amenities.push("🌱 Vegan");
    if (tags["diet:vegetarian"] === "yes") amenities.push("🥬 Vegetarian");
    
    return amenities;
  };

  const renderSunIcon = (label: string, size: number = 24) => {
    const iconStyle = { fontSize: `${size}px` };
    
    switch (label) {
      case "sun":
        return <span className="sun-icon" style={{ ...iconStyle, color: "#ff6b35" }}>☀️</span>;
      case "cloudSun":
        return <span className="sun-icon" style={{ ...iconStyle, color: "#f7931e" }}>⛅</span>;
      case "cloudOn":
        return <span className="sun-icon" style={{ ...iconStyle, color: "#6c757d" }}>☁️</span>;
      case "bedtime":
        return <span className="sun-icon" style={{ ...iconStyle, color: "#4a4a4a" }}>🌙</span>;
      default:
        return <span className="sun-icon" style={{ ...iconStyle, color: "#6c757d" }}>☁️</span>;
    }
  };

  const toggleExpanded = (cafeId: string) => {
    const newExpanded = new Set(expandedCafes);
    if (newExpanded.has(cafeId)) {
      newExpanded.delete(cafeId);
    } else {
      newExpanded.add(cafeId);
    }
    setExpandedCafes(newExpanded);
  };

  // Filter and sort cafes
  const filteredCafes = cafes
    .filter(cafe => 
      !searchQuery || 
      cafe.name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        case "score":
          const scoreA = a.scoreByHour?.[selectedHour] || 0;
          const scoreB = b.scoreByHour?.[selectedHour] || 0;
          return scoreB - scoreA;
        case "distance":
          // TODO: Implement distance sorting using KINHOUSE_COORDS
          return 0;
        default:
          return 0;
      }
    });

  const displayedCafes = filteredCafes.slice(0, displayCount);
  const hasMore = displayCount < filteredCafes.length;

  return (
    <div className="cafe-list">
      <div className="list-controls">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search cafés..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="sort-controls">
          <label>Sort by:</label>
          <select 
            value={sortBy} 
            onChange={(e) => onSortChange(e.target.value as any)}
            className="sort-select"
          >
            <option value="score">Sun Score</option>
            <option value="name">Name</option>
            <option value="distance">Distance</option>
          </select>
        </div>
      </div>

      <div className="cafe-count">
        Showing {displayedCafes.length} of {filteredCafes.length} cafés
      </div>

      <div className="cafe-items">
        {displayedCafes.map((cafe) => {
          const { label, score } = getScoreDisplay(cafe);
          const isSelected = selectedCafe?.id === cafe.id;
          const isExpanded = expandedCafes.has(cafe.id);
          const address = getAddress(cafe);
          const amenities = getAmenities(cafe);
          const hours = formatOpeningHours(cafe.tags?.opening_hours);
          const phone = cafe.tags?.phone;
          const website = cafe.tags?.website;
          const cafeName = cafe.name || "Unnamed Café";
          
          return (
            <div
              key={cafe.id}
              className={`cafe-card ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}
            >
              <div 
                className="cafe-card-header"
                onClick={() => toggleExpanded(cafe.id)}
              >
                <div className="cafe-card-main">
                  <div className="cafe-title">
                    {website ? (
                      <a 
                        href={website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="cafe-name-link"
                      >
                        {cafeName}
                      </a>
                    ) : (
                      <span className="cafe-name">{cafeName}</span>
                    )}
                  </div>
                  {address && (
                    <div className="cafe-address-preview">
                      📍 {address}
                    </div>
                  )}
                </div>
                
                <div className="cafe-card-right">
                  <div className="sun-score-compact">
                    {renderSunIcon(label, 28)}
                    {score !== undefined && (
                      <div className="score-value">
                        {(score * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                  <div className="expand-indicator">
                    {isExpanded ? '▼' : '▶'}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="cafe-card-content">
                  {(hours || phone || website) && (
                    <div className="cafe-contact">
                      {hours && (
                        <div className="cafe-hours">
                          🕒 {hours}
                        </div>
                      )}
                      {phone && (
                        <div className="cafe-phone">
                          📞 <a href={`tel:${phone}`}>{phone}</a>
                        </div>
                      )}
                      {website && (
                        <div className="cafe-website">
                          🌐 <a href={website} target="_blank" rel="noopener noreferrer">
                            {website.replace(/^https?:\/\//, '').split('/')[0]}
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {amenities.length > 0 && (
                    <div className="cafe-amenities">
                      {amenities.map((amenity, index) => (
                        <span key={index} className="amenity-badge">
                          {amenity}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="cafe-actions">
                    <button
                      className={`select-button ${isSelected ? 'selected' : ''}`}
                      onClick={() => onCafeSelect(isSelected ? null : cafe)}
                    >
                      {isSelected ? 'Deselect' : 'Select on Map'}
                    </button>
                  </div>

                  <div className="cafe-coordinates">
                    {cafe.lat.toFixed(4)}, {cafe.lon.toFixed(4)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div className="load-more-container">
          <button
            className="load-more-button"
            onClick={() => setDisplayCount(prev => prev + ITEMS_PER_PAGE)}
          >
            Show More
          </button>
        </div>
      )}

      {filteredCafes.length === 0 && (
        <div className="empty-state">
          No cafés found matching your search.
        </div>
      )}
    </div>
  );
}