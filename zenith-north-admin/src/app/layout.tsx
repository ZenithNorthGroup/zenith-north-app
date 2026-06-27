import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Zenith North Admin',
  description: 'Internal admin panel',
}

const NAV = [
  { href: '/dashboard',  label: 'Overview',    icon: '⬡' },
  { href: '/firms',      label: 'Firms',        icon: '⬡' },
  { href: '/channels',   label: 'Channels',     icon: '⬡' },
  { href: '/errors',     label: 'Errors',       icon: '⬡' },
  { href: '/webhooks',   label: 'Webhooks',     icon: '⬡' },
  { href: '/system',     label: 'System',       icon: '⬡' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>

          {/* Sidebar */}
          <aside style={{
            width: 200,
            flexShrink: 0,
            background: 'var(--admin-surface)',
            borderRight: '0.5px solid var(--admin-border)',
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            top: 0,
            left: 0,
            height: '100vh',
            zIndex: 10,
          }}>
            {/* Logo */}
            <div style={{
              padding: '16px 14px',
              borderBottom: '0.5px solid var(--admin-border)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <div style={{
                width: 28,
                height: 28,
                border: '1px solid rgba(201,169,110,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--admin-gold)' }}>Z</span>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--admin-text1)' }}>Admin</div>
                <div style={{ fontSize: 9, color: 'var(--admin-text3)', fontFamily: 'monospace', letterSpacing: '0.1em' }}>ZENITH NORTH</div>
              </div>
            </div>

            {/* Nav */}
            <nav style={{ padding: '8px 8px', flex: 1 }}>
              {NAV.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    color: 'var(--admin-text2)',
                    textDecoration: 'none',
                    marginBottom: 2,
                    transition: 'all 0.1s',
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Bottom */}
            <div style={{
              padding: '12px 14px',
              borderTop: '0.5px solid var(--admin-border)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--admin-text3)', fontFamily: 'monospace' }}>
                INTERNAL USE ONLY
              </div>
            </div>
          </aside>

          {/* Main */}
          <main style={{ marginLeft: 200, flex: 1, minHeight: '100vh' }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
