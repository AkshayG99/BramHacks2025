import { WeatherData, FireData, LocationData, EarthEngineData } from '@/types'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Helper function to convert wind direction degrees to cardinal direction
function getWindDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

export async function generateInsights(
  location: LocationData,
  weather: WeatherData,
  fire: FireData,
  earthData?: EarthEngineData
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

    const earthDataSection = earthData ? `
Earth Engine Satellite Data:
- Vegetation Health (NDVI): ${earthData.ndvi.toFixed(3)} (-1 to 1 scale, lower = drier/stressed vegetation)
- Enhanced Vegetation (EVI): ${earthData.evi.toFixed(3)} (vegetation density indicator)
- Soil Moisture: ${earthData.soilMoisture.toFixed(1)}% (CRITICAL: lower = higher fire risk)
- Land Surface Temperature: ${earthData.landSurfaceTemp.toFixed(1)}°C (higher = increased fire danger)
- Historical Burns: ${earthData.burnedArea} burned area(s) detected in the past year
- Drought Index: ${(earthData.drought * 100).toFixed(0)}% (0-100 scale, higher = more severe drought conditions)
` : '';

    const prompt = `You are an expert wildfire risk analyst. Perform a comprehensive analysis of the following location:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 LOCATION DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: ${location.name || 'Unnamed Location'}
Coordinates: Latitude ${location.lat.toFixed(6)}°, Longitude ${location.lng.toFixed(6)}°
Precise Position: ${location.lat}°N, ${location.lng}°E

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☁️ WEATHER CONDITIONS (CRITICAL FACTORS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌡️ Temperature: ${weather.temperature}°C (${(weather.temperature * 9/5 + 32).toFixed(1)}°F)
💧 Relative Humidity: ${weather.humidity}% ⚠️ ${weather.humidity < 30 ? 'CRITICALLY LOW - HIGH FIRE RISK' : weather.humidity < 50 ? 'LOW - ELEVATED FIRE RISK' : 'MODERATE'}
💨 Wind Speed: ${weather.windSpeed} km/h (${(weather.windSpeed / 1.609).toFixed(1)} mph) ⚠️ ${weather.windSpeed > 20 ? 'HIGH WINDS - RAPID FIRE SPREAD RISK' : weather.windSpeed > 10 ? 'MODERATE WINDS - MONITOR' : 'LIGHT WINDS'}
🧭 Wind Direction: ${weather.windDirection}° (${getWindDirection(weather.windDirection)})
👁️ Visibility: ${weather.visibility || 'N/A'} km
🌤️ Current Conditions: ${weather.description}
🔽 Atmospheric Pressure: ${weather.pressure} hPa
${earthDataSection}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 FIRE RISK ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current Risk Level: ${fire.riskLevel.toUpperCase()}
Current Risk Score: ${fire.riskScore}/100
Total Historical Fires in Region: ${fire.historicalFires}
Recent Active Fires Nearby: ${fire.fireCount}
${fire.lastFireDate ? `Most Recent Fire: ${fire.lastFireDate}` : 'No recent fire history available'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 YOUR ANALYSIS TASK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Analyze ALL the data provided above with special attention to:

KEY FIRE RISK FACTORS TO CONSIDER:
1. 💧 HUMIDITY: ${weather.humidity}% - Low humidity (<30%) = extreme fire risk, rapid ignition
2. 💨 WIND SPEED: ${weather.windSpeed} km/h - High winds (>20 km/h) = rapid fire spread danger
3. 🌡️ TEMPERATURE: ${weather.temperature}°C - High temps (>30°C) = increased fire probability
${earthData ? `4. 🌿 VEGETATION: NDVI ${earthData.ndvi.toFixed(3)} - Low values (<0.3) = dry fuel, high risk
5. 💧 SOIL MOISTURE: ${earthData.soilMoisture.toFixed(1)}% - Low moisture (<30%) = critical drought conditions
6. 🏜️ DROUGHT INDEX: ${(earthData.drought * 100).toFixed(0)}% - High values (>50%) = severe fire weather` : ''}

CALCULATE AND PROVIDE:
1. **Comprehensive Risk Score (0-100)**: Weight the factors appropriately
   - Humidity: 25% (lower = higher risk)
   - Wind Speed: 20% (higher = higher risk)
   - Temperature: 15% (higher = higher risk)
   ${earthData ? `- Vegetation/Soil/Drought: 25% (combined satellite data)
   - Historical fires: 15% (past activity indicator)` : `- Historical fires: 40% (past activity indicator)`}

2. **Risk Level Classification**:
   - LOW (0-35): Minimal fire danger
   - MEDIUM (36-55): Moderate precautions needed
   - HIGH (56-75): Significant fire risk, high alert
   - EXTREME (76-100): Critical danger, immediate action required

3. **Detailed Analysis (2-3 sentences)**: Explain your reasoning, highlighting the MOST CRITICAL factors affecting this location's fire risk right now.

4. **Actionable Recommendations (3-5 items)**: Specific, practical advice based on the current conditions.

⚠️ IMPORTANT: Pay special attention to the combination of low humidity AND high winds - this creates the most dangerous fire conditions!

RESPONSE FORMAT (MUST be valid JSON):
{
  "riskScore": <number 0-100>,
  "riskLevel": "low|medium|high|extreme",
  "analysis": "<your detailed analysis considering coordinates ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}, humidity ${weather.humidity}%, wind speed ${weather.windSpeed} km/h, and all other factors>",
  "recommendations": ["<specific recommendation 1>", "<specific recommendation 2>", "<specific recommendation 3>"]
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

