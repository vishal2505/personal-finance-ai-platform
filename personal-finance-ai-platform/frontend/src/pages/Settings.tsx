import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Trash2, Edit, Tag, ShoppingBag } from 'lucide-react'
import Card from '../components/Card'
import clsx from 'clsx'

interface Category {
  id: number
  name: string
  color: string
  icon: string
}

interface MerchantRule {
  id: number
  merchant_pattern: string
  category_id: number
  category_name: string | null
  is_active: boolean
}

const Settings = () => {
  const [categories, setCategories] = useState<Category[]>([])
  const [merchantRules, setMerchantRules] = useState<MerchantRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [editingRule, setEditingRule] = useState<MerchantRule | null>(null)
  const [ruleForm, setRuleForm] = useState({ merchant_pattern: '', category_id: '' })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [categoriesRes, rulesRes] = await Promise.all([
        axios.get('/api/categories'),
        axios.get('/api/settings/merchant-rules')
      ])
      setCategories(categoriesRes.data)
      setMerchantRules(rulesRes.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingRule) {
        await axios.put(`/api/settings/merchant-rules/${editingRule.id}`, {
          merchant_pattern: ruleForm.merchant_pattern,
          category_id: parseInt(ruleForm.category_id)
        })
      } else {
        await axios.post('/api/settings/merchant-rules', {
          merchant_pattern: ruleForm.merchant_pattern,
          category_id: parseInt(ruleForm.category_id)
        })
      }
      setShowRuleModal(false)
      setEditingRule(null)
      setRuleForm({ merchant_pattern: '', category_id: '' })
      fetchData()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Error saving rule')
    }
  }

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return
    try {
      await axios.delete(`/api/settings/merchant-rules/${id}`)
      fetchData()
    } catch (error) {
      console.error('Error deleting rule:', error)
    }
  }

  const handleToggleRule = async (id: number) => {
    try {
      await axios.put(`/api/settings/merchant-rules/${id}/toggle`)
      fetchData()
    } catch (error) {
      console.error('Error toggling rule:', error)
    }
  }

  const openEditRule = (rule: MerchantRule) => {
    setEditingRule(rule)
    setRuleForm({ merchant_pattern: rule.merchant_pattern, category_id: rule.category_id.toString() })
    setShowRuleModal(true)
  }

  if (loading) {
    return <div className="py-12 text-center text-sm font-semibold text-[#9a8678]">Loading settings...</div>
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-[#2b2521]">Settings</h1>
        <p className="mt-1 text-sm text-[#9a8678]">Manage categories and automation rules.</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Merchant Rules Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xl font-extrabold text-[#2b2521]">Automation Rules</h2>
            <button
              onClick={() => {
                setEditingRule(null)
                setRuleForm({ merchant_pattern: '', category_id: '' })
                setShowRuleModal(true)
              }}
              className="flex items-center gap-1.5 rounded-xl bg-[#f4ebe6] px-3 py-1.5 text-xs font-bold text-[#cc735d] transition hover:bg-[#ebd5ce]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add New
            </button>
          </div>

          <Card className="divide-y divide-[#f0ebe6] !p-0">
            {merchantRules.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#9a8678]">
                No rules yet. Add a rule to auto-categorize transactions.
              </div>
            ) : (
              merchantRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-4 transition hover:bg-[#fbf8f4]"
                >
                  <div className="flex items-center gap-4">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f4ebe6] text-[#cc735d]">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold text-[#2b2521]">{rule.merchant_pattern}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-[#9a8678]">
                        <Tag className="h-3 w-3" />
                        {rule.category_name || 'Unknown Category'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className={clsx(
                        'rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition',
                        rule.is_active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {rule.is_active ? 'Active' : 'Paused'}
                    </button>
                    <button
                      onClick={() => openEditRule(rule)}
                      className="rounded-lg p-2 text-[#9a8678] transition hover:bg-black/5 hover:text-[#2b2521]"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="rounded-lg p-2 text-[#9a8678] transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </Card>
        </section>
      </div>



      {/* Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b2521]/40 backdrop-blur-sm">
          <Card className="w-full max-w-sm shadow-2xl">
            <h3 className="mb-6 text-xl font-extrabold text-[#2b2521]">
              {editingRule ? 'Edit Rule' : 'New Rule'}
            </h3>
            <form onSubmit={handleRuleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#b8a79c]">Merchant Pattern</label>
                <input
                  type="text"
                  required
                  value={ruleForm.merchant_pattern}
                  onChange={(e) => setRuleForm({ ...ruleForm, merchant_pattern: e.target.value })}
                  className="w-full rounded-xl border-0 bg-[#fbf8f4] py-2.5 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
                  placeholder="e.g., Starbucks"
                />
                <p className="mt-1.5 text-xs text-[#9a8678]">
                  Matches if merchant name contains this text.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#b8a79c]">Category</label>
                <select
                  required
                  value={ruleForm.category_id}
                  onChange={(e) => setRuleForm({ ...ruleForm, category_id: e.target.value })}
                  className="w-full appearance-none rounded-xl border-0 bg-[#fbf8f4] py-2.5 px-3 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
                >
                  <option value="">Select category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-8 flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowRuleModal(false)
                    setEditingRule(null)
                  }}
                  className="rounded-xl px-4 py-2 text-sm font-bold text-[#9a8678] hover:bg-black/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#d07a63] px-6 py-2 text-sm font-bold text-white shadow-lg transition hover:bg-[#b85f4a]"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}

export default Settings
