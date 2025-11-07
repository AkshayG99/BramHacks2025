import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(request: NextRequest) {
  try {
    const { location, weather, fire } = await request.json()

    // Use server-side env variable (without NEXT_PUBLIC_) for better security
    // Falls back to NEXT_PUBLIC_ for backwards compatibility
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || ''
    
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      )
    }

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
- Risk Level: ${fire.riskLevel}
- Risk Score: ${fire.riskScore}/100
- Historical Fires: ${fire.historicalFires}
- Recent Fires: ${fire.fireCount}
${fire.lastFireDate ? `- Last Fire: ${fire.lastFireDate}` : ''}

Provide:
1. A brief 2-3 sentence analysis of the fire risk for this location
2. 3-5 specific, actionable recommendations for fire prevention and safety

Format your response as JSON:
{
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
      throw new Error(`No available Gemini model found. Tried: ${modelNames.join(', ')}. Last error: ${lastError?.message || 'Unknown'}`)
    }

    // Try to parse JSON from the response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return NextResponse.json({
          recommendations: parsed.recommendations || [],
          aiInsights: parsed.analysis || 'AI analysis generated successfully.',
        })
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

      return NextResponse.json({
        recommendations: recommendations.length > 0 ? recommendations : [],
        aiInsights: analysis.trim() || 'AI analysis generated successfully.',
      })
    }

    return NextResponse.json({
      recommendations: [],
      aiInsights: 'AI analysis generated successfully.',
    })
  } catch (error: any) {
    console.error('Error generating Gemini insights:', error)
    return NextResponse.json(
      { 
        error: error?.message || 'Unknown error',
        recommendations: [],
        aiInsights: `Unable to generate AI insights: ${error?.message || 'Unknown error'}`,
      },
      { status: 500 }
    )
  }
}

