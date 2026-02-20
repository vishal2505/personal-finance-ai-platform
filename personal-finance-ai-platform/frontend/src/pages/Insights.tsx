import { useState, useEffect } from 'react'
import axios from 'axios'
import { Lightbulb, TrendingDown, TrendingUp, AlertTriangle, DollarSign, Sparkles, BarChart3 } from 'lucide-react'
import Card from '../components/Card'
import clsx from 'clsx'

interface Insight {
  type: string
  title: string
  description: string
  data?: any
  source?: 'rule' | 'ai'
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

  const getIcon = (type: string, data?: any, source?: string) => {
    if (source === 'ai') {
      return <Sparkles className="h-6 w-6 text-purple-500" />
    }
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

  const getBackgroundColor = (type: string, source?: string) => {
    if (source === 'ai') return 'bg-purple-50'
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

  const ruleInsights = insights.filter(i => i.source !== 'ai')
  const aiInsights = insights.filter(i => i.source === 'ai')

  const renderCard = (insight: Insight, index: number) => (
    <Card
      key={`${insight.source ?? 'rule'}-${insight.type}-${insight.title}`}
      className={clsx(
        'flex flex-col justify-between transition hover:shadow-lg',
        insight.source === 'ai' && 'ring-1 ring-purple-200'
      )}
    >
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div
            className={clsx(
              'inline-flex h-12 w-12 items-center justify-center rounded-2xl',
              getBackgroundColor(insight.type, insight.source)
            )}
          >
            {getIcon(insight.type, insight.data, insight.source)}
          </div>
          {insight.source === 'ai' && (
            <span className="flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-purple-700">
              <Sparkles className="h-3 w-3" />
              OpenAI
            </span>
          )}
        </div>
        <h3 className="mb-2 text-lg font-bold text-[#2b2521]">
          {insight.title}
        </h3>
        <p className="text-sm leading-relaxed text-[#6f6158]">{insight.description}</p>
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-[#f0ebe6] pt-4">
        <span className={clsx(
          'flex items-center gap-1.5 text-xs font-semibold',
          insight.source === 'ai' ? 'text-purple-500' : 'text-[#b8a79c]'
        )}>
          {insight.source === 'ai' ? (
            <>
              <Sparkles className="h-3 w-3" />
              Powered by GPT
            </>
          ) : (
            <>
              <BarChart3 className="h-3 w-3" />
              Rule-Based Analysis
            </>
          )}
        </span>
      </div>
    </Card>
  )

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

      {loading ? (
        <div className="py-12 text-center text-[#9a8678]">Analyzing finances...</div>
      ) : insights.length === 0 ? (
        <div className="py-12 text-center text-[#9a8678]">
          No insights available yet. Add more transactions to generate analysis.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Rule-based insights */}
          {ruleInsights.length > 0 && (
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-[#9a8678]">
                <BarChart3 className="h-4 w-4" />
                Data Analysis
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {ruleInsights.map((insight, index) => renderCard(insight, index))}
              </div>
            </div>
          )}

          {/* AI-powered insights */}
          {aiInsights.length > 0 && (
            <div>
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-purple-600">
                <Sparkles className="h-4 w-4" />
                AI-Powered Recommendations
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {aiInsights.map((insight, index) => renderCard(insight, ruleInsights.length + index))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Insights
