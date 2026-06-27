/**
 * GET /api/myrepchat/contacts
 * MyRepChat calls this to pull client contacts for texting
 */

import { type NextRequest } from 'next/server'
import { GET_contacts } from '@/lib/integrations/myrepchat'

export async function GET(request: NextRequest) {
  return GET_contacts(request)
}
