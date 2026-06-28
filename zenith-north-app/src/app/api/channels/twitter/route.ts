/**
 * POST /api/channels/twitter
 * Twitter/X Account Activity API — captures advisor tweets.
 *
 * Setup:
 *   developer.twitter.com → Projects → App → User authentication settings
 *   Webhook URL: https://app.zenith-north.com/api/channels/twitter
 *   Subscribe to: tweet_create_events, direct_message_events
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import crypto from 'crypto'

// Twitter CRC challenge
export async function GET(request: NextRequest) {
  const crcToken = request.nextUrl.searchParams.get('crc_token')
  if (!crcToken || !process.env.TWITTER_CONSUMER_SECRET) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }
  const hash = crypto
    .createHmac('sha256', process.env.TWITTER_CONSUMER_SECRET)
    .update(crcToken)
    .digest('base64')
  return NextResponse.json({ response_token: 'sha256=' + hash })
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  // Find tenant by Twitter user ID
  const userId = body.for_user_id as string

  const tenantResult = await db.execute(sql`
    SELECT id FROM tenants
    WHERE config->>'twitterUserId' = ${userId ?? ''}
      AND archived_at IS NULL LIMIT 1
  `)

  if (tenantResult.rows.length > 0) {
    const tenantId = (tenantResult.rows[0] as any).id

    // Capture tweets
    for (const tweet of body.tweet_create_events ?? []) {
      if (tweet.user.id_str === userId) {
        await db.execute(sql`
          INSERT INTO communications (tenant_id, thread_id, client_id, channel, direction, body, ai_scanned, metadata)
          VALUES (${tenantId}, ${'tw_' + tweet.id_str}, null, 'twitter', 'outbound', ${tweet.full_text ?? tweet.text ?? ''}, false, ${JSON.stringify({ tweetId: tweet.id_str, user: tweet.user.screen_name })}::jsonb)
        `)
      }
    }

    await db.execute(sql`
      INSERT INTO channel_events (tenant_id, platform, event_type, payload, processed_at)
      VALUES (${tenantId}, 'twitter', 'activity', ${JSON.stringify(body)}::jsonb, NOW())
    `)
  }

  return NextResponse.json({ status: 'ok' })
}
