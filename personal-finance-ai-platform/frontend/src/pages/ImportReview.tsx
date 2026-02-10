import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { format } from 'date-fns'

interface Transaction {
  id: number
  date: string
  amount: number
  merchant: string
  description: string | null
  category_id: number | null
  category_name: string | null
  status: string
}

const ImportReview = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([])
  const [selectedCategory, setSelectedCategory] = useState<{ [key: number]: number | null }>({})
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [bulkCategory, setBulkCategory] = useState('')

  useEffect(() => {
    if (location.state?.transactions) {
      setTransactions(location.state.transactions)
      fetchCategories()
    } else {
      // If no transactions in state, fetch pending transactions
      fetchPendingTransactions()
      fetchCategories()
    }
  }, [location])

  const fetchPendingTransactions = async () => {
    try {
      const response = await axios.get('/api/transactions', {
        params: { status: 'pending', limit: 100 }
      })
      setTransactions(response.data)
    } catch (error) {
      console.error('Error fetching transactions:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/settings/categories')
      setCategories(response.data)
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const handleCategoryChange = (transactionId: number, categoryId: string) => {
    setSelectedCategory({
      ...selectedCategory,
      [transactionId]: categoryId ? parseInt(categoryId) : null
    })
  }

  const handleBulkCategoryChange = (categoryId: string) => {
    setBulkCategory(categoryId)
    if (categoryId && selectedTransactions.size > 0) {
      const updates: { [key: number]: number } = {}
      selectedTransactions.forEach((id) => {
        updates[id] = parseInt(categoryId)
      })
      setSelectedCategory({ ...selectedCategory, ...updates })
    }
  }

  const handleToggleSelect = (transactionId: number) => {
    const newSelected = new Set(selectedTransactions)
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId)
    } else {
      newSelected.add(transactionId)
    }
    setSelectedTransactions(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedTransactions.size === transactions.length) {
      setSelectedTransactions(new Set())
    } else {
      setSelectedTransactions(new Set(transactions.map((t) => t.id)))
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const updates = Object.entries(selectedCategory).map(([transactionId, categoryId]) => ({
        transaction_id: parseInt(transactionId),
        category_id: categoryId
      }))

      for (const update of updates) {
        await axios.put(`/api/transactions/${update.transaction_id}`, {
          category_id: update.category_id,
          status: 'reviewed'
        })
      }

      // Bulk update selected transactions
      if (selectedTransactions.size > 0) {
        await axios.post('/api/transactions/bulk-update', {
          transaction_ids: Array.from(selectedTransactions),
          status: 'reviewed'
        })
      }

      navigate('/transactions')
    } catch (error) {
      console.error('Error saving updates:', error)
      alert('Error saving updates')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Import Review</h1>
        <p className="mt-2 text-sm text-gray-600">Review and categorize imported transactions</p>
      </div>

      {transactions.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <p className="text-gray-500">No pending transactions to review</p>
        </div>
      ) : (
        <>
          <div className="bg-white shadow rounded-lg mb-4 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {selectedTransactions.size === transactions.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-gray-600">
                  {selectedTransactions.size} selected
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={bulkCategory}
                  onChange={(e) => handleBulkCategoryChange(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                  disabled={selectedTransactions.size === 0}
                >
                  <option value="">Bulk assign category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                      <input
                        type="checkbox"
                        checked={selectedTransactions.size === transactions.length && transactions.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
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
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedTransactions.has(transaction.id)}
                          onChange={() => handleToggleSelect(transaction.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(transaction.date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{transaction.merchant}</div>
                        {transaction.description && (
                          <div className="text-sm text-gray-500">{transaction.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${transaction.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={selectedCategory[transaction.id] || transaction.category_id || ''}
                          onChange={(e) => handleCategoryChange(transaction.id, e.target.value)}
                          className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Uncategorized</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            transaction.status === 'reviewed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ImportReview
