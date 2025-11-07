'use client'

import { useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { LocationData } from '@/types'

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
}

export default function Map({ onLocationSelect, selectedLocation, onGoHome }: MapProps) {
  const center = useMemo(() => {
    if (selectedLocation) {
      return [selectedLocation.lat, selectedLocation.lng] as [number, number]
    }
    return [34.0522, -118.2437] as [number, number]
  }, [selectedLocation])

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

  return (
    <div className="w-full h-screen relative">
      <MapContainer
        center={center}
        zoom={selectedLocation ? 12 : 10}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController selectedLocation={selectedLocation} onLocationSelect={onLocationSelect} />
        <HomeControl onGoHome={onGoHome} />
        {selectedLocation && (
          <Marker
            position={[selectedLocation.lat, selectedLocation.lng]}
            icon={createCustomIcon()}
          />
        )}
      </MapContainer>
    </div>
  )
}
