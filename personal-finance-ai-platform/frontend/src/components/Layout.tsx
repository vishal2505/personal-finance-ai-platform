import clsx from 'clsx'
import { Link, useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  DollarSign,
  FileCheck,
  FileText,
  LayoutDashboard,
  Layers,
  LogOut,
  Settings,
  Sparkles,
  Upload,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import SpendWiseLogo from './SpendWiseLogo'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { logout, user } = useAuth()
  const location = useLocation()

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
    { path: '/upload', icon: Upload, label: 'Upload Statement' },
    { path: '/import-review', icon: FileCheck, label: 'Import Review' },
    { path: '/transactions', icon: FileText, label: 'Transactions' },
    { path: '/categories', icon: Layers, label: 'Categories' },
    { path: '/budgets', icon: DollarSign, label: 'Budgets' },
    { path: '/insights', icon: Sparkles, label: 'AI Insights', badge: 'NEW' as const },
    { path: '/anomalies', icon: AlertTriangle, label: 'Anomalies' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ]

  const displayName = user?.full_name || user?.email || 'Guest'
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')

  return (
    <div className="flex h-screen bg-[#fbf8f4] overflow-hidden">
      <aside className="hidden w-72 flex-col gap-6 border-r border-[#e8e4df] bg-white px-6 py-6 md:flex">
        <SpendWiseLogo />

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition',
                  isActive
                    ? 'bg-[#f4ebe6] text-[#cc735d] shadow-sm ring-1 ring-black/5'
                    : 'text-[#6f6158] hover:bg-black/5'
                )}
              >
                <Icon className={clsx('h-5 w-5', isActive ? 'text-[#cc735d]' : 'text-[#9a8678]')} />
                <span className="flex-1">{item.label}</span>
                {'badge' in item && item.badge && (
                  <span className="rounded-full bg-[#ffe9e2] px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-[#cc735d]">
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-black/5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#f4ebe6] text-sm font-extrabold text-[#cc735d]">
              {initials || 'U'}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[#2b2521]">{displayName}</div>
              <div className="text-xs text-[#9a8678]">Pro Account</div>
            </div>
            <Link
              to="/settings"
              className="ml-auto grid h-9 w-9 place-items-center rounded-xl text-[#9a8678] transition hover:bg-black/5"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>

          <button
            onClick={() => {
              logout()
              window.location.href = '/'
            }}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-black/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}

export default Layout
