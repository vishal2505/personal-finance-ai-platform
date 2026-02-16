import { useState, useEffect } from 'react'
import axios from 'axios'
import { Lightbulb, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react'
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

  useEffect(() => {
    fetchInsights()
  }, [])

  const fetchInsights = async () => {
    try {
      const response = await axios.get('/api/insights/')
      setInsights(response.data)
    } catch (error) {
      console.error('Error fetching insights:', error)
    } finally {
      setLoading(false)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'trend':
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
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2b2521]">AI Insights</h1>
        <p className="mt-1 text-sm text-[#9a8678]">
          Smart recommendations to improve your financial health.
        </p>
      </div>

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
                  {getIcon(insight.type)}
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
