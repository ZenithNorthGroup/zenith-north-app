/**
 * ZENITH NORTH — Permission System
 *
 * Every action in the platform maps to a permission string.
 * Roles are named collections of permissions.
 * Custom roles are stored in tenant config.
 *
 * Permission format: module.action
 * e.g. clients.view, compliance.resolve, audit.export
 */

// ── All permissions ────────────────────────────────────────

export const ALL_PERMISSIONS = {
  clients: {
    label: 'Clients',
    permissions: {
      'clients.view':        { label: 'View clients',              desc: 'See the client list' },
      'clients.view_all':    { label: 'View all clients',          desc: 'See all clients, not just assigned ones' },
      'clients.create':      { label: 'Add clients',               desc: 'Create new client records' },
      'clients.edit':        { label: 'Edit clients',              desc: 'Update client information' },
      'clients.archive':     { label: 'Archive clients',           desc: 'Archive or remove client records' },
      'clients.view_360':    { label: 'View client 360',           desc: 'See full client history, notes, and timeline' },
    },
  },
  compliance: {
    label: 'Compliance',
    permissions: {
      'compliance.view':       { label: 'View compliance',         desc: 'See the compliance queue' },
      'compliance.resolve':    { label: 'Resolve items',           desc: 'Mark compliance items as resolved' },
      'compliance.snooze':     { label: 'Snooze items',            desc: 'Snooze compliance items' },
      'compliance.run_engine': { label: 'Run compliance engine',   desc: 'Manually trigger the compliance check' },
    },
  },
  messages: {
    label: 'Communications',
    permissions: {
      'messages.view':         { label: 'View messages',           desc: 'See all message threads' },
      'messages.send':         { label: 'Send messages',           desc: 'Send messages to clients' },
      'messages.view_flagged': { label: 'View flagged messages',   desc: 'See AI-flagged communications' },
      'messages.review_flag':  { label: 'Review AI flags',         desc: 'Mark flagged messages as reviewed' },
    },
  },
  audit: {
    label: 'Audit center',
    permissions: {
      'audit.view':    { label: 'View audit log',    desc: 'See the immutable audit trail' },
      'audit.export':  { label: 'Export exam package', desc: 'Generate SEC exam packages' },
    },
  },
  workflows: {
    label: 'Workflows',
    permissions: {
      'workflows.view':       { label: 'View workflows',    desc: 'See onboarding pipeline' },
      'workflows.create':     { label: 'Start workflows',   desc: 'Initiate new onboarding workflows' },
      'workflows.advance':    { label: 'Advance steps',     desc: 'Complete workflow steps' },
      'workflows.approve':    { label: 'Approve workflows', desc: 'Give CCO approval on workflow steps' },
    },
  },
  documents: {
    label: 'Documents',
    permissions: {
      'documents.view':    { label: 'View documents',   desc: 'See the document library' },
      'documents.upload':  { label: 'Upload documents', desc: 'Add new documents' },
      'documents.delete':  { label: 'Archive documents',desc: 'Archive documents (never permanent delete)' },
    },
  },
  ai: {
    label: 'AI assistant',
    permissions: {
      'ai.ask':      { label: 'Use AI assistant',      desc: 'Ask questions via the AI assistant' },
      'ai.view_scan':{ label: 'View AI scan results',  desc: 'See AI compliance scan results on messages' },
    },
  },
  reports: {
    label: 'Reports',
    permissions: {
      'reports.view':   { label: 'View reports',    desc: 'See analytics and reports' },
      'reports.export': { label: 'Export reports',  desc: 'Download report data' },
    },
  },
  settings: {
    label: 'Settings',
    permissions: {
      'settings.view':       { label: 'View settings',         desc: 'See firm settings' },
      'settings.edit':       { label: 'Edit firm settings',    desc: 'Change firm configuration' },
      'settings.manage_team':{ label: 'Manage team',           desc: 'Add/edit/remove team members and roles' },
      'settings.manage_integrations': { label: 'Manage integrations', desc: 'Connect channels and third-party tools' },
    },
  },
  calendar: {
    label: 'Calendar',
    permissions: {
      'calendar.view':   { label: 'View calendar', desc: 'See deadlines and events' },
      'calendar.edit':   { label: 'Edit calendar', desc: 'Add and manage calendar events' },
    },
  },
  tasks: {
    label: 'Tasks',
    permissions: {
      'tasks.view':    { label: 'View tasks',   desc: 'See the task list' },
      'tasks.create':  { label: 'Create tasks', desc: 'Add new tasks' },
      'tasks.complete':{ label: 'Complete tasks',desc: 'Mark tasks as done' },
    },
  },
} as const

export type Permission = string

// ── Preset role permissions ────────────────────────────────

export const PRESET_PERMISSIONS: Record<string, Permission[]> = {
  owner: Object.values(ALL_PERMISSIONS).flatMap(g => Object.keys(g.permissions)),

  cco: [
    'clients.view', 'clients.view_all', 'clients.view_360',
    'compliance.view', 'compliance.resolve', 'compliance.snooze', 'compliance.run_engine',
    'messages.view', 'messages.view_flagged', 'messages.review_flag',
    'audit.view', 'audit.export',
    'workflows.view', 'workflows.approve',
    'documents.view', 'documents.upload',
    'ai.ask', 'ai.view_scan',
    'reports.view', 'reports.export',
    'settings.view',
    'calendar.view',
    'tasks.view', 'tasks.create', 'tasks.complete',
  ],

  advisor: [
    'clients.view', 'clients.create', 'clients.edit', 'clients.view_360',
    'messages.view', 'messages.send',
    'workflows.view', 'workflows.create', 'workflows.advance',
    'documents.view', 'documents.upload',
    'ai.ask',
    'calendar.view', 'calendar.edit',
    'tasks.view', 'tasks.create', 'tasks.complete',
  ],

  operations: [
    'clients.view', 'clients.view_all', 'clients.create', 'clients.edit',
    'workflows.view', 'workflows.create', 'workflows.advance',
    'documents.view', 'documents.upload',
    'calendar.view', 'calendar.edit',
    'tasks.view', 'tasks.create', 'tasks.complete',
    'reports.view',
  ],

  associate: [
    'clients.view', 'clients.view_360',
    'messages.view',
    'workflows.view',
    'documents.view',
    'calendar.view',
    'tasks.view', 'tasks.complete',
  ],
}

// ── Permission resolver ────────────────────────────────────

export function resolvePermissions(
  role: string,
  customPermissions?: string[],
  tenantCustomRoles?: Array<{ id: string; name: string; permissions: string[] }>
): Set<Permission> {
  // Check preset roles first
  if (PRESET_PERMISSIONS[role]) {
    const base = new Set(PRESET_PERMISSIONS[role])
    // Apply any fine-grained overrides from user.permissions
    if (customPermissions) customPermissions.forEach(p => base.add(p))
    return base
  }

  // Check tenant custom roles
  if (tenantCustomRoles) {
    const customRole = tenantCustomRoles.find(r => r.id === role || r.name === role)
    if (customRole) {
      return new Set(customRole.permissions)
    }
  }

  // Fallback — minimal read-only
  return new Set(['clients.view', 'workflows.view', 'documents.view', 'calendar.view', 'tasks.view'])
}

export function hasPermission(
  permissions: Set<Permission>,
  permission: Permission
): boolean {
  return permissions.has(permission)
}

export function hasAnyPermission(
  permissions: Set<Permission>,
  required: Permission[]
): boolean {
  return required.some(p => permissions.has(p))
}
