import { NextResponse } from 'next/server'
import type { FirmsDetection } from '@/types'

const FIRMS_API_URL =
  process.env.FIRMS_API_URL ||
  'https://firms.modaps.eosdis.nasa.gov/api/area/csv/a2a6d69dca094876760207e5597cf342/VIIRS_SNPP_NRT/-95,36,-63,54/3'
  //'https://firms.modaps.eosdis.nasa.gov/api/area/csv/a2a6d69dca094876760207e5597cf342/VIIRS_SNPP_NRT/-170,-60,-30,85/2'

export const dynamic = 'force-dynamic'

const formatAcquisitionTime = (time: string) => {
  const digits = (time || '').replace(/\D/g, '').padStart(4, '0').slice(-4)
  const hours = digits.slice(0, 2)
  const minutes = digits.slice(2, 4)
  return `${hours}:${minutes}`
}

const parseCsv = (csv: string): FirmsDetection[] => {
  return csv
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0 && !line.startsWith('latitude'))
    .map((line) => {
      const parts = line.split(',').map((value) => value.trim())
      if (parts.length < 14) return null

      const [
        latitude,
        longitude,
        brightTi4,
        scan,
        track,
        acquisitionDate,
        acquisitionTime,
        satellite,
        instrument,
        confidence,
        version,
        brightTi5,
        frp,
        daynight,
      ] = parts

      const latNum = Number.parseFloat(latitude)
      const lonNum = Number.parseFloat(longitude)
      if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
        return null
      }

      const detection: FirmsDetection = {
        id: `${acquisitionDate}-${acquisitionTime}-${latNum.toFixed(3)}-${lonNum.toFixed(3)}`,
        latitude: latNum,
        longitude: lonNum,
        brightTi4: Number.parseFloat(brightTi4) || 0,
        brightTi5: brightTi5 ? Number.parseFloat(brightTi5) || null : null,
        scan: Number.parseFloat(scan) || 0,
        track: Number.parseFloat(track) || 0,
        acquisitionDate,
        acquisitionTime: formatAcquisitionTime(acquisitionTime),
        satellite: satellite || 'Unknown',
        instrument: instrument || 'Unknown',
        confidence: confidence || '—',
        version: version || '—',
        frp: Number.parseFloat(frp) || 0,
        daynight: (daynight || '').toUpperCase(),
      }

      return detection
    })
    .filter((item): item is FirmsDetection => Boolean(item))
}

export async function GET() {
  try {
    const response = await fetch(FIRMS_API_URL, {
      cache: 'no-store',
      headers: { Accept: 'text/csv' },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Unable to reach NASA FIRMS feed' },
        { status: response.status }
      )
    }

    const csv = await response.text()
    const detections = parseCsv(csv)

    return NextResponse.json({
      detections,
      updatedAt: new Date().toISOString(),
      source: 'NASA FIRMS (VIIRS SNPP NRT)',
    })
  } catch (error) {
    console.error('Error fetching FIRMS feed:', error)
    return NextResponse.json(
      { error: 'Failed to load FIRMS detections' },
      { status: 500 }
    )
  }
}
