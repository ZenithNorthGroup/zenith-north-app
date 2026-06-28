'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { trpc } from '@/lib/trpc/provider'
import {
  IconLayoutDashboard, IconUsers, IconGitBranch,
  IconMessage, IconCalendar, IconShield, IconFileText,
  IconListCheck, IconSparkles, IconChartBar, IconPlug,
  IconUpload, IconSettings, IconScale, IconBell,
  IconBuildingStore, IconFlag, IconStar,
} from '@tabler/icons-react'

const NAV = [
  {
    section: 'Workspace',
    items: [
      { href: '/dashboard',   label: 'Dashboard',    icon: IconLayoutDashboard },
      { href: '/clients',     label: 'Clients',       icon: IconUsers },
      { href: '/workflows',   label: 'Workflows',     icon: IconGitBranch },
      { href: '/messages',    label: 'Messages',      icon: IconMessage },
      { href: '/calendar',    label: 'Calendar',      icon: IconCalendar },
      { href: '/tasks',       label: 'Tasks',         icon: IconListCheck },
    ],
  },
  {
    section: 'Compliance',
    items: [
      { href: '/compliance',  label: 'Compliance',    icon: IconShield },
      { href: '/wsp',         label: 'WSP',           icon: IconFileText },
      { href: '/marketing',   label: 'Marketing',     icon: IconStar },
      { href: '/reviews',     label: 'Annual reviews',icon: IconCalendar },
      { href: '/incidents',   label: 'Incidents',     icon: IconFlag },
      { href: '/audit',       label: 'Audit center',  icon: IconListCheck },
    ],
  },
  {
    section: 'Operations',
    items: [
      { href: '/documents',   label: 'Documents',     icon: IconFileText },
      { href: '/vendors',     label: 'Vendors',       icon: IconBuildingStore },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      { href: '/ai',          label: 'AI assistant',  icon: IconSparkles },
      { href: '/reports',     label: 'Reports',       icon: IconChartBar },
      { href: '/integrations',label: 'Integrations',  icon: IconPlug },
      { href: '/import',      label: 'Import data',   icon: IconUpload },
    ],
  },
  {
    section: 'Firm',
    items: [
      { href: '/settings',    label: 'Settings',      icon: IconSettings },
    ],
  },
]

// Role-specific nav sets
const NAV_BY_ROLE: Record<string, typeof NAV> = {
  owner: NAV,
  cco: [
    {
      section: 'Compliance',
      items: [
        { href: '/dashboard',   label: 'Dashboard',    icon: IconLayoutDashboard },
        { href: '/compliance',  label: 'Compliance',   icon: IconShield },
        { href: '/wsp',         label: 'WSP',          icon: IconFileText },
        { href: '/marketing',   label: 'Marketing',    icon: IconStar },
        { href: '/reviews',     label: 'Annual reviews', icon: IconCalendar },
        { href: '/incidents',   label: 'Incidents',    icon: IconFlag },
        { href: '/messages',    label: 'Messages',     icon: IconMessage },
        { href: '/audit',       label: 'Audit center', icon: IconListCheck },
      ],
    },
    {
      section: 'Firm',
      items: [
        { href: '/clients',     label: 'Clients',      icon: IconUsers },
        { href: '/workflows',   label: 'Workflows',    icon: IconGitBranch },
        { href: '/documents',   label: 'Documents',    icon: IconFileText },
        { href: '/vendors',     label: 'Vendors',      icon: IconBuildingStore },
        { href: '/reports',     label: 'Reports',      icon: IconChartBar },
        { href: '/ai',          label: 'AI assistant', icon: IconSparkles },
        { href: '/settings',    label: 'Settings',     icon: IconSettings },
      ],
    },
  ],
  advisor: [
    {
      section: 'My work',
      items: [
        { href: '/dashboard',   label: 'Dashboard',    icon: IconLayoutDashboard },
        { href: '/clients',     label: 'My clients',   icon: IconUsers },
        { href: '/workflows',   label: 'Onboardings',  icon: IconGitBranch },
        { href: '/messages',    label: 'Messages',     icon: IconMessage },
        { href: '/reviews',     label: 'Annual reviews', icon: IconCalendar },
        { href: '/calendar',    label: 'Calendar',     icon: IconCalendar },
        { href: '/tasks',       label: 'Tasks',        icon: IconListCheck },
      ],
    },
    {
      section: 'Resources',
      items: [
        { href: '/marketing',   label: 'Marketing',    icon: IconStar },
        { href: '/documents',   label: 'Documents',    icon: IconFileText },
        { href: '/ai',          label: 'AI assistant', icon: IconSparkles },
        { href: '/settings',    label: 'Settings',     icon: IconSettings },
      ],
    },
  ],
  operations: [
    {
      section: 'Operations',
      items: [
        { href: '/dashboard',   label: 'Dashboard',    icon: IconLayoutDashboard },
        { href: '/workflows',   label: 'Workflows',    icon: IconGitBranch },
        { href: '/tasks',       label: 'Tasks',        icon: IconListCheck },
        { href: '/clients',     label: 'Clients',      icon: IconUsers },
        { href: '/documents',   label: 'Documents',    icon: IconFileText },
        { href: '/vendors',     label: 'Vendors',      icon: IconBuildingStore },
        { href: '/calendar',    label: 'Calendar',     icon: IconCalendar },
        { href: '/import',      label: 'Import data',  icon: IconUpload },
        { href: '/settings',    label: 'Settings',     icon: IconSettings },
      ],
    },
  ],
  associate: [
    {
      section: 'My work',
      items: [
        { href: '/dashboard',   label: 'Dashboard',    icon: IconLayoutDashboard },
        { href: '/clients',     label: 'My clients',   icon: IconUsers },
        { href: '/tasks',       label: 'Tasks',        icon: IconListCheck },
        { href: '/calendar',    label: 'Calendar',     icon: IconCalendar },
        { href: '/documents',   label: 'Documents',    icon: IconFileText },
      ],
    },
  ],
}

function ZNMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 50" fill="none">
      <rect x="2" y="2" width="36" height="46" stroke="#C9A96E" strokeWidth="1.5" fill="none" />
      <rect x="5" y="5" width="30" height="40" stroke="#C9A96E" strokeWidth="0.5" fill="none" opacity="0.4" />
      <line x1="8" y1="42" x2="32" y2="8" stroke="#C9A96E" strokeWidth="0.75" opacity="0.5" />
      <text x="8" y="24" fontFamily="Inter, sans-serif" fontWeight="300" fontSize="16" fill="#C9A96E" letterSpacing="-0.5">Z</text>
      <text x="18" y="40" fontFamily="Inter, sans-serif" fontWeight="300" fontSize="16" fill="#9CA3AF" letterSpacing="-0.5">N</text>
    </svg>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const { data: me } = trpc.me.getMe.useQuery()
  const { data: complianceData } = trpc.compliance.dashboard.useQuery()

  const role         = (me?.role ?? 'owner') as string
  const activeNav    = NAV_BY_ROLE[role] ?? NAV
  const criticalCount = complianceData?.stats?.critical ?? 0

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <div
      className="flex h-screen w-[220px] flex-shrink-0 flex-col"
      style={{ background: 'var(--zn-sidebar)', borderRight: '1px solid #1F2937' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid #1F2937' }}>
        <ZNMark size={32} />
        <div>
          <div className="text-[13px] font-semibold tracking-tight text-white">Zenith North</div>
          <div className="text-[10px] truncate" style={{ color: 'var(--zn-sidebar-muted)', maxWidth: 110 }}>
            {me?.tenantName ?? '...'}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {activeNav.map((group) => (
          <div key={group.section} className="mb-5">
            <div
              className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.09em]"
              style={{ color: 'var(--zn-sidebar-muted)' }}
            >
              {group.section}
            </div>
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href + label}
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-all mb-0.5',
                    active ? 'nav-item-active' : 'nav-item',
                  )}
                >
                  <Icon size={15} className="flex-shrink-0" />
                  {label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Compliance pulse */}
      {criticalCount > 0 && (
        <div className="mx-3 mb-3 rounded-lg p-3" style={{
          background: 'rgba(220,38,38,0.12)',
          border: '1px solid rgba(220,38,38,0.25)',
        }}>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400">
              {criticalCount} critical item{criticalCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="text-[11px] text-red-300">Needs attention today</div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderTop: '1px solid #1F2937' }}>
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
          style={{ background: 'var(--zn-gold-bg)', color: 'var(--zn-gold)' }}
        >
          {(me?.fullName ?? 'ZN').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-white truncate">
            {me?.fullName ?? '...'}
          </div>
          <div className="text-[10px] capitalize" style={{ color: 'var(--zn-sidebar-muted)' }}>
            {me?.role ?? ''}{me?.isCco ? ' · CCO' : ''}
          </div>
        </div>
        <Link href="/settings">
          <IconSettings size={14} style={{ color: 'var(--zn-sidebar-muted)' }} />
        </Link>
      </div>
    </div>
  )
}
