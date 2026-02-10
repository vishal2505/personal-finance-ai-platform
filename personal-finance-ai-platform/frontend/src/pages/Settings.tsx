import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Trash2, Edit } from 'lucide-react'

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
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingRule, setEditingRule] = useState<MerchantRule | null>(null)
  const [categoryForm, setCategoryForm] = useState({ name: '', color: '#3B82F6', icon: '💰' })
  const [ruleForm, setRuleForm] = useState({ merchant_pattern: '', category_id: '' })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [categoriesRes, rulesRes] = await Promise.all([
        axios.get('/api/settings/categories'),
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

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingCategory) {
        await axios.put(`/api/settings/categories/${editingCategory.id}`, categoryForm)
      } else {
        await axios.post('/api/settings/categories', categoryForm)
      }
      setShowCategoryModal(false)
      setEditingCategory(null)
      setCategoryForm({ name: '', color: '#3B82F6', icon: '💰' })
      fetchData()
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Error saving category')
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

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Are you sure you want to delete this category?')) return
    try {
      await axios.delete(`/api/settings/categories/${id}`)
      fetchData()
    } catch (error) {
      console.error('Error deleting category:', error)
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

  const openEditCategory = (category: Category) => {
    setEditingCategory(category)
    setCategoryForm({ name: category.name, color: category.color, icon: category.icon })
    setShowCategoryModal(true)
  }

  const openEditRule = (rule: MerchantRule) => {
    setEditingRule(rule)
    setRuleForm({ merchant_pattern: rule.merchant_pattern, category_id: rule.category_id.toString() })
    setShowRuleModal(true)
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-sm text-gray-600">Manage categories and merchant rules</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Categories</h2>
            <button
              onClick={() => {
                setEditingCategory(null)
                setCategoryForm({ name: '', color: '#3B82F6', icon: '💰' })
                setShowCategoryModal(true)
              }}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </button>
          </div>
          <div className="space-y-2">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{category.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{category.name}</div>
                    <div
                      className="w-4 h-4 rounded-full inline-block"
                      style={{ backgroundColor: category.color }}
                    ></div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openEditCategory(category)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Merchant Rules Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Merchant Rules</h2>
            <button
              onClick={() => {
                setEditingRule(null)
                setRuleForm({ merchant_pattern: '', category_id: '' })
                setShowRuleModal(true)
              }}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </button>
          </div>
          <div className="space-y-2">
            {merchantRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">{rule.merchant_pattern}</div>
                  <div className="text-xs text-gray-500">
                    → {rule.category_name || 'Unknown Category'}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleToggleRule(rule.id)}
                    className={`px-2 py-1 text-xs rounded ${
                      rule.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {rule.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => openEditRule(rule)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingCategory ? 'Edit Category' : 'New Category'}
            </h3>
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Icon</label>
                <input
                  type="text"
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="💰"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Color</label>
                <input
                  type="color"
                  value={categoryForm.color}
                  onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  className="mt-1 block w-full h-10 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryModal(false)
                    setEditingCategory(null)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rule Modal */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {editingRule ? 'Edit Merchant Rule' : 'New Merchant Rule'}
            </h3>
            <form onSubmit={handleRuleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Merchant Pattern</label>
                <input
                  type="text"
                  required
                  value={ruleForm.merchant_pattern}
                  onChange={(e) => setRuleForm({ ...ruleForm, merchant_pattern: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  placeholder="e.g., Starbucks, GRAB"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Transactions containing this text will be auto-categorized
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select
                  required
                  value={ruleForm.category_id}
                  onChange={(e) => setRuleForm({ ...ruleForm, category_id: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="">Select category...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRuleModal(false)
                    setEditingRule(null)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings
