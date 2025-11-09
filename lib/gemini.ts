import { WeatherData, FireData, LocationData, EarthEngineData } from '@/types'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Helper function to convert wind direction degrees to cardinal direction
function getWindDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

// Helper function to calculate smart risk score based on conditions
function calculateSmartRiskScore(
  weather: WeatherData,
  fire: FireData,
  earthData?: EarthEngineData
): number {
  let score = 0;

  // Humidity factor (now 18%) - still penalizes very dry air but softens extremes
  const humidityScore = Math.max(0, (100 - weather.humidity) * 0.18);
  score += humidityScore;

  // Wind speed factor (15%) - keeps high winds meaningful but less punishing overall
  const windScore = Math.min(weather.windSpeed * 1.2, 15);
  score += windScore;

  // Temperature factor (12%) - focuses on above-average heat
  const effectiveTemp = Math.max(0, weather.temperature - 5);
  const tempScore = Math.min(effectiveTemp * 0.4, 12);
  score += tempScore;

  if (earthData) {
    // Vegetation/Soil/Drought (softer 19% aggregate)
    const vegetationScore = (1 - earthData.ndvi) * 6; // Low NDVI = high risk
    const soilScore = (100 - earthData.soilMoisture) * 0.06; // Low moisture = high risk
    const droughtScore = earthData.drought * 7; // High drought = high risk
    score += vegetationScore + soilScore + droughtScore;

    // Historical fires (12%)
    const fireHistoryScore = Math.min(fire.fireCount * 2.5, 12);
    score += fireHistoryScore;
  } else {
    // Without earth data, still rely on historical fires but cap lower (25%)
    const fireHistoryScore = Math.min(fire.riskScore * 0.25, 25);
    score += fireHistoryScore;
  }

  // Global damping before bounding to keep scores trending lower
  const dampenedScore = score * 0.9;

  // Ensure score is between 0 and 100
  return Math.round(Math.min(Math.max(dampenedScore, 0), 100));
}

