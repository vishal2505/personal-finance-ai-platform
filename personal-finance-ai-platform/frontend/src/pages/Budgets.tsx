import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Trash2, Calendar, Target } from 'lucide-react'
import { format } from 'date-fns'
import Card from '../components/Card'
import clsx from 'clsx'

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
      const response = await axios.get('/api/budgets/')
      setBudgets(response.data)
    } catch (error) {
      console.error('Error fetching budgets:', error)
    } finally {
      setLoading(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await axios.post('/api/budgets/', {
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
    if (percentage >= 100) return 'bg-red-500'
    if (percentage >= 80) return 'bg-orange-500'
    return 'bg-green-500' // Using brand-aligned green/orange/red
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2b2521]">Budgets</h1>
          <p className="mt-1 text-sm text-[#9a8678]">Track your spending against budgets</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-[#2b2521] px-4 py-2 text-sm font-bold text-white shadow-xl transition hover:bg-[#4a403a]"
        >
          <Plus className="h-4 w-4" />
          New Budget
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm font-semibold text-[#9a8678]">Loading budgets...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {budgets.length === 0 ? (
            <div className="col-span-full py-12 text-center text-[#9a8678]">
              No budgets created yet. Create your first budget to get started.
            </div>
          ) : (
            budgets.map((budget) => (
              <Card key={budget.id} className="group relative overflow-hidden transition hover:ring-[#d07a63]/20">
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-[#cc735d]" />
                      <h3 className="font-extrabold text-[#2b2521]">{budget.name}</h3>
                    </div>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#9a8678]">
                      {budget.category_name || 'Overall'} • {budget.period}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(budget.id)}
                    className="rounded-lg p-1.5 text-[#9a8678] transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex items-end justify-between">
                    <div>
                      <div className="text-2xl font-extrabold text-[#2b2521]">
                        ${budget.spent.toFixed(2)}
                      </div>
                      <div className="text-xs font-medium text-[#9a8678]">
                        of ${budget.amount.toFixed(2)} limit
                      </div>
                    </div>
                    <div className="text-xs font-bold text-[#b8a79c]">
                      {((budget.spent / budget.amount) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#f4ebe6]">
                    <div
                      className={clsx('h-full transition-all duration-500', getProgressColor(budget.spent, budget.amount))}
                      style={{ width: `${getProgressPercentage(budget.spent, budget.amount)}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs font-medium text-[#9a8678]">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(budget.start_date), 'MMM dd')}
                  {budget.end_date && ` - ${format(new Date(budget.end_date), 'MMM dd')}`}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b2521]/40 backdrop-blur-sm">
          <Card className="w-full max-w-md shadow-2xl">
            <h3 className="mb-6 text-xl font-extrabold text-[#2b2521]">Create New Budget</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#b8a79c]">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border-0 bg-[#fbf8f4] py-2.5 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#b8a79c]">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full rounded-xl border-0 bg-[#fbf8f4] py-2.5 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#b8a79c]">Period</label>
                  <select
                    value={formData.period}
                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                    className="w-full appearance-none rounded-xl border-0 bg-[#fbf8f4] py-2.5 px-3 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#b8a79c]">Category</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full appearance-none rounded-xl border-0 bg-[#fbf8f4] py-2.5 px-3 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
                  >
                    <option value="">Overall</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#b8a79c]">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full rounded-xl border-0 bg-[#fbf8f4] py-2.5 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#b8a79c]">End Date</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full rounded-xl border-0 bg-[#fbf8f4] py-2.5 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
                  />
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl px-4 py-2 text-sm font-bold text-[#9a8678] hover:bg-black/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#d07a63] px-6 py-2 text-sm font-bold text-white shadow-lg transition hover:bg-[#b85f4a]"
                >
                  Create Budget
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}

export default Budgets
