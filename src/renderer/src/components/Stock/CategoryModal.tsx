import React, { useState } from 'react'
import { X, Plus, Edit2, Trash2, Check, Tag } from 'lucide-react'
import { notifyDataChanged } from '../../utils/events'

interface CategoryModalProps {
  isOpen: boolean
  onClose: () => void
  categories: any[]
  onRefresh: () => Promise<void> | void
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  categories,
  onRefresh,
}) => {
  const [newCatName, setNewCatName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim() || isSubmitting) return

    setIsSubmitting(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/products/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      })

      if (res.ok) {
        setNewCatName('')
        setIsSubmitting(false)
        onRefresh()
        notifyDataChanged()
      } else {
        const data = await res.json()
        setErrorMsg(data.error || 'Kategori eklenemedi.')
        setIsSubmitting(false)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Bağlantı hatası.')
      setIsSubmitting(false)
    }
  }

  const handleStartEdit = (cat: any) => {
    setEditingId(cat.id)
    setEditingName(cat.name)
    setErrorMsg('')
  }

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim() || isSubmitting) return
    setIsSubmitting(true)
    setErrorMsg('')

    try {
      const res = await fetch(`/api/products/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() }),
      })

      if (res.ok) {
        setEditingId(null)
        setEditingName('')
        setIsSubmitting(false)
        onRefresh()
        notifyDataChanged()
      } else {
        const data = await res.json()
        setErrorMsg(data.error || 'Kategori güncellenemedi.')
        setIsSubmitting(false)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Güncelleme hatası.')
      setIsSubmitting(false)
    }
  }

  const handleDeleteCategory = async (id: string, name: string, count: number) => {
    const message = count > 0
      ? `"${name}" kategorisini silmek istediğinizden emin misiniz? Bu kategoriye bağlı ${count} adet ürün kategorisiz olarak kalacaktır.`
      : `"${name}" kategorisini silmek istediğinizden emin misiniz?`

    if (!confirm(message)) return

    setIsSubmitting(true)
    setErrorMsg('')
    try {
      const res = await fetch(`/api/products/categories/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        if (editingId === id) setEditingId(null)
        setIsSubmitting(false)
        onRefresh()
        notifyDataChanged()
      } else {
        const data = await res.json()
        setErrorMsg(data.error || 'Kategori silinemedi.')
        setIsSubmitting(false)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Silme hatası.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-sans">
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <Tag className="w-4 h-4 text-blue-700" />
            <h2 className="font-bold text-slate-900 text-sm">Kategori Yönetimi</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-2.5 rounded font-medium">
              {errorMsg}
            </div>
          )}

          {/* Add New Category Form */}
          <form onSubmit={handleCreateCategory} className="flex space-x-2">
            <input
              type="text"
              placeholder="Yeni kategori adı yazın..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600"
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={isSubmitting || !newCatName.trim()}
              className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-bold transition flex items-center space-x-1 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ekle</span>
            </button>
          </form>

          {/* Categories List Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="px-4 py-2.5">Kategori Adı</th>
                  <th className="px-4 py-2.5 text-center">Ürün Sayısı</th>
                  <th className="px-4 py-2.5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-400">
                      Henüz eklenmiş kategori bulunmuyor.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => {
                    const productCount = cat._count?.products || 0
                    const isEditing = editingId === cat.id

                    return (
                      <tr key={cat.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-2.5 font-semibold text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(cat.id)
                                if (e.key === 'Escape') setEditingId(null)
                              }}
                              className="bg-white border border-blue-500 rounded px-2 py-1 text-xs font-semibold text-slate-900 focus:outline-none w-full"
                              autoFocus
                            />
                          ) : (
                            <span>{cat.name}</span>
                          )}
                        </td>

                        <td className="px-4 py-2.5 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200">
                            {productCount} Ürün
                          </span>
                        </td>

                        <td className="px-4 py-2.5 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => handleSaveEdit(cat.id)}
                                className="p-1 text-emerald-700 hover:bg-emerald-50 rounded transition"
                                title="Kaydet"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1 text-slate-400 hover:bg-slate-100 rounded transition"
                                title="İptal"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                onClick={() => handleStartEdit(cat)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                                title="Düzenle"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat.id, cat.name, productCount)}
                                className="p-1 text-rose-600 hover:bg-rose-50 rounded transition"
                                title="Sil"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs font-semibold transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}
