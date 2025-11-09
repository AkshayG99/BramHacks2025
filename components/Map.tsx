'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { LocationData, FirmsDetection } from '@/types'

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
)
const CircleMarker = dynamic(
  () => import('react-leaflet').then((mod) => mod.CircleMarker),
  { ssr: false }
)
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
)
const MapController = dynamic(
  () => import('./MapController'),
  { ssr: false }
)
const HomeControl = dynamic(
  () => import('./HomeControl'),
  { ssr: false }
)

interface MapProps {
  onLocationSelect: (lat: number, lng: number, name?: string) => void
  selectedLocation: LocationData | null
  onGoHome: () => void
  firmsDetections?: FirmsDetection[]
  isFirmsLoading?: boolean
  firmsError?: string | null
  onRefreshFirms?: () => Promise<void> | void
}

type CityLookupState = {
  name?: string
  population?: number | null
  status?: 'idle' | 'loading' | 'error'
}

export default function Map({
  onLocationSelect,
  selectedLocation,
  onGoHome,
  firmsDetections,
  isFirmsLoading,
  firmsError,
  onRefreshFirms,
}: MapProps) {
  const center = useMemo(() => {
    if (selectedLocation) {
      return [selectedLocation.lat, selectedLocation.lng] as [number, number]
    }
    return [34.0522, -118.2437] as [number, number]
  }, [selectedLocation])

  const populationFormatter = useMemo(() => new Intl.NumberFormat('en-US'), [])
  const [alertStatuses, setAlertStatuses] = useState<Record<string, 'idle' | 'sending' | 'success' | 'error'>>({})
  const [locationAlertStatus, setLocationAlertStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [detectionCityNames, setDetectionCityNames] = useState<Record<string, CityLookupState>>({})
  const activeDetections = firmsDetections || []

  useEffect(() => {
    setLocationAlertStatus('idle')
  }, [selectedLocation?.lat, selectedLocation?.lng])

  // Create custom icon for marker
  const createCustomIcon = useCallback(() => {
    if (typeof window !== 'undefined') {
      const L = require('leaflet')
      return L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          width: 20px;
          height: 20px;
          background: #FF6B35;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })
    }
    return undefined
  }, [])

  const colorForDetection = useCallback((detection: FirmsDetection) => {
    if (detection.daynight === 'N') return '#312e81'
    if (detection.confidence?.toLowerCase?.() === 'high') return '#dc2626'
    return '#f97316'
  }, [])

  const radiusForDetection = useCallback((detection: FirmsDetection) => {
    const base = detection.frp ? Math.min(16, Math.max(6, detection.frp * 0.4)) : 6
    return Number.isFinite(base) ? base : 6
  }, [])

  const fetchNearestCityDetails = useCallback(async (lat: number, lng: number) => {
    const fallback = `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`
    try {
      const response = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
      if (!response.ok) {
        throw new Error('Reverse geocode lookup failed')
      }
      const data = await response.json()
      return {
        name: data?.shortName || data?.name || fallback,
        population: typeof data?.population === 'number' ? data.population : null,
      }
    } catch (error) {
      console.error('Reverse geocode error for detection:', error)
      return {
        name: fallback,
        population: null,
      }
    }
  }, [])

  const ensureDetectionCity = useCallback(
    (detection: FirmsDetection) => {
      let shouldLookup = false
      setDetectionCityNames((prev) => {
        const existing = prev[detection.id]
        if (existing?.name || existing?.status === 'loading') {
          return prev
        }
        shouldLookup = true
        return {
          ...prev,
          [detection.id]: {
            ...existing,
            status: 'loading',
          },
        }
      })

      if (!shouldLookup) {
        return
      }

      ;(async () => {
        try {
          const { name, population } = await fetchNearestCityDetails(detection.latitude, detection.longitude)
          setDetectionCityNames((prev) => ({
            ...prev,
            [detection.id]: {
              name,
              population,
              status: 'idle',
            },
          }))
        } catch (error) {
          console.error('Failed to resolve detection city', error)
          const fallback = `Location (${detection.latitude.toFixed(2)}, ${detection.longitude.toFixed(2)})`
          setDetectionCityNames((prev) => ({
            ...prev,
            [detection.id]: {
              name: fallback,
              population: null,
              status: 'error',
            },
          }))
        }
      })()
    },
    [fetchNearestCityDetails]
  )

  const handleAlertResidents = useCallback(
    async (detection: FirmsDetection, cityName?: string) => {
      if (!detection) return
      setAlertStatuses((prev) => ({ ...prev, [detection.id]: 'sending' }))
      try {
        const riskScore = Math.min(
          100,
          Math.max(45, Math.round(detection.frp * 3 + detection.brightTi4 - 260))
        )
        const riskLevel =
          riskScore >= 80 ? 'extreme' : riskScore >= 60 ? 'high' : riskScore >= 45 ? 'medium' : 'low'

        const response = await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locationName:
              cityName || `FIRMS hotspot (${detection.latitude.toFixed(2)}, ${detection.longitude.toFixed(2)})`,
            coordinates: {
              lat: detection.latitude,
              lng: detection.longitude,
            },
            riskLevel,
            riskScore,
            message: `NASA FIRMS hotspot detected ${detection.acquisitionDate} ${detection.acquisitionTime} UTC near ${
              cityName || `(${detection.latitude.toFixed(2)}, ${detection.longitude.toFixed(2)})`
            }. Brightness ${Math.round(
              detection.brightTi4
            )}K, FRP ${detection.frp.toFixed(1)} MW. Alert nearby residents immediately.`,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => null)
          throw new Error(errorData?.error || 'Failed to trigger alert')
        }

        await response.json()
        setAlertStatuses((prev) => ({ ...prev, [detection.id]: 'success' }))
        setTimeout(() => {
          setAlertStatuses((prev) => ({ ...prev, [detection.id]: 'idle' }))
        }, 6000)
      } catch (error) {
        console.error('Unable to alert residents', error)
        setAlertStatuses((prev) => ({ ...prev, [detection.id]: 'error' }))
        setTimeout(() => {
          setAlertStatuses((prev) => ({ ...prev, [detection.id]: 'idle' }))
        }, 6000)
      }
    },
    []
  )

  const handleAlertSelectedLocation = useCallback(async () => {
    if (!selectedLocation) return
    setLocationAlertStatus('sending')
    try {
      const response = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationName: selectedLocation.name || 'Unknown area',
          coordinates: {
            lat: selectedLocation.lat,
            lng: selectedLocation.lng,
          },
          riskLevel: 'high',
          riskScore: 70,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to send alert')
      }

      await response.json()
      setLocationAlertStatus('success')
      setTimeout(() => setLocationAlertStatus('idle'), 5000)
    } catch (error) {
      console.error('Unable to alert residents for selected location', error)
      setLocationAlertStatus('error')
    }
  }, [selectedLocation])

  const handleRetryFirms = useCallback(() => {
    if (!onRefreshFirms) return
    onRefreshFirms()
  }, [onRefreshFirms])

  return (
    <div className="w-full h-screen relative">
      {firmsError ? (
        <div className="pointer-events-auto absolute left-1/2 top-6 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-rose-200/70 bg-rose-600/95 px-4 py-2 text-xs font-semibold text-white shadow-xl">
          <span>{firmsError}</span>
          {onRefreshFirms && (
            <button
              type="button"
              onClick={handleRetryFirms}
              className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
            >
              Retry
            </button>
          )}
        </div>
      ) : isFirmsLoading ? (
        <div className="pointer-events-none absolute left-1/2 top-6 z-20 -translate-x-1/2 rounded-full border border-white/70 bg-white/90 px-4 py-2 text-xs font-semibold text-apple-dark shadow-xl">
          Syncing NASA hotspots…
        </div>
      ) : null}

      <MapContainer
        center={center}
        zoom={selectedLocation ? 12 : 8}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController selectedLocation={selectedLocation} onLocationSelect={onLocationSelect} />
        <HomeControl onGoHome={onGoHome} />
        {activeDetections.map((detection) => {
          const status = alertStatuses[detection.id] || 'idle'
          const cityMeta = detectionCityNames[detection.id]
          const isCityLoading = cityMeta?.status === 'loading'
          const populationLabel =
            typeof cityMeta?.population === 'number' ? populationFormatter.format(cityMeta.population) : null
          const cityName =
            cityMeta?.name || `Location (${detection.latitude.toFixed(2)}, ${detection.longitude.toFixed(2)})`
          return (
            <CircleMarker
              key={detection.id}
              center={[detection.latitude, detection.longitude]}
              radius={radiusForDetection(detection)}
              pathOptions={{
                color: colorForDetection(detection),
                weight: 1.5,
                fillColor: colorForDetection(detection),
                fillOpacity: 0.7,
              }}
              eventHandlers={{
                click: () => ensureDetectionCity(detection),
                popupopen: () => ensureDetectionCity(detection),
              }}
            >
              <Popup>
                <div className="min-w-[220px] space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-apple-dark/50">Closest city</p>
                    {isCityLoading ? (
                      <div className="space-y-1">
                        <p className="text-sm text-apple-dark/60">Locating nearest city…</p>
                        <p className="text-xs text-apple-dark/50">
                          Lat {detection.latitude.toFixed(2)}, Lng {detection.longitude.toFixed(2)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-base font-semibold text-apple-dark">{cityName}</p>
                    )}
                    {!!populationLabel && !isCityLoading && (
                      <p className="text-xs text-apple-dark/70">Population ≈ {populationLabel}</p>
                    )}
                    {cityMeta?.status === 'error' && (
                      <p className="text-[11px] text-rose-500">Showing approximate location.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAlertResidents(detection, cityMeta?.name)}
                    disabled={status === 'sending'}
                    className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {status === 'sending'
                      ? 'Sending alert…'
                      : status === 'success'
                      ? 'Alert sent'
                      : status === 'error'
                      ? 'Retry'
                      : 'Alert residents'}
                  </button>
                  {status === 'error' && (
                    <p className="text-xs text-rose-500">Failed to send alert. Try again.</p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
        {selectedLocation && (
          <Marker
            position={[selectedLocation.lat, selectedLocation.lng]}
            icon={createCustomIcon()}
          >
            <Popup>
              <div className="min-w-[200px] space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-apple-dark/40">
                    Closest city
                  </p>
                  <p className="text-base font-semibold text-apple-dark">
                    {selectedLocation.name || 'Unknown area'}
                  </p>
                  {typeof selectedLocation.population === 'number' && (
                    <p className="text-xs text-apple-dark/70">
                      Population ≈ {populationFormatter.format(selectedLocation.population)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAlertSelectedLocation}
                  disabled={locationAlertStatus === 'sending'}
                  className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {locationAlertStatus === 'sending'
                    ? 'Sending alert…'
                    : locationAlertStatus === 'success'
                    ? 'Alert sent'
                    : locationAlertStatus === 'error'
                    ? 'Retry alert'
                    : 'Alert residents'}
                </button>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  )
}
