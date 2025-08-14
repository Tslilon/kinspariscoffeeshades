"use client";

import { useState } from "react";
import { calculateDistance, formatDistance } from "@/app/lib/utils";

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
  userLocation?: {lat: number, lon: number} | null;
  onShowOnMap?: (cafe: Cafe) => void;
  favorites: Set<string>;
  onToggleFavorite: (cafeId: string) => void;
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
  selectedCafe,
  userLocation,
  onShowOnMap,
  favorites,
  onToggleFavorite
}: CafeListProps) {
  
  const [expandedCafes, setExpandedCafes] = useState<Set<string>>(new Set());
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  
  const getScoreDisplay = (cafe: Cafe) => {
    const label = cafe.labelByHour?.[selectedHour] || "☁️";
    const score = cafe.scoreByHour?.[selectedHour];
    return { label, score };
  };

  const availableFilters = [
    { id: 'favorites', label: '❤️ Favorites', key: 'favorites' },
    { id: 'sunny', label: 'Sunny', key: 'sunny' },
    { id: 'partial', label: 'Partial Sun', key: 'partial' },
    { id: 'outdoor_seating', label: 'Outdoor', key: 'outdoor_seating' },
    { id: 'wifi', label: 'WiFi', key: 'internet_access' },
    { id: 'vegan', label: 'Vegan', key: 'diet:vegan' },
    { id: 'vegetarian', label: 'Vegetarian', key: 'diet:vegetarian' },
    { id: 'ac', label: 'AC', key: 'air_conditioning' },
    { id: 'accessible', label: 'Accessible', key: 'wheelchair' }
  ];

  const toggleFilter = (filterId: string) => {
    const newFilters = new Set(activeFilters);
    if (newFilters.has(filterId)) {
      newFilters.delete(filterId);
    } else {
      newFilters.add(filterId);
    }
    setActiveFilters(newFilters);
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
      case "☀️":
        return <span className="sun-icon" style={{ ...iconStyle, color: "#ff6b35" }}>☀️</span>;
      case "⛅":
        return <span className="sun-icon" style={{ ...iconStyle, color: "#f7931e" }}>⛅</span>;
      case "☁️":
        return <span className="sun-icon" style={{ ...iconStyle, color: "#6c757d" }}>☁️</span>;
      case "🌙":
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
    .filter(cafe => {
      // Filter out unnamed cafés
      if (!cafe.name || cafe.name === "Unnamed Café" || cafe.name.trim() === "") {
        return false;
      }
      
      // Apply search filter
      if (searchQuery && !cafe.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Apply amenity and sun filters
      if (activeFilters.size > 0) {
        const hasAllFilters = Array.from(activeFilters).every(filterId => {
          if (filterId === 'favorites') {
            return favorites.has(cafe.id);
          }
          
          // Sun level filters
          if (filterId === 'sunny' || filterId === 'partial') {
            const currentLabel = cafe.labelByHour?.[selectedHour];
            if (filterId === 'sunny') {
              return currentLabel === '☀️';
            }
            if (filterId === 'partial') {
              return currentLabel === '⛅';
            }
          }
          
          // Amenity filters
          const filter = availableFilters.find(f => f.id === filterId);
          if (!filter) return true;
          return cafe.tags?.[filter.key] === "yes";
        });
        if (!hasAllFilters) return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        case "score":
          const scoreA = a.scoreByHour?.[selectedHour] || 0;
          const scoreB = b.scoreByHour?.[selectedHour] || 0;
          return scoreB - scoreA;
        case "distance":
          // Calculate distance from user location or KINHOUSE_COORDS fallback
          const kinHouseCoords = process.env.NEXT_PUBLIC_KINHOUSE_COORDS?.split(',') || ['48.8566', '2.3522'];
          const refLat = userLocation?.lat || parseFloat(kinHouseCoords[0]);
          const refLon = userLocation?.lon || parseFloat(kinHouseCoords[1]);
          
          const distanceA = calculateDistance(a.lat, a.lon, refLat, refLon);
          const distanceB = calculateDistance(b.lat, b.lon, refLat, refLon);
          
          return distanceA - distanceB;
        default:
          return 0;
      }
    });

  const displayedCafes = filteredCafes.slice(0, displayCount);
  const hasMore = displayCount < filteredCafes.length;

  return (
    <div className="cafe-list">
      <div className="list-controls">
        <div className="search-sort-row">
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
        
        <div className="filter-pills-row">
          <div className="filter-pills">
            {availableFilters.map(filter => (
              <button
                key={filter.id}
                className={`filter-pill ${activeFilters.has(filter.id) ? 'active' : ''}`}
                data-filter={filter.id}
                onClick={() => toggleFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {activeFilters.size > 0 && (
            <button 
              className="clear-filters"
              onClick={() => setActiveFilters(new Set())}
            >
              Clear all
            </button>
          )}
        </div>
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
          
          // Calculate distance for display
          const kinHouseCoords = process.env.NEXT_PUBLIC_KINHOUSE_COORDS?.split(',') || ['48.8566', '2.3522'];
          const refLat = userLocation?.lat || parseFloat(kinHouseCoords[0]);
          const refLon = userLocation?.lon || parseFloat(kinHouseCoords[1]);
          const distanceKm = calculateDistance(cafe.lat, cafe.lon, refLat, refLon);
          const distanceText = formatDistance(distanceKm);
          
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
                  <div className="cafe-meta-preview">
                    <div className="cafe-address-preview">
                      📍 {address || 'Address not available'}
                    </div>
                    {sortBy === "distance" && (
                      <div className="cafe-distance-preview">
                        🚶 {distanceText}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="cafe-card-right">
                  <button
                    className={`favorite-button ${favorites.has(cafe.id) ? 'favorited' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(cafe.id);
                    }}
                    title={favorites.has(cafe.id) ? 'Remove from Favorites' : 'Add to Favorites'}
                  >
                    {favorites.has(cafe.id) ? '❤️' : '🤍'}
                  </button>
                  <button
                    className="show-map-icon-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onShowOnMap) {
                        onShowOnMap(cafe);
                      }
                    }}
                    title="Show on Map"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                  </button>
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

                  <div className="cafe-location-info">
                    <div className="cafe-distance">
                      📍 Distance: {distanceText} from Kin&apos;s House
                    </div>
                    <div className="cafe-coordinates">
                      📍 Coordinates: {cafe.lat.toFixed(4)}, {cafe.lon.toFixed(4)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
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
      </div>

      {filteredCafes.length === 0 && (
        <div className="empty-state">
          No cafés found matching your search.
        </div>
      )}
    </div>
  );
}