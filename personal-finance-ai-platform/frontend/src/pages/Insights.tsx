import { useState, useEffect } from 'react'
import axios from 'axios'
import { TrendingUp, AlertCircle, DollarSign, Lightbulb } from 'lucide-react'

interface Insight {
  type: string
  title: string
  description: string
  data?: any
}

const Insights = () => {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState(3)

  useEffect(() => {
    fetchInsights()
  }, [months])

  const fetchInsights = async () => {
    try {
      const response = await axios.get('/api/insights/', {
        params: { months }
      })
      setInsights(response.data)
    } catch (error) {
      console.error('Error fetching insights:', error)
    } finally {
      setLoading(false)
    }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'trend':
        return <TrendingUp className="h-5 w-5" />
      case 'category':
        return <DollarSign className="h-5 w-5" />
      case 'anomaly':
        return <AlertCircle className="h-5 w-5" />
      case 'budget':
        return <AlertCircle className="h-5 w-5" />
      default:
        return <Lightbulb className="h-5 w-5" />
    }
  }

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'trend':
        return 'bg-blue-100 text-blue-800'
      case 'category':
        return 'bg-green-100 text-green-800'
      case 'anomaly':
        return 'bg-yellow-100 text-yellow-800'
      case 'budget':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Insights</h1>
          <p className="mt-2 text-sm text-gray-600">AI-powered insights about your spending patterns</p>
        </div>
        <select
          value={months}
          onChange={(e) => setMonths(parseInt(e.target.value))}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value={1}>Last Month</option>
          <option value={3}>Last 3 Months</option>
          <option value={6}>Last 6 Months</option>
          <option value={12}>Last Year</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading insights...</div>
      ) : (
        <div className="space-y-6">
          {insights.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-6 text-center text-gray-500">
              No insights available. Upload some transactions to get started.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {insights.map((insight, index) => (
                  <div
                    key={index}
                    className={`bg-white shadow rounded-lg p-6 border-l-4 ${
                      insight.type === 'trend' ? 'border-blue-500' :
                      insight.type === 'category' ? 'border-green-500' :
                      insight.type === 'anomaly' ? 'border-yellow-500' :
                      'border-red-500'
                    }`}
                  >
                    <div className="flex items-start">
                      <div className={`flex-shrink-0 ${getInsightColor(insight.type)} rounded-full p-2`}>
                        {getInsightIcon(insight.type)}
                      </div>
                      <div className="ml-4 flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{insight.title}</h3>
                        <p className="mt-2 text-sm text-gray-600">{insight.description}</p>
                        {insight.data && (
                          <div className="mt-4 text-xs text-gray-500">
                            {JSON.stringify(insight.data, null, 2)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Spending Overview</h2>
                <p className="text-sm text-gray-600 mb-4">
                  View detailed analytics and trends in the Transactions and Dashboard pages.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default Insights
