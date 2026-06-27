import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zn-black">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="relative flex h-12 w-12 items-start justify-center border border-zn-gold-dim p-1.5">
            <div className="absolute inset-[3px] border border-zn-gold/20" />
            <span className="relative z-10 -mt-0.5 font-sans text-xl font-semibold leading-none text-zn-gold">
              Z
            </span>
            <span className="absolute bottom-[7px] right-[7px] z-10 font-sans text-[11px] font-medium leading-none text-zn-silver">
              N
            </span>
          </div>
          <div className="text-center">
            <div className="text-base font-semibold tracking-wide text-zn-text-1">
              Zenith North
            </div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-zn-text-3">
              The RIA Operating System
            </div>
          </div>
        </div>

        <SignIn
          appearance={{
            variables: {
              colorPrimary:    '#C9A96E',
              colorBackground: '#131313',
              colorText:       '#E8EAE8',
              colorTextSecondary: '#8A9099',
              colorInputBackground: '#1A1A1A',
              colorInputText:  '#E8EAE8',
              borderRadius:    '4px',
            },
            elements: {
              card:            'bg-zn-surface border border-zn-border rounded-md shadow-none',
              headerTitle:     'text-zn-text-1 font-semibold',
              headerSubtitle:  'text-zn-text-3 font-mono text-xs',
              formButtonPrimary: 'bg-zn-gold text-zn-black font-medium hover:bg-[#B8965A]',
              footerActionLink:  'text-zn-gold hover:text-zn-gold/80',
            },
          }}
        />
      </div>
    </div>
  )
}