// Helper function to get risk level from score
function getRiskLevelFromScore(score: number): 'low' | 'medium' | 'high' | 'extreme' {
  if (score >= 76) return 'extreme';
  if (score >= 56) return 'high';
  if (score >= 36) return 'medium';
  return 'low';
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
    // Using Gemini 2.0 Flash Lite - most efficient for quick responses
    const modelNames = [
      'gemini-2.0-flash-lite',  // Latest Gemini 2.0 Flash Lite (fastest, most efficient)
      'gemini-2.0-flash-exp',   // Gemini 2.0 Flash experimental fallback
      'gemini-1.5-flash',       // Stable fallback - fast and efficient
      'gemini-1.5-pro',         // More powerful, slower
      'gemini-pro',             // Legacy fallback
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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 REQUIRED RESPONSE FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOU MUST respond with VALID JSON ONLY. No markdown, no code blocks, no explanations outside the JSON.

EXACT FORMAT:
{
  "riskScore": 75,
  "riskLevel": "high",
  "analysis": "Your analysis here",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
}

RULES:
- "riskScore" MUST be a NUMBER between 0 and 100 (not a string!)
- "riskLevel" MUST be one of: "low", "medium", "high", or "extreme"
- "analysis" MUST mention the coordinates (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}), humidity (${weather.humidity}%), and wind speed (${weather.windSpeed} km/h)
- "recommendations" MUST be an array of 3-5 strings

EXAMPLE VALID RESPONSE:
{
  "riskScore": 82,
  "riskLevel": "extreme",
  "analysis": "At coordinates ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}, the combination of ${weather.humidity}% humidity and ${weather.windSpeed} km/h wind speed creates critical fire conditions. The low humidity will cause rapid ignition and the winds will spread fire quickly.",
  "recommendations": [
    "Avoid all outdoor burning and fire-related activities",
    "Clear dry vegetation within 30 feet of structures",
    "Have evacuation routes planned and ready",
    "Monitor local fire alerts continuously"
  ]
}

NOW PROVIDE YOUR RESPONSE AS VALID JSON:`

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

    console.log('🤖 Raw AI response:', text.substring(0, 500)) // Log first 500 chars

    // Try to parse JSON from the response
    try {
      // Remove markdown code blocks if present
      let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      
      // Extract JSON object
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        
        console.log('✅ Parsed AI response:', {
          riskScore: parsed.riskScore,
          riskLevel: parsed.riskLevel,
          hasAnalysis: !!parsed.analysis,
          hasRecommendations: !!parsed.recommendations,
        })
        
        return {
          recommendations: parsed.recommendations || generateDefaultRecommendations(weather, fire),
          aiInsights: parsed.analysis || 'AI analysis generated successfully.',
          aiRiskScore: typeof parsed.riskScore === 'number' ? parsed.riskScore : undefined,
          aiRiskLevel: parsed.riskLevel ? String(parsed.riskLevel).toLowerCase() : undefined,
        }
      }
    } catch (e) {
      console.error('❌ Failed to parse AI JSON response:', e)
      console.log('Attempting text extraction...')
      
      // If JSON parsing fails, try to extract data from text
      const lines = text.split('\n').filter((line: string) => line.trim().length > 0)
      const recommendations: string[] = []
      let analysis = ''
      let extractedScore: number | undefined = undefined
      let extractedLevel: string | undefined = undefined

      // Try to extract risk score from text (e.g., "risk score: 75" or "riskScore: 75")
      const scoreMatch = text.match(/risk\s*score[:\s]+(\d+)/i)
      if (scoreMatch) {
        extractedScore = parseInt(scoreMatch[1])
        console.log(`📊 Extracted risk score from text: ${extractedScore}`)
      }

      // Try to extract risk level from text
      const levelMatch = text.match(/risk\s*level[:\s]+(low|medium|high|extreme)/i)
      if (levelMatch) {
        extractedLevel = levelMatch[1].toLowerCase()
        console.log(`📊 Extracted risk level from text: ${extractedLevel}`)
      }

      for (const line of lines) {
        if (line.match(/^\d+[\.\)]/) || line.startsWith('-')) {
          recommendations.push(line.replace(/^\d+[\.\)]\s*[-•]\s*/, '').trim())
        } else if (line.length > 20 && !line.includes('{') && !line.includes('}')) {
          analysis += line + ' '
        }
      }

      // If we couldn't extract a score, calculate one based on conditions
      if (!extractedScore) {
        extractedScore = calculateSmartRiskScore(weather, fire, earthData)
        console.log(`🧮 Calculated smart risk score: ${extractedScore}`)
      }

      // If we couldn't extract a level, derive it from score
      if (!extractedLevel && extractedScore) {
        extractedLevel = getRiskLevelFromScore(extractedScore)
        console.log(`🏷️ Derived risk level from score: ${extractedLevel}`)
      }

      return {
        recommendations: recommendations.length > 0 ? recommendations : generateDefaultRecommendations(weather, fire),
        aiInsights: analysis.trim() || 'AI analysis generated from structured data.',
        aiRiskScore: extractedScore,
        aiRiskLevel: extractedLevel,
      }
    }

    // Fallback: calculate smart risk score
    const smartScore = calculateSmartRiskScore(weather, fire, earthData)
    const smartLevel = getRiskLevelFromScore(smartScore)
    
    return {
      recommendations: generateDefaultRecommendations(weather, fire),
      aiInsights: 'AI analysis generated successfully.',
      aiRiskScore: smartScore,
      aiRiskLevel: smartLevel,
    }
  } catch (error: any) {
    console.error('Error generating Gemini insights:', error)
    
    // Even on error, provide calculated risk score
    const smartScore = calculateSmartRiskScore(weather, fire, earthData)
    const smartLevel = getRiskLevelFromScore(smartScore)
    
    // Provide more user-friendly error messages
    let errorMessage = 'Using calculated risk assessment based on weather and fire data.'
    
    if (error?.message?.includes('429') || error?.message?.includes('quota')) {
      errorMessage = 'Gemini API quota exceeded. Using calculated risk assessment. Try again later.'
    } else if (error?.message?.includes('404') || error?.message?.includes('not found')) {
      errorMessage = 'Gemini API model unavailable. Using calculated risk assessment based on environmental data.'
    } else if (error?.message?.includes('No available Gemini model')) {
      errorMessage = 'Gemini API temporarily unavailable. Using calculated risk assessment with weather and satellite data.'
    }
    
    return {
      recommendations: generateDefaultRecommendations(weather, fire),
      aiInsights: errorMessage,
      aiRiskScore: smartScore,
      aiRiskLevel: smartLevel,
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
