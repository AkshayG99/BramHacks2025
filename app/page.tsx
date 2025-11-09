'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Header from '@/components/Header'
import Landing from '@/components/Landing'
import {
  LocationData,
  WeatherData,
  FireData,
  InsightsData,
  FirmsDetection,
} from '@/types'

const HOME_LOCATION: LocationData = {
  lat: 43.7315,
  lng: -79.7624,
  name: 'Brampton, Ontario',
}

const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center bg-apple-gray">
      <div className="text-apple-dark/60">Loading map...</div>
    </div>
  ),
})

export default function Home() {
  const [showLanding, setShowLanding] = useState(true)
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSearchLoading, setIsSearchLoading] = useState(false)
  const [insights, setInsights] = useState<{
    weather: WeatherData
    fire: FireData
    recommendations?: string[]
    aiInsights?: string
  } | null>(null)
  const [isInsightsLoading, setIsInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState<string | null>(null)
  const [firmsDetections, setFirmsDetections] = useState<FirmsDetection[]>([])
  const [firmsUpdatedAt, setFirmsUpdatedAt] = useState<string | null>(null)
  const [firmsError, setFirmsError] = useState<string | null>(null)
  const [isFirmsLoading, setIsFirmsLoading] = useState(false)

  const fetchNearestCityDetails = useCallback(async (lat: number, lng: number) => {
    const fallbackName = `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`
    try {
      const response = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
      if (!response.ok) {
        throw new Error('Reverse geocode lookup failed')
      }
      const data = await response.json()
      const population = typeof data?.population === 'number' ? data.population : null
      return {
        name: data?.shortName || data?.name || fallbackName,
        population,
      }
    } catch (error) {
      console.error('Reverse geocode error:', error)
      return {
        name: fallbackName,
        population: null,
      }
    }
  }, [])

  const handleLocationSelect = useCallback(async (lat: number, lng: number, name?: string) => {
    setIsLoading(true)
    try {
      const fallbackName = name || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`
      const locationData: LocationData = {
        lat,
        lng,
        name: fallbackName,
        population: null,
      }
      console.log('📍 Location Selected:', {
        latitude: locationData.lat,
        longitude: locationData.lng,
        name: locationData.name,
        coordinates: `(${locationData.lat}, ${locationData.lng})`,
      })
      setSelectedLocation(locationData)

      const resolvedDetails = await fetchNearestCityDetails(lat, lng)
      setSelectedLocation((prev) => {
        if (!prev) return prev
        if (Math.abs(prev.lat - lat) < 0.0001 && Math.abs(prev.lng - lng) < 0.0001) {
          return {
            ...prev,
            name: name ? prev.name : resolvedDetails.name,
            population: resolvedDetails.population,
          }
        }
        return prev
      })
    } catch (error) {
      console.error('Error fetching location data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [fetchNearestCityDetails])

  useEffect(() => {
    if (!selectedLocation) {
      setInsights(null)
      setInsightsError(null)
      return
    }

    let isCancelled = false
    setIsInsightsLoading(true)
    setInsightsError(null)

    const locationName = selectedLocation.name || `${selectedLocation.lat}, ${selectedLocation.lng}`
    console.log(`🌐 [loading: ${locationName}] Fetching insights...`)

    fetch('/api/insights', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
        name: selectedLocation.name,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }
        return response.json()
      })
      .then((data: InsightsData) => {
        if (isCancelled) return
        
        console.log('✅ Insights Data Received:', {
          location: {
            name: data.location.name,
            coordinates: `(${data.location.lat}, ${data.location.lng})`,
          },
          weather: {
            temperature: `${data.weather.temperature}°C`,
            humidity: `${data.weather.humidity}%`,
            windSpeed: `${data.weather.windSpeed} km/h`,
            windDirection: `${data.weather.windDirection}°`,
            pressure: `${data.weather.pressure} hPa`,
            visibility: data.weather.visibility ? `${data.weather.visibility} km` : 'N/A',
            description: data.weather.description || 'N/A',
          },
          fire: {
            riskLevel: data.fire.riskLevel,
            riskScore: `${data.fire.riskScore}/100`,
            fireCount: data.fire.fireCount,
            historicalFires: data.fire.historicalFires,
            lastFireDate: data.fire.lastFireDate || 'None',
          },
          recommendations: data.recommendations?.length || 0,
          hasAIInsights: !!data.aiInsights,
        })
        
        setInsights({
          weather: data.weather,
          fire: data.fire,
          recommendations: data.recommendations,
          aiInsights: data.aiInsights,
        })
      })
      .catch((error) => {
        if (isCancelled) return
        setInsightsError(error instanceof Error ? error.message : 'Unable to load analysis')
      })
      .finally(() => {
        if (!isCancelled) {
          setIsInsightsLoading(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [selectedLocation])

  const handleSearchLocation = useCallback(
    async (query: string) => {
      const trimmedQuery = query.trim()
      if (!trimmedQuery) {
        return
      }

      setIsSearchLoading(true)
      try {
        console.log('🔎 Searching for location:', { query: trimmedQuery })
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(trimmedQuery)}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.error || 'Unable to find that location')
        }

        console.log('✅ Location found:', {
          name: data.name,
          lat: data.lat,
          lng: data.lng,
        })

        await handleLocationSelect(Number(data.lat), Number(data.lng), data.name)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to search for that location'
        throw new Error(message)
      } finally {
        setIsSearchLoading(false)
      }
    },
    [handleLocationSelect]
  )

  const handleSuggestionSelect = useCallback(
    async (location: LocationData) => {
      await handleLocationSelect(location.lat, location.lng, location.name)
    },
    [handleLocationSelect]
  )

  const handleGoHome = useCallback(async () => {
    await handleLocationSelect(HOME_LOCATION.lat, HOME_LOCATION.lng, HOME_LOCATION.name)
  }, [handleLocationSelect])

  const handleEnterExperience = useCallback(() => {
    setShowLanding(false)
    handleGoHome()
  }, [handleGoHome])

  const fetchFirmsDetections = useCallback(async () => {
    setIsFirmsLoading(true)
    setFirmsError(null)
    try {
      const response = await fetch('/api/firms', { cache: 'no-store' })
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || `HTTP ${response.status}`)
      }
      const data = await response.json()
      setFirmsDetections(Array.isArray(data?.detections) ? data.detections : [])
      setFirmsUpdatedAt(data?.updatedAt || null)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load NASA FIRMS feed'
      setFirmsError(message)
    } finally {
      setIsFirmsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFirmsDetections()
  }, [fetchFirmsDetections])

  if (showLanding) {
    return <Landing onEnter={handleEnterExperience} />
  }

  return (
    <main className="w-full h-screen overflow-hidden relative">
      <Header
        onSearchLocation={handleSearchLocation}
        onSelectSuggestion={handleSuggestionSelect}
        selectedLocation={selectedLocation || HOME_LOCATION}
        isSearchLoading={isSearchLoading || isLoading}
        insights={insights}
        insightsError={insightsError}
        firmsDetections={firmsDetections}
        firmsUpdatedAt={firmsUpdatedAt}
        firmsError={firmsError}
        isFirmsLoading={isFirmsLoading}
      />
      <Map
        onLocationSelect={handleLocationSelect}
        selectedLocation={selectedLocation}
        onGoHome={handleGoHome}
        firmsDetections={firmsDetections}
        isFirmsLoading={isFirmsLoading}
        firmsError={firmsError}
        onRefreshFirms={fetchFirmsDetections}
      />
    </main>
  )
}
