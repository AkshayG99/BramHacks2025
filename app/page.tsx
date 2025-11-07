'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Header from '@/components/Header'
import Landing from '@/components/Landing'
import { fetchAllInsights } from '@/lib/api'
import { LocationData, WeatherData, FireData } from '@/types'

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

  const handleLocationSelect = useCallback(async (lat: number, lng: number, name?: string) => {
    setIsLoading(true)
    try {
      const locationData: LocationData = {
        lat,
        lng,
        name: name || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      }
      setSelectedLocation(locationData)
    } catch (error) {
      console.error('Error fetching location data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedLocation) {
      setInsights(null)
      setInsightsError(null)
      return
    }

    let isCancelled = false
    setIsInsightsLoading(true)
    setInsightsError(null)

    fetchAllInsights(selectedLocation)
      .then((data) => {
        if (isCancelled) return
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
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(trimmedQuery)}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data?.error || 'Unable to find that location')
        }

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

  if (showLanding) {
    return <Landing onEnter={handleEnterExperience} />
  }

  return (
    <main className="w-full h-screen overflow-hidden relative">
      <Header
        onSearchLocation={handleSearchLocation}
        onSelectSuggestion={handleSuggestionSelect}
        selectedLocation={selectedLocation || HOME_LOCATION}
        analysisLocation={selectedLocation}
        isSearchLoading={isSearchLoading || isLoading}
        insights={insights}
        isInsightsLoading={isInsightsLoading}
        insightsError={insightsError}
      />
      <Map
        onLocationSelect={handleLocationSelect}
        selectedLocation={selectedLocation}
        onGoHome={handleGoHome}
      />
    </main>
  )
}
