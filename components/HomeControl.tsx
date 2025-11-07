'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

interface HomeControlProps {
  onGoHome: () => void
}

export default function HomeControl({ onGoHome }: HomeControlProps) {
  const map = useMap()

  useEffect(() => {
    if (!map) return

    const homeControl = L.control({ position: 'topleft' })

    homeControl.onAdd = () => {
      const container = L.DomUtil.create('div', 'leaflet-control-home')
      const button = L.DomUtil.create('button', 'home-control-button', container)

      button.type = 'button'
      button.setAttribute('aria-label', 'Return to home view')
      button.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 11L12 3l9 8" />
          <path d="M5 12v8h5v-5h4v5h5v-8" />
        </svg>
      `

      const handleClick = (event: MouseEvent) => {
        event.preventDefault()
        event.stopPropagation()
        onGoHome()
      }

      button.addEventListener('click', handleClick)

      L.DomEvent.disableClickPropagation(button)
      L.DomEvent.disableScrollPropagation(button)

      return container
    }

    homeControl.addTo(map)

    const container = homeControl.getContainer()
    const controlsRoot = map.getContainer().querySelector('.leaflet-top.leaflet-left')
    if (container && controlsRoot) {
      controlsRoot.insertBefore(container, controlsRoot.firstChild)
    }

    return () => {
      homeControl.remove()
    }
  }, [map, onGoHome])

  return null
}
