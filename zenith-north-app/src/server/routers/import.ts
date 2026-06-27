/**
 * ZENITH NORTH — Redtail Importer
 *
 * Handles migration from Redtail CRM.
 * Redtail allows CSV export of contacts — this is the
 * most common migration path.
 *
 * Process:
 *   1. Parse CSV
 *   2. Map Redtail fields → Zenith North ClientData
 *   3. Validate each record
 *   4. Dry run mode — validate without inserting
 *   5. Import in batches of 50
 *   6. Write single audit log entry for entire import
 *   7. Return result summary
 *
 * This is what closes deals. A firm running Redtail
 * can be fully migrated in under 20 minutes.
 */

import { z } from 'zod'
import { router, adminProcedure } from '@/lib/trpc'
import { db, clients } from '@/lib/db'
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit'
import type { ClientData } from '@/lib/db/schema'

// ── Redtail field mapping ──────────────────────────────────

/**
 * Redtail CSV column names vary slightly by export version.
 * We handle the most common variants.
 */
const REDTAIL_FIELD_MAP: Record<string, keyof RedtailRow> = {
  'First Name':       'firstName',
  'Firstname':        'firstName',
  'FIRST_NAME':       'firstName',
  'Last Name':        'lastName',
  'Lastname':         'lastName',
  'LAST_NAME':        'lastName',
  'Email':            'email',
  'Email Address':    'email',
  'Primary Email':    'email',
  'Mobile Phone':     'phoneMobile',
  'Cell Phone':       'phoneMobile',
  'Home Phone':       'phoneHome',
  'Work Phone':       'phoneWork',
  'DOB':              'dateOfBirth',
  'Date of Birth':    'dateOfBirth',
  'Status':           'status',
  'Client Status':    'status',
  'Category':         'clientType',
  'Contact Type':     'clientType',
  'Source':           'source',
  'Advisor':          'advisor',
  'Primary Advisor':  'advisor',
  'Last Review Date': 'lastReviewDate',
  'Created':          'createdAt',
  'Created Date':     'createdAt',
  'ID':               'externalId',
  'Contact ID':       'externalId',
}

interface RedtailRow {
  firstName?:      string
  lastName?:       string
  email?:          string
  phoneMobile?:    string
  phoneHome?:      string
  phoneWork?:      string
  dateOfBirth?:    string
  status?:         string
  clientType?:     string
  source?:         string
  advisor?:        string
  lastReviewDate?: string
  createdAt?:      string
  externalId?:     string
}

interface ImportRecord {
  row:    RedtailRow
  mapped: Partial<ClientData>
  errors: string[]
  valid:  boolean
}

interface ImportResult {
  total:    number
  imported: number
  skipped:  number
  errors:   Array<{ row: number; field?: string; message: string }>
  warnings: Array<{ row: number; message: string }>
}

// ── Field mappers ──────────────────────────────────────────

function mapStatus(status?: string): ClientData['status'] {
  if (!status) return 'prospect'
  const s = status.toLowerCase()
  if (s.includes('active') || s === 'a') return 'active'
  if (s.includes('prospect') || s === 'p') return 'prospect'
  if (s.includes('inactive') || s === 'i') return 'inactive'
  return 'prospect'
}

function mapClientType(type?: string): ClientData['clientType'] {
  if (!type) return 'individual'
  const t = type.toLowerCase()
  if (t.includes('trust')) return 'trust'
  if (t.includes('entity') || t.includes('business') || t.includes('corp')) return 'entity'
  return 'individual'
}

function mapDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return undefined
    return d.toISOString().split('T')[0]
  } catch {
    return undefined
  }
}

function parseCSV(csvText: string): Array<Record<string, string>> {
  const lines = csvText.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  // Parse header — handle quoted fields
  const parseRow = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseRow(lines[0])
  return lines.slice(1).map(line => {
    const values = parseRow(line)
    return Object.fromEntries(
      headers.map((h, i) => [h.trim(), values[i]?.trim() ?? ''])
    )
  })
}

function mapRedtailRow(raw: Record<string, string>): ImportRecord {
  // Normalize column names
  const row: RedtailRow = {}
  for (const [key, value] of Object.entries(raw)) {
    const mapped = REDTAIL_FIELD_MAP[key]
    if (mapped && value) {
      (row as Record<string, string>)[mapped] = value
    }
  }

  const errors: string[] = []

  // Validate required fields
  if (!row.firstName?.trim()) errors.push('Missing first name')
  if (!row.lastName?.trim())  errors.push('Missing last name')
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errors.push('Invalid email format')
  }

  const mapped: Partial<ClientData> = {
    firstName:        row.firstName?.trim() ?? 'Unknown',
    lastName:         row.lastName?.trim() ?? 'Unknown',
    email:            row.email?.trim() ?? '',
    phone:            row.phoneMobile || row.phoneHome || row.phoneWork,
    dateOfBirth:      mapDate(row.dateOfBirth),
    clientType:       mapClientType(row.clientType),
    status:           mapStatus(row.status),
    lastReviewDate:   mapDate(row.lastReviewDate),
    annualReviewDue:  row.lastReviewDate
      ? (() => {
          const d = new Date(row.lastReviewDate)
          d.setFullYear(d.getFullYear() + 1)
          return d.toISOString().split('T')[0]
        })()
      : undefined,
    // Compliance defaults — needs review after import
    kycStatus:        'needs_review',
    // Migration metadata
    importSource: 'redtail',
    importId:     row.externalId,
  }

  return {
    row,
    mapped,
    errors,
    valid: errors.length === 0,
  }
}

