import { NextRequest, NextResponse } from 'next/server'
import { fetchFireData } from '../utils'

export const POST = async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { lat, lng } = body;

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Missing required parameters: lat and lng' },
        { status: 400 }
      );
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return NextResponse.json(
        { error: 'Invalid parameters: lat and lng must be valid numbers' },
        { status: 400 }
      );
    }

    const fireData = await fetchFireData(latNum, lngNum);
    return NextResponse.json(fireData, { status: 200 });
  } catch (error) {
    console.error('Error fetching fire data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fire data' },
      { status: 500 }
    );
  }
}

