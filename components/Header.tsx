'use client'

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  type FormEvent,
} from 'react'
import type { LocationData, WeatherData, FireData, EarthEngineData } from '@/types'
import type { LucideIcon } from 'lucide-react'
import {
  Flame,
  Wind,
  Droplet,
  Gauge,
  Sparkles,
  MapPin,
  Loader2,
  CheckCircle2,
} from 'lucide-react'

interface HeaderProps {
  onSearchLocation: (query: string) => Promise<void>
  onSelectSuggestion: (location: LocationData) => Promise<void>
  selectedLocation: LocationData
  analysisLocation: LocationData | null
  isSearchLoading: boolean
  insights: {
    weather: WeatherData
    fire: FireData
    earthData?: EarthEngineData
    recommendations?: string[]
    aiInsights?: string
    aiRiskScore?: number
    aiRiskLevel?: string
  } | null
  isInsightsLoading: boolean
  insightsError?: string | null
}

interface Suggestion extends LocationData {
  region?: string
}

interface StatBlock {
  label: string
  value: string
  hint: string
  change: string
  changeColor: string
  icon: LucideIcon
}

const compassLabels = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
]

const formatBearing = (degrees: number) => {
  const index = Math.round(degrees / 22.5) % 16
  return `${compassLabels[index < 0 ? 0 : index]} • ${degrees.toFixed(0)}°`
}

