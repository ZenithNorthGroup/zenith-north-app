/**
 * ZENITH NORTH — Documents Router
 *
 * Reads from the documents table (real data).
 * Upload route is separate (/api/documents/upload → R2).
 */

import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { db, documents } from '@/lib/db'
import { eq, and, isNull, desc, sql, like, or } from 'drizzle-orm'

export const documentsRouter = router({

  /**
   * List documents for the tenant, optionally filtered by client or type.
   */
  list: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid().optional(),
      docType:  z.string().optional(),
      search:   z.string().optional(),
      limit:    z.number().default(100),
    }))
    .query(async ({ ctx, input }) => {
      const rows = await db.execute(sql`
        SELECT
          d.*,
          TRIM(COALESCE(cl.data->>'firstName', '') || ' ' || COALESCE(cl.data->>'lastName', '')) as client_name
        FROM documents d
        LEFT JOIN LATERAL (
          SELECT data FROM clients
          WHERE id = d.client_id AND tenant_id = ${ctx.tenant.id}
          ORDER BY version DESC LIMIT 1
        ) cl ON true
        WHERE d.tenant_id = ${ctx.tenant.id}
          AND d.archived_at IS NULL
          ${input.clientId ? sql`AND d.client_id = ${input.clientId}` : sql``}
          ${input.docType  ? sql`AND d.doc_type = ${input.docType}`   : sql``}
          ${input.search   ? sql`AND (LOWER(d.name) LIKE ${'%' + input.search.toLowerCase() + '%'} OR LOWER(TRIM(COALESCE(cl.data->>'firstName','') || ' ' || COALESCE(cl.data->>'lastName',''))) LIKE ${'%' + input.search.toLowerCase() + '%'})` : sql``}
        ORDER BY d.created_at DESC
        LIMIT ${input.limit}
      `)

      return rows.rows as Array<{
        id:           string
        name:         string
        docType:      string
        clientId:     string | null
        clientName:   string | null
        version:      number
        signedAt:     string | null
        retainUntil:  string | null
        sizeBytes:    number | null
        storagePath:  string | null
        createdAt:    string
      }>
    }),

  /**
   * Summary stats for the documents page header.
   */
  summary: protectedProcedure
    .query(async ({ ctx }) => {
      const result = await db.execute(sql`
        SELECT
          COUNT(*)                                          as total,
          COUNT(*) FILTER (WHERE signed_at IS NOT NULL)    as signed,
          COUNT(*) FILTER (WHERE signed_at IS NULL
            AND doc_type NOT IN ('meeting_recording'))      as unsigned,
          COUNT(*) FILTER (
            WHERE retain_until IS NOT NULL
            AND retain_until < NOW() + INTERVAL '180 days'
            AND retain_until > NOW()
          )                                                 as expiring_soon
        FROM documents
        WHERE tenant_id = ${ctx.tenant.id}
          AND archived_at IS NULL
      `)

      const row = result.rows[0] as any
      return {
        total:        Number(row.total        ?? 0),
        signed:       Number(row.signed       ?? 0),
        unsigned:     Number(row.unsigned     ?? 0),
        expiringSoon: Number(row.expiring_soon ?? 0),
      }
    }),
})
