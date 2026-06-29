import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#F4F5F7', fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 24px',
          background: 'rgba(201,169,110,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
        }}>
          🔍
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
          Page not found
        </h1>
        <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 28, lineHeight: 1.6 }}>
          The page you're looking for doesn't exist or you don't have access to it.
        </p>
        <Link href="/dashboard" style={{
          display: 'inline-block', padding: '10px 24px',
          background: '#C9A96E', color: '#000',
          borderRadius: 8, fontSize: 14, fontWeight: 600,
          textDecoration: 'none',
        }}>
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
