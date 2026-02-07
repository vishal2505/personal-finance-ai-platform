import { useState, useEffect } from 'react'
import axios from 'axios'
import { RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

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
      const response = await axios.get('/api/anomalies', {
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Anomalies</h1>
          <p className="mt-2 text-sm text-gray-600">Unusual transactions detected by AI</p>
        </div>
        <div className="flex items-center space-x-4">
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
          <button
            onClick={handleRecalculate}
            disabled={recalculating}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
            Recalculate
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading anomalies...</div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {anomalies.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No anomalies detected. Your spending patterns look normal!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Merchant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Severity
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {anomalies.map((anomaly) => (
                    <tr key={anomaly.transaction_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(anomaly.transaction.date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {anomaly.transaction.merchant}
                        </div>
                        {anomaly.transaction.description && (
                          <div className="text-sm text-gray-500">
                            {anomaly.transaction.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${anomaly.transaction.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {anomaly.transaction.category_name || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {anomaly.reason}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${getSeverityColor(anomaly.severity)}`}
                        >
                          {anomaly.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Anomalies
