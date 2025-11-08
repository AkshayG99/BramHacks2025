import { WeatherData, FireData, LocationData } from '@/types'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function generateInsights(
  location: LocationData,
  weather: WeatherData,
  fire: FireData
): Promise<{ recommendations: string[], aiInsights: string, aiRiskScore?: number, aiRiskLevel?: string }> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
  
  if (!GEMINI_API_KEY) {
    // Return default recommendations if no API key
    return {
      recommendations: generateDefaultRecommendations(weather, fire),
      aiInsights: 'AI insights unavailable. Please add your Gemini API key for intelligent analysis.',
      aiRiskScore: undefined,
      aiRiskLevel: undefined,
    }
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
    
    // Try different model names in order of preference
    const modelNames = [
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest',
    ]

    const prompt = `You are a forest fire risk analyst. Analyze the following location data and provide insights:

Location: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}
Weather Conditions:
- Humidity: ${weather.humidity}%
- Temperature: ${weather.temperature}°C
- Wind Speed: ${weather.windSpeed} km/h
- Visibility: ${weather.visibility} km
- Condition: ${weather.description}

Fire Risk Assessment:
- Current Risk Level: ${fire.riskLevel}
- Current Risk Score: ${fire.riskScore}/100
- Historical Fires: ${fire.historicalFires}
- Recent Fires: ${fire.fireCount}
${fire.lastFireDate ? `- Last Fire: ${fire.lastFireDate}` : ''}

Based on the weather conditions, historical fire data, and location characteristics, provide:
1. Your own calculated risk score (0-100) based on your analysis of all factors
2. A corresponding risk level (low, medium, high, or extreme)
3. A brief 2-3 sentence analysis explaining your risk assessment
4. 3-5 specific, actionable recommendations for fire prevention and safety

Format your response as JSON:
{
  "riskScore": your_calculated_score_number,
  "riskLevel": "low|medium|high|extreme",
  "analysis": "your analysis here",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}`

    // Try each model until one works
    let text = ''
    let lastError: Error | null = null
    
    for (const modelName of modelNames) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent(prompt)
        const response = await result.response
        text = response.text()
        console.log(`Successfully used model: ${modelName}`)
        break
      } catch (error: any) {
        lastError = error
        console.log(`Model ${modelName} failed: ${error.message}`)
        continue
      }
    }
    
    if (!text) {
      throw new Error(`No available Gemini model found. Last error: ${lastError?.message || 'Unknown'}`)
    }

    // Try to parse JSON from the response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          recommendations: parsed.recommendations || generateDefaultRecommendations(weather, fire),
          aiInsights: parsed.analysis || 'AI analysis generated successfully.',
          aiRiskScore: typeof parsed.riskScore === 'number' ? parsed.riskScore : undefined,
          aiRiskLevel: parsed.riskLevel || undefined,
        }
      }
    } catch (e) {
      // If JSON parsing fails, extract recommendations from text
      const lines = text.split('\n').filter((line: string) => line.trim().length > 0)
      const recommendations: string[] = []
      let analysis = ''

      for (const line of lines) {
        if (line.match(/^\d+[\.\)]/) || line.startsWith('-')) {
          recommendations.push(line.replace(/^\d+[\.\)]\s*[-•]\s*/, '').trim())
        } else if (line.length > 20 && !line.includes('{') && !line.includes('}')) {
          analysis += line + ' '
        }
      }

      return {
        recommendations: recommendations.length > 0 ? recommendations : generateDefaultRecommendations(weather, fire),
        aiInsights: analysis.trim() || 'AI analysis generated from structured data.',
        aiRiskScore: undefined,
        aiRiskLevel: undefined,
      }
    }

    return {
      recommendations: generateDefaultRecommendations(weather, fire),
      aiInsights: 'AI analysis generated successfully.',
      aiRiskScore: undefined,
      aiRiskLevel: undefined,
    }
  } catch (error: any) {
    console.error('Error generating Gemini insights:', error)
    return {
      recommendations: generateDefaultRecommendations(weather, fire),
      aiInsights: `Unable to generate AI insights: ${error?.message || 'Unknown error'}. Using default recommendations.`,
      aiRiskScore: undefined,
      aiRiskLevel: undefined,
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

