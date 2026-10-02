import React, { useState, useEffect, useRef } from 'react'
import {
  ShoppingBag,
  CreditCard,
  CheckCircle,
  Tag,
  Percent,
  Gift,
  Flame,
  ShieldCheck,
  Wifi,
  Coins,
  Receipt,
  Smartphone,
  Sparkles,
} from 'lucide-react'
import {
  CustomerDisplayPayload,
  subscribeCustomerDisplay,
} from '../../utils/customerDisplaySync'

const PROMO_SLIDES = [
  {
    icon: Flame,
    title: 'Yeni Sezon Denim & Ceket Koleksiyonu',
    subtitle: 'En trend kesimler ve üstün Jack & Jones kumaş kalitesi sizleri bekliyor.',
    badge: 'YENİ SEZON',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
    iconBg: 'bg-blue-600/80 text-white',
  },
  {
    icon: Percent,
    title: 'Avantajlı Kampanyalar & İndirimler',
    subtitle: 'Kasa görevlimizden güncel mağaza indirimleri ve çoklu alım fırsatlarını öğrenin.',
    badge: 'KAMPANYA',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
    iconBg: 'bg-amber-500/80 text-white',
  },
  {
    icon: Gift,
    title: 'Sadakat & VIP Müşteri Ayrıcalığı',
    subtitle: 'Telefon numaranızı ileterek size özel indirim ve kampanyalardan anında yararlanın.',
    badge: 'VIP CLUB',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
    iconBg: 'bg-purple-600/80 text-white',
  },
  {
    icon: ShieldCheck,
    title: 'Hızlı & Güvenli Temassız Ödeme',
    subtitle: 'Tüm banka ve kredi kartları, Troy ve temassız mobil ödemeler geçerlidir.',
    badge: 'GÜVENLİ ÖDEME',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    iconBg: 'bg-emerald-600/80 text-white',
  },
]

