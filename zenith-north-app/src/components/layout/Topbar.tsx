'use client'

import { usePathname } from 'next/navigation'
import { IconSearch, IconBell, IconSettings } from '@tabler/icons-react'
import Link from 'next/link'

const BREADCRUMBS: Record<string, string[]> = {
  '/dashboard':   ['Dashboard'],
  '/clients':     ['Clients'],
  '/workflows':   ['Workflows'],
  '/tasks':       ['Tasks'],
  '/calendar':    ['Calendar'],
  '/messages':    ['Messages'],
  '/compliance':  ['Compliance'],
  '/documents':   ['Documents'],
  '/audit':       ['Audit center'],
  '/builder':     ['Settings', 'Workflow builder'],
  '/ai':          ['AI assistant'],
  '/reports':     ['Reports'],
}

export default function Topbar() {
  const pathname = usePathname()

  // Match exact or prefix
  const crumbs = BREADCRUMBS[pathname]
    ?? Object.entries(BREADCRUMBS).find(([k]) => pathname.startsWith(k))?.[1]
    ?? ['Dashboard']

  return (
    <header className="flex h-[50px] flex-shrink-0 items-center gap-3.5 border-b border-zn-border bg-zn-surface px-5">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={crumb} className="flex items-center gap-1.5">
            {i < crumbs.length - 1 ? (
              <>
                <span className="text-zn-text-3 cursor-pointer hover:text-zn-text-2">
                  {crumb}
                </span>
                <span className="text-zn-text-3 text-[10px]">›</span>
              </>
            ) : (
              <span className="font-medium text-zn-text-1">{crumb}</span>
            )}
          </span>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Search */}
        <Link
          href="/ai"
          className="flex w-[220px] cursor-text items-center gap-1.5 rounded border border-zn-border bg-zn-surface-2 px-3 py-1.5 text-sm text-zn-text-3 transition-colors hover:border-zn-border-2"
        >
          <IconSearch size={13} />
          <span>Search clients, docs...</span>
          <span className="ml-auto rounded border border-zn-border bg-zn-surface-3 px-1 py-0.5 font-mono text-[9px]">
            ⌘K
          </span>
        </Link>

        {/* Notifications */}
        <button className="relative flex h-[30px] w-[30px] items-center justify-center rounded border border-transparent text-zn-text-3 transition-all hover:border-zn-border hover:bg-zn-surface-2 hover:text-zn-text-2">
          <IconBell size={15} />
          <span className="absolute right-[5px] top-[5px] h-[6px] w-[6px] rounded-full border-[1.5px] border-zn-surface bg-zn-danger" />
        </button>

        {/* Settings */}
        <Link
          href="/builder"
          className="flex h-[30px] w-[30px] items-center justify-center rounded border border-transparent text-zn-text-3 transition-all hover:border-zn-border hover:bg-zn-surface-2 hover:text-zn-text-2"
        >
          <IconSettings size={15} />
        </Link>
      </div>
    </header>
  )
}
