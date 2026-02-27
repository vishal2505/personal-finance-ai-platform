import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { format } from 'date-fns'
import { Check, ChevronDown, Save, Trash2 } from 'lucide-react'
import Card from '../components/Card'
import Checkbox from '../components/Checkbox'
import clsx from 'clsx'

interface Transaction {
  id: number
  date: string
  amount: number
  merchant: string
  description: string | null
  category_id: number | null
  category_name: string | null
  status: string
  import_job_id: number | null
}

interface ImportJob {
  id: number
  filename: string
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
  const [importJobs, setImportJobs] = useState<ImportJob[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number | 'all'>('all')

  useEffect(() => {
    if (location.state?.transactions) {
      setTransactions(location.state.transactions)
      fetchCategories()
      fetchImportJobs()
    } else {
      fetchPendingTransactions()
      fetchCategories()
      fetchImportJobs()
    }
  }, [location])

  const fetchImportJobs = async () => {
    try {
      const response = await axios.get('/api/imports/')
      setImportJobs(response.data)
    } catch (error) {
      console.error('Error fetching import jobs:', error)
    }
  }

  const fetchPendingTransactions = async () => {
    try {
      const response = await axios.get('/api/transactions/', {
        params: { status: 'pending', limit: 100 }
      })
      setTransactions(response.data)
    } catch (error) {
      console.error('Error fetching transactions:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/categories/')
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
      const updates: { [key: number]: number | null } = {}
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

  const handleDelete = async () => {
    if (selectedTransactions.size === 0) return

    const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedTransactions.size} transactions? This cannot be undone.`)
    if (!confirmDelete) return

    setLoading(true)
    try {
      await axios.post('/api/transactions/bulk-delete', {
        transaction_ids: Array.from(selectedTransactions)
      })

      // Update local state to remove deleted transactions
      const remainingTransactions = transactions.filter(t => !selectedTransactions.has(t.id))
      setTransactions(remainingTransactions)

      // Clear selection
      setSelectedTransactions(new Set())

      // If no transactions left, maybe navigate back or show empty state
    } catch (error) {
      console.error('Error deleting transactions:', error)
      alert('Error deleting transactions')
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = selectedFileId === 'all'
    ? transactions
    : transactions.filter(t => t.import_job_id === selectedFileId)

  const totalAmount = filteredTransactions.reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="p-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2b2521]">Import Review</h1>
          <p className="mt-1 text-sm text-[#9a8678]">Review and categorize imported transactions.</p>
        </div>
        <div className="flex bg-white rounded-2xl p-2 px-6 shadow-sm ring-1 ring-[#e8e4df] items-center gap-8">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#b8a79c]">Transactions</span>
            <span className="text-xl font-black text-[#2b2521] leading-tight">{filteredTransactions.length}</span>
          </div>
          <div className="w-px h-8 bg-[#e8e4df]"></div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#b8a79c]">Total SGD</span>
            <span className="text-2xl font-black text-[#d07a63] leading-tight">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {transactions.length === 0 ? (
        <Card className="text-center">
          <p className="text-[#9a8678]">No pending transactions to review.</p>
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="relative w-full max-w-xs">
              <select
                value={selectedFileId}
                onChange={(e) => setSelectedFileId(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                className="w-full appearance-none rounded-xl border-0 bg-[#fbf8f4] py-2 pl-4 pr-10 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
              >
                <option value="all">All Files</option>
                {importJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.filename}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a8678]" />
            </div>
            <button
              onClick={() => navigate('/upload')}
              className="font-semibold text-[#d07a63] hover:text-[#b85f4a]"
            >
              Upload a statement
            </button>
          </div>
        </Card>
      ) : categories.length === 0 ? (
        <Card className="text-center py-8">
          <p className="text-[#9a8678] font-medium">You haven't created any categories yet.</p>
          <p className="text-sm text-[#9a8678] mt-1">Create categories in Settings to start organizing your transactions.</p>
          <button
            onClick={() => navigate('/settings')}
            className="mt-4 rounded-xl bg-[#d07a63] px-6 py-2 text-sm font-bold text-white shadow-md transition hover:bg-[#b85f4a]"
          >
            Go to Settings
          </button>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="flex items-center justify-between py-4">
            <div className="flex items-center gap-6">
              <div className="relative">
                <select
                  value={selectedFileId}
                  onChange={(e) => setSelectedFileId(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="appearance-none rounded-xl border-0 bg-[#fbf8f4] py-2 pl-4 pr-10 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
                >
                  <option value="all">All Uploaded Files</option>
                  {importJobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.filename}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a8678]" />
              </div>
              <div className="h-4 w-px bg-[#e8e4df]"></div>
              <button
                onClick={handleSelectAll}
                className="text-sm font-bold text-[#d07a63] transition hover:text-[#b85f4a]"
              >
                {selectedTransactions.size === filteredTransactions.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-sm font-medium text-[#9a8678]">
                {selectedTransactions.size} selected
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative">
                <select
                  value={bulkCategory}
                  onChange={(e) => handleBulkCategoryChange(e.target.value)}
                  disabled={selectedTransactions.size === 0}
                  className="appearance-none rounded-xl border-0 bg-[#fbf8f4] py-2 pl-4 pr-10 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63] disabled:opacity-50"
                >
                  <option value="">Bulk assign category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a8678]" />
              </div>
              <button
                onClick={handleDelete}
                disabled={loading || selectedTransactions.size === 0}
                className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-600 ring-1 ring-red-200 transition hover:bg-red-100 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-[#2b2521] px-4 py-2 text-sm font-bold text-white shadow-md transition hover:bg-[#4a403a] disabled:opacity-50"
              >
                {loading ? (
                  'Saving...'
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </Card>

          <Card className="overflow-hidden !p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#fbf8f4]">
                  <tr>
                    <th className="w-12 px-6 py-4">
                      <Checkbox
                        checked={selectedTransactions.size === filteredTransactions.length && filteredTransactions.length > 0}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-4 font-extrabold text-[#9a8678]">Date</th>
                    <th className="px-6 py-4 font-extrabold text-[#9a8678]">Merchant</th>
                    <th className="px-6 py-4 font-extrabold text-[#9a8678]">Amount</th>
                    <th className="px-6 py-4 font-extrabold text-[#9a8678]">Category</th>
                    <th className="px-6 py-4 font-extrabold text-[#9a8678]">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0ebe6]">
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="group transition hover:bg-[#fbf8f4]">
                      <td className="px-6 py-4">
                        <Checkbox
                          checked={selectedTransactions.has(transaction.id)}
                          onChange={() => handleToggleSelect(transaction.id)}
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
                      <td className="whitespace-nowrap px-6 py-4 font-bold text-[#2b2521]">
                        ${transaction.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative">
                          <select
                            value={selectedCategory[transaction.id] ?? transaction.category_id ?? ''}
                            onChange={(e) => handleCategoryChange(transaction.id, e.target.value)}
                            className="w-full appearance-none rounded-lg border-0 bg-[#f4ebe6] py-1.5 pl-3 pr-8 text-xs font-bold text-[#cc735d] ring-1 ring-transparent focus:bg-white focus:ring-[#d07a63]"
                          >
                            <option value="">Uncategorized</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#cc735d]" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold',
                            transaction.status === 'reviewed'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-yellow-50 text-yellow-700'
                          )}
                        >
                          {transaction.status === 'reviewed' && <Check className="h-3 w-3" />}
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default ImportReview
