export interface LocationData {
  lat: number
  lng: number
  name?: string
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

export interface InsightsData {
  location: LocationData
  weather: WeatherData
  fire: FireData
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

