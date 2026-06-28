'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  IconLayoutDashboard, IconUsers, IconGitBranch,
  IconMessage, IconCalendar, IconShield, IconFileText,
  IconListCheck, IconSparkles, IconChartBar, IconPlug,
  IconUpload, IconSettings,
} from '@tabler/icons-react'

const NAV = [
  {
    section: 'Workspace',
    items: [
      { href: '/dashboard',   label: 'Dashboard',   icon: IconLayoutDashboard },
      { href: '/clients',     label: 'Clients',      icon: IconUsers },
      { href: '/workflows',   label: 'Workflows',    icon: IconGitBranch },
      { href: '/messages',    label: 'Messages',     icon: IconMessage },
      { href: '/calendar',    label: 'Calendar',     icon: IconCalendar },
      { href: '/tasks',       label: 'Tasks',        icon: IconListCheck },
    ],
  },
  {
    section: 'Compliance',
    items: [
      { href: '/compliance',  label: 'Compliance',   icon: IconShield },
      { href: '/documents',   label: 'Documents',    icon: IconFileText },
      { href: '/audit',       label: 'Audit center', icon: IconListCheck },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      { href: '/ai',          label: 'AI assistant', icon: IconSparkles },
      { href: '/reports',     label: 'Reports',      icon: IconChartBar },
      { href: '/integrations',label: 'Integrations', icon: IconPlug },
      { href: '/import',      label: 'Import data',  icon: IconUpload },
    ],
  },
]

const NAV_BY_ROLE: Record<string, typeof NAV> = {
  owner: NAV,
  cco: [
    {
      section: 'Compliance',
      items: [
        { href: '/dashboard',   label: 'Dashboard',    icon: IconLayoutDashboard },
        { href: '/compliance',  label: 'Compliance',   icon: IconShield },
        { href: '/messages',    label: 'Messages',     icon: IconMessage },
        { href: '/audit',       label: 'Audit center', icon: IconListCheck },
        { href: '/documents',   label: 'Documents',    icon: IconFileText },
      ],
    },
    {
      section: 'Firm',
      items: [
        { href: '/clients',     label: 'Clients',      icon: IconUsers },
        { href: '/workflows',   label: 'Workflows',    icon: IconGitBranch },
        { href: '/calendar',    label: 'Calendar',     icon: IconCalendar },
      ],
    },
    {
      section: 'Intelligence',
      items: [
        { href: '/ai',          label: 'AI assistant', icon: IconSparkles },
        { href: '/reports',     label: 'Reports',      icon: IconChartBar },
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
        { href: '/calendar',    label: 'Calendar',     icon: IconCalendar },
        { href: '/tasks',       label: 'Tasks',        icon: IconListCheck },
      ],
    },
    {
      section: 'Resources',
      items: [
        { href: '/documents',   label: 'Documents',    icon: IconFileText },
        { href: '/ai',          label: 'AI assistant', icon: IconSparkles },
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
        { href: '/calendar',    label: 'Calendar',     icon: IconCalendar },
        { href: '/import',      label: 'Import data',  icon: IconUpload },
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
      {/* Outer rectangle frame */}
      <rect x="2" y="2" width="36" height="46" stroke="#C9A96E" strokeWidth="1.5" fill="none" />
      {/* Inner rectangle */}
      <rect x="5" y="5" width="30" height="40" stroke="#C9A96E" strokeWidth="0.5" fill="none" opacity="0.4" />
      {/* Diagonal slash */}
      <line x1="8" y1="42" x2="32" y2="8" stroke="#C9A96E" strokeWidth="0.75" opacity="0.5" />
      {/* Z letterform (gold) */}
      <text x="8" y="24" fontFamily="Inter, sans-serif" fontWeight="300" fontSize="16" fill="#C9A96E" letterSpacing="-0.5">Z</text>
      {/* N letterform (silver) */}
      <text x="18" y="40" fontFamily="Inter, sans-serif" fontWeight="300" fontSize="16" fill="#9CA3AF" letterSpacing="-0.5">N</text>
    </svg>
  )
}

export default function Sidebar() {
  const pathname = usePathname()

  // Read role from cookie as fallback — getMe replaces this in production
  const role = typeof window !== 'undefined'
    ? (document.cookie.match(/zn_role=([^;]+)/)?.[1] ?? 'owner')
    : 'owner'

  const activeNav = NAV_BY_ROLE[role] ?? NAV

  const roleLabel = {
    owner:      'Owner',
    cco:        'CCO',
    advisor:    'Advisor',
    operations: 'Operations',
    associate:  'Associate',
  }[role] ?? 'Team member'

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
          <div className="text-[13px] font-semibold tracking-tight text-white">
            Zenith North
          </div>
          <div className="text-[10px]" style={{ color: 'var(--zn-sidebar-muted)' }}>
            Wright Advisory
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
                  key={href}
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
      <div className="mx-3 mb-3 rounded-lg p-3" style={{
        background: 'rgba(220,38,38,0.12)',
        border: '1px solid rgba(220,38,38,0.25)',
      }}>
        <div className="flex items-center gap-1.5 mb-1">
          <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
          <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400">
            2 critical items
          </span>
        </div>
        <div className="text-[11px] text-red-300">Needs attention today</div>
      </div>

      {/* Footer */}
      <div
        className="flex items-center gap-2.5 px-4 py-3"
        style={{ borderTop: '1px solid #1F2937' }}
      >
        <div
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
          style={{ background: 'var(--zn-gold-bg)', color: 'var(--zn-gold)' }}
        >
          JW
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-white truncate">James Wright</div>
          <div className="text-[10px]" style={{ color: 'var(--zn-sidebar-muted)' }}>CCO · Admin</div>
        </div>
        <IconSettings size={14} style={{ color: 'var(--zn-sidebar-muted)' }} />
      </div>
    </div>
  )
}
