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

  // Fetch initial data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [cafesRes, sunScoreRes] = await Promise.all([
          fetch("/api/cafes"),
          fetch("/api/sunscore?hours=8")
        ]);
        
        const cafesData = await cafesRes.json();
        const sunData = await sunScoreRes.json();
        
        if (cafesData.cafes) {
          setCafes(cafesData.cafes);
        }
        
        if (sunData.cafes) {
          setSunScoreData(sunData);
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
  }, []);

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

  const hours = sunScoreData?.hours || [];

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
      
      <div className="main-content">
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
          />
        </div>
        
        <div className={`right-panel ${mapVisible ? 'visible' : ''}`}>
          <button 
            className="map-toggle"
            onClick={() => setMapVisible(!mapVisible)}
          >
            {mapVisible ? '← Hide Map' : 'Show Map →'}
          </button>
          
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
    </div>
  );
}
