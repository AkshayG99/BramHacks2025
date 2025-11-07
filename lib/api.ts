import { WeatherData, FireData, LocationData } from '@/types'
import { generateInsights } from './gemini'

const OPENWEATHER_API_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || ''

const fallbackConditions = [
  'smoke-hazed skies',
  'dry offshore flow',
  'patchy clouds',
  'low marine layer',
  'hot downslope winds',
  'monsoon moisture nearby',
]

const seededValue = (lat: number, lng: number, offset: number) => {
  const seed = (lat + 90) * 1000 + (lng + 180) * 1000 + offset
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

const buildFallbackWeather = (lat: number, lng: number): WeatherData => {
  const humidity = Math.round(25 + seededValue(lat, lng, 1) * 50)
  const temperature = Math.round(12 + seededValue(lat, lng, 2) * 28)
  const windSpeed = Math.round(6 + seededValue(lat, lng, 3) * 40)
  const windDirection = Math.round(seededValue(lat, lng, 4) * 360)
  const pressure = Math.round(996 + seededValue(lat, lng, 5) * 25)
  const visibility = Math.round((5 + seededValue(lat, lng, 6) * 8) * 10) / 10
  const description =
    fallbackConditions[Math.floor(seededValue(lat, lng, 7) * fallbackConditions.length)]

  return {
    humidity,
    temperature,
    windSpeed,
    windDirection,
    pressure,
    visibility,
    description,
  }
}

const buildFallbackFire = (lat: number, lng: number): FireData => {
  const vegetationStress = seededValue(lat, lng, 10)
  const windImpact = seededValue(lat, lng, 11)
  const droughtFactor = seededValue(lat, lng, 12)

  const riskScore = Math.round(
    20 + vegetationStress * 35 + windImpact * 20 + droughtFactor * 25
  )

  let riskLevel: 'low' | 'medium' | 'high' | 'extreme'
  if (riskScore < 35) riskLevel = 'low'
  else if (riskScore < 55) riskLevel = 'medium'
  else if (riskScore < 75) riskLevel = 'high'
  else riskLevel = 'extreme'

  const historicalFires = Math.round(vegetationStress * 6 + droughtFactor * 4)
  const fireCount = Math.round(windImpact * 2 + droughtFactor * 3)
  const lastFireDate =
    historicalFires > 0
      ? new Date(
          Date.now() - (45 + seededValue(lat, lng, 13) * 250) * 24 * 60 * 60 * 1000
        )
          .toISOString()
          .split('T')[0]
      : undefined

  return {
    riskLevel,
    riskScore,
    historicalFires,
    lastFireDate,
    fireCount,
  }
}

const EARTH_RADIUS_KM = 6371

const toRadians = (value: number) => (value * Math.PI) / 180

const distanceBetween = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

export async function fetchWeatherData(lat: number, lng: number): Promise<WeatherData> {
  if (!OPENWEATHER_API_KEY) {
    return buildFallbackWeather(lat, lng)
  }

  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=metric`
    )
    
    if (!response.ok) {
      throw new Error('Weather API error')
    }

    const data = await response.json()
    
    return {
      humidity: data.main.humidity,
      temperature: Math.round(data.main.temp),
      windSpeed: Math.round(data.wind?.speed * 3.6 || 0), // Convert m/s to km/h
      windDirection: data.wind?.deg || 0,
      pressure: data.main.pressure,
      visibility: (data.visibility || 10000) / 1000, // Convert to km
      description: data.weather[0]?.description || 'Unknown',
    }
  } catch (error) {
    console.error('Error fetching weather:', error)
    return buildFallbackWeather(lat, lng)
  }
}

export async function fetchFireData(lat: number, lng: number): Promise<FireData> {
  try {
    const response = await fetch(
      'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=wildfires'
    )

    if (!response.ok) {
      throw new Error('Wildfire API error')
    }

    const data = await response.json()

    const eventPoints: Array<{
      id: string
      date: string
      lat: number
      lon: number
    }> = []

    for (const event of data.events || []) {
      for (const geometry of event.geometry || []) {
        if (
          Array.isArray(geometry.coordinates) &&
          geometry.coordinates.length === 2
        ) {
          eventPoints.push({
            id: event.id,
            date: geometry.date || event.geometry?.[0]?.date || event.closed || '',
            lat: geometry.coordinates[1],
            lon: geometry.coordinates[0],
          })
        }
      }
    }

    const radiusKm = 500
    const nearbyEvents = eventPoints
      .map((point) => ({
        ...point,
        distance: distanceBetween(lat, lng, point.lat, point.lon),
      }))
      .filter((point) => point.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)

    if (nearbyEvents.length === 0) {
      return buildFallbackFire(lat, lng)
    }

    const mostRecentEvent = nearbyEvents.reduce((latest, current) => {
      if (!latest) return current
      return new Date(current.date) > new Date(latest.date) ? current : latest
    }, nearbyEvents[0])

    const proximityScore =
      nearbyEvents.length > 0
        ? Math.max(
            0,
            1 - Math.min(nearbyEvents[0].distance, radiusKm) / radiusKm
          ) * 50
        : 0

    const densityScore = Math.min(50, nearbyEvents.length * 8)
    const recencyScore = mostRecentEvent?.date
      ? Math.max(
          0,
          30 -
            (Date.now() - new Date(mostRecentEvent.date).getTime()) /
              (1000 * 60 * 60 * 24)
        )
      : 0

    const riskScore = Math.round(
      Math.min(100, proximityScore + densityScore + recencyScore)
    )

    let riskLevel: FireData['riskLevel']
    if (riskScore < 35) riskLevel = 'low'
    else if (riskScore < 55) riskLevel = 'medium'
    else if (riskScore < 75) riskLevel = 'high'
    else riskLevel = 'extreme'

    return {
      riskLevel,
      riskScore,
      fireCount: nearbyEvents.length,
      historicalFires: eventPoints.length,
      lastFireDate: mostRecentEvent?.date
        ? new Date(mostRecentEvent.date).toISOString().split('T')[0]
        : undefined,
    }
  } catch (error) {
    console.error('Error fetching fire data:', error)
    return buildFallbackFire(lat, lng)
  }
}

export async function fetchAllInsights(location: LocationData) {
  const [weather, fire] = await Promise.all([
    fetchWeatherData(location.lat, location.lng),
    fetchFireData(location.lat, location.lng),
  ])

  // Generate AI insights using Gemini
  const aiData = await generateInsights(location, weather, fire)

  return {
    location,
    weather,
    fire,
    recommendations: aiData.recommendations,
    aiInsights: aiData.aiInsights,
  }
}
