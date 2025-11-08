import { InsightsData, LocationData } from "@/types";
import { NextRequest, NextResponse } from 'next/server'
import { generateInsights } from '@/lib/gemini'
import { fetchWeatherData, fetchFireData } from '../utils'
import { getEarthEngineData, initializeEarthEngine } from '@/lib/earth-engine'

// Initialize Earth Engine on first load
let eeInitialized = false;
if (!eeInitialized) {
  initializeEarthEngine().then(success => {
    eeInitialized = success;
  });
}

export const POST = async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { lat, lng, name } = body;

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

    const location: LocationData = {
      lat: latNum,
      lng: lngNum,
      name: name || undefined,
    };

    console.log('🔍 API: Fetching insights for location:', {
      latitude: location.lat,
      longitude: location.lng,
      name: location.name || 'Unnamed',
      coordinates: `(${location.lat}, ${location.lng})`,
    });

    // Fetch weather, fire, and Earth Engine data in parallel
    const [weather, fire, earthData] = await Promise.all([
      fetchWeatherData(latNum, lngNum),
      fetchFireData(latNum, lngNum),
      getEarthEngineData(latNum, lngNum),
    ])

    console.log('📈 API: Weather data received:', {
      temperature: `${weather.temperature}°C`,
      humidity: `${weather.humidity}%`,
      windSpeed: `${weather.windSpeed} km/h`,
      pressure: `${weather.pressure} hPa`,
      description: weather.description,
    })

    console.log('🔥 API: Fire data received:', {
      riskLevel: fire.riskLevel,
      riskScore: fire.riskScore,
      fireCount: fire.fireCount,
      historicalFires: fire.historicalFires,
      lastFireDate: fire.lastFireDate || 'None',
    })

    console.log('🌍 API: Earth Engine data received:', {
      vegetation: `NDVI: ${earthData.ndvi.toFixed(3)}, EVI: ${earthData.evi.toFixed(3)}`,
      soilMoisture: `${earthData.soilMoisture.toFixed(1)}%`,
      landSurfaceTemp: `${earthData.landSurfaceTemp.toFixed(1)}°C`,
      burnedArea: earthData.burnedArea,
      drought: `${(earthData.drought * 100).toFixed(0)}%`,
    })

    // Generate AI insights using Gemini with Earth Engine data
    const aiData = await generateInsights(location, weather, fire, earthData)

    console.log('🤖 API: AI insights generated:', {
      recommendationsCount: aiData.recommendations?.length || 0,
      hasAIInsights: !!aiData.aiInsights,
      aiRiskScore: aiData.aiRiskScore,
      aiRiskLevel: aiData.aiRiskLevel,
      baseRiskScore: fire.riskScore,
      baseRiskLevel: fire.riskLevel,
      scoreDifference: aiData.aiRiskScore ? (aiData.aiRiskScore - fire.riskScore) : 'N/A',
    })

    // Warn if AI didn't provide risk score
    if (aiData.aiRiskScore === undefined) {
      console.warn('⚠️ AI did not return a risk score - using base score')
    }
    if (aiData.aiRiskLevel === undefined) {
      console.warn('⚠️ AI did not return a risk level - using base level')
    }

    const insights: InsightsData = {
      location,
      weather,
      fire,
      earthData,
      recommendations: aiData.recommendations,
      aiInsights: aiData.aiInsights,
      aiRiskScore: aiData.aiRiskScore,
      aiRiskLevel: aiData.aiRiskLevel,
    }
    
    console.log('📊 API: Insights data prepared:', {
      location: insights.location,
      weather: {
        temp: `${insights.weather.temperature}°C`,
        humidity: `${insights.weather.humidity}%`,
        wind: `${insights.weather.windSpeed} km/h`,
        pressure: `${insights.weather.pressure} hPa`,
      },
      fire: {
        riskLevel: insights.fire.riskLevel,
        riskScore: insights.fire.riskScore,
        fireCount: insights.fire.fireCount,
      },
      hasRecommendations: !!insights.recommendations?.length,
      hasAIInsights: !!insights.aiInsights,
    });
    
    return NextResponse.json(insights, { status: 200 });
  } catch (error) {
    console.error('Error fetching insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}

