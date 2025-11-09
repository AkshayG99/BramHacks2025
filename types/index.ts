export interface LocationData {
  lat: number
  lng: number
  name?: string
  population?: number | null
}

export interface WeatherData {
  humidity: number
  temperature: number
  windSpeed: number
  windDirection: number
  pressure: number
  visibility?: number
  description?: string
}

export interface FireData {
  riskLevel: 'low' | 'medium' | 'high' | 'extreme'
  riskScore: number
  historicalFires: number
  lastFireDate?: string
  fireCount: number
}

export interface EarthEngineData {
  ndvi: number // Normalized Difference Vegetation Index (-1 to 1)
  evi: number // Enhanced Vegetation Index
  soilMoisture: number // Soil moisture (%)
  landSurfaceTemp: number // Land surface temperature (Celsius)
  burnedArea: number // Count of burned pixels
  drought: number // Drought severity index (0-1)
}

export interface InsightsData {
  location: LocationData
  weather: WeatherData
  fire: FireData
  earthData?: EarthEngineData
  vegetation?: {
    type: string
    density: string
  }
  elevation?: number
  recommendations?: string[]
  aiInsights?: string
  aiRiskScore?: number
  aiRiskLevel?: string
}

export interface FirmsDetection {
  id: string
  latitude: number
  longitude: number
  brightTi4: number
  brightTi5?: number | null
  scan: number
  track: number
  acquisitionDate: string
  acquisitionTime: string
  satellite: string
  instrument: string
  confidence: string
  version: string
  frp: number
  daynight: 'D' | 'N' | string
}

export interface FirmsApiResponse {
  detections: FirmsDetection[]
  updatedAt: string
  source?: string
}
