'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconLayoutDashboard, IconUsers, IconGitBranch,
  IconCheckbox, IconCalendar, IconMessage,
  IconShield, IconFileText, IconClipboardList,
  IconSettings2, IconSparkles, IconChartBar,
  IconDots, IconChevronRight,
} from '@tabler/icons-react'
import { trpc } from '@/lib/trpc/provider'
import { cn } from '@/lib/utils'

// ── Nav config ────────────────────────────────────────────

const NAV = [
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard',   label: 'Dashboard',        icon: IconLayoutDashboard },
      { href: '/clients',     label: 'Clients',          icon: IconUsers },
      { href: '/workflows',   label: 'Workflows',        icon: IconGitBranch,    badge: 'workflows' },
      { href: '/tasks',       label: 'Tasks',            icon: IconCheckbox },
      { href: '/calendar',    label: 'Calendar',         icon: IconCalendar },
      { href: '/messages',    label: 'Messages',         icon: IconMessage,      badge: 'messages' },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { href: '/compliance',  label: 'Compliance',       icon: IconShield,       badge: 'compliance' },
      { href: '/documents',   label: 'Documents',        icon: IconFileText },
      { href: '/audit',       label: 'Audit center',     icon: IconClipboardList },
      { href: '/builder',     label: 'Workflow builder', icon: IconSettings2 },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/ai',          label: 'AI assistant',     icon: IconSparkles },
      { href: '/reports',     label: 'Reports',          icon: IconChartBar },
    ],
  },
]

// ── Compliance pulse indicator ────────────────────────────

function CompliancePulse() {
  const { data } = trpc.compliance.dashboard.useQuery(undefined, {
    refetchInterval: 60_000,  // refresh every minute
    staleTime: 30_000,
  })

  const critical = data?.stats.critical ?? 0
  const warning  = data?.stats.warning  ?? 0
  const total    = critical + warning

  const status = critical > 0 ? 'critical'
    : warning > 0             ? 'warning'
    : 'clean'

  const config = {
    clean: {
      wrap:  'border-zn-success/30 bg-zn-success/5',
      dot:   'bg-zn-success',
      ring:  'border-zn-success',
      label: 'text-zn-success',
      text:  'Firm is compliant',
    },
    warning: {
      wrap:  'border-zn-gold/20 bg-zn-gold/8',
      dot:   'bg-zn-gold',
      ring:  'border-zn-gold',
      label: 'text-zn-gold',
      text:  `${total} item${total !== 1 ? 's' : ''} need attention`,
    },
    critical: {
      wrap:  'border-zn-danger/30 bg-zn-danger/5',
      dot:   'bg-zn-danger',
      ring:  'border-zn-danger',
      label: 'text-zn-danger',
      text:  `${critical} critical item${critical !== 1 ? 's' : ''}`,
    },
  }[status]

  return (
    <Link
      href="/compliance"
      className={cn(
        'mx-3 my-3 flex items-center gap-2.5 rounded-md border px-3 py-2.5',
        'transition-all hover:border-opacity-60',
        config.wrap,
      )}
    >
      {/* Pulse animation */}
      <div className="relative h-2 w-2 flex-shrink-0">
        <div className={cn('absolute inset-0 rounded-full', config.dot)} />
        <div className={cn(
          'absolute inset-[-3px] animate-ping-slow rounded-full border opacity-0',
          config.ring,
        )} />
      </div>

      <div className="flex-1 min-w-0">
        <div className={cn('text-[11px] font-medium truncate', config.label)}>
          {config.text}
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-zn-text-3">
          Tap to review
        </div>
      </div>

      <IconChevronRight size={11} className="text-zn-text-3 flex-shrink-0" />
    </Link>
  )
}

// ── Nav badge ─────────────────────────────────────────────

function NavBadge({ type }: { type: string }) {
  const { data } = trpc.compliance.dashboard.useQuery()

  const counts: Record<string, number> = {
    compliance: (data?.stats.critical ?? 0) + (data?.stats.warning ?? 0),
    workflows:  4,   // TODO: from workflows router
    messages:   1,   // TODO: from messages router
  }

  const count = counts[type] ?? 0
  if (!count) return null

  const isWarn = type === 'compliance'
  return (
    <span className={cn(
      'ml-auto rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold',
      isWarn
        ? 'border border-zn-warning/25 bg-zn-warning/10 text-zn-warning'
        : 'bg-zn-danger text-white',
    )}>
      {count}
    </span>
  )
}

// ── Main Sidebar ──────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r border-zn-border bg-zn-surface">

      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-zn-border px-4 py-5">
        <div className="relative flex h-8 w-8 flex-shrink-0 items-start justify-center border border-zn-gold-dim p-1">
          <div className="absolute inset-[2px] border border-zn-gold/20" />
          <span className="relative z-10 -mt-0.5 font-sans text-[13px] font-semibold leading-none text-zn-gold">
            Z
          </span>
          <span className="absolute bottom-[5px] right-[5px] z-10 font-sans text-[9px] font-medium leading-none text-zn-silver">
            N
          </span>
        </div>
        <div>
          <div className="text-[13px] font-semibold tracking-wide text-zn-text-1">
            Zenith North
          </div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-zn-text-3">
            Wright Advisory
          </div>
        </div>
      </div>

      {/* Compliance pulse */}
      <CompliancePulse />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-1 scrollbar-thin">
        {NAV.map(group => (
          <div key={group.label} className="mb-5">
            <div className="mb-1.5 px-2 font-mono text-[9px] font-medium uppercase tracking-[0.12em] text-zn-text-3">
              {group.label}
            </div>
            {group.items.map(item => {
              const Icon = item.icon
              const isActive = pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'mb-0.5 flex items-center gap-2 rounded px-2.5 py-1.5 text-sm transition-all',
                    isActive
                      ? 'border border-zn-gold/20 bg-zn-gold/8 font-medium text-zn-gold hover:bg-zn-gold/8'
                      : 'text-zn-text-2 hover:bg-zn-surface-2 hover:text-zn-text-1',
                  )}
                >
                  <Icon size={14} className="flex-shrink-0" />
                  {item.label}
                  {item.badge && <NavBadge type={item.badge} />}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-zn-border p-2.5">
        <button className="flex w-full items-center gap-2.5 rounded px-2.5 py-2 transition-all hover:bg-zn-surface-2">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-zn-gold-dim bg-zn-gold/8 font-mono text-[10px] font-semibold text-zn-gold">
            JW
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-medium text-zn-text-1 truncate">James Wright</div>
            <div className="text-[10px] text-zn-text-3">Principal · CCO</div>
          </div>
          <IconDots size={13} className="text-zn-text-3 flex-shrink-0" />
        </button>
      </div>
    </aside>
  )
}
