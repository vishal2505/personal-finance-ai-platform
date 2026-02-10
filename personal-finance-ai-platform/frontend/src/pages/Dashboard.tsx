import { useEffect, useState } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'
import { DollarSign, TrendingUp, AlertTriangle, FileText, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { subMonths } from 'date-fns'

interface Stats {
  total_count: number
  total_amount: number
  by_category: Array<{ category: string; total: number; count: number }>
}

const Dashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [monthlyTrend, setMonthlyTrend] = useState<{ current: number; previous: number } | null>(null)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const endDate = new Date()
      const startDate = subMonths(endDate, 3)

      const [statsRes, transactionsRes] = await Promise.all([
        axios.get('/api/transactions/stats', {
          params: {
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString()
          }
        }),
        axios.get('/api/transactions', {
          params: { limit: 1000, start_date: startDate.toISOString(), end_date: endDate.toISOString() }
        })
      ])

      setStats(statsRes.data)

      // Calculate monthly trend
      const transactions = transactionsRes.data
      const currentMonth = transactions.filter((t: any) => {
        const date = new Date(t.date)
        return date.getMonth() === endDate.getMonth() && date.getFullYear() === endDate.getFullYear()
      })
      const previousMonth = transactions.filter((t: any) => {
        const date = new Date(t.date)
        const prevMonth = subMonths(endDate, 1)
        return date.getMonth() === prevMonth.getMonth() && date.getFullYear() === prevMonth.getFullYear()
      })

      const currentTotal = currentMonth.reduce((sum: number, t: any) => sum + t.amount, 0)
      const previousTotal = previousMonth.reduce((sum: number, t: any) => sum + t.amount, 0)

      setMonthlyTrend({ current: currentTotal, previous: previousTotal })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  const trendPercent = monthlyTrend
    ? ((monthlyTrend.current - monthlyTrend.previous) / monthlyTrend.previous) * 100
    : 0

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">Overview of your financial activity</p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DollarSign className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Spending</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    ${stats?.total_amount.toFixed(2) || '0.00'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FileText className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Transactions</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats?.total_count || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Monthly Trend</dt>
                  <dd className="flex items-center text-lg font-medium">
                    {trendPercent >= 0 ? (
                      <span className="text-red-600 flex items-center">
                        <ArrowUpRight className="h-4 w-4 mr-1" />
                        {Math.abs(trendPercent).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-green-600 flex items-center">
                        <ArrowDownRight className="h-4 w-4 mr-1" />
                        {Math.abs(trendPercent).toFixed(1)}%
                      </span>
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Anomalies</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    <Link to="/anomalies" className="text-blue-600 hover:text-blue-800">
                      View
                    </Link>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Top Categories</h2>
          <div className="space-y-3">
            {stats?.by_category.slice(0, 5).map((cat) => (
              <div key={cat.category} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{cat.category}</span>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500">{cat.count} transactions</span>
                  <span className="text-sm font-medium text-gray-900">${cat.total.toFixed(2)}</span>
                </div>
              </div>
            ))}
            {(!stats?.by_category || stats.by_category.length === 0) && (
              <p className="text-sm text-gray-500">No category data available</p>
            )}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to="/upload"
              className="block w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-md text-blue-700 font-medium transition"
            >
              Upload Statement
            </Link>
            <Link
              to="/transactions"
              className="block w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-md text-gray-700 font-medium transition"
            >
              View All Transactions
            </Link>
            <Link
              to="/budgets"
              className="block w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-md text-gray-700 font-medium transition"
            >
              Manage Budgets
            </Link>
            <Link
              to="/insights"
              className="block w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-md text-gray-700 font-medium transition"
            >
              View Insights
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
