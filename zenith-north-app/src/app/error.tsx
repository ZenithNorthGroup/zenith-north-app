'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[App Error]', error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#F4F5F7', fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 24px',
          background: 'rgba(220,38,38,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
        }}>
          ⚠️
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 28, lineHeight: 1.6 }}>
          An unexpected error occurred. Our team has been notified.
          {error.digest && (
            <span style={{ display: 'block', marginTop: 8, fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF' }}>
              Error ID: {error.digest}
            </span>
          )}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              padding: '10px 24px', background: '#C9A96E', color: '#000',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <a href="/dashboard" style={{
            padding: '10px 24px', background: 'transparent', color: '#4B5563',
            border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 14,
            textDecoration: 'none', display: 'inline-block',
          }}>
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
