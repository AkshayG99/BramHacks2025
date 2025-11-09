'use client'

import { useState, useEffect, useMemo, type FormEvent } from 'react'
import type {
  LocationData,
  WeatherData,
  FireData,
  EarthEngineData,
  FirmsDetection,
} from '@/types'
import { Flame, MapPin, Loader2, CloudRain, Wind, Droplets, Thermometer, Lightbulb, AlertTriangle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'

interface HeaderProps {
  onSearchLocation: (query: string) => Promise<void>
  onSelectSuggestion: (location: LocationData) => Promise<void>
  selectedLocation: LocationData
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
  insightsError?: string | null
  isInsightsLoading?: boolean
  firmsDetections?: FirmsDetection[]
  firmsUpdatedAt?: string | null
  isFirmsLoading?: boolean
  firmsError?: string | null
}

interface Suggestion extends LocationData {
  region?: string
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

const getRiskCardStyles = (level?: FireData['riskLevel']) => {
  switch (level) {
    case 'low':
      return {
        container: 'border-emerald-100/70 bg-emerald-50/60',
        label: 'text-emerald-500',
        value: 'text-emerald-700',
        meta: 'text-emerald-700/70',
      }
    case 'medium':
      return {
        container: 'border-amber-100/70 bg-amber-50/60',
        label: 'text-amber-600',
        value: 'text-amber-800',
        meta: 'text-amber-700/70',
      }
    case 'high':
      return {
        container: 'border-orange-100/70 bg-orange-50/60',
        label: 'text-orange-600',
        value: 'text-orange-800',
        meta: 'text-orange-700/70',
      }
    case 'extreme':
      return {
        container: 'border-rose-100/70 bg-rose-50/60',
        label: 'text-rose-600',
        value: 'text-rose-800',
        meta: 'text-rose-700/70',
      }
    default:
      return {
        container: 'border-slate-200 bg-white/80',
        label: 'text-slate-500',
        value: 'text-slate-800',
        meta: 'text-slate-600/80',
      }
  }
}

const PEOPLE_AT_RISK = '2.28 M'

export default function Header({
  onSearchLocation,
  onSelectSuggestion,
  selectedLocation,
  isSearchLoading,
  insights,
  insightsError,
  isInsightsLoading,
  firmsDetections,
  firmsUpdatedAt,
  isFirmsLoading,
  firmsError,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchError, setSearchError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isSuggestLoading, setIsSuggestLoading] = useState(false)
  const [briefingTimestamp, setBriefingTimestamp] = useState<string>('—')
  const [isInsightsExpanded, setIsInsightsExpanded] = useState(true)

  useEffect(() => {
    setBriefingTimestamp(
      new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    )
  }, [])

  // Auto-expand insights when location changes and insights are being loaded
  useEffect(() => {
    if (isInsightsLoading) {
      setIsInsightsExpanded(true)
    }
  }, [isInsightsLoading, selectedLocation])

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

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!searchQuery.trim()) return

    setSearchError(null)
    try {
      await onSearchLocation(searchQuery)
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
  }

  const firmsSummary = useMemo(() => {
    const detections = firmsDetections || []
    if (!detections.length) {
      return {
        total: 0,
        day: 0,
        night: 0,
        avgFrp: 0,
        hottest: null as FirmsDetection | null,
      }
    }

    const aggregate = detections.reduce(
      (acc, detection) => {
        acc.total += 1
        acc.totalFrp += detection.frp || 0
        if (detection.daynight === 'N') acc.night += 1
        else acc.day += 1
        if (!acc.hottest || detection.brightTi4 > acc.hottest.brightTi4) {
          acc.hottest = detection
        }
        return acc
      },
      {
        total: 0,
        day: 0,
        night: 0,
        totalFrp: 0,
        hottest: null as FirmsDetection | null,
      }
    )

    return {
      total: aggregate.total,
      day: aggregate.day,
      night: aggregate.night,
      avgFrp: aggregate.total ? aggregate.totalFrp / aggregate.total : 0,
      hottest: aggregate.hottest,
    }
  }, [firmsDetections])

  const formattedFirmsTimestamp = useMemo(() => {
    if (!firmsUpdatedAt) return 'Awaiting FIRMS feed'
    const parsed = new Date(firmsUpdatedAt)
    if (Number.isNaN(parsed.getTime())) return 'Awaiting FIRMS feed'
    const diffMinutes = Math.max(0, Math.round((Date.now() - parsed.getTime()) / 60000))
    let relative: string
    if (diffMinutes < 1) relative = 'moments ago'
    else if (diffMinutes === 1) relative = '1 min ago'
    else if (diffMinutes < 60) relative = `${diffMinutes} min ago`
    else {
      const diffHours = Math.round(diffMinutes / 60)
      relative = diffHours === 1 ? '1 hr ago' : `${diffHours} hrs ago`
    }
    const clock = parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return `Synced ${relative} • ${clock}`
  }, [firmsUpdatedAt])

  const normalizedAiRiskLevel =
    typeof insights?.aiRiskLevel === 'string'
      ? (['low', 'medium', 'high', 'extreme'].includes(
          insights.aiRiskLevel.toLowerCase()
        )
          ? (insights.aiRiskLevel.toLowerCase() as FireData['riskLevel'])
          : undefined)
      : undefined

  const activeRiskLevel = normalizedAiRiskLevel ?? insights?.fire?.riskLevel
  const activeRiskScore = insights?.aiRiskScore ?? insights?.fire?.riskScore

  const locationLabel = formatLocationName(selectedLocation?.name)
  const hottestDetection = firmsSummary.hottest
  const peakBrightnessValue = hottestDetection ? `${Math.round(hottestDetection.brightTi4)} K` : '—'
  const riskCardStyles = getRiskCardStyles(activeRiskLevel)
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-6">
      <div className="pointer-events-auto mx-auto max-w-5xl">
        <div className="rounded-3xl border border-white/50 bg-white/90 p-4 shadow-[0_10px_35px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-500 text-white shadow-lg shadow-orange-500/40">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-apple-dark/60">
                  BramFire Labs
                </p>
                <p className="text-base font-semibold text-apple-dark">Fire Ops Overview</p>
                <p className="text-xs text-apple-dark/50">{formattedFirmsTimestamp}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-100/80 bg-rose-50/80 px-4 py-1.5 text-sm font-medium text-rose-700">
                <span className="flex h-2 w-2 animate-pulse rounded-full bg-rose-500" />
                {locationLabel}
              </div>
              <div className="inline-flex items-center gap-2 rounded-2xl border border-rose-100/80 bg-rose-50/80 px-3 py-1 text-xs text-rose-700">
                <Sparkles className="h-4 w-4" />
                <div className="leading-tight">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-rose-500/80">Peak brightness</p>
                  <p className="text-sm font-semibold text-rose-700">{peakBrightnessValue}</p>
                </div>
              </div>
              
            </div>
          </div>

          <div className="mt-3">
            <form onSubmit={handleSearch} className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.3em] text-apple-dark/40">
                Search an area
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value)
                      setSearchError(null)
                    }}
                    placeholder="Try Brampton, Ontario"
                    className="w-full rounded-2xl border border-apple-dark/10 bg-white/80 py-2.5 pl-9 pr-3 text-sm text-apple-dark shadow-inner shadow-white/70 focus:outline-none focus:ring-2 focus:ring-rose-200"
                  />
                  {(isSuggestLoading || suggestions.length > 0 || searchError) && (
                    <div className="absolute left-0 right-0 top-11 z-20 rounded-2xl border border-white/60 bg-white/95 p-2 shadow-xl">
                      {isSuggestLoading && (
                        <p className="px-2 py-1 text-xs text-apple-dark/60">Searching nearby places…</p>
                      )}
                      {!isSuggestLoading && suggestions.length > 0 && (
                        <div className="space-y-1">
                          {suggestions.map((suggestion) => (
                            <button
                              key={`${suggestion.lat}-${suggestion.lng}`}
                              type="button"
                              onClick={() => handleSuggestionSelect(suggestion)}
                              className="flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left text-sm text-apple-dark transition hover:bg-rose-50/70"
                            >
                              <MapPin className="mt-0.5 h-4 w-4 text-rose-500" />
                              <div>
                                <p className="font-semibold">{suggestion.name}</p>
                                {suggestion.region && (
                                  <p className="text-xs text-apple-dark/60">{suggestion.region}</p>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {!isSuggestLoading && searchError && (
                        <p className="px-2 py-1 text-xs text-rose-600">{searchError}</p>
                      )}
                      {!isSuggestLoading && !suggestions.length && !searchError && searchQuery.trim().length >= 3 && (
                        <p className="px-2 py-1 text-xs text-apple-dark/50">No matching areas yet.</p>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!searchQuery.trim() || isSearchLoading}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-apple-dark px-5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Go'}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-orange-100/70 bg-orange-50/60 p-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-orange-500">Hotspots</p>
              <p className="text-2xl font-semibold text-orange-700">
                {isFirmsLoading ? '—' : firmsSummary.total}
              </p>
              <p className="text-xs text-orange-700/70">
                {firmsSummary.total ? `${firmsSummary.day} day • ${firmsSummary.night} night` : 'Awaiting satellites'}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100/70 bg-emerald-50/60 p-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-500">People at risk</p>
              <p className="text-2xl font-semibold text-emerald-700">{PEOPLE_AT_RISK}</p>
              <p className="text-xs text-emerald-700/70">Estimated population in danger zone</p>
            </div>
            <div className={`rounded-2xl border ${riskCardStyles.container} px-4 py-3`}>
              <p className={`text-[10px] uppercase tracking-[0.3em] ${riskCardStyles.label}`}>Fire score</p>
              <p className={`mt-0.5 text-2xl font-semibold capitalize ${riskCardStyles.value}`}>
                {activeRiskLevel ? activeRiskLevel : 'Risk pending'}
              </p>
              <p className={`mt-0.5 text-xs ${riskCardStyles.meta}`}>
                {activeRiskScore !== undefined ? `Score ${activeRiskScore}/100` : 'Awaiting AI briefing'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
