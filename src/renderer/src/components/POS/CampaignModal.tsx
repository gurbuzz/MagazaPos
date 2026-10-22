import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Tag, Plus, Trash2, Percent, DollarSign, Check, Sparkles } from 'lucide-react'
import { usePosStore, Campaign } from '../../store/usePosStore'

interface CampaignModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CampaignModal: React.FC<CampaignModalProps> = ({ isOpen, onClose }) => {
  const { campaigns, addCampaign, deleteCampaign, applyCampaign, activeCampaign, getSubtotal } = usePosStore()

  const [name, setName] = useState('')
  const [action, setAction] = useState<'DISCOUNT' | 'SURCHARGE'>('SURCHARGE')
  const [type, setType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE')
  const [value, setValue] = useState('')
  const [badgeColor, setBadgeColor] = useState<'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'orange'>('orange')
  const [isFormOpen, setIsFormOpen] = useState(false)

  if (!isOpen) return null

  const subtotal = getSubtotal()

  const parseDecimal = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val
    if (!val) return 0
    const clean = String(val).replace(/\s/g, '').replace(',', '.')
    const num = parseFloat(clean)
    return isNaN(num) ? 0 : num
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const numValue = parseDecimal(value)
    if (!name.trim() || isNaN(numValue) || numValue <= 0) {
      alert('Lütfen geçerli bir kampanya/taksit adı ve oran/tutar giriniz.')
      return
    }

    if (action === 'DISCOUNT' && type === 'PERCENTAGE' && numValue > 100) {
      alert('İndirim oranı %100\'den fazla olamaz.')
      return
    }

    addCampaign({
      name: name.trim(),
      type,
      action,
      value: numValue,
      badgeColor,
    })

    setName('')
    setValue('')
    setIsFormOpen(false)
  }

