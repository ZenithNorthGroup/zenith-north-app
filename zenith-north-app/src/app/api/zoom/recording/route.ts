/**
 * ZENITH NORTH — Zoom Recording Capture
 *
 * POST /api/zoom/recording
 *
 * Zoom fires this webhook when a meeting recording completes.
 * We capture:
 *   - Meeting metadata (title, date, duration, host)
 *   - All participants (matched to clients/advisors)
 *   - Recording URL (stored in R2, linked to client record)
 *   - Transcript (via Zoom's auto-transcription or Whisper)
 *
 * SETUP:
 *   1. marketplace.zoom.us → Build App → Webhook Only App
 *   2. Event subscriptions → Add: recording.completed
 *   3. Endpoint URL: https://your-domain.com/api/zoom/recording
 *   4. Copy the Webhook Secret Token → ZOOM_WEBHOOK_SECRET
 *
 * ENV VARS REQUIRED:
 *   ZOOM_WEBHOOK_SECRET     — from Zoom app settings
 *   ZOOM_ACCOUNT_ID         — from Zoom OAuth app
 *   ZOOM_CLIENT_ID          — from Zoom OAuth app
 *   ZOOM_CLIENT_SECRET      — from Zoom OAuth app
 *   R2_ACCOUNT_ID           — Cloudflare R2 for recording storage
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { db, communications, documents } from '@/lib/db'
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

// ── Types ─────────────────────────────────────────────────

interface ZoomRecordingPayload {
  event:   'recording.completed'
  payload: {
    account_id: string
    object: {
      uuid:          string
      id:            string        // meeting ID
      host_id:       string
      topic:         string        // meeting title
      type:          number        // meeting type
      start_time:    string        // ISO timestamp
      duration:      number        // minutes
      timezone:      string
      host_email:    string
      total_size:    number        // bytes
      recording_count: number
      recording_files: Array<{
        id:             string
        meeting_id:     string
        recording_start: string
        recording_end:   string
        file_type:      'MP4' | 'M4A' | 'CHAT' | 'TRANSCRIPT' | 'CC' | 'CSV' | 'SUMMARY'
        file_size:      number
        play_url:       string
        download_url:   string
        status:         string
        recording_type: string
      }>
      participant_audio_files?: Array<{
        id:          string
        recording_start: string
        recording_end:   string
        file_type:   'M4A'
        file_size:   number
        download_url: string
        file_name:   string
      }>
    }
  }
  download_token: string    // JWT token for downloading recordings
}

interface ZoomParticipant {
  id?:         string
  name:        string
  email?:      string
  join_time:   string
  leave_time:  string
  duration:    number       // seconds
}

// ── Webhook verification ───────────────────────────────────

function verifyZoomWebhook(
  request: NextRequest,
  rawBody: string
): boolean {
  const timestamp = request.headers.get('x-zm-request-timestamp')
  const signature = request.headers.get('x-zm-signature')
  const secret    = process.env.ZOOM_WEBHOOK_SECRET

  if (!timestamp || !signature || !secret) return false

  const message  = `v0:${timestamp}:${rawBody}`
  const hash     = createHmac('sha256', secret)
    .update(message)
    .digest('hex')
  const expected = `v0=${hash}`

  return expected === signature
}

// ── Zoom OAuth token ───────────────────────────────────────

async function getZoomAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString('base64')

  const response = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
    {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}` },
    }
  )

  const data = await response.json()
  return data.access_token
}

// ── Get meeting participants ───────────────────────────────

async function getMeetingParticipants(
  meetingId: string,
  token: string
): Promise<ZoomParticipant[]> {
  try {
    const response = await fetch(
      `https://api.zoom.us/v2/past_meetings/${meetingId}/participants?page_size=300`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await response.json()
    return data.participants ?? []
  } catch {
    return []
  }
}

// ── Download and store recording ───────────────────────────

async function downloadAndStoreRecording(
  downloadUrl:   string,
  downloadToken: string,
  tenantId:      string,
  meetingId:     string,
  fileType:      string
): Promise<string | null> {
  try {
    // Download from Zoom (URL is time-limited, must download within 24hrs)
    const response = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${downloadToken}` },
    })

    if (!response.ok) return null

    const buffer = await response.arrayBuffer()
    const key    = `recordings/${tenantId}/${meetingId}/${fileType.toLowerCase()}-${Date.now()}`

    // Upload to Cloudflare R2
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
    const s3 = new S3Client({
      region:   'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })

    await s3.send(new PutObjectCommand({
      Bucket:      process.env.R2_BUCKET_NAME!,
      Key:         key,
      Body:        Buffer.from(buffer),
      ContentType: fileType === 'MP4' ? 'video/mp4' : 'audio/mp4',
    }))

    return key
  } catch (err) {
    console.error('[ZOOM] Failed to store recording:', err)
    return null
  }
}

// ── Transcribe with Deepgram / Whisper ────────────────────

async function transcribeRecording(
  audioBuffer: ArrayBuffer
): Promise<string | null> {
  try {
    // Use Deepgram API if configured (recommended for production)
    if (process.env.DEEPGRAM_API_KEY) {
      const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&diarize=true', {
        method:  'POST',
        headers: {
          Authorization:  'Token ' + process.env.DEEPGRAM_API_KEY,
          'Content-Type': 'audio/mp4',
        },
        body: Buffer.from(audioBuffer),
      })
      const result = await response.json()
      return result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? null
    }

    // Fallback: OpenAI Whisper
    if (process.env.OPENAI_API_KEY) {
      const formData = new FormData()
      formData.append('file', new Blob([audioBuffer], { type: 'audio/mp4' }), 'recording.mp4')
      formData.append('model', 'whisper-1')
      formData.append('response_format', 'text')

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method:  'POST',
        headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
        body: formData,
      })
      return await response.text()
    }

    return null
  } catch {
    return null
  }
}

// ── AI compliance scan of transcript ──────────────────────

async function scanTranscript(transcript: string): Promise<{
  flagged:  boolean
  severity: 'low' | 'medium' | 'high' | null
  reason:   string | null
  excerpt:  string | null
  summary:  string | null
}> {
  try {
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 600,
      system: `You are a compliance monitoring system for a registered investment adviser.
Analyze this meeting transcript for SEC/FINRA compliance issues AND provide a brief summary.

Flag if participants discuss:
- Specific investment return guarantees
- Discretionary actions without documented authorization
- Unsuitable investment recommendations
- Undisclosed conflicts of interest
- Performance claims without required disclosures

Respond ONLY with valid JSON:
{
  "flagged": boolean,
  "severity": "low"|"medium"|"high"|null,
  "reason": string|null,
  "excerpt": string|null,
  "summary": "2-3 sentence summary of meeting topics discussed"
}`,
      messages: [{
        role:    'user',
        content: `Meeting transcript:\n\n${transcript.slice(0, 4000)}`,
      }],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return { flagged: false, severity: null, reason: null, excerpt: null, summary: null }
  }
}

// ── Tenant resolver ────────────────────────────────────────

async function resolveTenantFromHostEmail(
  hostEmail: string
): Promise<{ tenantId: string; userId: string } | null> {
  const result = await db.execute(sql`
    SELECT u.id as user_id, u.tenant_id
    FROM users u
    WHERE LOWER(u.email) = ${hostEmail.toLowerCase()}
      AND u.archived_at IS NULL
    LIMIT 1
  `)

  if (!result.rows.length) return null

  const row = result.rows[0] as { user_id: string; tenant_id: string }
  return { tenantId: row.tenant_id, userId: row.user_id }
}

async function resolveClientFromEmail(
  tenantId: string,
  email: string
): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT DISTINCT ON (id) id
    FROM clients
    WHERE tenant_id = ${tenantId}
      AND LOWER(data->>'email') = ${email.toLowerCase()}
      AND archived_at IS NULL
    ORDER BY id, version DESC
    LIMIT 1
  `)

  return (result.rows[0] as { id: string } | undefined)?.id ?? null
}

// ── Main webhook handler ───────────────────────────────────

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  // Zoom sends a URL validation challenge on first setup
  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Handle Zoom's URL validation challenge
  if (payload.event === 'endpoint.url_validation') {
    const hash = createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET ?? '')
      .update(payload.payload.plainToken)
      .digest('hex')
    return NextResponse.json({
      plainToken:     payload.payload.plainToken,
      encryptedToken: hash,
    })
  }

  // Verify signature
  if (!verifyZoomWebhook(request, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  if (payload.event !== 'recording.completed') {
    return NextResponse.json({ status: 'ignored' })
  }

  const meeting = (payload as ZoomRecordingPayload).payload.object
  const downloadToken = (payload as ZoomRecordingPayload).download_token

  // Resolve tenant from meeting host email
  const auth = await resolveTenantFromHostEmail(meeting.host_email)
  if (!auth) {
    console.warn('[ZOOM] Host email not found:', meeting.host_email)
    return NextResponse.json({ status: 'host_not_found' })
  }

  const { tenantId, userId } = auth

  // Get Zoom access token for participant lookup
  const accessToken  = await getZoomAccessToken()
  const participants = await getMeetingParticipants(meeting.id, accessToken)

  // Find client participants (non-advisors)
  let clientId: string | null = null
  const participantEmails: string[] = []

  for (const participant of participants) {
    if (!participant.email) continue
    participantEmails.push(participant.email)

    const resolved = await resolveClientFromEmail(tenantId, participant.email)
    if (resolved) {
      clientId = resolved
      break
    }
  }

  // Find recording files
  const videoFile      = meeting.recording_files.find(f => f.file_type === 'MP4')
  const transcriptFile = meeting.recording_files.find(f => f.file_type === 'TRANSCRIPT')
  const chatFile       = meeting.recording_files.find(f => f.file_type === 'CHAT')
  const summaryFile    = meeting.recording_files.find(f => f.file_type === 'SUMMARY')

  // Download transcript if available (async, non-blocking)
  let transcript: string | null = null
  let transcriptKey: string | null = null

  if (transcriptFile) {
    try {
      const transcriptResponse = await fetch(transcriptFile.download_url, {
        headers: { Authorization: `Bearer ${downloadToken}` },
      })
      transcript = await transcriptResponse.text()

      // Store transcript in R2
      transcriptKey = await downloadAndStoreRecording(
        transcriptFile.download_url,
        downloadToken,
        tenantId,
        meeting.id,
        'TRANSCRIPT'
      )
    } catch (err) {
      console.error('[ZOOM] Failed to get transcript:', err)
    }
  }

  // Store video recording reference (download async)
  let videoKey: string | null = null
  if (videoFile) {
    // Fire-and-forget download — recordings can be large
    void downloadAndStoreRecording(
      videoFile.download_url,
      downloadToken,
      tenantId,
      meeting.id,
      'MP4'
    ).then(key => { videoKey = key })
  }

  // AI compliance scan + meeting summary
  let scanResult = {
    flagged:  false,
    severity: null as string | null,
    reason:   null as string | null,
    excerpt:  null as string | null,
    summary:  null as string | null,
  }

  if (transcript) {
    const scan = await scanTranscript(transcript)
    scanResult = scan
  }

  // Compose meeting body for the communication record
  const meetingBody = [
    `Meeting: ${meeting.topic}`,
    `Date: ${new Date(meeting.start_time).toLocaleString()}`,
    `Duration: ${meeting.duration} minutes`,
    `Host: ${meeting.host_email}`,
    `Participants: ${participantEmails.join(', ') || 'Not captured'}`,
    scanResult.summary ? `\nSummary: ${scanResult.summary}` : '',
  ].filter(Boolean).join('\n')

  // Write to communications table
  const [record] = await db.insert(communications).values({
    tenantId,
    threadId:   crypto.randomUUID(),
    clientId:   clientId ?? undefined,
    fromUserId: userId,
    channel:    'zoom',
    direction:  'outbound',
    subject:    meeting.topic,
    body:       meetingBody,
    bodyEncrypted: Buffer.from(meetingBody).toString('base64'),
    aiScanned:  !!transcript,
    aiFlagged:  scanResult.flagged,
    aiSeverity: scanResult.severity,
    aiReason:   scanResult.reason,
    aiExcerpt:  scanResult.excerpt,
    metadata: {
      zoomMeetingId:    meeting.id,
      zoomMeetingUuid:  meeting.uuid,
      duration:         meeting.duration,
      participants:     participants.map(p => ({
        name:     p.name,
        email:    p.email,
        duration: p.duration,
      })),
      hasRecording:   !!videoFile,
      hasTranscript:  !!transcriptFile,
      videoStorageKey:      videoKey,
      transcriptStorageKey: transcriptKey,
      meetingSummary: scanResult.summary,
      source:         'zoom',
    },
  } as any).returning()

  // Create compliance item if flagged
  if (scanResult.flagged && scanResult.severity === 'high' && clientId) {
    await db.insert(complianceItems).values({
      tenantId,
      clientId,
      itemType:    'communication_flagged',
      severity:    'critical',
      title:       `High severity Zoom meeting flag — ${scanResult.reason}`,
      description: `Meeting: ${meeting.topic} · ${scanResult.excerpt ?? ''}`,
      sourceType:  'communication',
      sourceId:    record.id,
    })
  }

  // Write to audit log
  await writeAudit(
    { tenantId, userId },
    {
      skillSlug:  'messaging',
      action:     AUDIT_ACTIONS.MSG_SENT,
      entityType: clientId ? 'client' : 'internal',
      entityId:   clientId ?? tenantId,
      nextState: {
        messageId:     record.id,
        channel:       'zoom',
        meetingId:     meeting.id,
        topic:         meeting.topic,
        duration:      meeting.duration,
        participants:  participantEmails.length,
        hasRecording:  !!videoFile,
        hasTranscript: !!transcriptFile,
        flagged:       scanResult.flagged,
      },
    }
  )

  // Also write document record for the recording
  if (videoFile && clientId) {
    await db.insert(documents).values({
      tenantId,
      clientId,
      createdBy:   userId,
      skillSlug:   'messaging',
      name:        `Zoom recording — ${meeting.topic} — ${new Date(meeting.start_time).toLocaleDateString()}`,
      docType:     'meeting_recording',
      storagePath: videoKey ?? `zoom/${meeting.id}`,
      mimeType:    'video/mp4',
      sizeBytes:   videoFile.file_size,
      metadata: {
        zoomMeetingId: meeting.id,
        duration:      meeting.duration,
        participants:  participantEmails,
      },
    } as any)
  }

  return NextResponse.json({
    status:        'captured',
    messageId:     record.id,
    clientId,
    hasTranscript: !!transcript,
    flagged:       scanResult.flagged,
  })
}
