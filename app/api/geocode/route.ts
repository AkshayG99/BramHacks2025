import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q')?.trim()

    if (!query) {
      return NextResponse.json(
        { error: 'Missing search query' },
        { status: 400 }
      )
    }

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '1',
    })

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        'User-Agent': 'BramFireInsights/1.0 (contact@bramhacks.local)',
      },
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch location data')
    }

    const results = await response.json()

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: 'No results found for that location' },
        { status: 404 }
      )
    }

    const bestMatch = results[0]

    return NextResponse.json({
      lat: parseFloat(bestMatch.lat),
      lng: parseFloat(bestMatch.lon),
      name: bestMatch.display_name,
    })
  } catch (error: any) {
    console.error('Geocode error:', error)
    return NextResponse.json(
      { error: error?.message || 'Unable to search for that location' },
      { status: 500 }
    )
  }
}
