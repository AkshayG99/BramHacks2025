import { NextRequest, NextResponse } from 'next/server'

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/reverse'

const normalizePlaceName = (data: any) => {
  const address = data?.address || {}
  const hierarchy = [
    address.city,
    address.town,
    address.village,
    address.municipality,
    address.county,
  ].filter(Boolean)

  if (hierarchy.length > 0) {
    const region = address.state || address.region
    return {
      shortName: region ? `${hierarchy[0]}, ${region}` : hierarchy[0],
      name: data?.display_name || hierarchy[0],
    }
  }

  return {
    shortName: data?.display_name || null,
    name: data?.display_name || null,
  }
}

const parsePopulation = (value: any): number | null => {
  if (value === undefined || value === null) {
    return null
  }

  const normalized = String(value).replace(/[, ]/g, '')
  const parsed = Number.parseInt(normalized, 10)
  return Number.isNaN(parsed) ? null : parsed
}

export async function GET(request: NextRequest) {
  try {
    const lat = request.nextUrl.searchParams.get('lat')
    const lng = request.nextUrl.searchParams.get('lng')

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Missing required parameters: lat and lng' },
        { status: 400 }
      )
    }

    const params = new URLSearchParams({
      lat,
      lon: lng,
      format: 'json',
      zoom: '10',
      addressdetails: '1',
    })

    const response = await fetch(`${NOMINATIM_BASE}?${params.toString()}`, {
      headers: {
        'User-Agent': 'BramFireInsights/1.0 (contact@bramhacks.local)',
      },
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      throw new Error('Failed to resolve nearest city')
    }

    const data = await response.json()
    const names = normalizePlaceName(data)
    const population =
      parsePopulation(data?.extratags?.population) ??
      parsePopulation(data?.address?.population) ??
      parsePopulation(data?.population)

    return NextResponse.json({
      lat: Number.parseFloat(lat),
      lng: Number.parseFloat(lng),
      name: names.name,
      shortName: names.shortName,
      population,
    })
  } catch (error: any) {
    console.error('Reverse geocode error:', error)
    return NextResponse.json(
      { error: error?.message || 'Unable to resolve nearest city' },
      { status: 500 }
    )
  }
}
