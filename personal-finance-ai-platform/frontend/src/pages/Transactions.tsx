import { useState, useEffect } from 'react'
import axios from 'axios'
import { format, subMonths } from 'date-fns'
import { Search, Filter, Download, Trash2 } from 'lucide-react'
import Card from '../components/Card'


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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
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

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)))
    }
  }

  const deleteTransaction = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return
    try {
      await axios.delete(`/api/transactions/${id}`)
      setTransactions((prev) => prev.filter((t) => t.id !== id))
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next })
    } catch (err: any) {
      console.error('Error deleting transaction:', err)
      setError(err.response?.data?.detail || 'Failed to delete transaction')
    }
  }

  const bulkDeleteTransactions = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} transaction${selectedIds.size > 1 ? 's' : ''}?`)) return
    try {
      await axios.post('/api/transactions/bulk-delete', { transaction_ids: Array.from(selectedIds) })
      setTransactions((prev) => prev.filter((t) => !selectedIds.has(t.id)))
      setSelectedIds(new Set())
    } catch (err: any) {
      console.error('Error deleting transactions:', err)
      setError(err.response?.data?.detail || 'Failed to delete transactions')
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2b2521]">Transactions</h1>
          <p className="mt-1 text-sm text-[#9a8678]">View and filter your transaction history</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#6f6158] shadow-sm ring-1 ring-black/5 transition hover:bg-black/5">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[#b8a79c]">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full rounded-xl border-0 bg-[#fbf8f4] py-2.5 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[#b8a79c]">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full rounded-xl border-0 bg-[#fbf8f4] py-2.5 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[#b8a79c]">Category</label>
              <div className="relative">
                <select
                  value={filters.categoryId}
                  onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
                  className="w-full appearance-none rounded-xl border-0 bg-[#fbf8f4] py-2.5 pl-4 pr-10 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <Filter className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a8678]" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-[#b8a79c]">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a8678]" />
                <input
                  type="text"
                  placeholder="Search merchant..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full rounded-xl border-0 bg-[#fbf8f4] py-2.5 pl-10 pr-4 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] placeholder:text-[#b8a79c] focus:ring-2 focus:ring-[#d07a63]"
                />
              </div>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="py-12 text-center text-sm font-semibold text-[#9a8678]">Loading transactions...</div>
        ) : (
          <Card className="overflow-hidden !p-0">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 border-b border-[#f0ebe6] bg-red-50 px-6 py-3">
                <span className="text-sm font-semibold text-[#2b2521]">
                  {selectedIds.size} selected
                </span>
                <button
                  onClick={bulkDeleteTransactions}
                  className="flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Selected
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#fbf8f4]">
                  <tr>
                    <th className="w-12 px-6 py-4">
                      <input
                        type="checkbox"
                        checked={transactions.length > 0 && selectedIds.size === transactions.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-[#e8e4df] text-[#d07a63] focus:ring-[#d07a63]"
                      />
                    </th>
                    <th className="px-6 py-4 font-extrabold text-[#9a8678]">Date</th>
                    <th className="px-6 py-4 font-extrabold text-[#9a8678]">Merchant</th>
                    <th className="px-6 py-4 font-extrabold text-[#9a8678]">Category</th>
                    <th className="px-6 py-4 font-extrabold text-[#9a8678]">Amount</th>
                    <th className="px-6 py-4 font-extrabold text-[#9a8678]">Bank</th>
                    <th className="px-6 py-4 font-extrabold text-[#9a8678]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ebe6]">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-[#9a8678]">
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    transactions.map((transaction) => (
                      <tr key={transaction.id} className={`group transition hover:bg-[#fbf8f4] ${selectedIds.has(transaction.id) ? 'bg-[#fbf8f4]' : ''}`}>
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(transaction.id)}
                            onChange={() => toggleSelect(transaction.id)}
                            className="h-4 w-4 rounded border-[#e8e4df] text-[#d07a63] focus:ring-[#d07a63]"
                          />
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 font-medium text-[#6f6158]">
                          {format(new Date(transaction.date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-[#2b2521]">{transaction.merchant}</div>
                          {transaction.description && (
                            <div className="text-xs text-[#9a8678]">{transaction.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-lg bg-[#f4ebe6] px-2.5 py-1 text-xs font-bold text-[#cc735d]">
                            {transaction.category_name || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 font-bold text-[#2b2521]">
                          ${transaction.amount.toFixed(2)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-[#9a8678]">
                          {transaction.bank_name || '-'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <button
                            onClick={() => deleteTransaction(transaction.id)}
                            className="rounded-lg p-1.5 text-[#b8a79c] transition hover:bg-red-50 hover:text-red-500"
                            title="Delete transaction"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

export default Transactions