// ── Router ────────────────────────────────────────────────

export const importRouter = router({

  /**
   * Preview a Redtail CSV import — validate without inserting.
   * Shows exactly what will be imported before committing.
   */
  previewRedtail: adminProcedure
    .input(z.object({
      csvContent: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const rows = parseCSV(input.csvContent)
      const records = rows.map(mapRedtailRow)

      return {
        total:   records.length,
        valid:   records.filter(r => r.valid).length,
        invalid: records.filter(r => !r.valid).length,
        preview: records.slice(0, 10).map((r, i) => ({
          row:    i + 1,
          name:   `${r.mapped.firstName ?? ''} ${r.mapped.lastName ?? ''}`.trim(),
          email:  r.mapped.email,
          status: r.mapped.status,
          errors: r.errors,
          valid:  r.valid,
        })),
        errors: records
          .filter(r => !r.valid)
          .slice(0, 20)
          .map((r, i) => ({
            row:     i + 1,
            name:    `${r.row.firstName ?? ''} ${r.row.lastName ?? ''}`.trim(),
            errors:  r.errors,
          })),
      }
    }),

  /**
   * Execute a Redtail CSV import.
   * Imports in batches of 50. Skips invalid records.
   * Returns full result summary.
   */
  importRedtail: adminProcedure
    .input(z.object({
      csvContent:   z.string().min(1),
      skipInvalid:  z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const rows = parseCSV(input.csvContent)
      const records = rows.map(mapRedtailRow)

      const result: ImportResult = {
        total:    records.length,
        imported: 0,
        skipped:  0,
        errors:   [],
        warnings: [],
      }

      // Process in batches of 50
      const BATCH_SIZE = 50
      const validRecords = input.skipInvalid
        ? records.filter(r => r.valid)
        : records

      for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
        const batch = validRecords.slice(i, i + BATCH_SIZE)

        await db.transaction(async trx => {
          for (const record of batch) {
            if (!record.valid && !input.skipInvalid) {
              result.skipped++
              result.errors.push({
                row:     i + 1,
                message: record.errors.join(', '),
              })
              continue
            }

            try {
              const clientId = crypto.randomUUID()

              await trx.insert(clients).values({
                id:        clientId,
                tenantId:  ctx.tenant.id,
                version:   1,
                data:      record.mapped,
                createdBy: ctx.user.id,
              })

              result.imported++

              // Warn if email is missing
              if (!record.mapped.email) {
                result.warnings.push({
                  row:     i + 1,
                  message: `${record.mapped.firstName} ${record.mapped.lastName} imported without email`,
                })
              }
            } catch (err) {
              result.skipped++
              result.errors.push({
                row:     i + 1,
                message: err instanceof Error ? err.message : 'Unknown error',
              })
            }
          }
        })
      }

      // Single audit log entry for the entire import
      await writeAudit(ctx.auditCtx, {
        skillSlug:  'crm',
        action:     AUDIT_ACTIONS.IMPORT_COMPLETED,
        entityType: 'tenant',
        entityId:   ctx.tenant.id,
        nextState: {
          source:   'redtail',
          total:    result.total,
          imported: result.imported,
          skipped:  result.skipped,
          errors:   result.errors.length,
        },
      })

      return result
    }),

  /**
   * Import from generic CSV.
   * Flexible mapping for any CSV source.
   */
  importCSV: adminProcedure
    .input(z.object({
      csvContent: z.string().min(1),
      fieldMap: z.record(z.string()), // { csvColumn: clientDataField }
    }))
    .mutation(async ({ ctx, input }) => {
      const rows = parseCSV(input.csvContent)
      let imported = 0
      let skipped  = 0

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50)
        await db.transaction(async trx => {
          for (const row of batch) {
            try {
              // Apply custom field mapping
              const data: Partial<ClientData> = {
                kycStatus:    'needs_review',
                status:       'prospect',
                clientType:   'individual',
                importSource: 'csv',
              }

              for (const [csvCol, clientField] of Object.entries(input.fieldMap)) {
                if (row[csvCol]) {
                  (data as Record<string, unknown>)[clientField] = row[csvCol]
                }
              }

              if (!data.firstName || !data.lastName) {
                skipped++
                continue
              }

              await trx.insert(clients).values({
                id:        crypto.randomUUID(),
                tenantId:  ctx.tenant.id,
                version:   1,
                data,
                createdBy: ctx.user.id,
              })
              imported++
            } catch {
              skipped++
            }
          }
        })
      }

      await writeAudit(ctx.auditCtx, {
        skillSlug:  'crm',
        action:     AUDIT_ACTIONS.IMPORT_COMPLETED,
        entityType: 'tenant',
        entityId:   ctx.tenant.id,
        nextState: { source: 'csv', imported, skipped },
      })

      return { total: rows.length, imported, skipped }
    }),
})
