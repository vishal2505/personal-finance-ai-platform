import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { format, subDays, subMonths } from 'date-fns'
import { Bell, Home, MoreHorizontal, PiggyBank, ShieldCheck, Tag, UtensilsCrossed, Car, Sparkles, ShoppingBag } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface Stats {
  total_count: number
  total_amount: number
  by_category: Array<{ category: string; total: number; count: number }>
}

interface Transaction {
  id: number
  date: string
  amount: number
  category_name?: string | null
}

type TrendView = 'week' | 'month'

const currency = (value: number) =>
  value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

const getCategoryIcon = (name: string) => {
  const n = name.toLowerCase()
  if (n.includes('food') || n.includes('dining') || n.includes('restaurant')) return UtensilsCrossed
  if (n.includes('transport') || n.includes('grab') || n.includes('uber') || n.includes('taxi')) return Car
  if (n.includes('home') || n.includes('housing') || n.includes('rent')) return Home
  return Tag
}

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div
    className={clsx(
      'rounded-3xl bg-white/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)] ring-1 ring-black/5 backdrop-blur',
      className
    )}
  >
    {children}
  </div>
)

const StatCard: React.FC<{
  icon: React.ElementType
  iconBg: string
  iconColor: string
  title: string
  value: string
  pill?: { label: string; tone: 'good' | 'info' }
  menu?: boolean
}> = ({ icon: Icon, iconBg, iconColor, title, value, pill, menu }) => (
  <Card className="p-7">
    <div className="flex items-start justify-between gap-4">
      <div className={clsx('grid h-12 w-12 place-items-center rounded-2xl', iconBg)}>
        <Icon className={clsx('h-6 w-6', iconColor)} />
      </div>
      <div className="flex items-center gap-2">
        {pill && (
          <span
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-extrabold',
              pill.tone === 'good'
                ? 'bg-green-50 text-green-700'
                : 'bg-blue-50 text-blue-700'
            )}
          >
            {pill.label}
          </span>
        )}
        {menu && (
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-xl text-[#9a8678] transition hover:bg-black/5"
            aria-label="More options"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>

    <div className="mt-6">
      <div className="text-sm font-semibold text-[#9a8678]">{title}</div>
      <div className="mt-1 text-3xl font-extrabold tracking-tight text-[#2b2521]">{value}</div>
    </div>
  </Card>
)

const Dashboard = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [monthlyTrend, setMonthlyTrend] = useState<{ current: number; previous: number } | null>(null)
  const [trendView, setTrendView] = useState<TrendView>('week')

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const endDate = new Date()
      const startDate = subMonths(endDate, 3)

      const [statsRes, transactionsRes] = await Promise.all([
        axios.get('/api/transactions/stats', {
          params: {
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
          },
        }),
        axios.get('/api/transactions/', {
          params: { limit: 1500, start_date: startDate.toISOString(), end_date: endDate.toISOString() },
        }),
      ])

      setStats(statsRes.data)
      setTransactions(transactionsRes.data)

      const currentMonth = transactionsRes.data.filter((t: Transaction) => {
        const date = new Date(t.date)
        return date.getMonth() === endDate.getMonth() && date.getFullYear() === endDate.getFullYear()
      })
      const previousMonth = transactionsRes.data.filter((t: Transaction) => {
        const date = new Date(t.date)
        const prevMonth = subMonths(endDate, 1)
        return date.getMonth() === prevMonth.getMonth() && date.getFullYear() === prevMonth.getFullYear()
      })

      const currentTotal = currentMonth.reduce((sum: number, t: Transaction) => sum + Number(t.amount || 0), 0)
      const previousTotal = previousMonth.reduce((sum: number, t: Transaction) => sum + Number(t.amount || 0), 0)
      setMonthlyTrend({ current: currentTotal, previous: previousTotal })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const firstName = useMemo(() => {
    const raw = user?.full_name || user?.email || 'Friend'
    return raw.split(' ')[0] || raw
  }, [user?.email, user?.full_name])

  const monthlyChange = useMemo(() => {
    if (!monthlyTrend || monthlyTrend.previous <= 0) return null
    return ((monthlyTrend.current - monthlyTrend.previous) / monthlyTrend.previous) * 100
  }, [monthlyTrend])

  const weeklySeries = useMemo(() => {
    const end = new Date()
    const days = Array.from({ length: 7 }, (_, i) => subDays(end, 6 - i))
    const byKey = new Map<string, number>(days.map((d) => [format(d, 'yyyy-MM-dd'), 0]))

    for (const t of transactions) {
      const key = format(new Date(t.date), 'yyyy-MM-dd')
      if (!byKey.has(key)) continue
      byKey.set(key, (byKey.get(key) || 0) + Number(t.amount || 0))
    }

    return days.map((d) => ({
      key: format(d, 'yyyy-MM-dd'),
      label: format(d, 'EEE').toUpperCase(),
      amount: byKey.get(format(d, 'yyyy-MM-dd')) || 0,
    }))
  }, [transactions])

  const monthlySeries = useMemo(() => {
    const end = new Date()
    const months = Array.from({ length: 6 }, (_, i) => subMonths(end, 5 - i))
    const byKey = new Map<string, number>(months.map((d) => [format(d, 'yyyy-MM'), 0]))

    for (const t of transactions) {
      const key = format(new Date(t.date), 'yyyy-MM')
      if (!byKey.has(key)) continue
      byKey.set(key, (byKey.get(key) || 0) + Number(t.amount || 0))
    }

    return months.map((d) => ({
      key: format(d, 'yyyy-MM'),
      label: format(d, 'MMM').toUpperCase(),
      amount: byKey.get(format(d, 'yyyy-MM')) || 0,
    }))
  }, [transactions])

  const series = trendView === 'week' ? weeklySeries : monthlySeries
  const rawMaxSeries = Math.max(...series.map((d) => d.amount), 0)
  const maxSeries = Math.max(rawMaxSeries, 1)
  const maxIdx = series.reduce((bestIdx, cur, idx, arr) => (cur.amount > arr[bestIdx].amount ? idx : bestIdx), 0)

  const topCategories = (stats?.by_category || []).slice(0, 4)
  const maxCat = Math.max(...topCategories.map((c) => c.total), 1)

  const estimatedNetWorth = 142_580.42
  const estimatedSavings = 24_850.0
  const budgetHealth = 'Excellent'

  const insightText = (() => {
    if (monthlyChange === null) return 'Upload more transactions to unlock smarter insights.'
    if (monthlyChange < 0)
      return `You spent ${Math.abs(monthlyChange).toFixed(0)}% less this month compared to last. Great progress!`
    if (monthlyChange > 0)
      return `Your spending is up ${monthlyChange.toFixed(0)}% compared to last month. Consider reviewing top categories.`
    return 'Your spending is steady compared to last month.'
  })()

  if (loading) {
    return <div className="p-8 text-sm font-semibold text-[#6f6158]">Loading dashboard...</div>
  }

  return (
    <div className="p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2b2521]">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-[#9a8678]">Here&apos;s your financial summary for today.</p>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[11px] font-extrabold tracking-[0.16em] text-[#b8a79c]">
              ESTIMATED NET WORTH
            </div>
            <div className="text-2xl font-extrabold tracking-tight text-[#2b2521]">
              {currency(estimatedNetWorth)}
            </div>
          </div>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full bg-white/80 text-[#9a8678] ring-1 ring-black/5 transition hover:bg-white"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <StatCard
          icon={ShoppingBag}
          iconBg="bg-[#f4ebe6]"
          iconColor="text-[#cc735d]"
          title="Monthly Spending"
          value={currency(monthlyTrend?.current || 0)}
          pill={
            monthlyChange !== null
              ? { label: `${monthlyChange >= 0 ? '+' : '-'}${Math.abs(monthlyChange).toFixed(0)}% vs last month`, tone: 'good' }
              : undefined
          }
        />
        <StatCard
          icon={PiggyBank}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          title="Total Savings"
          value={currency(estimatedSavings)}
          pill={{ label: '+8.2%', tone: 'info' }}
        />
        <StatCard
          icon={ShieldCheck}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          title="Budget Health"
          value={budgetHealth}
          menu
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-[#2b2521]">Spending Trends</h2>
              <p className="text-sm text-[#9a8678]">Weekly overview of your expenses</p>
            </div>

            <div className="flex items-center rounded-full bg-black/5 p-1">
              {(['week', 'month'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTrendView(v)}
                  className={clsx(
                    'rounded-full px-4 py-2 text-xs font-extrabold transition',
                    trendView === v ? 'bg-white text-[#2b2521] shadow ring-1 ring-black/5' : 'text-[#9a8678]'
                  )}
                >
                  {v === 'week' ? 'Week' : 'Month'}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <div className="flex h-64 items-end gap-3">
              {series.map((d, idx) => {
                const pct = Math.max(8, Math.round((d.amount / maxSeries) * 100))
                const isMax = rawMaxSeries > 0 && idx === maxIdx
                return (
                  <div key={d.key} className="flex h-full flex-1 flex-col justify-end">
                    <div
                      className={clsx(
                        'w-full rounded-2xl transition',
                        isMax ? 'bg-[#d07a63]' : 'bg-[#edd7d0]'
                      )}
                      style={{ height: `${pct}%` }}
                      title={`${d.label}: ${currency(d.amount)}`}
                    />
                    <div className="mt-3 text-center text-[11px] font-extrabold tracking-wide text-[#b8a79c]">
                      {d.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold tracking-tight text-[#2b2521]">Top Categories</h2>
            </div>

            <div className="mt-6 space-y-6">
              {topCategories.length === 0 ? (
                <div className="text-sm text-[#9a8678]">No category data yet.</div>
              ) : (
                topCategories.map((cat) => {
                  const Icon = getCategoryIcon(cat.category)
                  const width = Math.max(4, Math.round((cat.total / maxCat) * 100))
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-[#9a8678]" />
                          <div className="text-sm font-semibold text-[#2b2521]">{cat.category}</div>
                        </div>
                        <div className="text-sm font-extrabold text-[#2b2521]">{currency(cat.total)}</div>
                      </div>
                      <div className="mt-3 h-2 w-full rounded-full bg-black/5">
                        <div
                          className="h-2 rounded-full bg-[#d07a63]"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          <Card className="bg-[#fff7f4]">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#ffe9e2] text-[#cc735d]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-extrabold tracking-[0.16em] text-[#cc735d]">AI INSIGHT</div>
                <p className="mt-2 text-sm leading-relaxed text-[#7d6a5f]">{insightText}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
