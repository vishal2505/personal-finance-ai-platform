import { useState, useEffect } from 'react'
import axios from 'axios'
import { Lightbulb, TrendingDown, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react'
import Card from '../components/Card'
import clsx from 'clsx'

interface Insight {
  type: string
  title: string
  description: string
  data?: any
}

const Insights = () => {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [useAI, setUseAI] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchInsights()
  }, [useAI])

  const fetchInsights = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get(`/api/insights/?use_ai=${useAI}`)
      setInsights(response.data)
    } catch (error: any) {
      console.error('Error fetching insights:', error)
      setError(error.response?.data?.detail || 'Failed to load insights. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getIcon = (type: string, data?: any) => {
    switch (type) {
      case 'trend':
        const change = Number(data?.change_percent)
        if (!Number.isNaN(change) && change >= 0) {
          return <TrendingUp className="h-6 w-6 text-green-500" />
        }
        return <TrendingDown className="h-6 w-6 text-red-500" />
      case 'category':
        return <DollarSign className="h-6 w-6 text-blue-500" />
      case 'budget':
      case 'anomaly':
        return <AlertTriangle className="h-6 w-6 text-amber-500" />
      case 'tip':
      default:
        return <Lightbulb className="h-6 w-6 text-[#d07a63]" />
    }
  }

  const getBackgroundColor = (type: string) => {
    switch (type) {
      case 'trend':
        return 'bg-red-50'
      case 'category':
        return 'bg-blue-50'
      case 'budget':
      case 'anomaly':
        return 'bg-amber-50'
      default:
        return 'bg-[#f4ebe6]'
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2b2521]">AI Insights</h1>
          <p className="mt-1 text-sm text-[#9a8678]">
            Smart recommendations to improve your financial health.
          </p>
        </div>
        <button
          onClick={() => setUseAI(!useAI)}
          className={clsx(
            'rounded-xl px-4 py-2 text-sm font-semibold transition',
            useAI
              ? 'bg-[#d07a63] text-white hover:bg-[#b85f4a]'
              : 'bg-[#f4ebe6] text-[#6f6158] hover:bg-[#e8ddd6]'
          )}
        >
          {useAI ? '✨ AI Enhanced' : 'Basic Insights'}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-12 text-center text-[#9a8678]">Analyzing finances...</div>
        ) : insights.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[#9a8678]">
            No insights available yet. Add more transactions to generate analysis.
          </div>
        ) : (
          insights.map((insight, index) => (
            <Card key={index} className="flex flex-col justify-between transition hover:shadow-lg">
              <div>
                <div
                  className={clsx(
                    'mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl',
                    getBackgroundColor(insight.type)
                  )}
                >
                  {getIcon(insight.type, insight.data)}
                </div>
                <h3 className="mb-2 text-lg font-bold text-[#2b2521]">
                  {insight.title}
                </h3>
                <p className="text-sm leading-relaxed text-[#6f6158]">{insight.description}</p>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-[#f0ebe6] pt-4">
                <span className="text-xs font-semibold text-[#b8a79c]">
                  AI Generated
                </span>
                {/* <button className="flex items-center gap-1 text-xs font-bold text-[#d07a63] transition hover:text-[#b85f4a]">
                  View Details <ArrowRight className="h-3 w-3" />
                </button> */}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

export default Insights
