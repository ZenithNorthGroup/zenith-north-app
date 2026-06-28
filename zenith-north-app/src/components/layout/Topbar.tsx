'use client'

import { usePathname } from 'next/navigation'
import { IconSearch, IconBell, IconSparkles } from '@tabler/icons-react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/clients':      'Clients',
  '/workflows':    'Workflows',
  '/messages':     'Messages',
  '/calendar':     'Calendar',
  '/tasks':        'Tasks',
  '/compliance':   'Compliance',
  '/documents':    'Documents',
  '/audit':        'Audit center',
  '/ai':           'AI assistant',
  '/reports':      'Reports',
  '/integrations': 'Integrations',
  '/import':       'Import data',
}

export default function Topbar() {
  const pathname = usePathname()
  const base = '/' + (pathname.split('/')[1] ?? '')
  const title = PAGE_TITLES[base] ?? 'Zenith North'

  return (
    <div
      className="flex h-[52px] flex-shrink-0 items-center justify-between px-6"
      style={{
        background: '#fff',
        borderBottom: '1px solid var(--zn-border)',
      }}
    >
      {/* Page title */}
      <h1 className="text-[15px] font-semibold text-zn-text-1 tracking-tight">
        {title}
      </h1>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div
          className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-[12px] cursor-pointer transition-colors"
          style={{
            background: 'var(--zn-surface-2)',
            borderColor: 'var(--zn-border)',
            color: 'var(--zn-text-3)',
          }}
        >
          <IconSearch size={13} />
          <span>Search...</span>
          <kbd
            className="rounded px-1 py-0.5 text-[10px]"
            style={{ background: 'var(--zn-border)', color: 'var(--zn-text-3)' }}
          >
            ⌘K
          </kbd>
        </div>

        {/* AI button */}
        <button className="btn-gold btn-sm flex items-center gap-1.5">
          <IconSparkles size={13} />
          Ask AI
        </button>

        {/* Notifications */}
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-md border transition-colors"
          style={{
            background: 'var(--zn-surface-2)',
            borderColor: 'var(--zn-border)',
            color: 'var(--zn-text-2)',
          }}
        >
          <IconBell size={15} />
          <span
            className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
            style={{ background: 'var(--zn-danger)' }}
          />
        </button>
      </div>
    </div>
  )
}
