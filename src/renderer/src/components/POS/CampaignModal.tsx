import React, { useState } from 'react'
import { X, Tag, Plus, Trash2, Percent, DollarSign, Check, Sparkles } from 'lucide-react'
import { usePosStore, Campaign } from '../../store/usePosStore'

interface CampaignModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CampaignModal: React.FC<CampaignModalProps> = ({ isOpen, onClose }) => {
  const { campaigns, addCampaign, deleteCampaign, applyCampaign, activeCampaign, getSubtotal } = usePosStore()

  const [name, setName] = useState('')
  const [type, setType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE')
  const [value, setValue] = useState('')
  const [badgeColor, setBadgeColor] = useState<'indigo' | 'emerald' | 'amber' | 'rose' | 'purple'>('indigo')
  const [isFormOpen, setIsFormOpen] = useState(false)

  if (!isOpen) return null

  const subtotal = getSubtotal()

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const numValue = parseFloat(value)
    if (!name.trim() || isNaN(numValue) || numValue <= 0) {
      alert('Lütfen geçerli bir kampanya adı ve indirim miktarı girin.')
      return
    }

    addCampaign({
      name: name.trim(),
      type,
      value: numValue,
      badgeColor,
    })

    setName('')
    setValue('')
    setIsFormOpen(false)
  }

  const getColorClasses = (color?: string, isActive?: boolean) => {
    if (isActive) {
      return 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
    }
    switch (color) {
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
      case 'purple':
        return 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
      default:
        return 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl space-y-0">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Kampanya & İndirim Yönetimi</h3>
              <p className="text-xs text-slate-500 font-medium">Sepet şablon indirimi ve promosyonları tanımlayın</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Active Campaigns Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                <span>Tanımlı Kampanyalar ({campaigns.length})</span>
              </h4>
              <button
                onClick={() => setIsFormOpen(!isFormOpen)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yeni Kampanya Ekle</span>
              </button>
            </div>

            {/* New Campaign Creation Form */}
            {isFormOpen && (
              <form onSubmit={handleCreate} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                <h5 className="text-xs font-extrabold text-slate-800">Yeni Kampanya Şablonu Tanımla</h5>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Kampanya Adı</label>
                    <input
                      type="text"
                      placeholder="Örn: Sezon Sonu İndirimi"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">İndirim Türü</label>
                    <div className="flex rounded-xl overflow-hidden border border-slate-300 p-0.5 bg-white">
                      <button
                        type="button"
                        onClick={() => setType('PERCENTAGE')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center space-x-1 transition ${
                          type === 'PERCENTAGE' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Percent className="w-3.5 h-3.5" />
                        <span>Yüzde (%)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setType('FIXED')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center space-x-1 transition ${
                          type === 'FIXED' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Sabit Tutar (₺)</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      {type === 'PERCENTAGE' ? 'İndirim Oranı (%)' : 'İndirim Tutarı (₺)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={type === 'PERCENTAGE' ? '15' : '75'}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Rozet Rengi</label>
                    <div className="flex items-center space-x-2 pt-1">
                      {(['indigo', 'emerald', 'amber', 'rose', 'purple'] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setBadgeColor(c)}
                          className={`w-6 h-6 rounded-full border-2 transition ${
                            badgeColor === c ? 'border-slate-900 scale-110' : 'border-transparent'
                          } ${
                            c === 'indigo'
                              ? 'bg-indigo-500'
                              : c === 'emerald'
                              ? 'bg-emerald-500'
                              : c === 'amber'
                              ? 'bg-amber-500'
                              : c === 'rose'
                              ? 'bg-rose-500'
                              : 'bg-purple-500'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-300"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-md"
                  >
                    Kaydet
                  </button>
                </div>
              </form>
            )}

            {/* Campaign Cards List */}
            <div className="space-y-2">
              {campaigns.map((camp) => {
                const isActive = activeCampaign?.id === camp.id
                let previewDiscount = 0
                if (subtotal > 0) {
                  previewDiscount =
                    camp.type === 'PERCENTAGE'
                      ? (subtotal * camp.value) / 100
                      : camp.value
                }

                return (
                  <div
                    key={camp.id}
                    className={`border rounded-2xl p-3.5 flex items-center justify-between transition shadow-sm ${
                      isActive
                        ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`px-2.5 py-1 rounded-xl text-xs font-extrabold border ${getColorClasses(
                          camp.badgeColor,
                          isActive
                        )}`}
                      >
                        {camp.type === 'PERCENTAGE' ? `%${camp.value}` : `-${camp.value} ₺`}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h5 className="font-extrabold text-slate-900 text-xs">{camp.name}</h5>
                          {isActive && (
                            <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center space-x-1">
                              <Check className="w-3 h-3" />
                              <span>Sepette Aktif</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {subtotal > 0 ? (
                            <span>Mevcut Sepet İndirimi: <strong className="text-emerald-600">-{previewDiscount.toFixed(2)} ₺</strong></span>
                          ) : (
                            <span>{camp.type === 'PERCENTAGE' ? 'Tüm sepet tutarına uygulanır' : 'Sabit tutar indirimi'}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          if (isActive) {
                            applyCampaign(null)
                          } else {
                            applyCampaign(camp)
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1 ${
                          isActive
                            ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                        }`}
                      >
                        <span>{isActive ? 'Kaldır' : 'Sepete Uygula'}</span>
                      </button>

                      <button
                        onClick={() => deleteCampaign(camp.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                        title="Kampanyayı Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white text-xs font-extrabold rounded-xl hover:bg-slate-800 transition shadow-md"
          >
            Tamam / Kapat
          </button>
        </div>
      </div>
    </div>
  )
}
