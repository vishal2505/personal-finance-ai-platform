import React from 'react'
import SpendWiseLogo from './SpendWiseLogo'

type AuthShellProps = {
  children: React.ReactNode
  footer?: React.ReactNode
}

const AuthShell: React.FC<AuthShellProps> = ({ children, footer }) => {
  return (
    <div className="min-h-screen bg-[#c8c8c8] p-6">
      <div className="relative mx-auto min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-3xl border border-black/5 bg-[#fbf8f4] shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(208,122,99,0.16),_transparent_60%)]" />

        <div className="relative flex min-h-[calc(100vh-3rem)] flex-col px-10 py-8">
          <header className="flex items-center justify-between">
            <SpendWiseLogo />
          </header>

          <main className="flex flex-1 items-center justify-center py-10">
            <div className="w-full max-w-[520px] rounded-[36px] bg-white/80 p-10 shadow-[0_30px_80px_rgba(0,0,0,0.18)] ring-1 ring-black/5 backdrop-blur">
              {children}
            </div>
          </main>

          <footer className="text-center text-xs text-[#b4a39a]">
            {footer ?? (
              <span>
                © {new Date().getFullYear()} SpendWise Inc. Intelligent personal finance.
              </span>
            )}
          </footer>
        </div>
      </div>
    </div>
  )
}

export default AuthShell
