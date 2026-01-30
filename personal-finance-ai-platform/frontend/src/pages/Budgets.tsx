import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Trash2, Edit } from 'lucide-react'
import { format } from 'date-fns'

interface Budget {
  id: number
  name: string
  amount: number
  spent: number
  period: string
  category_name: string | null
  start_date: string
  end_date: string | null
  is_active: boolean
}

interface Category {
  id: number
  name: string
}

const Budgets = () => {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    period: 'monthly',
    category_id: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: ''
  })

  useEffect(() => {
    fetchBudgets()
    fetchCategories()
  }, [])

  const fetchBudgets = async () => {
    try {
      const response = await axios.get('/api/budgets')
      setBudgets(response.data)
    } catch (error) {
      console.error('Error fetching budgets:', error)
    } finally {
      setLoading(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await axios.post('/api/budgets', {
        ...formData,
        amount: parseFloat(formData.amount),
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null
      })
      setShowModal(false)
      setFormData({
        name: '',
        amount: '',
        period: 'monthly',
        category_id: '',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: ''
      })
      fetchBudgets()
    } catch (error) {
      console.error('Error creating budget:', error)
      alert('Error creating budget')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this budget?')) return
    try {
      await axios.delete(`/api/budgets/${id}`)
      fetchBudgets()
    } catch (error) {
      console.error('Error deleting budget:', error)
    }
  }

  const getProgressPercentage = (spent: number, amount: number) => {
    return Math.min((spent / amount) * 100, 100)
  }

  const getProgressColor = (spent: number, amount: number) => {
    const percentage = (spent / amount) * 100
    if (percentage >= 100) return 'bg-red-600'
    if (percentage >= 80) return 'bg-yellow-600'
    return 'bg-green-600'
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Budgets</h1>
          <p className="mt-2 text-sm text-gray-600">Track your spending against budgets</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Budget
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              No budgets created yet. Create your first budget to get started.
            </div>
          ) : (
            budgets.map((budget) => (
              <div key={budget.id} className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{budget.name}</h3>
                    <p className="text-sm text-gray-500">
                      {budget.category_name || 'Overall'} • {budget.period}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(budget.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Spent</span>
                    <span className="font-medium">
                      ${budget.spent.toFixed(2)} / ${budget.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getProgressColor(budget.spent, budget.amount)}`}
                      style={{ width: `${getProgressPercentage(budget.spent, budget.amount)}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {((budget.spent / budget.amount) * 100).toFixed(1)}% used
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  {format(new Date(budget.start_date), 'MMM dd, yyyy')}
                  {budget.end_date && ` - ${format(new Date(budget.end_date), 'MMM dd, yyyy')}`}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Create New Budget</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Period</label>
                <select
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category (optional)</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Overall Budget</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">End Date (optional)</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Budgets
