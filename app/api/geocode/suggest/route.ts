import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q')?.trim()

    if (!query) {
      return NextResponse.json(
        { error: 'Missing search query', suggestions: [] },
        { status: 400 }
      )
    }

    const params = new URLSearchParams({
      q: query,
      format: 'json',
      limit: '5',
      addressdetails: '1',
    })

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        'User-Agent': 'BramFireInsights/1.0 (contact@bramhacks.local)',
      },
      next: { revalidate: 60 },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch suggestions')
    }

    const results = await response.json()

    const suggestions = Array.isArray(results)
      ? results.map((result: any) => ({
          name: result.display_name,
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          region:
            result.address?.state || result.address?.region || result.address?.country || '',
        }))
      : []

    return NextResponse.json({ suggestions })
  } catch (error: any) {
    console.error('Geocode suggestion error:', error)
    return NextResponse.json(
      { error: error?.message || 'Unable to fetch suggestions', suggestions: [] },
      { status: 500 }
    )
  }
}
