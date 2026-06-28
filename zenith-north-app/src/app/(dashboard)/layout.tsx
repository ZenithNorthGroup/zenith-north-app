import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { TRPCProvider } from '@/lib/trpc/provider'
import Sidebar from '@/components/layout/Sidebar'
import Topbar  from '@/components/layout/Topbar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <TRPCProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--zn-page)' }}>
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--zn-page)' }}>
            {children}
          </main>
        </div>
      </div>
    </TRPCProvider>
  )
}