  const getColorClasses = (color?: string, isActive?: boolean, isSurcharge?: boolean) => {
    if (isActive) {
      return isSurcharge
        ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20'
        : 'bg-blue-700 text-white border-blue-700 shadow-md shadow-blue-700/20'
    }
    switch (color) {
      case 'emerald':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
      case 'rose':
        return 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
      case 'amber':
        return 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
      case 'orange':
        return 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
      case 'purple':
        return 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 select-none font-sans">
      <div className="glass-modal rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl space-y-0">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Kampanya & İndirim Yönetimi</h3>
              <p className="text-[11px] text-slate-500 font-medium">Sepet şablon indirimi ve promosyonları tanımlayın</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Active Campaigns Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center space-x-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-700" />
                <span>Tanımlı Kampanyalar ({campaigns.length})</span>
              </h4>
              <button
                onClick={() => setIsFormOpen(!isFormOpen)}
                className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded text-xs font-semibold transition flex items-center space-x-1 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yeni Kampanya Ekle</span>
              </button>
            </div>

            {/* New Campaign Creation Form */}
            {isFormOpen && (
              <form onSubmit={handleCreate} className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3">
                <h5 className="text-xs font-bold text-slate-800">Yeni Kampanya veya Taksit Şablonu Tanımla</h5>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">İşlem Türü</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-white border border-slate-300 rounded">
                    <button
                      type="button"
                      onClick={() => {
                        setAction('DISCOUNT')
                        if (badgeColor === 'orange') setBadgeColor('emerald')
                      }}
                      className={`py-1.5 text-xs font-bold rounded flex items-center justify-center space-x-1.5 transition ${
                        action === 'DISCOUNT' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>İndirim Yap (-)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAction('SURCHARGE')
                        setBadgeColor('orange')
                      }}
                      className={`py-1.5 text-xs font-bold rounded flex items-center justify-center space-x-1.5 transition ${
                        action === 'SURCHARGE' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Fiyat Artır / Taksit Farkı (+)</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Şablon / Kampanya Adı</label>
                    <input
                      type="text"
                      placeholder={action === 'SURCHARGE' ? 'Örn: +%10 Taksit Farkı' : 'Örn: Sezon Sonu İndirimi'}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 font-medium focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Hesaplama Şekli</label>
                    <div className="flex rounded border border-slate-300 p-0.5 bg-white">
                      <button
                        type="button"
                        onClick={() => setType('PERCENTAGE')}
                        className={`flex-1 py-1 text-xs font-semibold rounded flex items-center justify-center space-x-1 transition ${
                          type === 'PERCENTAGE' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Percent className="w-3 h-3" />
                        <span>Yüzde (%)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setType('FIXED')}
                        className={`flex-1 py-1 text-xs font-semibold rounded flex items-center justify-center space-x-1 transition ${
                          type === 'FIXED' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <DollarSign className="w-3 h-3" />
                        <span>Sabit Tutar (₺)</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {action === 'SURCHARGE'
                        ? (type === 'PERCENTAGE' ? 'Artırım Oranı (%)' : 'Artırım Tutarı (₺)')
                        : (type === 'PERCENTAGE' ? 'İndirim Oranı (%)' : 'İndirim Tutarı (₺)')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={type === 'PERCENTAGE' ? (action === 'SURCHARGE' ? '10' : '15') : '50'}
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 font-semibold focus:ring-1 focus:ring-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Rozet Rengi</label>
                    <div className="flex items-center space-x-2 pt-1">
                      {(['orange', 'amber', 'emerald', 'indigo', 'purple', 'rose'] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setBadgeColor(c)}
                          className={`w-5 h-5 rounded-full border-2 transition ${
                            badgeColor === c ? 'border-slate-900 scale-110' : 'border-transparent'
                          } ${
                            c === 'orange'
                              ? 'bg-amber-600'
                              : c === 'amber'
                              ? 'bg-amber-400'
                              : c === 'emerald'
                              ? 'bg-emerald-600'
                              : c === 'indigo'
                              ? 'bg-blue-600'
                              : c === 'purple'
                              ? 'bg-purple-600'
                              : 'bg-rose-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-3 py-1 bg-slate-200 text-slate-700 text-xs font-semibold rounded hover:bg-slate-300"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1 bg-blue-700 text-white text-xs font-semibold rounded hover:bg-blue-800 shadow-2xs"
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
                const isSurcharge = camp.action === 'SURCHARGE'
                let previewAmount = 0
                if (subtotal > 0) {
                  const calculated =
                    camp.type === 'PERCENTAGE'
                      ? (subtotal * camp.value) / 100
                      : camp.value
                  previewAmount = isSurcharge ? calculated : Math.min(subtotal, calculated)
                }

                return (
                  <div
                    key={camp.id}
                    className={`border rounded-lg p-3 flex items-center justify-between transition shadow-2xs ${
                      isActive
                        ? isSurcharge
                          ? 'border-amber-500 bg-amber-50/60'
                          : 'border-blue-500 bg-blue-50/50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`px-2 py-0.5 rounded text-xs font-bold border ${getColorClasses(
                          camp.badgeColor || (isSurcharge ? 'orange' : 'indigo'),
                          isActive,
                          isSurcharge
                        )}`}
                      >
                        {isSurcharge ? '+' : '-'}
                        {camp.type === 'PERCENTAGE' ? `%${camp.value}` : `${camp.value} ₺`}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h5 className="font-bold text-slate-900 text-xs">{camp.name}</h5>
                          {isActive && (
                            <span
                              className={`px-2 py-0.5 text-white text-[10px] font-semibold rounded flex items-center space-x-1 ${
                                isSurcharge ? 'bg-amber-600' : 'bg-blue-700'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                              <span>Sepette Aktif</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {subtotal > 0 ? (
                            isSurcharge ? (
                              <span>
                                Sepet Taksit / Vade Farkı:{' '}
                                <strong className="text-amber-700 font-bold">+{previewAmount.toFixed(2)} ₺</strong>
                              </span>
                            ) : (
                              <span>
                                Sepet İndirimi:{' '}
                                <strong className="text-emerald-700 font-bold">-{previewAmount.toFixed(2)} ₺</strong>
                              </span>
                            )
                          ) : (
                            <span>
                              {camp.type === 'PERCENTAGE'
                                ? 'Tüm sepet tutarına uygulanır'
                                : isSurcharge
                                ? 'Sabit tutar artırımı'
                                : 'Sabit tutar indirimi'}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => {
                          if (isActive) {
                            applyCampaign(null)
                          } else {
                            applyCampaign(camp)
                          }
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-semibold transition flex items-center space-x-1 ${
                          isActive
                            ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            : isSurcharge
                            ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-2xs'
                            : 'bg-blue-700 text-white hover:bg-blue-800 shadow-2xs'
                        }`}
                      >
                        <span>{isActive ? 'Kaldır' : 'Sepete Uygula'}</span>
                      </button>

                      <button
                        onClick={() => deleteCampaign(camp.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                        title="Kampanyayı Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded hover:bg-slate-800 transition shadow-2xs"
          >
            Tamam / Kapat
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
