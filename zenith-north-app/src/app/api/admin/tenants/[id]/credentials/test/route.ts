import { NextRequest, NextResponse } from 'next/server'
import { validateAdminRequest, adminUnauthorized } from '../../../../middleware'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { getCredential } from '@/lib/credentials'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!validateAdminRequest(request)) return adminUnauthorized()

  const { channel } = await request.json()
  const { id } = params

  const result = await db.execute(sql`SELECT config FROM tenants WHERE id = ${id} LIMIT 1`)
  if (!result.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const config = (result.rows[0] as any).config

  switch (channel) {
    case 'twilio': {
      const sid   = getCredential(config, 'twilioAccountSid')
      const token = getCredential(config, 'twilioAuthToken')
      if (!sid || !token) return NextResponse.json({ success: false, error: 'Twilio credentials not set' })
      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
        headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') }
      })
      if (resp.ok) return NextResponse.json({ success: true, message: 'Twilio connection verified ✓' })
      return NextResponse.json({ success: false, error: `Twilio returned HTTP ${resp.status}` })
    }

    case 'deepgram': {
      const key = getCredential(config, 'deepgramApiKey')
      if (!key) return NextResponse.json({ success: false, error: 'Deepgram API key not set' })
      const resp = await fetch('https://api.deepgram.com/v1/projects', {
        headers: { Authorization: `Token ${key}` }
      })
      if (resp.ok) return NextResponse.json({ success: true, message: 'Deepgram connection verified ✓' })
      return NextResponse.json({ success: false, error: `Deepgram returned HTTP ${resp.status}` })
    }

    default:
      return NextResponse.json({ success: false, error: `No test available for ${channel}` })
  }
}
