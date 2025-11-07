import { WeatherData, FireData, LocationData } from '@/types'

export async function generateInsights(
  location: LocationData,
  weather: WeatherData,
  fire: FireData
): Promise<{ recommendations: string[], aiInsights: string }> {
  const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
  
  if (!GEMINI_API_KEY) {
    // Return default recommendations if no API key
    return {
      recommendations: generateDefaultRecommendations(weather, fire),
      aiInsights: 'AI insights unavailable. Please add your Gemini API key for intelligent analysis.',
    }
  }

  try {
    // Call the API route instead of calling Gemini directly from client
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location,
        weather,
        fire,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || 'API request failed')
    }

    const data = await response.json()
    
    return {
      recommendations: data.recommendations?.length > 0 
        ? data.recommendations 
        : generateDefaultRecommendations(weather, fire),
      aiInsights: data.aiInsights || 'AI analysis generated successfully.',
    }
  } catch (error: any) {
    console.error('Error generating Gemini insights:', error)
    // Provide more helpful error message
    const errorMessage = error?.message || 'Unknown error'
    return {
      recommendations: generateDefaultRecommendations(weather, fire),
      aiInsights: `Unable to generate AI insights: ${errorMessage}. Using default recommendations. Please check your API key and try again.`,
    }
  }
}

function generateDefaultRecommendations(weather: WeatherData, fire: FireData): string[] {
  const recommendations: string[] = []

  if (fire.riskLevel === 'extreme') {
    recommendations.push('Extreme fire risk detected. Avoid all outdoor activities and open flames.')
  } else if (fire.riskLevel === 'high') {
    recommendations.push('High fire risk. Exercise extreme caution with any fire-related activities.')
  }

  if (weather.humidity < 40) {
    recommendations.push('Low humidity increases fire risk. Consider postponing outdoor activities.')
  }

  if (weather.windSpeed > 15) {
    recommendations.push('High wind speeds can spread fires rapidly. Be extra cautious.')
  }

  if (fire.historicalFires > 5) {
    recommendations.push('This area has a history of wildfires. Stay alert and prepared.')
  }

  if (recommendations.length === 0) {
    recommendations.push('Current conditions are relatively safe, but always practice fire safety.')
    recommendations.push('Keep fire extinguishing equipment nearby when engaging in outdoor activities.')
  }

  return recommendations
}

