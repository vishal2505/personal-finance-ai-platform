import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { format, subDays, subMonths } from 'date-fns'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Rectangle, AreaChart, Area } from 'recharts'

const ZERO_BAR_PLACEHOLDER_HEIGHT = 6

function TrendBarShape(props: { x?: number; y?: number; width?: number; height?: number; payload?: { amount?: number }; fill?: string }) {
  const { x = 0, y = 0, width = 0, height = 0, payload, fill = '#edd7d0' } = props
  const isZero = (payload?.amount ?? 0) === 0
  const barHeight = isZero ? ZERO_BAR_PLACEHOLDER_HEIGHT : height
  const barY = isZero ? (y + height - ZERO_BAR_PLACEHOLDER_HEIGHT) : y
  const barFill = isZero ? '#e8e4df' : fill
  return (
    <Rectangle
      x={x}
      y={barY}
      width={width}
      height={barHeight}
      fill={barFill}
      radius={[8, 8, 0, 0]}
    />
  )
}
import { Bell, Home, MoreHorizontal, PiggyBank, ShieldCheck, Tag, UtensilsCrossed, Car, Sparkles, ShoppingBag, ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const RECENT_TRANSACTIONS_COUNT = 5
const TOP_CATEGORIES_COUNT = 4
const TREND_WEEK_DAYS = 7
const TREND_MONTHS = 6
const TREND_CHART_HEIGHT = 260

interface Stats {
  total_count: number
  total_amount: number
  by_category: Array<{ category: string; total: number; count: number }>
}

interface Transaction {
  id: number
  date: string
  amount: number
  merchant?: string | null
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
  pill?: { label: string; tone: 'good' | 'info' | 'warn' }
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
              pill.tone === 'good' && 'bg-green-50 text-green-700',
              pill.tone === 'info' && 'bg-blue-50 text-blue-700',
              pill.tone === 'warn' && 'bg-amber-50 text-amber-700'
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

  const { netBalance, monthlySavings, monthlyTrend, monthlyChange, currentMonthIncome, currentMonthExpense } = useMemo(() => {
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
      monthlyChange: mChange,
      currentMonthIncome,
      currentMonthExpense,
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
    const days = Array.from({ length: TREND_WEEK_DAYS }, (_, i) => subDays(end, TREND_WEEK_DAYS - 1 - i))
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
    const months = Array.from({ length: TREND_MONTHS }, (_, i) => subMonths(end, TREND_MONTHS - 1 - i))
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
  const trendPeriodTotal = series.reduce((sum, d) => sum + d.amount, 0)
  const trendPeriodAverage = trendView === 'week'
    ? (trendPeriodTotal / TREND_WEEK_DAYS)
    : (trendPeriodTotal / TREND_MONTHS)
  const peakInPeriod = series[maxIdx]
  const peakLabel = peakInPeriod?.label ?? '—'
  const peakAmount = peakInPeriod?.amount ?? 0

  const { trendTransactionCount, previousPeriodTotal, trendVsPrevPercent } = useMemo(() => {
    const end = new Date()
    let periodStart: Date
    let prevStart: Date
    let prevEnd: Date
    if (trendView === 'week') {
      periodStart = subDays(end, TREND_WEEK_DAYS - 1)
      prevEnd = subDays(end, TREND_WEEK_DAYS)
      prevStart = subDays(prevEnd, TREND_WEEK_DAYS - 1)
    } else {
      periodStart = subMonths(end, TREND_MONTHS - 1)
      prevEnd = subMonths(end, TREND_MONTHS)
      prevStart = subMonths(prevEnd, TREND_MONTHS - 1)
    }
    let count = 0
    let prevTotal = 0
    transactions.forEach((t) => {
      if (t.transaction_type === 'credit') return
      const d = new Date(t.date)
      const amount = Number(t.amount || 0)
      if (d >= periodStart && d <= end) count += 1
      if (d >= prevStart && d < prevEnd) prevTotal += amount
    })
    let vsPercent: number | null = null
    if (prevTotal > 0) {
      vsPercent = ((trendPeriodTotal - prevTotal) / prevTotal) * 100
    }
    return {
      trendTransactionCount: count,
      previousPeriodTotal: prevTotal,
      trendVsPrevPercent: vsPercent,
    }
  }, [transactions, trendView, trendPeriodTotal])

  const topCategories = (stats?.by_category || []).slice(0, TOP_CATEGORIES_COUNT)
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
          <p className="mt-1 text-sm text-[#9a8678]">Your financial summary at a glance.</p>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="text-right">
            <div className="text-[11px] font-extrabold tracking-[0.16em] text-[#b8a79c]">
              NET BALANCE
            </div>
            <div className={clsx('text-2xl font-extrabold tracking-tight', netBalance >= 0 ? 'text-green-600' : 'text-red-600')}>
              {currency(netBalance)}
            </div>
          </div>
          <div className="flex gap-6 border-l border-[#e8e4df] pl-6">
            <div className="text-right">
              <div className="text-[11px] font-extrabold tracking-[0.16em] text-[#b8a79c]">INCOME (MONTH)</div>
              <div className="text-lg font-bold text-green-600">{currency(currentMonthIncome)}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-extrabold tracking-[0.16em] text-[#b8a79c]">EXPENSE (MONTH)</div>
              <div className="text-lg font-bold text-[#cc735d]">{currency(currentMonthExpense)}</div>
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
              ? { label: `${monthlyChange >= 0 ? '+' : ''}${monthlyChange.toFixed(0)}% vs last month`, tone: monthlyChange <= 0 ? 'good' : 'warn' }
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
              <p className="text-sm text-[#9a8678]">
                {trendView === 'week' ? 'Last 7 days' : 'Last 6 months'} — expenses only
              </p>
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

          <div className="mt-6" style={{ minHeight: TREND_CHART_HEIGHT }}>
            {rawMaxSeries === 0 ? (
              <div
                className="flex flex-col items-center justify-center rounded-2xl bg-[#fbf8f4] py-12 px-6"
                style={{ height: TREND_CHART_HEIGHT }}
              >
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#edd7d0] text-[#cc735d]">
                  <ShoppingBag className="h-7 w-7" />
                </div>
                <p className="mt-4 text-center text-sm font-semibold text-[#6f6158]">
                  No spending in this period
                </p>
                <p className="mt-1 text-center text-xs text-[#9a8678]">
                  {trendView === 'week' ? 'Upload statements or add transactions to see your weekly trend.' : 'Upload statements or add transactions to see your monthly trend.'}
                </p>
              </div>
            ) : (
              <div style={{ height: TREND_CHART_HEIGHT }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={series.map((d) => ({ ...d, name: d.label }))}
                    margin={{ top: 12, right: 12, left: 8, bottom: 8 }}
                  >
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#b8a79c', fontWeight: 700 }}
                    />
                    <YAxis
                      hide
                      domain={[0, Math.max(maxSeries * 1.15, 1)]}
                    />
                    <Tooltip
                      formatter={(value: number) => [currency(value), 'Spent']}
                      labelFormatter={(label) => label}
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                      cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                    />
                    <Bar dataKey="amount" maxBarSize={48} shape={<TrendBarShape />}>
                      {series.map((_, idx) => (
                        <Cell key={idx} fill={rawMaxSeries > 0 && idx === maxIdx ? '#d07a63' : '#edd7d0'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Analytics strip below the chart */}
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center gap-6 rounded-2xl bg-[#fbf8f4] px-5 py-4">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#b8a79c]">Total in period</p>
                  <p className="mt-0.5 text-lg font-bold text-[#2b2521]">{currency(trendPeriodTotal)}</p>
                </div>
                <div className="h-10 w-px bg-[#e8e4df]" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#b8a79c]">
                    {trendView === 'week' ? 'Avg per day' : 'Avg per month'}
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-[#2b2521]">{currency(trendPeriodAverage)}</p>
                </div>
              </div>
              <div className="ml-auto h-10 w-full min-w-[140px] max-w-[200px] sm:ml-0 sm:flex-1">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#b8a79c]">Trend</p>
                <ResponsiveContainer width="100%" height={36}>
                  <AreaChart data={series.map((d) => ({ ...d, name: d.label }))} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trendSparkline" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#cc735d" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#cc735d" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#cc735d"
                      strokeWidth={1.5}
                      fill="url(#trendSparkline)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Second row: more analytics */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-[#fbf8f4] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#b8a79c]">Transactions</p>
                <p className="mt-0.5 text-base font-bold text-[#2b2521]">{trendTransactionCount}</p>
                <p className="text-xs text-[#9a8678]">expenses in period</p>
              </div>
              <div className="rounded-xl bg-[#fbf8f4] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#b8a79c]">
                  Peak {trendView === 'week' ? 'day' : 'month'}
                </p>
                <p className="mt-0.5 text-base font-bold text-[#2b2521]">{peakLabel}</p>
                <p className="text-xs text-[#9a8678]">{currency(peakAmount)}</p>
              </div>
              <div className="rounded-xl bg-[#fbf8f4] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#b8a79c]">Vs previous period</p>
                {trendVsPrevPercent !== null ? (
                  <>
                    <p className={clsx('mt-0.5 text-base font-bold', trendVsPrevPercent <= 0 ? 'text-green-600' : 'text-amber-600')}>
                      {trendVsPrevPercent >= 0 ? '+' : ''}{trendVsPrevPercent.toFixed(0)}%
                    </p>
                    <p className="text-xs text-[#9a8678]">
                      {trendVsPrevPercent <= 0 ? 'Less spent' : 'More spent'} than prior {trendView === 'week' ? '7 days' : '6 months'}
                    </p>
                  </>
                ) : (
                  <p className="mt-0.5 text-sm text-[#9a8678]">No prior data</p>
                )}
              </div>
              <div className="rounded-xl bg-[#fbf8f4] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#b8a79c]">Previous period total</p>
                <p className="mt-0.5 text-base font-bold text-[#2b2521]">{currency(previousPeriodTotal)}</p>
                <p className="text-xs text-[#9a8678]">prior {trendView === 'week' ? 'week' : '6 months'}</p>
              </div>
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
                <div className="text-sm text-[#9a8678]">No spending by category yet. Upload a statement to see breakdown.</div>
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

          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold tracking-tight text-[#2b2521]">Recent activity</h2>
              <Link
                to="/transactions"
                className="flex items-center gap-1 text-xs font-semibold text-[#cc735d] transition hover:text-[#b85d47]"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {transactions.length === 0 ? (
                <p className="text-sm text-[#9a8678]">No transactions yet. Upload a statement to get started.</p>
              ) : (
                transactions.slice(0, RECENT_TRANSACTIONS_COUNT).map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-xl bg-black/[0.02] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-[#2b2521]">
                        {t.merchant || 'Transaction'}
                      </div>
                      <div className="text-xs text-[#9a8678]">
                        {format(new Date(t.date), 'MMM d, yyyy')}
                        {t.category_name && ` · ${t.category_name}`}
                      </div>
                    </div>
                    <div className={clsx('ml-2 shrink-0 text-sm font-bold', t.transaction_type === 'credit' ? 'text-green-600' : 'text-[#2b2521]')}>
                      {t.transaction_type === 'credit' ? '+' : '-'}{currency(Math.abs(t.amount))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
