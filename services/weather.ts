
import { WeatherData } from "../types";
import { t } from "./translations";

export const getWeather = async (lat: number, lon: number, cityName?: string, lang: string = 'it'): Promise<WeatherData> => {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`
    );
    const data = await response.json();
    
    const daily = data.daily.time.map((time: string, index: number) => ({
      date: time,
      maxTemp: data.daily.temperature_2m_max[index],
      minTemp: data.daily.temperature_2m_min[index],
      weatherCode: data.daily.weather_code[index],
      sunrise: data.daily.sunrise[index],
      sunset: data.daily.sunset[index]
    }));

    return {
      currentTemp: data.current.temperature_2m,
      currentCode: data.current.weather_code,
      humidity: data.current.relative_humidity_2m,
      windSpeed: data.current.wind_speed_10m,
      feelsLike: data.current.apparent_temperature,
      isDay: data.current.is_day,
      daily: daily,
      city: cityName || t('currentLocation', lang) 
    };
  } catch (error) {
    console.error("Weather fetch failed", error);
    return { 
        currentTemp: 0, 
        currentCode: 0, 
        humidity: 0,
        windSpeed: 0,
        feelsLike: 0,
        isDay: 1,
        daily: [],
        city: "N/A" 
    };
  }
};

export const searchCities = async (query: string, lang: string = 'it'): Promise<{id: number, name: string, country: string, latitude: number, longitude: number, admin1?: string}[]> => {
    try {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=${lang}&format=json`);
        const data = await response.json();
        return data.results || [];
    } catch (e) {
        console.error("City search failed", e);
        return [];
    }
}

export const getCityFromCoords = async (lat: number, lon: number, lang: string = 'it'): Promise<string | null> => {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=${lang}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || null;
    } catch (e) {
        console.error("Reverse geocoding failed", e);
        return null;
    }
}

// Uses OpenStreetMap Nominatim for general place search (streets, POIs)
export const searchPlaces = async (query: string, lang: string = 'it'): Promise<{display_name: string, lat: string, lon: string}[]> => {
    try {
        // limit=5 to keep UI clean
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&accept-language=${lang}&addressdetails=1&limit=5`);
        if (!response.ok) return [];
        const data = await response.json();
        return data;
    } catch (e) {
        console.error("Place search failed", e);
        return [];
    }
}

export const getWeatherCodeDescription = (code: number, lang: string = 'it', isDay: boolean = true, windSpeed: number = 0) => {
    // Thresholds for wind conditions
    const isWindy = windSpeed >= 25; // km/h - moderate wind
    const isVeryWindy = windSpeed >= 40; // km/h - strong wind
    
    // Night/Day icons mapping for clear/partly cloudy conditions
    const clearIcon = isDay ? "☀️" : "🌙";
    const partlyCloudyIcon = isDay ? "🌤️" : "☁️";
    const fewCloudsIcon = isDay ? "⛅" : "☁️";
    
    // Wind indicator - show wind condition if windy but not stormy/rainy
    if ((code === 0 || code === 1 || code === 2 || code === 3) && isVeryWindy) {
        return { label: t('weather_windy', lang), icon: "💨" };
    }
    if ((code === 0 || code === 1) && isWindy) {
        return { label: t('weather_breezy', lang), icon: "🍃" };
    }
    
    // WMO Weather interpretation codes
    // 0: Clear sky
    if (code === 0) return { label: isDay ? t('weather_0', lang) : t('weather_0_night', lang), icon: clearIcon };
    
    // 1: Mainly clear
    if (code === 1) return { label: t('weather_1', lang), icon: partlyCloudyIcon };
    
    // 2: Partly cloudy
    if (code === 2) return { label: t('weather_2', lang), icon: fewCloudsIcon };
    
    // 3: Overcast
    if (code === 3) return { label: t('weather_3', lang), icon: "☁️" };
    
    // 45, 48: Fog and depositing rime fog
    if (code === 45) return { label: t('weather_45', lang), icon: "🌫️" };
    if (code === 48) return { label: t('weather_48', lang), icon: "🌫️" };
    
    // 51, 53, 55: Drizzle (light, moderate, dense)
    if (code === 51) return { label: t('weather_51', lang), icon: "🌦️" };
    if (code === 53) return { label: t('weather_53', lang), icon: "🌧️" };
    if (code === 55) return { label: t('weather_55', lang), icon: "🌧️" };
    
    // 56, 57: Freezing drizzle
    if (code === 56 || code === 57) return { label: t('weather_56', lang), icon: "🌨️" };
    
    // 61, 63, 65: Rain (slight, moderate, heavy)
    if (code === 61) return { label: t('weather_61', lang), icon: "🌦️" };
    if (code === 63) return { label: t('weather_63', lang), icon: "🌧️" };
    if (code === 65) return { label: t('weather_65', lang), icon: "🌧️" };
    
    // 66, 67: Freezing rain
    if (code === 66 || code === 67) return { label: t('weather_66', lang), icon: "🌨️" };
    
    // 71, 73, 75: Snow fall (slight, moderate, heavy)
    if (code === 71) return { label: t('weather_71', lang), icon: "🌨️" };
    if (code === 73) return { label: t('weather_73', lang), icon: "❄️" };
    if (code === 75) return { label: t('weather_75', lang), icon: "❄️" };
    
    // 77: Snow grains
    if (code === 77) return { label: t('weather_77', lang), icon: "🌨️" };
    
    // 80, 81, 82: Rain showers (slight, moderate, violent)
    if (code === 80) return { label: t('weather_80', lang), icon: "🌦️" };
    if (code === 81) return { label: t('weather_81', lang), icon: "🌧️" };
    if (code === 82) return { label: t('weather_82', lang), icon: "⛈️" };
    
    // 85, 86: Snow showers (slight, heavy)
    if (code === 85) return { label: t('weather_85', lang), icon: "🌨️" };
    if (code === 86) return { label: t('weather_86', lang), icon: "❄️" };
    
    // 95: Thunderstorm (slight or moderate)
    if (code === 95) return { label: t('weather_95', lang), icon: "⛈️" };
    
    // 96, 99: Thunderstorm with hail (slight, heavy)
    if (code === 96) return { label: t('weather_96', lang), icon: "⛈️" };
    if (code === 99) return { label: t('weather_99', lang), icon: "⛈️" };
    
    return { label: t('weather_default', lang), icon: "🌡️" };
};
