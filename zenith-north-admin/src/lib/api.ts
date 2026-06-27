/**
 * ZENITH NORTH ADMIN — API Client
 *
 * Typed fetch wrapper that calls the main Zenith North API.
 * All requests are authenticated with the ADMIN_SECRET env var.
 *
 * The main app exposes /api/admin/* routes protected by this secret.
 * This client hits those routes and returns typed data.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'admin-secret-change-me'

async function adminFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type':    'application/json',
      'X-Admin-Secret':  ADMIN_SECRET,
      ...options.headers,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error ?? `HTTP ${response.status}`)
  }

  return response.json()
}

// ── Types ─────────────────────────────────────────────────

export interface TenantSummary {
  id:         string
  name:       string
  slug:       string
  plan:       'starter' | 'professional' | 'enterprise'
  status:     'active' | 'trial' | 'suspended' | 'churned'
  createdAt:  string
  config:     TenantConfig
  stats: {
    clientCount:        number
    userCount:          number
    openComplianceItems: number
    criticalItems:      number
    activeWorkflows:    number
    totalAuditEntries:  number
    lastActivityAt:     string | null
  }
  channelHealth: ChannelHealth
  setupProgress: SetupProgress
  healthScore:   number   // 0-100
}

export interface TenantConfig {
  plan:               string
  crd?:               string
  ccoName?:           string
  ccoEmail?:          string
  address?:           string
  firmState?:         string
  registrationType?:  'SEC' | 'state'
  // API tokens
  myrepchatToken?:    string
  twilioPhoneNumber?: string
  zoomEnabled?:       boolean
  slackEnabled?:      boolean
  // Email
  emailProvider?:     'microsoft365' | 'google_workspace' | 'both'
  emailEnabled?:      boolean
  journalAddress?:    string
  // WSP
  wspSignedAt?:       string
  // DEO
  deoName?:           string
  deoSignedAt?:       string
  // Integration tokens
  integrationToken?:  string
}

export interface ChannelHealth {
  platformMessaging: boolean
  email:             boolean
  emailProvider?:    string
  emailLastReceived?: string
  sms:               boolean
  smsNumber?:        string
  zoom:              boolean
  slack:             boolean
}

export interface SetupProgress {
  firmInfoComplete:  boolean
  deoSigned:         boolean
  wspSigned:         boolean
  emailConnected:    boolean
  smsConnected:      boolean
  firstClientImported: boolean
  firstWorkflowRun:  boolean
  completedSteps:    number
  totalSteps:        number
  percentComplete:   number
}

export interface ErrorLogEntry {
  id:          string
  tenantId?:   string
  tenantName?: string
  source:      string   // 'email_ingest' | 'sms_webhook' | 'zoom_webhook' | 'ai_scan' | etc.
  severity:    'error' | 'warning' | 'info'
  message:     string
  stack?:      string
  metadata?:   Record<string, unknown>
  resolvedAt?: string
  createdAt:   string
}

export interface SystemHealth {
  api: {
    status:        'healthy' | 'degraded' | 'down'
    responseTimeMs: number
    uptime:        number
  }
  database: {
    status:        'healthy' | 'degraded' | 'down'
    connectionPoolSize: number
    activeConnections:  number
    responseTimeMs:     number
  }
  email: {
    status:         'healthy' | 'degraded' | 'down'
    lastInboundAt?: string
    todayCount:     number
  }
  sms: {
    status:         'healthy' | 'degraded' | 'down'
    lastInboundAt?: string
    todayCount:     number
  }
  ai: {
    status:     'healthy' | 'degraded' | 'down'
    scansToday: number
    flagsToday: number
  }
  complianceEngine: {
    lastRunAt?:  string
    lastRunResult?: { itemsCreated: number; tenantsProcessed: number }
  }
}

// ── API methods ───────────────────────────────────────────

export const adminAPI = {

  // Tenants
  listTenants: () =>
    adminFetch<TenantSummary[]>('/api/admin/tenants'),

  getTenant: (id: string) =>
    adminFetch<TenantSummary>(`/api/admin/tenants/${id}`),

  updateTenantConfig: (id: string, config: Partial<TenantConfig>) =>
    adminFetch<{ success: boolean }>(`/api/admin/tenants/${id}`, {
      method: 'PATCH',
      body:   JSON.stringify(config),
    }),

  regenerateToken: (id: string) =>
    adminFetch<{ token: string }>(`/api/admin/tenants/${id}/token`, {
      method: 'POST',
    }),

  runComplianceEngine: (tenantId?: string) =>
    adminFetch<{ itemsCreated: number }>('/api/admin/run-engine', {
      method: 'POST',
      body:   JSON.stringify({ tenantId }),
    }),

  // Errors
  listErrors: (params?: { tenantId?: string; source?: string; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.tenantId) q.set('tenantId', params.tenantId)
    if (params?.source)   q.set('source',   params.source)
    if (params?.limit)    q.set('limit',     String(params.limit))
    return adminFetch<ErrorLogEntry[]>(`/api/admin/errors?${q}`)
  },

  resolveError: (id: string) =>
    adminFetch<{ success: boolean }>(`/api/admin/errors/${id}/resolve`, {
      method: 'POST',
    }),

  // System env vars
  getEnvVars: () =>
    adminFetch<{ values: Record<string, string> }>('/api/admin/system/env'),

  saveEnvVar: (key: string, value: string) =>
    adminFetch<{ success: boolean }>('/api/admin/system/env', {
      method: 'POST',
      body:   JSON.stringify({ key, value }),
    }),

  // System health
  getSystemHealth: () =>
    adminFetch<SystemHealth>('/api/admin/health'),

  // Webhooks
  listWebhookDeliveries: (params?: { tenantId?: string; source?: string; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.tenantId) q.set('tenantId', params.tenantId)
    if (params?.source)   q.set('source',   params.source)
    if (params?.limit)    q.set('limit',     String(params.limit))
    return adminFetch<any[]>(`/api/admin/webhooks?${q}`)
  },
}
