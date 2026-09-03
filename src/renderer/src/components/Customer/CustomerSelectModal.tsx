import React, { useState, useEffect } from 'react'
import { X, Search, UserPlus, Check, UserCheck, Phone, MapPin, Plus } from 'lucide-react'
import { usePosStore, Customer } from '../../store/usePosStore'

interface CustomerSelectModalProps {
  isOpen: boolean
  onClose: () => void
}

export const CustomerSelectModal: React.FC<CustomerSelectModalProps> = ({ isOpen, onClose }) => {
  const { selectedCustomer, setSelectedCustomer } = usePosStore()

  const [activeTab, setActiveTab] = useState<'search' | 'new'>('search')
  const [searchTerm, setSearchTerm] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // New Customer Form State (Ad & Soyad Separate)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchCustomers = async (query = '') => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Müşteriler çekilemedi:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchCustomers(searchTerm)
      setErrorMsg('')
    }
  }, [isOpen, searchTerm])

  if (!isOpen) return null

  const handleSelect = (customer: Customer) => {
    setSelectedCustomer(customer)
    onClose()
  }

  const handleClearSelection = () => {
    setSelectedCustomer(null)
    onClose()
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setErrorMsg('Lütfen Ad, Soyad ve Telefon Numarasını eksiksiz giriniz.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          city: city.trim(),
          district: district.trim(),
          notes: notes.trim(),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        setErrorMsg(err.error || 'Müşteri eklenirken hata oluştu.')
        setIsSubmitting(false)
        return
      }

      const newCust = await res.json()
      // Auto select newly created customer
      setSelectedCustomer(newCust)

      // Reset form
      setFirstName('')
      setLastName('')
      setPhone('')
      setCity('')
      setDistrict('')
      setNotes('')
      setIsSubmitting(false)
      setActiveTab('search')
      onClose()
    } catch (err: any) {
      setErrorMsg(`Hata: ${err.message}`)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-sans select-none">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-900 text-sm">Alışveriş Müşterisi Seç</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Sub Nav */}
        <div className="px-5 pt-3 bg-white border-b border-slate-200 flex space-x-2">
          <button
            onClick={() => setActiveTab('search')}
            className={`pb-2 text-xs font-semibold px-3 border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'search'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Müşteri Ara & Seç</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('new')
              setErrorMsg('')
            }}
            className={`pb-2 text-xs font-semibold px-3 border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'new'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Hızlı Müşteri Ekle</span>
          </button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'search' ? (
          <div className="p-4 flex-1 flex flex-col overflow-hidden space-y-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="İsim, Soyisim, Telefon, İl veya İlçe ile ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-xs"
                autoFocus
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            {/* Currently Selected Customer Badge if any */}
            {selectedCustomer && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <div>
                    <span className="font-bold text-slate-900">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </span>
                    <span className="text-slate-500 font-mono ml-2">({selectedCustomer.phone})</span>
                  </div>
                </div>
                <button
                  onClick={handleClearSelection}
                  className="px-2 py-0.5 bg-white border border-blue-200 text-rose-600 hover:bg-rose-50 rounded font-semibold text-[11px] transition"
                >
                  Kaldır (Müşterisiz Satış)
                </button>
              </div>
            )}

            {/* Customer List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
              {isLoading ? (
                <div className="text-center text-xs text-slate-400 py-8">Yükleniyor...</div>
              ) : customers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  <p>Müşteri bulunamadı.</p>
                  <button
                    onClick={() => setActiveTab('new')}
                    className="mt-2 text-blue-600 font-semibold underline hover:text-blue-800"
                  >
                    + Hızlı Müşteri Oluştur
                  </button>
                </div>
              ) : (
                customers.map((c) => {
                  const isSelected = selectedCustomer?.id === c.id
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelect(c)}
                      className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-500 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-slate-900 text-xs">
                            {c.firstName} {c.lastName}
                          </h4>
                          {isSelected && (
                            <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[10px] rounded font-semibold">
                              Seçili
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                          <span className="flex items-center space-x-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{c.phone}</span>
                          </span>
                          {(c.city || c.district) && (
                            <span className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>
                                {c.district} {c.city ? `/ ${c.city}` : ''}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelect(c)
                        }}
                        className={`px-3 py-1 rounded text-xs font-semibold transition ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700'
                        }`}
                      >
                        {isSelected ? 'Seçildi' : 'Seç'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          /* Quick Add Customer Form */
          <form onSubmit={handleCreateCustomer} className="p-4 overflow-y-auto space-y-3">
            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-md text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase">
                  Ad *
                </label>
                <input
                  type="text"
                  placeholder="Örn: Ahmet"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase">
                  Soyad *
                </label>
                <input
                  type="text"
                  placeholder="Örn: Yılmaz"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase">
                Telefon Numarası *
              </label>
              <input
                type="text"
                placeholder="Örn: 0555 123 45 67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase">
                  İl
                </label>
                <input
                  type="text"
                  placeholder="Örn: İstanbul"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase">
                  İlçe
                </label>
                <input
                  type="text"
                  placeholder="Örn: Kadıköy"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1 uppercase">
                Not (Opsiyonel)
              </label>
              <textarea
                placeholder="Örn: VIP müşteri, özel indirim uygulanabilir..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div className="pt-2 flex space-x-2">
              <button
                type="button"
                onClick={() => setActiveTab('search')}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded transition"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded transition flex items-center justify-center space-x-1 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Kaydet ve Alışverişe Seç</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
