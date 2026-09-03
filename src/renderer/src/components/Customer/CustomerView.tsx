import React, { useState, useEffect } from 'react'
import {
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  Calendar,
  ShoppingBag,
  Receipt,
  Printer,
  Edit2,
  Trash2,
  ChevronRight,
  UserCheck,
  X,
  CreditCard,
  Banknote,
  Clock,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  Info
} from 'lucide-react'
import { usePosStore, Customer } from '../../store/usePosStore'
import { ReturnModal } from './ReturnModal'

export const CustomerView: React.FC = () => {
  const { setSelectedCustomer, setActiveTab } = usePosStore()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [customerDetails, setCustomerDetails] = useState<any | null>(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [notes, setNotes] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Return Modal State
  const [selectedReturnSale, setSelectedReturnSale] = useState<any | null>(null)
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false)

  const fetchCustomers = async (query = '') => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(query)}`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(Array.isArray(data) ? data : [])
        // If there are customers and none selected, auto select first
        if (data.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(data[0].id)
        }
      }
    } catch (err) {
      console.error('Müşteriler çekilemedi:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCustomerDetails = async (id: string) => {
    setIsLoadingDetails(true)
    try {
      const res = await fetch(`/api/customers/${id}`)
      if (res.ok) {
        const data = await res.json()
        setCustomerDetails(data)
      }
    } catch (err) {
      console.error('Müşteri detay hatası:', err)
    } finally {
      setIsLoadingDetails(false)
    }
  }

  useEffect(() => {
    fetchCustomers(searchTerm)
  }, [searchTerm])

  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerDetails(selectedCustomerId)
    } else {
      setCustomerDetails(null)
    }
  }, [selectedCustomerId])

  const handleOpenAddModal = () => {
    setEditingCustomer(null)
    setFirstName('')
    setLastName('')
    setPhone('')
    setCity('')
    setDistrict('')
    setNotes('')
    setErrorMsg('')
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (c: Customer, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingCustomer(c)
    setFirstName(c.firstName)
    setLastName(c.lastName)
    setPhone(c.phone)
    setCity(c.city || '')
    setDistrict(c.district || '')
    setNotes(c.notes || '')
    setErrorMsg('')
    setIsModalOpen(true)
  }

  const handleDeleteCustomer = async (c: Customer, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`${c.firstName} ${c.lastName} isimli müşteriyi silmek istediğinizden emin misiniz?`)) {
      return
    }
    try {
      const res = await fetch(`/api/customers/${c.id}`, { method: 'DELETE' })
      if (res.ok) {
        if (selectedCustomerId === c.id) {
          setSelectedCustomerId(null)
        }
        fetchCustomers(searchTerm)
      } else {
        const err = await res.json()
        alert(`Hata: ${err.error}`)
      }
    } catch (err: any) {
      alert(`Silme hatası: ${err.message}`)
    }
  }

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setErrorMsg('Ad, Soyad ve Telefon alanları zorunludur.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')

    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      city: city.trim(),
      district: district.trim(),
      notes: notes.trim(),
    }

    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers'
      const method = editingCustomer ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        setErrorMsg(err.error || 'İşlem başarısız.')
        setIsSubmitting(false)
        return
      }

      const savedCust = await res.json()
      setIsModalOpen(false)
      setIsSubmitting(false)
      fetchCustomers(searchTerm)
      setSelectedCustomerId(savedCust.id)
    } catch (err: any) {
      setErrorMsg(`Hata: ${err.message}`)
      setIsSubmitting(false)
    }
  }

  const handleStartPosWithCustomer = (cust: Customer) => {
    setSelectedCustomer(cust)
    setActiveTab('pos')
  }

  const handlePrintReceipt = (sale: any) => {
    const receiptHtml = `
      <html>
        <head>
          <style>
            body { font-family: monospace; width: 280px; padding: 10px; font-size: 12px; }
            .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; }
            .item { display: flex; justify-content: space-between; margin: 4px 0; }
            .total { border-top: 1px dashed #000; margin-top: 8px; padding-top: 5px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h3>MAĞAZA POS</h3>
            <p>Fiş No: ${sale.receiptNo}</p>
            <p>Müşteri: ${customerDetails?.firstName || ''} ${customerDetails?.lastName || ''}</p>
            <p>Tarih: ${new Date(sale.createdAt).toLocaleString('tr-TR')}</p>
          </div>
          <div style="margin-top: 10px;">
            ${sale.items
              .map(
                (item: any) => `
              <div class="item">
                <span>${item.variant?.product?.name || 'Ürün'} (${item.variant?.attributes?.color || ''} ${item.variant?.attributes?.size || ''}) x${item.quantity}</span>
                <span>${item.totalPrice.toFixed(2)} TL</span>
              </div>
            `
              )
              .join('')}
          </div>
          <div class="total">
            <div class="item"><span>İndirim:</span><span>-${sale.discountAmount.toFixed(2)} TL</span></div>
            <div class="item" style="font-size: 14px;"><span>GENEL TOPLAM:</span><span>${sale.totalAmount.toFixed(2)} TL</span></div>
          </div>
          <div class="header" style="border-bottom: none; border-top: 1px dashed #000; margin-top: 10px;">
            <p>Bizi Tercih Ettiğiniz İçin Teşekkür Ederiz!</p>
          </div>
        </body>
      </html>
    `

    if (window.electron?.printSilent) {
      window.electron.printSilent(receiptHtml)
    } else {
      const printWin = window.open('', '_blank')
      printWin?.document.write(receiptHtml)
      printWin?.print()
      printWin?.close()
    }
  }

  // Calculate customer metrics
  const totalSalesCount = customerDetails?.sales?.length || 0
  const totalSpent = customerDetails?.sales?.reduce((sum: number, s: any) => sum + s.totalAmount, 0) || 0
  const averageSpent = totalSalesCount > 0 ? totalSpent / totalSalesCount : 0

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-slate-100 flex overflow-hidden font-sans select-none">
      {/* LEFT PANEL: Customer List & Search */}
      <div className="w-96 bg-white border-r border-slate-200 flex flex-col h-full shadow-sm">
        {/* Header Bar */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-900 text-sm">Müşteri Kayıtları</h2>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-2xs transition flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Yeni Kayıt</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-slate-200 bg-white">
          <div className="relative">
            <input
              type="text"
              placeholder="Ad, Soyad, Telefon, İl veya İlçe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Customer List Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Yükleniyor...</div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <Users className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
              <p className="font-medium text-slate-600">Müşteri Bulunamadı</p>
              <p className="text-[11px] text-slate-400 mt-1">Yeni müşteri kaydı ekleyebilirsiniz.</p>
            </div>
          ) : (
            customers.map((c) => {
              const isSelected = selectedCustomerId === c.id
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCustomerId(c.id)}
                  className={`p-3 cursor-pointer transition flex items-center justify-between group ${
                    isSelected ? 'bg-blue-50/90 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-xs">
                        {c.firstName} {c.lastName}
                      </span>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/60 px-1.5 py-0.2 rounded">
                        {c._count?.sales || 0} Satış
                      </span>
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

                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => handleOpenEditModal(c, e)}
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-200 rounded transition"
                      title="Düzenle"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteCustomer(c, e)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-100 rounded transition"
                      title="Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Customer Details & Purchase History */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
        {!selectedCustomerId || !customerDetails ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
            <Users className="w-16 h-16 text-slate-300 stroke-[1.2] mb-3" />
            <h3 className="text-sm font-bold text-slate-600">Müşteri Detayı ve Geçmiş Alışverişler</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              Sol listeden bir müşteri seçerek detaylarını ve geçmiş alışveriş fişlerini inceleyebilirsiniz.
            </p>
          </div>
        ) : isLoadingDetails ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Detaylar yükleniyor...
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Customer Info Header Banner */}
            <div className="p-4 bg-white border-b border-slate-200 shadow-2xs flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg border border-blue-200">
                  {customerDetails.firstName[0]}
                  {customerDetails.lastName[0]}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {customerDetails.firstName} {customerDetails.lastName}
                    </h2>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[11px] font-semibold">
                      Kayıtlı Müşteri
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs text-slate-500 mt-1">
                    <span className="flex items-center space-x-1 font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{customerDetails.phone}</span>
                    </span>
                    {(customerDetails.city || customerDetails.district) && (
                      <span className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {customerDetails.district} {customerDetails.city ? `/ ${customerDetails.city}` : ''}
                        </span>
                      </span>
                    )}
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Kayıt: {new Date(customerDetails.createdAt).toLocaleDateString('tr-TR')}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button: Start POS Sale with this Customer */}
              <button
                onClick={() => handleStartPosWithCustomer(customerDetails)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center space-x-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Bu Müşteri İle Alışveriş Yap</span>
              </button>
            </div>

            {/* RETURN POLICY NOTICE BANNER */}
            <div className="mx-4 mt-3 bg-amber-50/90 border border-amber-200 rounded-lg p-3 flex items-start space-x-3 text-xs shadow-2xs">
              <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h4 className="font-bold text-amber-900 text-xs flex items-center space-x-1.5">
                  <span>Müşteri Ürün İade & Stok Politikası</span>
                </h4>
                <p className="text-amber-800/90 text-[11px] leading-relaxed">
                  Ürün iade ve değişim işlemleri yasal takibi sağlamak amacıyla <strong>yalnızca kayıtlı müşterilerimizin</strong> geçmiş fişleri üzerinden yapılabilmektedir. İade alınan ürünler anında ilgili varyant stok miktarlarına <strong>otomatik olarak geri eklenmektedir</strong>.
                </p>
              </div>
            </div>

            {/* Metrics Overview Cards */}
            <div className="p-4 grid grid-cols-3 gap-3">
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight block">
                  Toplam Harcama
                </span>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {totalSpent.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight block">
                  Toplam Alışveriş Sayısı
                </span>
                <div className="text-xl font-bold text-blue-600 mt-1">{totalSalesCount} Adet Fiş</div>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight block">
                  Ortalama Fiş Tutarı
                </span>
                <div className="text-xl font-bold text-emerald-700 mt-1">
                  {averageSpent.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
              </div>
            </div>

            {/* Purchase History Section */}
            <div className="flex-1 px-4 pb-4 overflow-y-auto flex flex-col space-y-3">
              <div className="flex items-center justify-between pt-1">
                <h3 className="font-bold text-slate-800 text-xs flex items-center space-x-1.5">
                  <Receipt className="w-4 h-4 text-blue-600" />
                  <span>Geçmiş Alışveriş Fişleri ({totalSalesCount})</span>
                </h3>
              </div>

              {totalSalesCount === 0 ? (
                <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-400 text-xs">
                  <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                  <p className="font-semibold text-slate-600">Henüz Alışveriş Kaydı Bulunmuyor</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Bu müşteri adına henüz bir POS satışı yapılnamış.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customerDetails.sales.map((sale: any) => {
                    const pay = sale.paymentType || {}
                    const isCash = pay.cash > 0 && (!pay.card || pay.card === 0)
                    const isCard = pay.card > 0 && (!pay.cash || pay.cash === 0)

                    const isFullyReturned = sale.status === 'RETURNED'
                    const isPartialReturned = sale.status === 'PARTIAL_RETURN'

                    return (
                      <div
                        key={sale.id}
                        className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex flex-col space-y-3"
                      >
                        {/* Sale Top Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <div className="flex items-center space-x-3">
                            <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                              {sale.receiptNo}
                            </span>

                            {isFullyReturned && (
                              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-bold text-[10px]">
                                Tamamı İade Edildi
                              </span>
                            )}
                            {isPartialReturned && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded font-bold text-[10px]">
                                Kısmi İade Yapıldı
                              </span>
                            )}

                            <span className="text-xs text-slate-500 flex items-center space-x-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{new Date(sale.createdAt).toLocaleString('tr-TR')}</span>
                            </span>
                            <span className="text-xs text-slate-400">| Kasiyer: {sale.cashierName}</span>
                          </div>

                          <div className="flex items-center space-x-3">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 block font-medium">Toplam</span>
                              <span className="font-bold text-sm text-slate-900">
                                {sale.totalAmount.toFixed(2)} ₺
                              </span>
                            </div>

                            {/* RETURN BUTTON FOR REGISTERED CUSTOMER SALE */}
                            {!isFullyReturned && (
                              <button
                                onClick={() => {
                                  setSelectedReturnSale(sale)
                                  setIsReturnModalOpen(true)
                                }}
                                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-xs font-semibold transition flex items-center space-x-1 shadow-2xs"
                                title="Ürün İade Et & Stoğa Ekle"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                                <span>Ürün İade Et</span>
                              </button>
                            )}

                            <button
                              onClick={() => handlePrintReceipt(sale)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 transition"
                              title="Fişi Yazdır"
                            >
                              <Printer className="w-4 h-4 text-blue-600" />
                            </button>
                          </div>
                        </div>

                        {/* Purchased Items Grid / List */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight block">
                            Satın Alınan Ürünler ({sale.items?.length || 0}):
                          </span>
                          <div className="bg-slate-50 rounded p-2 border border-slate-200/60 divide-y divide-slate-200/50 space-y-1">
                            {sale.items?.map((item: any) => {
                              const retQty = item.returnedQuantity || 0
                              return (
                                <div
                                  key={item.id}
                                  className="pt-1 first:pt-0 flex items-center justify-between text-xs text-slate-800"
                                >
                                  <div>
                                    <span className="font-semibold">
                                      {item.variant?.product?.name || 'Ürün'}
                                    </span>
                                    <span className="text-[11px] text-slate-500 ml-1.5 font-medium">
                                      ({item.variant?.attributes?.color || '-'} /{' '}
                                      {item.variant?.attributes?.size || '-'})
                                    </span>
                                    {retQty > 0 && (
                                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-200 px-1.5 py-0.2 rounded ml-2">
                                        İade: {retQty} Adet
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-4">
                                    <span className="text-slate-500 font-mono">
                                      {item.quantity} ad x {item.unitPrice.toFixed(2)}₺
                                    </span>
                                    <span className="font-bold text-slate-900">{item.totalPrice.toFixed(2)} ₺</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Payment Type Details */}
                        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">Ödeme Yöntemi:</span>
                            {isCash && (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-semibold flex items-center space-x-1">
                                <Banknote className="w-3 h-3" />
                                <span>Nakit</span>
                              </span>
                            )}
                            {isCard && (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded font-semibold flex items-center space-x-1">
                                <CreditCard className="w-3 h-3" />
                                <span>Kredi Kartı</span>
                              </span>
                            )}
                            {!isCash && !isCard && (
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded font-semibold">
                                Parçalı ({pay.cash || 0}₺ Nakit / {pay.card || 0}₺ Kart)
                              </span>
                            )}
                          </div>

                          {sale.discountAmount > 0 && (
                            <span className="text-amber-700 font-semibold">
                              Uygulanan İndirim: -{sale.discountAmount.toFixed(2)} ₺
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 select-none">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm">
                {editingCustomer ? 'Müşteri Bilgilerini Düzenle' : 'Yeni Müşteri Kaydı'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-3">
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
                  Notlar (Opsiyonel)
                </label>
                <textarea
                  placeholder="Müşteriye özel notlar..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded transition"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Kaydediliyor...' : editingCustomer ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Product Modal */}
      <ReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        sale={selectedReturnSale}
        onSuccess={() => {
          if (selectedCustomerId) {
            fetchCustomerDetails(selectedCustomerId)
          }
        }}
      />
    </div>
  )
}