export const CustomerDisplayView: React.FC = () => {
  const [data, setData] = useState<CustomerDisplayPayload>({
    status: 'idle',
    storeName: 'JACK & JONES',
    storeAddress: '',
    storePhone: '',
    cashierName: '',
    cartItems: [],
    subtotal: 0,
    discountAmount: 0,
    total: 0,
    activeCampaign: null,
    selectedCustomer: null,
    paymentInfo: null,
    hidePrices: localStorage.getItem('pos_stock_only_mode') === 'true',
  })

  const [currentTime, setCurrentTime] = useState<string>('')
  const [currentDate, setCurrentDate] = useState<string>('')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isTransitionActive, setIsTransitionActive] = useState(false)
  const [transitionMessage, setTransitionMessage] = useState<string | null>(null)
  const cartBottomRef = useRef<HTMLDivElement>(null)
  const prevStatusRef = useRef<string>('idle')

  // Clock ticker
  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      )
      setCurrentDate(
        now.toLocaleDateString('tr-TR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      )
    }

    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-rotating promo carousel in idle state
  useEffect(() => {
    const slideTimer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % PROMO_SLIDES.length)
    }, 5000)
    return () => clearInterval(slideTimer)
  }, [])

  // Subscribe to real-time updates from Cashier POS
  useEffect(() => {
    const unsubscribe = subscribeCustomerDisplay((incoming) => {
      setData((prev) => ({
        ...prev,
        ...incoming,
      }))
    })

    return () => unsubscribe()
  }, [])

  // Slower, High-Impact Eye-Catching Transition (+0.5s = 1850ms hold)
  useEffect(() => {
    const prev = prevStatusRef.current
    const current = data.status
    let transTimer: NodeJS.Timeout | undefined

    if (prev !== current) {
      if (prev === 'idle' && (current === 'checkout' || current === 'cart')) {
        setIsTransitionActive(true)
        setTransitionMessage(
          current === 'checkout' ? 'Ödeme Aşaması Başlatılıyor' : 'Yeni Alışveriş Başlatıldı'
        )
        transTimer = setTimeout(() => {
          setIsTransitionActive(false)
          setTransitionMessage(null)
        }, 2350)
      } else if (current === 'checkout' && prev !== 'checkout') {
        setIsTransitionActive(true)
        setTransitionMessage('Ödeme & Tahsilat Aşaması')
        transTimer = setTimeout(() => {
          setIsTransitionActive(false)
          setTransitionMessage(null)
        }, 2350)
      }
      prevStatusRef.current = current
    }

    return () => {
      if (transTimer) clearTimeout(transTimer)
    }
  }, [data.status])

  // Auto-scroll to latest item when cart changes
  useEffect(() => {
    if (data.cartItems && data.cartItems.length > 0) {
      cartBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [data.cartItems?.length])

  const isCompleted = data.status === 'completed'
  const isCheckout = data.status === 'checkout'
  const hasCart = data.cartItems && data.cartItems.length > 0 && !isCompleted

  const SlideIcon = PROMO_SLIDES[currentSlide].icon

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-[#0c1322] via-[#101b33] to-[#0c1424] text-white flex flex-col font-sans select-none overflow-hidden relative">
      {/* Balanced translucent ambient glows (Soft twilight atmosphere) */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] bg-blue-600/20 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[420px] h-[420px] bg-indigo-600/15 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Slower Radiant Light Sweep Beam during transition (1.85s) */}
      {isTransitionActive && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
          <div className="w-[50%] h-full bg-gradient-to-r from-transparent via-cyan-400/35 via-blue-500/40 to-transparent blur-3xl animate-light-sweep" />
        </div>
      )}

      {/* High-Impact Eye-Catching Transition Portal Card (+0.5s extended to 1.85s) */}
      {isTransitionActive && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none animate-portal-card">
          <div className="relative p-7 rounded-3xl bg-slate-900/90 border border-blue-400/50 shadow-2xl backdrop-blur-2xl flex flex-col items-center space-y-3.5 max-w-sm text-center">
            {/* Pulsing ring aura */}
            <div className="absolute inset-0 rounded-3xl bg-blue-500/20 blur-xl animate-pulse" />
            <div className="relative bg-white h-11 px-7 rounded-2xl shadow-xl border border-white/95 flex items-center justify-center">
              <img
                src="/org_logo.svg"
                alt="JACK & JONES"
                className="h-6 w-auto max-w-[160px] object-contain select-none"
              />
            </div>
            <div className="relative flex items-center space-x-2 text-blue-300 text-sm font-black tracking-wider uppercase">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
              <span>{transitionMessage || 'Ödeme Aşaması Aktifleştiriliyor'}</span>
            </div>
            <div className="relative text-xs text-blue-200/80 font-medium">
              Lütfen Bekleyiniz • Güvenli Terminal Hazırlandı
            </div>
          </div>
        </div>
      )}

      {/* TOP HEADER: Centered Jack & Jones Logo & No Screen/Fullscreen Icon */}
      <header className="h-16 bg-slate-900/60 backdrop-blur-2xl border-b border-white/10 px-8 flex items-center justify-between z-20 shrink-0 shadow-lg relative">
        {/* Left: Customer Recognition Badge or Active Status */}
        <div className="flex items-center shrink-0 min-w-[200px]">
          {data.selectedCustomer ? (
            <div className="flex items-center space-x-2.5 bg-white/10 border border-white/15 px-4 py-1.5 rounded-xl backdrop-blur-xl shadow-md">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-blue-200 font-medium">Sayın</span>
              <span className="text-sm font-extrabold text-white">
                {data.selectedCustomer.firstName} {data.selectedCustomer.lastName}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/40 text-[10.5px] font-black uppercase ml-1 shadow-2xs">
                VIP
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-white/[0.05] border border-white/10 px-3.5 py-1.5 rounded-xl text-xs text-blue-200/90 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-[11px] text-blue-100">Kasa Aktif</span>
            </div>
          )}
        </div>

        {/* Center: Mathematically Centered Jack & Jones Logo Pill */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
          <div className="bg-white h-9 px-6 rounded-xl shadow-xl flex items-center justify-center border border-white/95 shrink-0">
            <img
              src="/org_logo.svg"
              alt="JACK & JONES"
              className="h-5 w-auto max-w-[150px] object-contain select-none"
              onError={(e) => {
                const target = e.target as HTMLElement
                target.style.display = 'none'
                const parent = target.parentElement
                if (parent) {
                  parent.innerHTML =
                    '<span class="text-[#00268A] font-black text-sm tracking-wider">JACK & JONES</span>'
                }
              }}
            />
          </div>
        </div>

        {/* Right: Clock & Date Only (Screen Icon Removed) */}
        <div className="text-right shrink-0 min-w-[200px]">
          <div className="text-xl font-black font-mono tracking-wider text-white leading-tight">
            {currentTime}
          </div>
          <div className="text-[11px] font-bold text-blue-300/80 capitalize">
            {currentDate}
          </div>
        </div>
      </header>

      {/* MAIN VIEW CONTAINER: Perfectly Proportioned for 13.3" Displays */}
      <main className="flex-1 flex overflow-hidden p-4 md:p-5 z-10 gap-4 md:gap-5 min-h-0">
        {/* CASE 1: COMPLETED SALE CELEBRATION */}
        {isCompleted ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-900/55 border border-white/15 rounded-3xl backdrop-blur-2xl shadow-2xl animate-slowmotion-enter overflow-y-auto">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mb-4 shadow-xl shadow-emerald-500/30 animate-bounce">
              <CheckCircle className="w-12 h-12 text-emerald-400" />
            </div>

            <span className="px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-black uppercase tracking-wider mb-2">
              İşlem Başarılı
            </span>

            <h2 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight">
              {data.hidePrices ? 'İşleminiz Başarıyla Tamamlandı!' : 'Ödemeniz Başarıyla Alındı!'}
            </h2>

            {data.selectedCustomer && (
              <div className="text-base text-blue-300 font-bold mb-1">
                Sayın {data.selectedCustomer.firstName} {data.selectedCustomer.lastName}
              </div>
            )}

            <p className="text-sm text-blue-200/90 font-medium max-w-md mb-6">
              Bizi tercih ettiğiniz için teşekkür eder, ürünlerinizi keyifle kullanmanızı dileriz.
            </p>

            {/* Sale summary badge card */}
            <div className="bg-white/[0.06] border border-white/15 rounded-2xl p-5 w-full max-w-md space-y-3 shadow-xl backdrop-blur-xl">
              {data.paymentInfo?.receiptNo && (
                <div className="flex justify-between items-center text-sm border-b border-white/10 pb-2">
                  <span className="text-blue-200 font-medium">Fiş Numarası:</span>
                  <span className="font-mono font-black text-white text-base">
                    {data.paymentInfo.receiptNo}
                  </span>
                </div>
              )}

              {!data.hidePrices && data.paymentInfo?.mode && (
                <div className="flex justify-between items-center text-sm border-b border-white/10 pb-2">
                  <span className="text-blue-200 font-medium">Ödeme Yöntemi:</span>
                  <span className="font-bold text-white">
                    {data.paymentInfo.mode === 'CASH'
                      ? 'Nakit Ödeme'
                      : data.paymentInfo.mode === 'CARD'
                      ? 'Kredi Kartı / Temassız'
                      : 'Parçalı Ödeme'}
                  </span>
                </div>
              )}

              {!data.hidePrices ? (
                <>
                  <div className="flex justify-between items-center text-base pt-1">
                    <span className="font-bold text-white">Tahsil Edilen Toplam:</span>
                    <span className="text-2xl font-black text-emerald-400">
                      {data.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </span>
                  </div>

                  {data.paymentInfo?.mode === 'CASH' && (data.paymentInfo?.changeDue ?? 0) > 0 && (
                    <div className="p-3 bg-emerald-500/20 border border-emerald-400/40 rounded-xl flex justify-between items-center mt-2 animate-emerald-ring">
                      <span className="text-xs font-black text-emerald-200 uppercase tracking-wide">
                        Verilen Para Üstü:
                      </span>
                      <span className="text-2xl font-black font-mono text-emerald-300">
                        {(data.paymentInfo.changeDue || 0).toLocaleString('tr-TR', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        ₺
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between items-center text-base pt-1">
                  <span className="font-bold text-white">Teslim Edilen Toplam:</span>
                  <span className="text-2xl font-black text-emerald-400">
                    {data.cartItems.reduce((acc, i) => acc + i.quantity, 0)} Adet Ürün
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-blue-300/80 font-medium mt-4">
              🧾 Fişiniz basılıyor, lütfen kasanızdan fişinizi almayı unutmayınız.
            </p>
          </div>
        ) : isCheckout ? (
          /* CASE 2: DEDICATED SLOW-MOTION PAYMENT STAGE (ÖDEME EKRANI) */
          <div className="flex-1 flex overflow-hidden gap-4 md:gap-5 min-h-0">
            {/* Left 58%: Translucent Interactive Payment Stage with Left Entrance Animation */}
            <div className="flex-[3] flex flex-col bg-slate-900/55 border border-white/15 rounded-3xl overflow-hidden backdrop-blur-2xl shadow-2xl min-h-0 animate-panel-left">
              {/* Payment Stage Header (No duplicate logo inside scene) */}
              <div className="px-6 py-3.5 border-b border-white/10 bg-white/[0.04] flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg font-black">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-blue-300 uppercase tracking-widest block">
                      GÜVENLİ İŞLEM
                    </span>
                    <h2 className="text-base font-black text-white tracking-tight">
                      {!data.hidePrices ? 'Ödeme & Tahsilat Aşaması' : 'Stok Çıkış Aşaması'}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                  <span className="px-3.5 py-1 rounded-full bg-blue-500/25 text-blue-200 border border-blue-400/40 text-xs font-black uppercase">
                    {!data.hidePrices
                      ? data.paymentInfo?.mode === 'CASH'
                        ? 'Nakit Ödeme'
                        : data.paymentInfo?.mode === 'CARD'
                        ? 'Kart / Temassız'
                        : 'Parçalı Ödeme'
                      : 'Stok İşlemi'}
                  </span>
                </div>
              </div>

              {/* Main Interactive Stage Body */}
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
                {data.paymentInfo?.mode === 'CASH' ? (
                  /* CASH PAYMENT VISUALIZATION */
                  <div className="w-full max-w-lg space-y-4">
                    <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-3xl bg-amber-500/20 animate-emerald-ring" />
                      <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border-2 border-amber-400/50 flex items-center justify-center text-amber-300 shadow-xl">
                        <Coins className="w-10 h-10" />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-2xl font-black text-white tracking-tight">
                        Nakit Tahsilat Yapılıyor
                      </h3>
                      <p className="text-sm text-blue-200/80 font-medium mt-1">
                        Lütfen nakit ödemenizi kasa görevlisine iletiniz.
                      </p>
                    </div>

                    {/* Cash Details Grid */}
                    {!data.hidePrices && (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="bg-white/[0.05] border border-white/10 p-4 rounded-2xl">
                          <span className="text-xs font-bold text-blue-200 uppercase tracking-wider block">
                            Alınan Tutar
                          </span>
                          <span className="text-2xl font-black font-mono text-white mt-1 block">
                            {(data.paymentInfo.givenCash || 0).toLocaleString('tr-TR', {
                              minimumFractionDigits: 2,
                            })}{' '}
                            ₺
                          </span>
                        </div>

                        <div className="bg-emerald-500/20 border-2 border-emerald-400/60 p-4 rounded-2xl animate-emerald-ring">
                          <span className="text-xs font-black text-emerald-200 uppercase tracking-wider block">
                            Para Üstü
                          </span>
                          <span className="text-2xl font-black font-mono text-emerald-300 mt-1 block">
                            {(data.paymentInfo.changeDue || 0).toLocaleString('tr-TR', {
                              minimumFractionDigits: 2,
                            })}{' '}
                            ₺
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* CARD / CONTACTLESS VISUALIZATION (DEFAULT & CARD) */
                  <div className="w-full max-w-lg space-y-5">
                    {/* Simulated POS Card Terminal Graphic with Slow-motion Wave */}
                    <div className="relative mx-auto w-28 h-28 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-soft-ring" />
                      <div className="absolute -inset-2 rounded-full border border-blue-400/30 animate-ping duration-1000" />
                      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-blue-800 border-2 border-blue-400 flex items-center justify-center text-white shadow-2xl shadow-blue-900/50">
                        <Wifi className="w-10 h-10 rotate-90" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="px-3 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/40 text-xs font-extrabold uppercase inline-block">
                        TEMASSIZ VEYA ÇİPLİ İŞLEM
                      </span>
                      <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                        Lütfen Kartınızı POS Cihazına Yaklaştırınız
                      </h3>
                      <p className="text-sm text-blue-200/80 font-medium max-w-sm mx-auto">
                        Kartınızı terminale yaklaştırabilir veya çipli olarak cihaza yerleştirebilirsiniz.
                      </p>
                    </div>

                    {/* Customer Recognition Banner during Checkout */}
                    {data.selectedCustomer && (
                      <div className="bg-white/[0.08] border border-white/15 p-3 rounded-2xl inline-flex items-center space-x-2 text-sm text-white font-bold backdrop-blur-md shadow-lg">
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        <span>
                          Sayın {data.selectedCustomer.firstName} {data.selectedCustomer.lastName}
                        </span>
                        <span className="text-xs text-blue-300 font-semibold">• İyi Günlerde Kullanınız</span>
                      </div>
                    )}

                    {/* Supported Card Badges */}
                    <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-white/[0.06] border border-white/15 text-xs font-bold text-white flex items-center space-x-1.5">
                        <Wifi className="w-3.5 h-3.5 rotate-90 text-blue-400" />
                        <span>Temassız</span>
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-white/[0.06] border border-white/15 text-xs font-bold text-white">
                        Troy
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-white/[0.06] border border-white/15 text-xs font-bold text-white">
                        Visa
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-white/[0.06] border border-white/15 text-xs font-bold text-white">
                        Mastercard
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-white/[0.06] border border-white/15 text-xs font-bold text-white flex items-center space-x-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-blue-300" />
                        <span>Apple / Mobil Pay</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Notice */}
              <div className="px-6 py-2.5 bg-white/[0.03] border-t border-white/10 text-xs text-blue-300/80 font-medium flex items-center justify-between shrink-0">
                <span className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>256-bit Uçtan Uca Şifreli Güvenli Tahsilat</span>
                </span>
                <span className="font-semibold text-white">
                  {data.cartItems.reduce((acc, i) => acc + i.quantity, 0)} Ürün
                </span>
              </div>
            </div>

            {/* Right 42%: Order Summary & Giant Amount Due Card with Right Entrance Animation */}
            <div className="flex-[2] flex flex-col justify-between space-y-3 min-h-0 animate-panel-right">
              {/* Compact Cart Items Recap */}
              <div className="bg-slate-900/55 border border-white/15 rounded-3xl p-4 backdrop-blur-2xl shadow-xl flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2 shrink-0">
                  <span className="text-xs font-black text-blue-200 uppercase tracking-wider flex items-center space-x-1.5">
                    <Receipt className="w-4 h-4 text-blue-400" />
                    <span>Sipariş Özeti</span>
                  </span>
                  <span className="text-xs font-bold text-blue-300/80">
                    {data.cartItems.length} Kalem
                  </span>
                </div>

                {/* Items scroll */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
                  {data.cartItems.map((item, idx) => (
                    <div
                      key={item.variantId || idx}
                      className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="font-bold text-white truncate">{item.productName}</div>
                        {!data.hidePrices ? (
                          <div className="text-[11px] text-blue-300/70">
                            {item.quantity} Adet × {item.unitPrice.toFixed(2)} ₺
                          </div>
                        ) : (
                          <div className="text-[11px] text-blue-300/70">
                            {item.quantity} Adet
                          </div>
                        )}
                      </div>
                      {!data.hidePrices && (
                        <span className="font-black font-mono text-white shrink-0">
                          {item.totalPrice.toFixed(2)} ₺
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Breakdown totals or Stock item count */}
                {!data.hidePrices ? (
                  <div className="pt-2 border-t border-white/10 space-y-1 text-xs shrink-0">
                    <div className="flex justify-between text-blue-200/80">
                      <span>Ara Toplam:</span>
                      <span className="font-bold text-white">
                        {data.subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </span>
                    </div>
                    {data.discountAmount > 0 && (
                      <div className="flex justify-between text-amber-300 font-bold">
                        <span>İndirim Tutarı:</span>
                        <span>
                          -{data.discountAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="pt-2 border-t border-white/10 space-y-1 text-xs shrink-0">
                    <div className="flex justify-between text-blue-200/80">
                      <span>Toplam Parça:</span>
                      <span className="font-bold text-white">
                        {data.cartItems.reduce((acc, item) => acc + item.quantity, 0)} Adet
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* GIANT TOTAL DUE CARD / STOCK CARD */}
              <div className="bg-gradient-to-br from-[#00268A]/90 via-[#0a359e]/80 to-[#1e3a8a]/70 border-2 border-blue-400/60 rounded-2xl p-5 text-center shadow-2xl backdrop-blur-xl text-white shrink-0">
                <span className="text-xs font-black text-blue-200 uppercase tracking-widest block mb-1">
                  {!data.hidePrices ? 'ÖDENECEK TOPLAM TUTAR' : 'TOPLAM ÜRÜN ADEDİ'}
                </span>
                <div className="text-5xl md:text-6xl font-black text-white tracking-tight drop-shadow-md">
                  {!data.hidePrices ? (
                    <>
                      {data.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}{' '}
                      <span className="text-3xl text-blue-200 font-bold">₺</span>
                    </>
                  ) : (
                    <>
                      {data.cartItems.reduce((acc, item) => acc + item.quantity, 0)}{' '}
                      <span className="text-2xl text-blue-200 font-bold">ADET</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-blue-200 font-semibold mt-2">
                  {!data.hidePrices ? 'Net Tutar' : 'Stok Çıkış Listesi'}
                </div>
              </div>
            </div>
          </div>
        ) : hasCart ? (
          /* CASE 3: ACTIVE SHOPPING CART (BALANCED TRANSLUCENT LOOK) */
          <div className="flex-1 flex overflow-hidden gap-4 md:gap-5 min-h-0">
            {/* Left 58%: Real-Time Cart Items List */}
            <div className="flex-[3] flex flex-col bg-slate-900/55 border border-white/15 rounded-3xl overflow-hidden backdrop-blur-2xl shadow-2xl min-h-0 animate-panel-left">
              {/* Cart List Header (No duplicate logo inside scene) */}
              <div className="px-5 py-3 border-b border-white/10 bg-white/[0.04] flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-2.5">
                  <ShoppingBag className="w-5 h-5 text-blue-400" />
                  <h2 className="text-base font-black text-white tracking-wide">
                    Alışveriş Sepetiniz
                  </h2>
                </div>
                <span className="px-3 py-0.5 rounded-full bg-blue-500/25 text-blue-200 border border-blue-400/40 text-xs font-extrabold">
                  {data.cartItems.reduce((acc, item) => acc + item.quantity, 0)} Kalem
                </span>
              </div>

              {/* Items List - Fully Scrollable */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 min-h-0">
                {data.cartItems.map((item, idx) => {
                  const isLastItem = idx === data.cartItems.length - 1
                  return (
                    <div
                      key={item.variantId || idx}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                        isLastItem
                          ? 'bg-blue-500/20 border-blue-400/60 shadow-lg ring-1 ring-blue-400/40'
                          : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className="flex-1 mr-3 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-base font-extrabold text-white leading-snug truncate">
                            {item.productName}
                          </h3>
                          {isLastItem && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/40 text-blue-100 border border-blue-400/50 text-[10px] font-black uppercase shrink-0 shadow-2xs">
                              Yeni Eklendi
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 mt-1 text-xs text-blue-200/80">
                          {(item.attributes?.color || item.attributes?.size) && (
                            <span className="px-2.5 py-0.5 rounded-md bg-white/10 text-white font-bold border border-white/15">
                              {item.attributes.color || '-'} / {item.attributes.size || '-'}
                            </span>
                          )}
                          {item.barcode && (
                            <span className="font-mono text-blue-300 font-semibold text-[11px]">
                              {item.barcode}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity & Unit Price */}
                      <div className="text-right flex items-center space-x-4 shrink-0">
                        <div className="text-center bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 min-w-[50px]">
                          <span className="text-[10px] text-blue-200 uppercase block font-bold">
                            Adet
                          </span>
                          <span className="text-xl font-black text-white">{item.quantity}</span>
                        </div>

                        {!data.hidePrices && (
                          <div className="text-right min-w-[95px]">
                            <span className="text-[11px] text-blue-200/80 block font-medium">
                              Birim: {item.unitPrice.toFixed(2)} ₺
                            </span>
                            <span className="text-xl font-black text-white">
                              {item.totalPrice.toFixed(2)} ₺
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={cartBottomRef} />
              </div>

              {/* Bottom Notice */}
              <div className="px-5 py-2 bg-white/[0.03] border-t border-white/10 text-[11px] text-blue-300/80 font-medium flex items-center justify-between shrink-0">
                <span>Fişinizle 14 gün içinde değişim yapılabilir.</span>
                <span className="text-blue-300/90 font-semibold">Keyifli Alışverişler Dileriz</span>
              </div>
            </div>

            {/* Right 42%: Financial Summary & Total Box OR Stock Summary Box */}
            <div className="flex-[2] flex flex-col justify-between space-y-3 min-h-0 overflow-y-auto animate-panel-right">
              {data.hidePrices ? (
                /* Stock Only Mode: No Financials, Clean Items Summary */
                <div className="bg-slate-900/55 border border-white/15 rounded-3xl p-6 backdrop-blur-2xl space-y-5 shadow-2xl flex-1 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-rose-300 border-b border-white/10 pb-3">
                      <ShoppingBag className="w-5 h-5" />
                      <span className="text-sm font-black uppercase tracking-wider">
                        Ürün & Stok Bilgisi
                      </span>
                    </div>

                    <div className="space-y-2 text-sm text-blue-100">
                      <div className="flex justify-between items-center bg-white/[0.04] p-3 rounded-xl border border-white/10">
                        <span className="text-blue-200 font-semibold">Toplam Çeşit:</span>
                        <span className="font-black text-white text-base">
                          {data.cartItems.length} Kalem
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-white/[0.04] p-3 rounded-xl border border-white/10">
                        <span className="text-blue-200 font-semibold">Toplam Ürün Adedi:</span>
                        <span className="font-black text-white text-base">
                          {data.cartItems.reduce((acc, item) => acc + item.quantity, 0)} Adet
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-[#00268A]/90 via-[#0a359e]/80 to-[#1e3a8a]/70 border-2 border-blue-400/60 rounded-2xl p-5 text-center shadow-2xl backdrop-blur-xl text-white shrink-0">
                    <span className="text-xs font-black text-blue-200 uppercase tracking-widest block mb-1">
                      SEPETTEKİ TOPLAM ÜRÜN
                    </span>
                    <div className="text-5xl md:text-6xl font-black text-white tracking-tight drop-shadow-md">
                      {data.cartItems.reduce((acc, item) => acc + item.quantity, 0)}{' '}
                      <span className="text-2xl text-blue-200 font-bold">ADET</span>
                    </div>
                    <div className="text-xs text-blue-200 font-semibold mt-2">
                      Stok Çıkış Listesi
                    </div>
                  </div>

                  <div className="text-center text-xs text-blue-200/80 font-medium pt-1">
                    <span>Keyifli Alışverişler Dileriz</span>
                  </div>
                </div>
              ) : (
                <>
                  {/* Active Campaign Card if applied */}
                  {data.activeCampaign && (
                    <div className="bg-amber-500/20 border border-amber-400/40 rounded-2xl p-3 flex items-center justify-between backdrop-blur-xl shadow-md shrink-0">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/30 text-amber-300 border border-amber-400/40 shadow-xs">
                          <Tag className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-amber-300 uppercase tracking-wide block">
                            Uygulanan Kampanya
                          </span>
                          <span className="text-sm font-black text-white">
                            {data.activeCampaign.name}
                          </span>
                        </div>
                      </div>
                      {data.discountAmount > 0 && (
                        <span className="text-sm font-black text-amber-200 bg-amber-400/30 px-3 py-1 rounded-xl border border-amber-400/40">
                          -{data.discountAmount.toFixed(2)} ₺
                        </span>
                      )}
                    </div>
                  )}

                  {/* Subtotal & Giant Total Due Card (WITHOUT CALCULATED VAT) */}
                  <div className="bg-slate-900/55 border border-white/15 rounded-3xl p-5 backdrop-blur-2xl space-y-3.5 shadow-2xl flex-1 flex flex-col justify-between">
                    <div className="space-y-2 pb-3 border-b border-white/10 shrink-0">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-blue-200 font-semibold">Ara Toplam</span>
                        <span className="font-extrabold text-white text-base">
                          {data.subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </span>
                      </div>

                      {data.discountAmount > 0 && (
                        <div className="flex justify-between items-center text-sm text-amber-300 font-extrabold">
                          <span className="flex items-center space-x-1.5">
                            <Tag className="w-3.5 h-3.5" />
                            <span>İndirim Tutarı</span>
                          </span>
                          <span className="text-base">
                            -{data.discountAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                          </span>
                        </div>
                      )}
                    </div>

                    {/* GIANT TOTAL CARD: Jack & Jones Corporate Navy with Glass Depth */}
                    <div className="bg-gradient-to-br from-[#00268A]/90 via-[#0a359e]/80 to-[#1e3a8a]/70 border-2 border-blue-400/60 rounded-2xl p-4 md:p-5 text-center shadow-2xl relative overflow-hidden backdrop-blur-xl text-white shrink-0">
                      <span className="text-xs font-black text-blue-200 uppercase tracking-widest block mb-1">
                        ÖDENECEK TOPLAM TUTAR
                      </span>
                      <div className="text-5xl md:text-6xl font-black text-white tracking-tight drop-shadow-md">
                        {data.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}{' '}
                        <span className="text-3xl text-blue-200 font-bold">₺</span>
                      </div>
                    </div>

                    {/* Accepted Payment badges */}
                    <div className="text-center space-y-1.5 shrink-0 pt-1">
                      <span className="text-[11px] text-blue-200/80 block font-semibold">
                        Kredi Kartı, Temassız veya Nakit Ödeme Kabul Edilir
                      </span>
                      <div className="flex items-center justify-center space-x-2 text-xs">
                        <span className="px-2.5 py-0.5 rounded-lg bg-white/10 border border-white/15 text-white font-bold text-[11px]">
                          Temassız
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-white/10 border border-white/15 text-white font-bold text-[11px]">
                          Troy
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-white/10 border border-white/15 text-white font-bold text-[11px]">
                          Visa / Mastercard
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-white/10 border border-white/15 text-white font-bold text-[11px]">
                          Nakit
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* CASE 4: STANDBY / IDLE STATE (EMPTY CART) - FULLY 13.3" BALANCED (NEVER CLIPS LOGO) */
          <div className="flex-1 flex flex-col items-center justify-around p-4 md:p-5 bg-slate-900/55 border border-white/15 rounded-3xl backdrop-blur-2xl shadow-2xl relative overflow-y-auto animate-slowmotion-fade">
            {/* Top Standby Welcome (No duplicate in-scene logo, brand logo is centered in top navbar) */}
            <div className="text-center space-y-2 z-10 max-w-xl shrink-0">
              <div>
                <span className="px-3.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[11px] font-black tracking-widest uppercase inline-block shadow-xs">
                  PREMIUM RETAIL EXPERIENCE
                </span>
              </div>

              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
                Hoş Geldiniz
              </h2>

              <p className="text-sm text-blue-200/90 font-medium">
                Yeni sezon koleksiyonumuz ve ayrıcalıklı alışveriş deneyimi için buradayız.
              </p>
            </div>

            {/* Center: Dynamic Auto-Rotating Campaign Banner (Compact 13.3" Height) */}
            <div className="w-full max-w-xl my-1 z-10 shrink-0">
              <div className="bg-gradient-to-r from-blue-950/40 via-slate-900/50 to-indigo-950/40 border border-white/15 rounded-2xl p-4 backdrop-blur-xl shadow-xl transition-all duration-500">
                <div className="flex items-start space-x-4">
                  <div
                    className={`p-3 rounded-xl ${PROMO_SLIDES[currentSlide].iconBg} shadow-lg shrink-0 border border-white/15`}
                  >
                    <SlideIcon className="w-6 h-6" />
                  </div>

                  <div className="flex-1 space-y-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border inline-block ${PROMO_SLIDES[currentSlide].badgeColor}`}
                    >
                      {PROMO_SLIDES[currentSlide].badge}
                    </span>
                    <h3 className="text-xl font-black text-white tracking-tight">
                      {PROMO_SLIDES[currentSlide].title}
                    </h3>
                    <p className="text-xs text-blue-200/90 font-medium leading-relaxed">
                      {PROMO_SLIDES[currentSlide].subtitle}
                    </p>
                  </div>
                </div>

                {/* Carousel Dots */}
                <div className="flex justify-center space-x-1.5 mt-3 pt-2.5 border-t border-white/10">
                  {PROMO_SLIDES.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === currentSlide
                          ? 'w-7 bg-blue-400'
                          : 'w-1.5 bg-white/20 hover:bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Standby Cards (Compact & Safe) */}
            <div className="w-full max-w-lg z-10 grid grid-cols-2 gap-3 pt-1 border-t border-white/10 text-xs shrink-0">
              <div className="bg-white/[0.04] border border-white/10 p-3 rounded-xl text-center backdrop-blur-md">
                <span className="text-blue-300 block text-[10px] font-bold uppercase mb-0.5">
                  Ödeme Yöntemleri
                </span>
                <span className="font-extrabold text-white text-xs">
                  Nakit & Tüm Banka Kartları
                </span>
              </div>

              <div className="bg-white/[0.04] border border-white/10 p-3 rounded-xl text-center backdrop-blur-md">
                <span className="text-blue-300 block text-[10px] font-bold uppercase mb-0.5">
                  Değişim Kolaylığı
                </span>
                <span className="font-extrabold text-white text-xs">
                  Fiş ile 14 Gün İçinde Değişim
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER: Compact height (h-8 = 32px) with safe padding */}
      <footer className="h-8 bg-slate-900/60 backdrop-blur-2xl border-t border-white/10 px-8 flex items-center justify-between text-xs text-blue-300/80 z-10 shrink-0">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-[11px] text-blue-100">Kasa Aktif & Canlı Bağlantı</span>
        </div>

        <div>
          <span className="text-[9px] text-blue-300/60 font-semibold tracking-wider uppercase">
            Design & Architecture by Atacan Gürbüz
          </span>
        </div>
      </footer>
    </div>
  )
}
