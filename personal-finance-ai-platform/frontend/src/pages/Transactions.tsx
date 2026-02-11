import { useState, useEffect } from 'react'
import axios from 'axios'
import { format, subMonths } from 'date-fns'
import { Search } from 'lucide-react'

interface Transaction {
  id: number
  date: string
  amount: number
  merchant: string
  description: string | null
  category_name: string | null
  bank_name: string | null
  status: string
}

const Transactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [filters, setFilters] = useState({
    startDate: format(subMonths(new Date(), 12), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    categoryId: '',
    search: ''
  })

  useEffect(() => {
    fetchCategories()
    fetchTransactions()
  }, [filters])

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/categories/')
      setCategories(response.data)
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchTransactions = async () => {
    setLoading(true)
    setError('')
    try {
      const params: any = {
        start_date: new Date(filters.startDate + 'T00:00:00').toISOString(),
        end_date: new Date(filters.endDate + 'T23:59:59').toISOString(),
        limit: 500
      }
      if (filters.categoryId) {
        params.category_id = parseInt(filters.categoryId)
      }

      const response = await axios.get('/api/transactions/', { params })
      let filtered = response.data ?? []

      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        filtered = filtered.filter(
          (t: Transaction) =>
            t.merchant.toLowerCase().includes(searchLower) ||
            (t.description && t.description.toLowerCase().includes(searchLower))
        )
      }

      setTransactions(filtered)
    } catch (err: any) {
      console.error('Error fetching transactions:', err)
      setError(err.response?.data?.detail || err.message || 'Failed to load transactions')
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
        <p className="mt-2 text-sm text-gray-600">View and filter your transaction history</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filters.categoryId}
              onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search merchant..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
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
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bank
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No transactions found
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(transaction.date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{transaction.merchant}</div>
                        {transaction.description && (
                          <div className="text-sm text-gray-500">{transaction.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                          {transaction.category_name || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${transaction.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.bank_name || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default Transactions
