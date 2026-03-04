export type WeatherMapped = {
  code: number;
  label: string;
  icon: string; // emoji for now (fast), can swap to SVG icons later
};

export function mapWeatherCode(code: number, isDay?: number): WeatherMapped {
  const day = isDay === 1;

  // Open-Meteo uses WMO weather interpretation codes.
  // Reference mapping (common WMO set):
  // 0 Clear, 1-3 mainly clear/partly cloudy/overcast
  // 45-48 fog
  // 51-57 drizzle
  // 61-67 rain
  // 71-77 snow
  // 80-82 rain showers
  // 85-86 snow showers
  // 95 thunderstorm, 96-99 thunderstorm w/ hail

  const dSun = day ? "☀️" : "🌙";

  if (code === 0) return { code, label: "Clear sky", icon: dSun };
  if (code === 1) return { code, label: "Mainly clear", icon: dSun };
  if (code === 2) return { code, label: "Partly cloudy", icon: day ? "⛅" : "☁️" };
  if (code === 3) return { code, label: "Overcast", icon: "☁️" };

  if (code === 45) return { code, label: "Fog", icon: "🌫️" };
  if (code === 48) return { code, label: "Depositing rime fog", icon: "🌫️" };

  if (code === 51) return { code, label: "Light drizzle", icon: "🌦️" };
  if (code === 53) return { code, label: "Moderate drizzle", icon: "🌦️" };
  if (code === 55) return { code, label: "Dense drizzle", icon: "🌧️" };
  if (code === 56) return { code, label: "Light freezing drizzle", icon: "🧊🌧️" };
  if (code === 57) return { code, label: "Dense freezing drizzle", icon: "🧊🌧️" };

  if (code === 61) return { code, label: "Slight rain", icon: "🌧️" };
  if (code === 63) return { code, label: "Moderate rain", icon: "🌧️" };
  if (code === 65) return { code, label: "Heavy rain", icon: "🌧️" };
  if (code === 66) return { code, label: "Light freezing rain", icon: "🧊🌧️" };
  if (code === 67) return { code, label: "Heavy freezing rain", icon: "🧊🌧️" };

  if (code === 71) return { code, label: "Slight snowfall", icon: "🌨️" };
  if (code === 73) return { code, label: "Moderate snowfall", icon: "🌨️" };
  if (code === 75) return { code, label: "Heavy snowfall", icon: "❄️" };
  if (code === 77) return { code, label: "Snow grains", icon: "❄️" };

  if (code === 80) return { code, label: "Slight rain showers", icon: "🌦️" };
  if (code === 81) return { code, label: "Moderate rain showers", icon: "🌦️" };
  if (code === 82) return { code, label: "Violent rain showers", icon: "⛈️" };

  if (code === 85) return { code, label: "Slight snow showers", icon: "🌨️" };
  if (code === 86) return { code, label: "Heavy snow showers", icon: "❄️" };

  if (code === 95) return { code, label: "Thunderstorm", icon: "⛈️" };
  if (code === 96) return { code, label: "Thunderstorm with slight hail", icon: "⛈️" };
  if (code === 99) return { code, label: "Thunderstorm with heavy hail", icon: "⛈️" };

  return { code, label: "Unknown conditions", icon: "❔" };
}