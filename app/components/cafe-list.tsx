"use client";

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
  
  const getScoreDisplay = (cafe: Cafe) => {
    const label = cafe.labelByHour?.[selectedHour] || "▢";
    const score = cafe.scoreByHour?.[selectedHour];
    return { label, score };
  };

  const hasOutdoorSeating = (cafe: Cafe) => {
    return cafe.tags?.outdoor_seating === "yes";
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
        {cafes.length} cafés found
      </div>

      <div className="cafe-items">
        {cafes.map((cafe) => {
          const { label, score } = getScoreDisplay(cafe);
          const isSelected = selectedCafe?.id === cafe.id;
          const address = getAddress(cafe);
          const amenities = getAmenities(cafe);
          const hours = formatOpeningHours(cafe.tags?.opening_hours);
          const phone = cafe.tags?.phone;
          const website = cafe.tags?.website;
          
          return (
            <div
              key={cafe.id}
              className={`cafe-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onCafeSelect(isSelected ? null : cafe)}
            >
              <div className="cafe-header">
                <div className="cafe-info">
                  <div className="cafe-name">
                    {cafe.name || "Unnamed Café"}
                  </div>
                  {address && (
                    <div className="cafe-address">
                      📍 {address}
                    </div>
                  )}
                </div>
                
                <div className="sun-score">
                  <div className={`sun-label ${label.replace('️', '')}`}>
                    {label}
                  </div>
                  {score !== undefined && (
                    <div className="score-value">
                      {(score * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              </div>

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

              <div className="cafe-coordinates">
                {cafe.lat.toFixed(4)}, {cafe.lon.toFixed(4)}
              </div>
            </div>
          );
        })}
      </div>

      {cafes.length === 0 && (
        <div className="empty-state">
          No cafés found matching your search.
        </div>
      )}
    </div>
  );
}