const formatLocationName = (name?: string) => {
  if (!name) return 'Unknown location'
  const parts = name
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[1]}`
  }
  return parts[0] || 'Unknown location'
}

// Convert km/h to mph
const kmhToMph = (kmh: number) => Math.round(kmh * 0.621371)

// Convert real API data to StatBlock format
const deriveStatsFromAPI = (
  weather: WeatherData | null,
  fire: FireData | null,
  isLoading: boolean
): StatBlock[] => {
  if (isLoading || !weather || !fire) {
    return [
      {
        label: 'Wind speed',
        value: '—',
        hint: 'Loading...',
        change: '—',
        changeColor: 'text-gray-500',
        icon: Wind,
      },
      {
        label: 'Humidity',
        value: '—',
        hint: 'Loading...',
        change: '—',
        changeColor: 'text-gray-500',
        icon: Droplet,
      },
      {
        label: 'Containment',
        value: '—',
        hint: 'Loading...',
        change: '—',
        changeColor: 'text-gray-500',
        icon: Gauge,
      },
    ]
  }

  // Convert wind speed from km/h to mph
  const windMph = kmhToMph(weather.windSpeed)
  const windDirection = weather.windDirection

  // Use humidity directly
  const humidity = weather.humidity

  // Use fire risk score as containment (inverted - higher risk = lower containment)
  const containment = Math.max(0, 100 - fire.riskScore)

  // Calculate deltas (we'll use 0 for now since we don't have historical data)
  // In a real app, you'd compare with previous values
  const windDelta = 0
  const humidityDelta = 0
  const containmentDelta = 0

  return [
    {
      label: 'Wind speed',
      value: `${windMph} mph`,
      hint: `Flowing ${formatBearing(windDirection)}`,
      change: `${windDelta >= 0 ? '+' : ''}${windDelta} mph`,
      changeColor: windDelta >= 0 ? 'text-emerald-600' : 'text-rose-500',
      icon: Wind,
    },
    {
      label: 'Humidity',
      value: `${humidity}%`,
      hint: humidity < 25 ? 'Critically dry boundary layer' : 'Marginal moisture',
      change: `${humidityDelta >= 0 ? '+' : ''}${humidityDelta}%`,
      changeColor: humidityDelta >= 0 ? 'text-sky-600' : 'text-rose-500',
      icon: Droplet,
    },
    {
      label: 'Containment',
      value: `${containment}%`,
      hint: fire.riskLevel === 'extreme' 
        ? 'Critical fire risk - immediate action required'
        : fire.riskLevel === 'high'
        ? 'High fire risk - stay alert'
        : 'Incident data refreshed moments ago',
      change: `${containmentDelta >= 0 ? '+' : ''}${containmentDelta}%`,
      changeColor: containmentDelta >= 0 ? 'text-emerald-600' : 'text-amber-600',
      icon: Gauge,
    },
  ]
}

export default function Header({
  onSearchLocation,
  onSelectSuggestion,
  selectedLocation,
  analysisLocation,
  isSearchLoading,
  insights,
  isInsightsLoading,
  insightsError,
}: HeaderProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isSuggestLoading, setIsSuggestLoading] = useState(false)
  const [briefingTimestamp, setBriefingTimestamp] = useState<string>('—')
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(false)
  const [analysisContentHeight, setAnalysisContentHeight] = useState(0)
  const [alertFeedback, setAlertFeedback] = useState<{
    status: 'idle' | 'sending' | 'success' | 'error'
    message?: string
  }>({ status: 'idle' })

  const searchCardRef = useRef<HTMLFormElement | null>(null)
  const analysisContentRef = useRef<HTMLDivElement | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsData, setStatsData] = useState<{ weather: WeatherData | null; fire: FireData | null }>({
    weather: null,
    fire: null,
  })

  // Fetch stats data when selectedLocation changes
  useEffect(() => {
    if (!selectedLocation) {
      setStatsData({ weather: null, fire: null })
      return
    }

    let isCancelled = false
    setStatsLoading(true)

    // Use insights if available, otherwise fetch from API
    if (insights && !isInsightsLoading) {
      setStatsData({
        weather: insights.weather,
        fire: insights.fire,
      })
      setStatsLoading(false)
      return
    }

    // Fetch from API if insights not available
    Promise.all([
      fetch('/api/weatherData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: selectedLocation.lat, lng: selectedLocation.lng }),
      })
        .then(res => res.json())
        .then(data => ({ weather: data })),
      fetch('/api/fireData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: selectedLocation.lat, lng: selectedLocation.lng }),
      })
        .then(res => res.json())
        .then(data => ({ fire: data })),
    ])
      .then(([weatherResult, fireResult]) => {
        if (!isCancelled) {
          setStatsData({
            weather: weatherResult.weather,
            fire: fireResult.fire,
          })
        }
      })
      .catch((error) => {
        console.error('Error fetching stats:', error)
        if (!isCancelled) {
          setStatsData({ weather: null, fire: null })
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setStatsLoading(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [selectedLocation, insights, isInsightsLoading])

  const derivedStats = useMemo(
    () => deriveStatsFromAPI(statsData.weather, statsData.fire, statsLoading),
    [statsData.weather, statsData.fire, statsLoading]
  )
  const recommendationList = insights?.recommendations?.slice(0, 3) ?? []

  const locationLabel = formatLocationName(selectedLocation?.name)
  const analysisLabel = formatLocationName(analysisLocation?.name || selectedLocation?.name)

  const insightsReady = Boolean(insights && analysisLocation)

  useEffect(() => {
    if (!isSearchOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (searchCardRef.current && !searchCardRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isSearchOpen])

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      setSuggestions([])
      setIsSuggestLoading(false)
      return
    }

    setIsSuggestLoading(true)
    const controller = new AbortController()
    const debounce = setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode/suggest?q=${encodeURIComponent(searchQuery)}`, {
          signal: controller.signal,
        })
        const data = await response.json()
        if (response.ok && Array.isArray(data?.suggestions)) {
          setSuggestions(data.suggestions)
        } else {
          setSuggestions([])
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          setSuggestions([])
        }
      } finally {
        setIsSuggestLoading(false)
      }
    }, 250)

    return () => {
      clearTimeout(debounce)
      controller.abort()
    }
  }, [searchQuery])

  useEffect(() => {
    if (!analysisLocation) {
      setIsAnalysisExpanded(false)
    }
  }, [analysisLocation])

  useEffect(() => {
    setBriefingTimestamp(
      new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    )
  }, [])

  useEffect(() => {
    if (!analysisLocation || !analysisContentRef.current) {
      setAnalysisContentHeight(0)
      return
    }

    const measure = () => {
      if (analysisContentRef.current) {
        setAnalysisContentHeight(analysisContentRef.current.scrollHeight)
      }
    }

    measure()
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(analysisContentRef.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [
    analysisLocation,
    isInsightsLoading,
    insightsError,
    insights?.fire.riskScore,
    insights?.fire.lastFireDate,
    insights?.aiInsights,
    recommendationList.length,
  ])

  useEffect(() => {
    setAlertFeedback({ status: 'idle' })
  }, [
    analysisLocation?.lat,
    analysisLocation?.lng,
    insights?.fire.riskLevel,
    insights?.fire.riskScore,
  ])

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!searchQuery.trim()) return

    setSearchError(null)
    try {
      await onSearchLocation(searchQuery)
      setIsSearchOpen(false)
      setSearchQuery('')
      setSuggestions([])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to search for that location'
      setSearchError(message)
    }
  }

  const handleSuggestionSelect = async (suggestion: Suggestion) => {
    await onSelectSuggestion({
      lat: suggestion.lat,
      lng: suggestion.lng,
      name: suggestion.name,
    })
    setSearchQuery('')
    setSuggestions([])
    setIsSearchOpen(false)
  }

  const handleLiveBriefingClick = () => {
    if (!analysisLocation) return
    setIsAnalysisExpanded((prev) => {
      const nextState = !prev
      if (nextState) {
        setBriefingTimestamp(
          new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        )
      }
      return nextState
    })
  }

  const handleSendManualAlert = async () => {
    if (!analysisLocation || !insights) return
    setAlertFeedback({ status: 'sending' })
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationName: analysisLabel,
          coordinates: {
            lat: analysisLocation.lat,
            lng: analysisLocation.lng,
          },
          riskLevel: insights.fire.riskLevel,
          riskScore: insights.aiRiskScore ?? insights.fire.riskScore,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Unable to send alert')
      }

      await response.json()
      setAlertFeedback({
        status: 'success',
        message: 'Alert sent',
      })
    } catch (error: any) {
      setAlertFeedback({
        status: 'error',
        message: error?.message || 'Failed to send alert',
      })
    }
  }

  const getRiskChipStyles = (level?: FireData['riskLevel']) => {
    switch (level) {
      case 'low':
        return 'text-emerald-700 bg-emerald-50'
      case 'medium':
        return 'text-amber-700 bg-amber-50'
      case 'high':
        return 'text-orange-700 bg-orange-50'
      case 'extreme':
        return 'text-rose-700 bg-rose-50'
      default:
        return 'text-slate-700 bg-slate-100'
    }
  }

  const normalizedAiRiskLevel =
    typeof insights?.aiRiskLevel === 'string'
      ? (['low', 'medium', 'high', 'extreme'].includes(
          insights.aiRiskLevel.toLowerCase()
        )
          ? (insights.aiRiskLevel.toLowerCase() as FireData['riskLevel'])
          : undefined)
      : undefined
  const activeRiskLevel =
    normalizedAiRiskLevel ?? insights?.fire.riskLevel
  const activeRiskScore =
    insights?.aiRiskScore ?? insights?.fire.riskScore
  const riskDescriptor = activeRiskLevel
    ? `${activeRiskLevel.charAt(0).toUpperCase()}${activeRiskLevel.slice(1)}`
    : 'Awaiting data'
  const formattedRiskScore =
    activeRiskScore !== undefined ? `${activeRiskScore}/100` : '—'

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-50 px-6 pt-6">
      <div className="pointer-events-auto mx-auto max-w-6xl">
        <div className="rounded-[32px] border border-white/40 bg-gradient-to-br from-white/95 via-white/80 to-white/60 p-6 shadow-[0_25px_65px_rgba(15,23,42,0.15)] backdrop-blur-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-red-500 to-rose-500 shadow-lg shadow-orange-500/40">
                  <Flame className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-apple-dark/60">
                    BramFire Lab
                  </p>
                  <h1 className="text-2xl font-semibold tracking-tight text-apple-dark">
                    Forest Fire Insights
                  </h1>
                  <p className="text-sm text-apple-dark/60">
                    Precision telemetry & risk intelligence in realtime
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="inline-flex items-center gap-3 rounded-2xl border border-rose-100/70 bg-rose-50/80 px-4 py-2 text-rose-700 shadow-inner shadow-white/60">
                  <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-rose-400">
                      Tracking
                    </p>
                    <p className="font-semibold text-apple-dark">{locationLabel}</p>
                  </div>
                </div>

                <div
                  className={`inline-flex items-center gap-3 rounded-2xl px-4 py-2 text-sm font-semibold shadow-inner shadow-white/40 ${getRiskChipStyles(activeRiskLevel)}`}
                >
                  <Gauge className="h-4 w-4" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] opacity-70">
                      Risk posture
                    </p>
                    <p className="text-base">
                      {riskDescriptor}
                      <span className="ml-1 text-xs font-medium opacity-70">· {formattedRiskScore}</span>
                    </p>
                  </div>
                </div>

                <div className="inline-flex items-center gap-3 rounded-2xl border border-apple-dark/5 bg-white/70 px-4 py-2 text-apple-dark/70 shadow-inner shadow-white/60">
                  <Sparkles className="h-4 w-4 text-rose-500" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-apple-dark/40">
                      Live briefing
                    </p>
                    <p className="text-sm font-semibold text-apple-dark">
                      Updated {briefingTimestamp}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSearchOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-full border border-apple-dark/10 bg-white/90 px-4 py-2 text-sm font-semibold text-apple-dark shadow-lg shadow-apple-dark/10 transition hover:-translate-y-0.5"
                >
                  <MapPin className="h-4 w-4 text-rose-500" />
                  Reposition search
                </button>

                {isSearchOpen && (
                  <form
                    ref={searchCardRef}
                    onSubmit={handleSearch}
                    className="absolute right-0 mt-3 w-80 rounded-2xl border border-white/50 bg-white/95 p-4 text-left shadow-2xl"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-apple-dark/50">
                      Jump to location
                    </p>
                    <p className="text-sm text-apple-dark/60">
                      Search any city, landmark, or coordinates.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => {
                          setSearchQuery(event.target.value)
                          setSearchError(null)
                        }}
                        placeholder="e.g. Yosemite Valley"
                        className="flex-1 rounded-xl border border-apple-dark/10 bg-white/80 px-3 py-2 text-sm text-apple-dark shadow-inner shadow-white/50 focus:outline-none focus:ring-2 focus:ring-rose-200"
                      />
                      <button
                        type="submit"
                        disabled={!searchQuery.trim() || isSearchLoading}
                        className="inline-flex h-10 w-14 items-center justify-center rounded-xl bg-apple-dark text-sm font-semibold text-white shadow-lg shadow-apple-dark/30 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSearchLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Go'
                        )}
                      </button>
                    </div>
                    {searchError && (
                      <p className="mt-2 text-xs font-medium text-rose-500">{searchError}</p>
                    )}
                    <div className="mt-3 space-y-1">
                      {isSuggestLoading && (
                        <div className="text-xs text-apple-dark/50">Searching nearby places…</div>
                      )}
                      {!isSuggestLoading &&
                        suggestions.map((suggestion) => (
                          <button
                            key={`${suggestion.lat}-${suggestion.lng}`}
                            type="button"
                            onClick={() => handleSuggestionSelect(suggestion)}
                            className="flex w-full items-start gap-3 rounded-xl border border-transparent px-2 py-2 text-left transition hover:border-rose-100 hover:bg-rose-50/60"
                          >
                            <MapPin className="h-4 w-4 text-rose-500" />
                            <div>
                              <p className="text-sm font-semibold text-apple-dark">
                                {suggestion.name}
                              </p>
                              {suggestion.region && (
                                <p className="text-xs text-apple-dark/60">{suggestion.region}</p>
                              )}
                            </div>
                          </button>
                        ))}
                      {!isSuggestLoading &&
                        searchQuery.trim().length >= 3 &&
                        suggestions.length === 0 && (
                          <p className="text-xs text-apple-dark/50">
                            No matching areas yet—try refining your search.
                          </p>
                        )}
                    </div>
                  </form>
                )}
              </div>

              <button
                type="button"
                onClick={handleLiveBriefingClick}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!analysisLocation}
              >
                <Sparkles className="h-4 w-4" />
                Live briefing
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {derivedStats.map(({ icon: Icon, label, value, hint, change, changeColor }) => (
              <div
                key={label}
                className="flex items-start gap-3 rounded-2xl border border-white/40 bg-white/80 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-apple-gray/60">
                  <Icon className="h-5 w-5 text-apple-dark/70" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-apple-dark/50">{label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-semibold text-apple-dark">{value}</span>
                    <span className={`text-xs font-semibold ${changeColor}`}>{change}</span>
                  </div>
                  <p className="text-xs text-apple-dark/60">{hint}</p>
                </div>
              </div>
            ))}
          </div>

          {analysisLocation && (
            <div
              className="mt-6 overflow-hidden transition-all duration-500"
              style={{
                maxHeight:
                  isAnalysisExpanded && analysisContentHeight
                    ? analysisContentHeight
                    : 0,
                opacity: isAnalysisExpanded ? 1 : 0,
                pointerEvents: isAnalysisExpanded ? 'auto' : 'none',
              }}
            >
              <div
                ref={analysisContentRef}
                className="rounded-3xl border border-white/30 bg-white/95 p-5 transition-opacity duration-500"
                aria-hidden={!isAnalysisExpanded}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-apple-dark/40">
                    Location analysis
                  </p>
                  <p className="text-lg font-semibold text-apple-dark">{analysisLabel}</p>
                </div>

                <div className="mt-5 space-y-4">
                  {isInsightsLoading && (
                    <div className="flex items-center gap-3 text-sm text-apple-dark/60">
                      <div className="h-4 w-4 animate-spin rounded-full border-[3px] border-rose-200 border-t-rose-500" />
                      Pulling live incident data…
                    </div>
                  )}

                  {!isInsightsLoading && insightsError && (
                    <div className="rounded-2xl border border-rose-100 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
                      {insightsError}
                    </div>
                  )}

                  {!isInsightsLoading && insightsReady && insights && (
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-white/50 bg-gradient-to-r from-white to-rose-50/80 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 text-white">
                              <Flame className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-apple-dark/50">
                                Fire risk
                              </p>
                              <p className="text-lg font-semibold text-apple-dark">
                                {insights.aiRiskScore !== undefined ? insights.aiRiskScore : insights.fire.riskScore} / 100
                              </p>
                              {insights.aiRiskScore !== undefined && (
                                <p className="text-[10px] text-apple-dark/50">
                                  AI-calculated (Base: {insights.fire.riskScore})
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getRiskChipStyles(
                              (insights.aiRiskLevel as any) || insights.fire.riskLevel
                            )}`}
                          >
                            {insights.aiRiskLevel || insights.fire.riskLevel}
                          </span>
                        </div>
                        {insights.fire.lastFireDate && (
                          <p className="mt-3 text-xs text-apple-dark/60">
                            Last recorded burn {insights.fire.lastFireDate}
                          </p>
                        )}
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={handleSendManualAlert}
                            disabled={
                              !analysisLocation ||
                              !insights ||
                              alertFeedback.status === 'sending'
                            }
                            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-200 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {alertFeedback.status === 'sending' ? (
                              <Loader2 className="h-4 w-4 animate-spin text-white" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                            Send text alert
                          </button>
                          <div className="text-xs font-medium" aria-live="polite">
                            {alertFeedback.status === 'success' && (
                              <span className="text-emerald-600">
                                {alertFeedback.message || 'Alert sent'}
                              </span>
                            )}
                            {alertFeedback.status === 'error' && (
                              <span className="text-rose-600">
                                {alertFeedback.message || 'Unable to send alert'}
                              </span>
                            )}
                            {alertFeedback.status === 'sending' && (
                              <span className="text-apple-dark/70">Sending alert…</span>
                            )}
                            {alertFeedback.status === 'idle' && (
                              <span className="text-apple-dark/50">
                                Tap to notify your emergency contact.
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Earth Engine Satellite Data Section */}
                      {insights.earthData && (
                        <div className="rounded-2xl border border-white/50 bg-gradient-to-br from-white/90 to-white/70 p-4 shadow-lg backdrop-blur-sm">
                          <div className="mb-3 flex items-center gap-2">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-green-500 to-emerald-600 text-white shadow-md">
                              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.3em] text-apple-dark/50">
                                Earth Engine
                              </p>
                              <p className="text-sm font-semibold text-apple-dark">
                                Satellite Data
                              </p>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            {/* Vegetation Health - NDVI */}
                            <div className="flex items-center justify-between rounded-xl bg-white/60 p-3">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                                  <span className="text-lg">🌿</span>
                                </div>
                                <div>
                                  <p className="text-xs text-apple-dark/60">Vegetation Health (NDVI)</p>
                                  <p className="text-sm font-semibold text-apple-dark">
                                    {insights.earthData.ndvi.toFixed(3)}
                                  </p>
                                </div>
                              </div>
                              <div className={`rounded-full px-2 py-1 text-xs font-medium ${
                                insights.earthData.ndvi > 0.6 ? 'bg-green-100 text-green-700' :
                                insights.earthData.ndvi > 0.3 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {insights.earthData.ndvi > 0.6 ? 'Healthy' :
                                 insights.earthData.ndvi > 0.3 ? 'Moderate' : 'Stressed'}
                              </div>
                            </div>

                            {/* Enhanced Vegetation Index - EVI */}
                            <div className="flex items-center justify-between rounded-xl bg-white/60 p-3">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
                                  <span className="text-lg">🌱</span>
                                </div>
                                <div>
                                  <p className="text-xs text-apple-dark/60">Enhanced Vegetation (EVI)</p>
                                  <p className="text-sm font-semibold text-apple-dark">
                                    {insights.earthData.evi.toFixed(3)}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Soil Moisture */}
                            <div className="flex items-center justify-between rounded-xl bg-white/60 p-3">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                                  <span className="text-lg">💧</span>
                                </div>
                                <div>
                                  <p className="text-xs text-apple-dark/60">Soil Moisture</p>
                                  <p className="text-sm font-semibold text-apple-dark">
                                    {insights.earthData.soilMoisture.toFixed(1)}%
                                  </p>
                                </div>
                              </div>
                              <div className={`rounded-full px-2 py-1 text-xs font-medium ${
                                insights.earthData.soilMoisture > 50 ? 'bg-blue-100 text-blue-700' :
                                insights.earthData.soilMoisture > 30 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-orange-100 text-orange-700'
                              }`}>
                                {insights.earthData.soilMoisture > 50 ? 'Good' :
                                 insights.earthData.soilMoisture > 30 ? 'Low' : 'Very Low'}
                              </div>
                            </div>

                            {/* Land Surface Temperature */}
                            <div className="flex items-center justify-between rounded-xl bg-white/60 p-3">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
                                  <span className="text-lg">🌡️</span>
                                </div>
                                <div>
                                  <p className="text-xs text-apple-dark/60">Surface Temperature</p>
                                  <p className="text-sm font-semibold text-apple-dark">
                                    {insights.earthData.landSurfaceTemp.toFixed(1)}°C
                                  </p>
                                </div>
                              </div>
                              <div className={`rounded-full px-2 py-1 text-xs font-medium ${
                                insights.earthData.landSurfaceTemp > 35 ? 'bg-red-100 text-red-700' :
                                insights.earthData.landSurfaceTemp > 25 ? 'bg-orange-100 text-orange-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {insights.earthData.landSurfaceTemp > 35 ? 'Hot' :
                                 insights.earthData.landSurfaceTemp > 25 ? 'Warm' : 'Cool'}
                              </div>
                            </div>

                            {/* Drought Index */}
                            <div className="flex items-center justify-between rounded-xl bg-white/60 p-3">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                                  <span className="text-lg">🏜️</span>
                                </div>
                                <div>
                                  <p className="text-xs text-apple-dark/60">Drought Index</p>
                                  <p className="text-sm font-semibold text-apple-dark">
                                    {(insights.earthData.drought * 100).toFixed(0)}%
                                  </p>
                                </div>
                              </div>
                              <div className={`rounded-full px-2 py-1 text-xs font-medium ${
                                insights.earthData.drought > 0.6 ? 'bg-red-100 text-red-700' :
                                insights.earthData.drought > 0.4 ? 'bg-orange-100 text-orange-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {insights.earthData.drought > 0.6 ? 'Severe' :
                                 insights.earthData.drought > 0.4 ? 'Moderate' : 'Low'}
                              </div>
                            </div>
                          </div>

                          {/* Burned Area Warning */}
                          {insights.earthData.burnedArea > 0 && (
                            <div className="mt-3 rounded-lg bg-orange-50 border border-orange-200 p-3">
                              <div className="flex items-start gap-2">
                                <span className="text-lg">⚠️</span>
                                <div>
                                  <p className="text-xs font-semibold text-orange-800">
                                    Historical Burn Activity
                                  </p>
                                  <p className="text-xs text-orange-700">
                                    {insights.earthData.burnedArea} burned area(s) detected in past year
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Data Source Attribution */}
                          <p className="mt-3 text-[10px] text-apple-dark/40 text-center">
                            Data from Google Earth Engine • MODIS Satellites
                          </p>
                        </div>
                      )}

                      {(insights.aiInsights || recommendationList.length > 0) && (
                        <div className="rounded-2xl border border-white/50 bg-white/80 p-4">
                          {insights.aiInsights && (
                            <p className="text-sm text-apple-dark/80">{insights.aiInsights}</p>
                          )}
                          {recommendationList.length > 0 && (
                            <ul className="mt-3 space-y-2 text-sm text-apple-dark">
                              {recommendationList.slice(0, 2).map((item) => (
                                <li key={item} className="flex items-start gap-2">
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
