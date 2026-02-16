import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Trash2, Edit } from 'lucide-react'
import Card from '../components/Card'

interface Category {
    id: number
    name: string
    color: string
    icon: string
}

const Categories = () => {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [showCategoryModal, setShowCategoryModal] = useState(false)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [categoryForm, setCategoryForm] = useState({ name: '', color: '#3B82F6', icon: '💰' })

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const response = await axios.get('/api/categories')
            setCategories(response.data)
        } catch (error) {
            console.error('Error fetching categories:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleCategorySubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (editingCategory) {
                await axios.patch(`/api/categories/${editingCategory.id}`, categoryForm)
            } else {
                await axios.post('/api/categories', categoryForm)
            }
            setShowCategoryModal(false)
            setEditingCategory(null)
            setCategoryForm({ name: '', color: '#3B82F6', icon: '💰' })
            fetchData()
        } catch (error: any) {
            alert(error.response?.data?.detail || 'Error saving category')
        }
    }

    const handleDeleteCategory = async (id: number) => {
        if (!confirm('Are you sure you want to delete this category?')) return
        try {
            await axios.delete(`/api/categories/${id}`)
            fetchData()
        } catch (error) {
            console.error('Error deleting category:', error)
        }
    }

    const openEditCategory = (category: Category) => {
        setEditingCategory(category)
        setCategoryForm({ name: category.name, color: category.color, icon: category.icon })
        setShowCategoryModal(true)
    }

    if (loading) {
        return <div className="py-12 text-center text-sm font-semibold text-[#9a8678]">Loading categories...</div>
    }

    return (
        <div className="p-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-[#2b2521]">Categories</h1>
                    <p className="mt-1 text-sm text-[#9a8678]">Manage your transaction categories.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingCategory(null)
                        setCategoryForm({ name: '', color: '#3B82F6', icon: '💰' })
                        setShowCategoryModal(true)
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-[#d07a63] px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:bg-[#b85f4a]"
                >
                    <Plus className="h-4 w-4" />
                    New Category
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => (
                    <Card key={category.id} className="flex items-center justify-between p-4 transition hover:bg-[#fbf8f4]">
                        <div className="flex items-center gap-4">
                            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#fbf8f4] text-2xl">
                                {category.icon}
                            </div>
                            <div>
                                <div className="font-bold text-[#2b2521]">{category.name}</div>
                                <div className="mt-1 flex items-center gap-1.5">
                                    <div
                                        className="h-2.5 w-2.5 rounded-full ring-1 ring-black/5"
                                        style={{ backgroundColor: category.color }}
                                    ></div>
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#9a8678]">
                                        {category.color}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => openEditCategory(category)}
                                className="rounded-lg p-2 text-[#9a8678] transition hover:bg-black/5 hover:text-[#2b2521]"
                            >
                                <Edit className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => handleDeleteCategory(category.id)}
                                className="rounded-lg p-2 text-[#9a8678] transition hover:bg-red-50 hover:text-red-600"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Category Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b2521]/40 backdrop-blur-sm">
                    <Card className="w-full max-w-sm shadow-2xl">
                        <h3 className="mb-6 text-xl font-extrabold text-[#2b2521]">
                            {editingCategory ? 'Edit Category' : 'New Category'}
                        </h3>
                        <form onSubmit={handleCategorySubmit} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#b8a79c]">Name</label>
                                <input
                                    type="text"
                                    required
                                    value={categoryForm.name}
                                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                                    className="w-full rounded-xl border-0 bg-[#fbf8f4] py-2.5 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#b8a79c]">Icon (Emoji)</label>
                                <input
                                    type="text"
                                    value={categoryForm.icon}
                                    onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                                    className="w-full rounded-xl border-0 bg-[#fbf8f4] py-2.5 text-sm font-semibold text-[#2b2521] ring-1 ring-[#e8e4df] focus:ring-2 focus:ring-[#d07a63]"
                                    placeholder="💰"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#b8a79c]">Color</label>
                                <input
                                    type="color"
                                    value={categoryForm.color}
                                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                                    className="h-10 w-full cursor-pointer rounded-xl border-0 bg-[#fbf8f4] p-1 ring-1 ring-[#e8e4df]"
                                />
                            </div>
                            <div className="mt-8 flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCategoryModal(false)
                                        setEditingCategory(null)
                                    }}
                                    className="rounded-xl px-4 py-2 text-sm font-bold text-[#9a8678] hover:bg-black/5"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-xl bg-[#d07a63] px-6 py-2 text-sm font-bold text-white shadow-lg transition hover:bg-[#b85f4a]"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    )
}

export default Categories
