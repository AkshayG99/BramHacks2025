import { NextRequest, NextResponse } from 'next/server'

const RISK_LEVELS = ['low', 'medium', 'high', 'extreme'] as const
type RiskLevel = (typeof RISK_LEVELS)[number]

interface AlertRequestPayload {
  locationName?: string
  riskLevel?: RiskLevel
  riskScore?: number
  to?: string
  message?: string
}

type TwilioFactory = typeof import('twilio')
type TwilioClient = ReturnType<TwilioFactory>

export const runtime = 'nodejs'

const MESSAGE_MAX_LENGTH = 700
const TWILIO_MESSAGING_SERVICE_SID =
  process.env.TWILIO_MESSAGING_SERVICE_SID ||
  'MGfa37dd55596eaeb0d1c5c84b70b25094'

const DEFAULT_TO =
  sanitizePhone(process.env.ALERT_DEFAULT_PHONE) ??
  sanitizePhone(process.env.ALERT_PHONE_NUMBER) ??
  '+18777804236'

let cachedTwilioClient: TwilioClient | null = null

export const POST = async (request: NextRequest) => {
  try {
    const rawBody = await request.json().catch(() => null)
    if (!rawBody || typeof rawBody !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    const payload = parsePayload(rawBody)
    const to = payload.to ?? DEFAULT_TO
    if (!to) {
      return NextResponse.json(
        { error: 'Missing destination phone number' },
        { status: 400 }
      )
    }

    if (!TWILIO_MESSAGING_SERVICE_SID) {
      return NextResponse.json(
        { error: 'Missing Twilio messaging service SID' },
        { status: 500 }
      )
    }

    const summary = buildSummary(payload).slice(0, MESSAGE_MAX_LENGTH)
    const client = getTwilioClient()
    const result = await client.messages.create({
      body: summary,
      messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
      to,
    })

    return NextResponse.json({
      success: true,
      sid: result.sid,
      status: result.status,
      to,
      riskLevel: payload.riskLevel,
      riskScore: payload.riskScore,
    })
  } catch (error: unknown) {
    console.error('Error sending manual alert:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send alert' },
      { status: 500 }
    )
  }
}

function parsePayload(body: Record<string, unknown>): AlertRequestPayload {
  const parsed: AlertRequestPayload = {}

  const locationName = normalizeText(body.locationName)
  if (locationName) parsed.locationName = locationName

  const riskLevel = normalizeRiskLevel(body.riskLevel)
  if (riskLevel) parsed.riskLevel = riskLevel

  const riskScore = coerceRiskScore(body.riskScore)
  if (riskScore !== undefined) parsed.riskScore = riskScore

  const to = sanitizePhone(body.to)
  if (to) parsed.to = to

  const message = normalizeText(body.message)
  if (message) parsed.message = message

  return parsed
}

function buildSummary(payload: AlertRequestPayload) {
  if (payload.message) {
    return payload.message
  }

  const parts = [
    '🔥 Forest Fire Alert',
    payload.locationName && `Location: ${payload.locationName}`,
    payload.riskLevel !== undefined && payload.riskScore !== undefined
      ? `Risk: ${payload.riskLevel.toUpperCase()} (${payload.riskScore}/100)`
      : payload.riskLevel
      ? `Risk Level: ${payload.riskLevel.toUpperCase()}`
      : undefined,
    'Tap for details in the dashboard.',
  ]

  return parts.filter(Boolean).join('\n')
}

function sanitizePhone(value?: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function normalizeText(value?: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

function normalizeRiskLevel(value?: unknown): RiskLevel | undefined {
  if (typeof value !== 'string') return undefined
  const candidate = value.toLowerCase() as RiskLevel
  return RISK_LEVELS.includes(candidate) ? candidate : undefined
}

function coerceRiskScore(value?: unknown): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return undefined
  }
  const clamped = Math.min(100, Math.max(0, value))
  return Math.round(clamped * 10) / 10
}

function getTwilioClient(): TwilioClient {
  if (cachedTwilioClient) {
    return cachedTwilioClient
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken =
    process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_AUTH_TOKEN_FALLBACK || ''

  if (!accountSid || !authToken) {
    throw new Error('Missing Twilio account SID or auth token')
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const twilio = require('twilio') as TwilioFactory
  cachedTwilioClient = twilio(accountSid, authToken)
  return cachedTwilioClient
}
