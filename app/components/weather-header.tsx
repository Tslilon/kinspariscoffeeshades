"use client";

import { useState, useEffect } from "react";

type WeatherHeaderProps = {
  hours: string[];
  selectedHour: number;
  onHourChange: (hour: number) => void;
};

export function WeatherHeader({ hours, selectedHour, onHourChange }: WeatherHeaderProps) {
  const [weather, setWeather] = useState<any>(null);

  useEffect(() => {
    async function loadWeather() {
      try {
        const res = await fetch("/api/weather");
        const data = await res.json();
        setWeather(data);
      } catch (error) {
        console.error("Failed to load weather:", error);
      }
    }
    loadWeather();
  }, []);

  const formatHour = (hourISO: string) => {
    const date = new Date(hourISO);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      hour12: false 
    }).replace(':00', 'h');
  };

  const getWeatherIcon = () => {
    // Simple weather icon based on temperature and time
    if (!weather) return "🌡️";
    
    const now = new Date();
    const hour = now.getHours();
    const isNight = hour < 6 || hour > 20;
    
    if (isNight) return "🌙";
    
    const temp = weather.current?.temp_c || 0;
    if (temp > 25) return "☀️";
    if (temp > 15) return "⛅";
    return "🌤️";
  };

  return (
    <div className="weather-header">
      <div className="weather-info">
        <div className="weather-icon">{getWeatherIcon()}</div>
        <div className="weather-details">
          <div className="city">Paris, FR</div>
          <div className="temperature">
            {weather?.current?.temp_c ? Math.round(weather.current.temp_c) : '--'}°C / {weather?.current?.temp_f ? Math.round(weather.current.temp_f) : '--'}°F
          </div>
        </div>
      </div>

      {hours.length > 0 && (
        <div className="time-slider">
          <div className="slider-label">Next hours:</div>
          <div className="hour-pills">
            {hours.map((hour, index) => (
              <button
                key={hour}
                className={`hour-pill ${index === selectedHour ? 'active' : ''}`}
                onClick={() => onHourChange(index)}
              >
                {formatHour(hour)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
