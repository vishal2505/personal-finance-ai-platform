import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { RefreshCw, AlertTriangle, Info, AlertOctagon, Search } from 'lucide-react'
import { format, subMonths } from 'date-fns'
import Card from '../components/Card'
import clsx from 'clsx'

interface Anomaly {
  transaction_id: number
  transaction: {
    id: number
    date: string
    amount: number
    merchant: string
    description: string | null
    category_name: string | null
    status: string
    anomaly_score: number
  }
  reason: string
  severity: string
}

interface TransactionSummary {
  id: number
  date: string
  amount: number
  merchant: string
  category_name: string | null
}

const Anomalies = () => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [transactions, setTransactions] = useState<TransactionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [months, setMonths] = useState(3)
  const [searchTerm, setSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [seenFilter, setSeenFilter] = useState<'all' | 'new' | 'seen'>('all')
  const [showExpected, setShowExpected] = useState(false)
  const [updatingExpected, setUpdatingExpected] = useState<Record<number, boolean>>({})

  useEffect(() => {
    fetchAnomalies()
  }, [months])

  const getDateRange = () => {
    const end = new Date()
    const start = subMonths(end, months)
    return { start, end }
  }

  const fetchAnomalies = async () => {
    setLoading(true)
    try {
      const { start, end } = getDateRange()
      const [anomalyResponse, transactionResponse] = await Promise.all([
        axios.get('/api/anomalies/', { params: { months } }),
        axios.get('/api/transactions/', {
          params: {
            start_date: start.toISOString(),
            end_date: end.toISOString(),
            limit: 2000,
            skip: 0
          }
        })
      ])
      setAnomalies(anomalyResponse.data)
      setTransactions(transactionResponse.data)
    } catch (error) {
      console.error('Error fetching anomalies:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      await axios.post('/api/anomalies/recalculate', null, {
        params: { months }
      })
      await fetchAnomalies()
    } catch (error) {
      console.error('Error recalculating anomalies:', error)
    } finally {
      setRecalculating(false)
    }
  }

  const handleMarkExpected = async (transactionId: number) => {
    setUpdatingExpected((prev) => ({ ...prev, [transactionId]: true }))
    try {
      await axios.put(`/api/transactions/${transactionId}`, { status: 'reviewed' })
      setAnomalies((prev) =>
        prev.map((anomaly) =>
          anomaly.transaction.id === transactionId
            ? {
                ...anomaly,
                transaction: { ...anomaly.transaction, status: 'reviewed' }
              }
            : anomaly
        )
      )
    } catch (error) {
      console.error('Error marking transaction as expected:', error)
    } finally {
      setUpdatingExpected((prev) => {
        const next = { ...prev }
        delete next[transactionId]
        return next
      })
    }
  }

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'high':
        return {
          bg: 'bg-red-50',
          text: 'text-red-700',
          icon: AlertOctagon,
          iconColor: 'text-red-600'
        }
      case 'medium':
        return {
          bg: 'bg-orange-50',
          text: 'text-orange-700',
          icon: AlertTriangle,
          iconColor: 'text-orange-600'
        }
      case 'low':
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          icon: Info,
          iconColor: 'text-blue-600'
        }
      default:
        return {
          bg: 'bg-gray-50',
          text: 'text-gray-700',
          icon: Info,
          iconColor: 'text-gray-600'
        }
    }
  }

  const merchantStats = useMemo(() => {
    const stats = new Map<string, { sum: number; count: number }>()
    transactions.forEach((transaction) => {
      const key = transaction.merchant?.trim() || 'Unknown'
      const entry = stats.get(key) || { sum: 0, count: 0 }
      entry.sum += transaction.amount
      entry.count += 1
      stats.set(key, entry)
    })
    return stats
  }, [transactions])

  const categoryStats = useMemo(() => {
    const stats = new Map<string, { sum: number; count: number }>()
    transactions.forEach((transaction) => {
      const key = transaction.category_name || 'Uncategorized'
      const entry = stats.get(key) || { sum: 0, count: 0 }
      entry.sum += transaction.amount
      entry.count += 1
      stats.set(key, entry)
    })
    return stats
  }, [transactions])

  const merchantCounts = useMemo(() => {
    const counts = new Map<string, number>()
    transactions.forEach((transaction) => {
      const key = transaction.merchant?.trim() || 'Unknown'
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return counts
  }, [transactions])

  const categoryOptions = useMemo(() => {
    const set = new Set<string>()
    anomalies.forEach((anomaly) => {
      set.add(anomaly.transaction.category_name || 'Uncategorized')
    })
    return ['all', ...Array.from(set).sort()]
  }, [anomalies])

  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((anomaly) => {
      const merchant = anomaly.transaction.merchant?.trim() || 'Unknown'
      const category = anomaly.transaction.category_name || 'Uncategorized'
      const status = anomaly.transaction.status || 'processed'
      const isNewMerchant = (merchantCounts.get(merchant) || 0) <= 1

      if (!showExpected && status === 'reviewed') {
        return false
      }
      if (severityFilter !== 'all' && anomaly.severity !== severityFilter) {
        return false
      }
      if (categoryFilter !== 'all' && category !== categoryFilter) {
        return false
      }
      if (seenFilter === 'new' && !isNewMerchant) {
        return false
      }
      if (seenFilter === 'seen' && isNewMerchant) {
        return false
      }
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase()
        const merchantMatch = merchant.toLowerCase().includes(term)
        const descriptionMatch = anomaly.transaction.description?.toLowerCase().includes(term)
        if (!merchantMatch && !descriptionMatch) {
          return false
        }
      }
      return true
    })
  }, [anomalies, categoryFilter, merchantCounts, searchTerm, seenFilter, severityFilter, showExpected])

  return (
    <div className="p-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2b2521]">Anomalies</h1>
          <p className="mt-1 text-sm text-[#9a8678]">Unusual transactions detected by AI</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <select
              value={months}
              onChange={(e) => setMonths(parseInt(e.target.value))}
              className="appearance-none rounded-xl border-0 bg-[#fbf8f4] py-2 pl-4 pr-10 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
            >
              <option value={1}>Last Month</option>
              <option value={3}>Last 3 Months</option>
              <option value={6}>Last 6 Months</option>
              <option value={12}>Last Year</option>
            </select>
          </div>
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="flex items-center gap-2 rounded-xl bg-[#2b2521] px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:bg-[#4a403a] disabled:opacity-50"
          >
            <RefreshCw className={clsx('h-4 w-4', recalculating && 'animate-spin')} />
            Recalculate
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#9a8678]" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search merchant or note"
            className="w-full rounded-xl border-0 bg-white py-2 pl-9 pr-4 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'high', 'medium', 'low'] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setSeverityFilter(level)}
              className={clsx(
                'rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide transition',
                severityFilter === level
                  ? 'bg-[#2b2521] text-white'
                  : 'bg-[#fbf8f4] text-[#6f6158] ring-1 ring-[#e8e4df]'
              )}
            >
              {level}
            </button>
          ))}
        </div>
        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          className="rounded-xl border-0 bg-[#fbf8f4] px-3 py-2 text-xs font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
        >
          {categoryOptions.map((option) => (
            <option key={option} value={option}>
              {option === 'all' ? 'All Categories' : option}
            </option>
          ))}
        </select>
        <select
          value={seenFilter}
          onChange={(event) => setSeenFilter(event.target.value as 'all' | 'new' | 'seen')}
          className="rounded-xl border-0 bg-[#fbf8f4] px-3 py-2 text-xs font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
        >
          <option value="all">All Merchants</option>
          <option value="new">New Merchants</option>
          <option value="seen">Previously Seen</option>
        </select>
        <label className="flex items-center gap-2 text-xs font-semibold text-[#6f6158]">
          <input
            type="checkbox"
            checked={showExpected}
            onChange={(event) => setShowExpected(event.target.checked)}
            className="h-4 w-4 rounded border-[#e8e4df] text-[#2b2521] focus:ring-[#d07a63]"
          />
          Show expected
        </label>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm font-semibold text-[#9a8678]">Loading anomalies...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredAnomalies.length === 0 ? (
            <Card className="py-12 text-center text-[#9a8678]">
              No anomalies match your filters.
            </Card>
          ) : (
            filteredAnomalies.map((anomaly) => {
              const style = getSeverityStyles(anomaly.severity)
              const Icon = style.icon
              const merchant = anomaly.transaction.merchant?.trim() || 'Unknown'
              const category = anomaly.transaction.category_name || 'Uncategorized'
              const status = anomaly.transaction.status || 'processed'
              const merchantStat = merchantStats.get(merchant)
              const categoryStat = categoryStats.get(category)
              const merchantAvg = merchantStat ? merchantStat.sum / merchantStat.count : null
              const categoryAvg = categoryStat ? categoryStat.sum / categoryStat.count : null
              const merchantDeviation = merchantAvg && merchantAvg !== 0
                ? ((anomaly.transaction.amount - merchantAvg) / merchantAvg) * 100
                : null
              const isNewMerchant = (merchantCounts.get(merchant) || 0) <= 1
              return (
                <Card key={anomaly.transaction_id} className="group transition hover:bg-white hover:shadow-lg">
                  <div className="flex items-start gap-4">
                    <div className={clsx('mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full', style.bg)}>
                      <Icon className={clsx('h-5 w-5', style.iconColor)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className="font-extrabold text-[#2b2521]">{merchant}</h3>
                          <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide', style.bg, style.text)}>
                            {anomaly.severity} Priority
                          </span>
                          {status === 'reviewed' && (
                            <span className="rounded-full bg-[#eef7ec] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#2f6b2f]">
                              Expected
                            </span>
                          )}
                          {isNewMerchant && (
                            <span className="rounded-full bg-[#f0f3ff] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#3b4fd6]">
                              New Merchant
                            </span>
                          )}
                        </div>
                        <div className="text-lg font-extrabold text-[#2b2521]">
                          ${anomaly.transaction.amount.toFixed(2)}
                        </div>
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-[#9a8678]">
                        <span>{format(new Date(anomaly.transaction.date), 'MMM dd, yyyy')}</span>
                        <span>•</span>
                        <span>{category}</span>
                      </div>

                      <p className="mt-3 text-sm leading-relaxed text-[#6f6158]">
                        {anomaly.reason}
                      </p>

                      <details className="mt-4 text-sm text-[#6f6158]">
                        <summary className="cursor-pointer font-semibold text-[#2b2521]">Why flagged</summary>
                        <div className="mt-2 grid gap-2 rounded-xl bg-[#fbf8f4] p-3 text-xs text-[#6f6158]">
                          <div>
                            <span className="font-semibold text-[#2b2521]">Anomaly score:</span>{' '}
                            {anomaly.transaction.anomaly_score.toFixed(2)}
                          </div>
                          <div>
                            <span className="font-semibold text-[#2b2521]">Merchant average:</span>{' '}
                            {merchantAvg !== null
                              ? `$${merchantAvg.toFixed(2)} (n=${merchantStat?.count})`
                              : 'Not enough data'}
                          </div>
                          <div>
                            <span className="font-semibold text-[#2b2521]">Category average:</span>{' '}
                            {categoryAvg !== null
                              ? `$${categoryAvg.toFixed(2)} (n=${categoryStat?.count})`
                              : 'Not enough data'}
                          </div>
                          {merchantDeviation !== null && (
                            <div>
                              <span className="font-semibold text-[#2b2521]">Deviation vs merchant:</span>{' '}
                              {merchantDeviation >= 0 ? '+' : ''}{merchantDeviation.toFixed(0)}%
                            </div>
                          )}
                        </div>
                      </details>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleMarkExpected(anomaly.transaction.id)}
                          disabled={!!updatingExpected[anomaly.transaction.id] || status === 'reviewed'}
                          className="rounded-xl border border-[#e8e4df] bg-white px-3 py-1.5 text-xs font-semibold text-[#2b2521] transition hover:bg-[#fbf8f4] disabled:opacity-60"
                        >
                          {status === 'reviewed' ? 'Marked Expected' : 'Mark Expected'}
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export default Anomalies
