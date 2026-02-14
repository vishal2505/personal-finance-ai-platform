import { useState, useEffect } from 'react'
import axios from 'axios'
import { RefreshCw, AlertTriangle, Info, AlertOctagon } from 'lucide-react'
import { format } from 'date-fns'
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
  }
  reason: string
  severity: string
}

const Anomalies = () => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [months, setMonths] = useState(3)

  useEffect(() => {
    fetchAnomalies()
  }, [months])

  const fetchAnomalies = async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/anomalies/', {
        params: { months }
      })
      setAnomalies(response.data)
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

      {loading ? (
        <div className="py-12 text-center text-sm font-semibold text-[#9a8678]">Loading anomalies...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {anomalies.length === 0 ? (
            <Card className="py-12 text-center text-[#9a8678]">
              No anomalies detected. Your spending patterns look normal!
            </Card>
          ) : (
            anomalies.map((anomaly) => {
              const style = getSeverityStyles(anomaly.severity)
              const Icon = style.icon
              return (
                <Card key={anomaly.transaction_id} className="group transition hover:bg-white hover:shadow-lg">
                  <div className="flex items-start gap-4">
                    <div className={clsx('mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full', style.bg)}>
                      <Icon className={clsx('h-5 w-5', style.iconColor)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className="font-extrabold text-[#2b2521]">{anomaly.transaction.merchant}</h3>
                          <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide', style.bg, style.text)}>
                            {anomaly.severity} Priority
                          </span>
                        </div>
                        <div className="text-lg font-extrabold text-[#2b2521]">
                          ${anomaly.transaction.amount.toFixed(2)}
                        </div>
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-[#9a8678]">
                        <span>{format(new Date(anomaly.transaction.date), 'MMM dd, yyyy')}</span>
                        <span>•</span>
                        <span>{anomaly.transaction.category_name || 'Uncategorized'}</span>
                      </div>

                      <p className="mt-3 text-sm leading-relaxed text-[#6f6158]">
                        {anomaly.reason}
                      </p>
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
