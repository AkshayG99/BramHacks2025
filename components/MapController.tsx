'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import { LocationData } from '@/types'

interface MapControllerProps {
  selectedLocation: LocationData | null
  onLocationSelect: (lat: number, lng: number, name?: string) => void
}

export default function MapController({ selectedLocation, onLocationSelect }: MapControllerProps) {
  const map = useMap()
  
  useEffect(() => {
    if (selectedLocation && map) {
      map.setView([selectedLocation.lat, selectedLocation.lng], 12, {
        animate: true,
        duration: 0.5,
      })
    }
  }, [selectedLocation, map])

  useEffect(() => {
    if (!map) return

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (e.latlng) {
        onLocationSelect(e.latlng.lat, e.latlng.lng)
      }
    }

    map.on('click', handleClick)

    return () => {
      map.off('click', handleClick)
    }
  }, [map, onLocationSelect])

  return null
}
