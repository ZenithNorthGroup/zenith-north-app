/**
 * POST /api/myrepchat/messages
 * MyRepChat POSTs every SMS here when sent or received
 * We ingest it into our communications table
 */

import { type NextRequest } from 'next/server'
import { POST_message } from '@/lib/integrations/myrepchat'

export async function POST(request: NextRequest) {
  return POST_message(request)
}
