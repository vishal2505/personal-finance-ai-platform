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
  transaction_type?: 'credit' | 'debit'
}

type TrendView = 'week' | 'month'

import Card from '../components/Card'

const currency = (value: number) =>
  value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })

const getCategoryIcon = (name: string) => {
  const n = name.toLowerCase()
  if (n.includes('food') || n.includes('dining') || n.includes('restaurant')) return UtensilsCrossed
  if (n.includes('transport') || n.includes('grab') || n.includes('uber') || n.includes('taxi')) return Car
  if (n.includes('home') || n.includes('housing') || n.includes('rent')) return Home
  return Tag
}

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
  const [budgets, setBudgets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [trendView, setTrendView] = useState<TrendView>('week')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const endDate = new Date()
      const startDate = subMonths(endDate, 3)

      const [statsRes, transactionsRes, budgetsRes] = await Promise.all([
        axios.get('/api/transactions/stats', {
          params: {
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
          },
        }),
        axios.get('/api/transactions/', {
          params: { limit: 2000 },
        }),
        axios.get('/api/budgets/'),
      ])

      setStats(statsRes.data)
      setTransactions(transactionsRes.data)
      setBudgets(budgetsRes.data)
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const firstName = useMemo(() => {
    const raw = user?.full_name || user?.email || 'Friend'
    return raw.split(' ')[0] || raw
  }, [user?.email, user?.full_name])

  // --- Metrics Calculation ---

  const { netBalance, monthlySavings, monthlyTrend, monthlyChange } = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const prevMonthDate = subMonths(now, 1)

    let balance = 0
    let currentMonthIncome = 0
    let currentMonthExpense = 0
    let prevMonthExpense = 0

    transactions.forEach((t) => {
      const tDate = new Date(t.date)
      const amount = Number(t.amount || 0)
      const isCredit = t.transaction_type === 'credit'

      // Net Balance (All Time)
      if (isCredit) balance += amount
      else balance -= amount

      // Monthly Stats
      if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
        if (isCredit) currentMonthIncome += amount
        else currentMonthExpense += amount
      } else if (tDate.getMonth() === prevMonthDate.getMonth() && tDate.getFullYear() === prevMonthDate.getFullYear()) {
        if (!isCredit) prevMonthExpense += amount
      }
    })

    const mSavings = currentMonthIncome - currentMonthExpense

    // Calculate trend percentage
    let mChange: number | null = null
    if (prevMonthExpense > 0) {
      mChange = ((currentMonthExpense - prevMonthExpense) / prevMonthExpense) * 100
    }

    return {
      netBalance: balance,
      monthlySavings: mSavings,
      monthlyTrend: currentMonthExpense,
      monthlyChange: mChange
    }
  }, [transactions])

  const budgetHealth = useMemo(() => {
    if (budgets.length === 0) return 'No Budgets'
    const criticalCount = budgets.filter(b => (b.spent / b.amount) >= 1).length
    const warningCount = budgets.filter(b => (b.spent / b.amount) >= 0.8 && (b.spent / b.amount) < 1).length

    if (criticalCount > 0) return 'Critical'
    if (warningCount > 0) return 'At Risk'
    return 'Excellent'
  }, [budgets])

  // --- Chart Data Preparation ---

  const weeklySeries = useMemo(() => {
    const end = new Date()
    const days = Array.from({ length: 7 }, (_, i) => subDays(end, 6 - i))
    const byKey = new Map<string, number>(days.map((d) => [format(d, 'yyyy-MM-dd'), 0]))

    for (const t of transactions) {
      // Only include expenses in the chart
      if (t.transaction_type === 'credit') continue

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
      if (t.transaction_type === 'credit') continue
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
              NET BALANCE
            </div>
            <div className="text-2xl font-extrabold tracking-tight text-[#2b2521]">
              {currency(netBalance)}
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
          value={currency(monthlyTrend)}
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
          title="Monthly Savings"
          value={currency(monthlySavings)}
          pill={{ label: 'Current Month', tone: 'info' }}
        />
        <StatCard
          icon={ShieldCheck}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          title="Budget Health"
          value={budgetHealth}
          pill={budgetHealth !== 'Excellent' && budgetHealth !== 'No Budgets' ? { label: 'Action Needed', tone: 'info' } : undefined}
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
