import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_TO =
  process.env.ALERT_DEFAULT_PHONE ||
  process.env.ALERT_PHONE_NUMBER ||
  '+18777804236'

const getTwilioClient = () => {
  const accountSid =
    process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN_FALLBACK || ''

  if (!accountSid || !authToken) {
    throw new Error('Missing Twilio account SID or auth token')
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const twilio = require('twilio')
  return twilio(accountSid, authToken)
}

export const POST = async (request: NextRequest) => {
  try {
    const body = await request.json()
    const {
      locationName,
      coordinates,
      riskLevel,
      riskScore,
      to = DEFAULT_TO,
      message,
    } = body || {}

    if (!to) {
      return NextResponse.json(
        { error: 'Missing destination phone number' },
        { status: 400 }
      )
    }

    const messagingServiceSid =
      process.env.TWILIO_MESSAGING_SERVICE_SID ||
      'MGfa37dd55596eaeb0d1c5c84b70b25094'

    if (!messagingServiceSid) {
      return NextResponse.json(
        { error: 'Missing Twilio messaging service SID' },
        { status: 500 }
      )
    }

    const summary =
      message ||
      [
        '🔥 Forest Fire Alert!',
        locationName ? `📍 ${locationName}` : undefined,
        coordinates ? `(${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)})` : undefined,
        riskLevel && riskScore !== undefined
          ? `⚠️ Risk: ${riskLevel.toUpperCase()} (${riskScore}/100)`
          : undefined,
        'View details → Dashboard'
      ]
        .filter(Boolean)
        .join('\n')

    const client = getTwilioClient()

    const result = await client.messages.create({
      body: summary,
      messagingServiceSid,
      to,
    })

    return NextResponse.json({
      success: true,
      sid: result.sid,
      to,
      riskLevel,
      riskScore,
    })
  } catch (error: any) {
    console.error('Error sending manual alert:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to send alert' },
      { status: 500 }
    )
  }
}
