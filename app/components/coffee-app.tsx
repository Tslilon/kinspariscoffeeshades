"use client";

import { useState, useEffect } from "react";
import { WeatherHeader } from "./weather-header";
import { CafeList } from "./cafe-list";
import { CafeMap } from "./cafe-map";

type Cafe = {
  id: string;
  name: string | null;
  lat: number;
  lon: number;
  labelByHour?: string[];
  scoreByHour?: number[];
};

export function CoffeeApp() {
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [sunScoreData, setSunScoreData] = useState<any>(null);
  const [selectedHour, setSelectedHour] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "distance" | "score">("score");
  const [loading, setLoading] = useState(true);
  const [selectedCafe, setSelectedCafe] = useState<Cafe | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lon: number} | null>(null);
  const [precisionMode, setPrecisionMode] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [voxCityStatus, setVoxCityStatus] = useState<any>(null);

  // Get user location
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // Only use geolocation if we're reasonably close to Paris (within ~100km)
          const parisLat = 48.8566;
          const parisLon = 2.3522;
          const distance = Math.sqrt(
            Math.pow(latitude - parisLat, 2) + Math.pow(longitude - parisLon, 2)
          );
          
          if (distance < 1.0) { // roughly 100km in degrees
            setUserLocation({ lat: latitude, lon: longitude });
          } else {
            // Fall back to KINHOUSE_COORDS if not in Paris area
            setUserLocation({ lat: parisLat, lon: parisLon });
          }
        },
        () => {
          // Fall back to KINHOUSE_COORDS if geolocation fails
          setUserLocation({ lat: 48.8566, lon: 2.3522 });
        }
      );
    } else {
      // Fall back to KINHOUSE_COORDS if geolocation not supported
      setUserLocation({ lat: 48.8566, lon: 2.3522 });
    }
  }, []);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const savedFavorites = localStorage.getItem('kin-coffee-favorites');
      if (savedFavorites) {
        setFavorites(new Set(JSON.parse(savedFavorites)));
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  }, []);

  // Save favorites to localStorage
  const saveFavorites = (newFavorites: Set<string>) => {
    try {
      localStorage.setItem('kin-coffee-favorites', JSON.stringify(Array.from(newFavorites)));
      setFavorites(newFavorites);
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  };

  // Toggle favorite
  const toggleFavorite = (cafeId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(cafeId)) {
      newFavorites.delete(cafeId);
    } else {
      newFavorites.add(cafeId);
    }
    saveFavorites(newFavorites);
  };

  // Fetch initial data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const precisionParam = precisionMode ? 'voxcity' : 'heuristic';
        const [cafesRes, sunScoreRes] = await Promise.all([
          fetch("/api/cafes"),
          fetch(`/api/sunscore?hours=8&precision=${precisionParam}`)
        ]);
        
        const cafesData = await cafesRes.json();
        const sunData = await sunScoreRes.json();
        
        if (cafesData.cafes) {
          setCafes(cafesData.cafes);
        }
        
        if (sunData.cafes) {
          setSunScoreData(sunData);
          setVoxCityStatus(sunData.meta?.voxCityUsage || null);
          
          // Set selectedHour to current Paris time
          if (sunData.hours) {
            const currentParisTime = new Date().toLocaleString("en-US", {timeZone: "Europe/Paris"});
            const currentHour = new Date(currentParisTime).getHours();
            
            // Find the closest hour in the forecast
            let bestMatch = 0;
            let minDiff = Infinity;
            sunData.hours.forEach((hourISO: string, index: number) => {
              const forecastHour = new Date(hourISO).getHours();
              const diff = Math.abs(forecastHour - currentHour);
              if (diff < minDiff) {
                minDiff = diff;
                bestMatch = index;
              }
            });
            setSelectedHour(bestMatch);
          }
          
          // Merge sun score data with cafes
          const mergedCafes = cafesData.cafes?.map((cafe: Cafe) => {
            const sunCafe = sunData.cafes.find((sc: any) => sc.id === cafe.id);
            return {
              ...cafe,
              labelByHour: sunCafe?.labelByHour || [],
              scoreByHour: sunCafe?.scoreByHour || []
            };
          }) || [];
          setCafes(mergedCafes);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [precisionMode]); // Reload when precision mode changes

  // Filter and sort cafes
  const filteredCafes = cafes
    .filter(cafe => {
      // Filter out unnamed cafés
      if (!cafe.name || cafe.name === "Unnamed Café" || cafe.name.trim() === "") {
        return false;
      }
      // Apply search filter
      return !searchQuery || 
        cafe.name.toLowerCase().includes(searchQuery.toLowerCase());
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
          const refLat = userLocation?.lat || 48.8566;
          const refLon = userLocation?.lon || 2.3522;
          
          const distanceA = Math.sqrt(
            Math.pow(a.lat - refLat, 2) + Math.pow(a.lon - refLon, 2)
          );
          const distanceB = Math.sqrt(
            Math.pow(b.lat - refLat, 2) + Math.pow(b.lon - refLon, 2)
          );
          
          return distanceA - distanceB;
        default:
          return 0;
      }
    });

  const hours = sunScoreData?.hours || [];

  // Function to show café on map - opens map and selects café
  const handleShowOnMap = (cafe: Cafe) => {
    setSelectedCafe(cafe);
    setMapVisible(true);
  };

  if (loading) {
    return (
      <div className="coffee-app loading">
        <div className="loading-message">
          Loading the best suntraps in Paris...
        </div>
      </div>
    );
  }

  return (
    <div className="coffee-app">
      <WeatherHeader 
        hours={hours}
        selectedHour={selectedHour}
        onHourChange={setSelectedHour}
      />
      
      <div className={`main-content ${mapVisible ? 'map-visible' : ''}`}>
        <div className="left-panel">
          <CafeList
            cafes={filteredCafes}
            selectedHour={selectedHour}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onCafeSelect={setSelectedCafe}
            selectedCafe={selectedCafe}
            userLocation={userLocation}
            onShowOnMap={handleShowOnMap}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
          />
        </div>
        
        <button 
          className="map-toggle"
          onClick={() => setMapVisible(!mapVisible)}
          title={mapVisible ? 'Hide Map' : 'Show Map'}
        >
          <span className="map-toggle-desktop">
            {mapVisible ? '← Hide Map' : 'Show Map →'}
          </span>
          <span className="map-toggle-mobile">
            {mapVisible ? '✕' : '🗺️'}
          </span>
        </button>
        
        <div className={`right-panel ${mapVisible ? 'visible' : ''}`}>
          {mapVisible && (
            <CafeMap
              cafes={filteredCafes}
              selectedHour={selectedHour}
              selectedCafe={selectedCafe}
              onCafeSelect={setSelectedCafe}
            />
          )}
        </div>
      </div>
      
      {/* Precision Mode Toggle - Bottom Left */}
      <div className="precision-toggle-container">
        <div className="precision-toggle-wrapper">
          <button
            className={`precision-toggle ${precisionMode ? 'precision' : 'heuristic'}`}
            onClick={() => setPrecisionMode(!precisionMode)}
            aria-label="Toggle calculation mode"
          >
            <span className="toggle-indicator"></span>
            <span className="toggle-label">{precisionMode ? 'P' : 'H'}</span>
          </button>
          <div className="precision-tooltip">
                          <div className="tooltip-content">
                <div className="tooltip-header">
                  <strong>{precisionMode ? 'Precision Mode' : 'Heuristic Mode'}</strong>
                </div>
                <div className="tooltip-body">
                  {precisionMode ? (
                    <>
                      <div>🎯 <strong>High-accuracy calculations</strong></div>
                      <div>• Real shadow analysis</div>
                      <div>• 2-5m resolution accuracy</div>
                      <div>• Uses precomputed data</div>
                      {voxCityStatus && (
                        <div className="voxcity-status">
                          <div>📊 <strong>VoxCity Coverage: {voxCityStatus.precisionCoverage}</strong></div>
                          <div>• Precision calculations: {voxCityStatus.voxCityCalculations}</div>
                          <div>• Heuristic fallbacks: {voxCityStatus.heuristicFallbacks}</div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div>📐 <strong>Fast approximations</strong></div>
                      <div>• Street-based orientation</div>
                      <div>• General shadow estimates</div>
                      <div>• Real-time calculations</div>
                    </>
                  )}
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
