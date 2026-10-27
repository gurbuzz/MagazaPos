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
import lufianLogo from '../../assets/lufian-og.png'
import jackJonesLogo from '../../assets/org_logo.svg'
import customerBgImage from '../../assets/customerbackground.jpg'

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
    surchargeAmount: 0,
    total: 0,
    activeCampaign: null,
    selectedCustomer: null,
    paymentInfo: null,
    hidePrices: localStorage.getItem('pos_stock_only_mode') === 'true',
    theme: (localStorage.getItem('pos_customer_display_theme') as 'dark' | 'light') || 'dark',
  })

  const [currentTime, setCurrentTime] = useState<string>('')
  const [currentDate, setCurrentDate] = useState<string>('')
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isTransitionActive, setIsTransitionActive] = useState(false)
  const [transitionMessage, setTransitionMessage] = useState<string | null>(null)
  const cartListRef = useRef<HTMLDivElement>(null)
  const prevStatusRef = useRef<string>('idle')

  const isLight = (data.theme || localStorage.getItem('pos_customer_display_theme')) === 'light'

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

  // Reset any ancestor/window scroll displacement on status or cart changes
  useEffect(() => {
    window.scrollTo(0, 0)
    if (document.documentElement) document.documentElement.scrollTop = 0
    if (document.body) document.body.scrollTop = 0
    const root = document.getElementById('root')
    if (root) root.scrollTop = 0
  }, [data.status, data.cartItems?.length])

  // Auto-scroll inside cart items container without scrolling window or ancestor elements
  useEffect(() => {
    if (cartListRef.current) {
      cartListRef.current.scrollTop = cartListRef.current.scrollHeight
    }
  }, [data.cartItems?.length])

  const isCompleted = data.status === 'completed'
  const isCheckout = data.status === 'checkout'
  const hasCart = data.cartItems && data.cartItems.length > 0 && !isCompleted

  const SlideIcon = PROMO_SLIDES[currentSlide].icon

  return (
    <div
      className={`fixed inset-0 w-full h-full ${
        isLight
          ? 'bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/60 text-slate-800'
          : 'bg-gradient-to-br from-[#0c1322] via-[#101b33] to-[#0c1424] text-white'
      } flex flex-col font-sans select-none overflow-hidden`}
    >
      {/* Ambient Fullscreen Background for Idle State */}
      {!hasCart && !isCheckout && !isCompleted && (
        <div
          className={`absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000 ease-in-out ${
            isLight ? 'opacity-25' : 'opacity-45'
          }`}
        >
          <img
            src={customerBgImage}
            alt="Ambient Background"
            className={`w-full h-full object-cover object-center filter ${
              isLight ? 'brightness-[1.08] contrast-[0.95]' : 'brightness-[0.88] contrast-[1.05]'
            } scale-105`}
            onError={(e) => {
              const target = e.target as HTMLImageElement
              if (!target.dataset.triedFallback) {
                target.dataset.triedFallback = 'true'
                target.src = './customerbackground.jpg'
              }
            }}
          />
          <div
            className={`absolute inset-0 ${
              isLight
                ? 'bg-gradient-to-b from-white/80 via-white/30 to-white/80'
                : 'bg-gradient-to-b from-[#060c1c]/40 via-transparent to-[#060c1c]/50'
            }`}
          />
        </div>
      )}

      {/* Balanced translucent ambient glows */}
      <div
        className={`absolute -top-32 -left-32 w-[420px] h-[420px] ${
          isLight ? 'bg-blue-300/15' : 'bg-blue-600/20'
        } rounded-full blur-[110px] pointer-events-none`}
      />
      <div
        className={`absolute -bottom-32 -right-32 w-[420px] h-[420px] ${
          isLight ? 'bg-indigo-300/10' : 'bg-indigo-600/15'
        } rounded-full blur-[110px] pointer-events-none`}
      />
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] ${
          isLight ? 'bg-sky-300/15' : 'bg-sky-500/10'
        } rounded-full blur-[120px] pointer-events-none`}
      />

      {/* Slower Radiant Light Sweep Beam during transition (1.85s) */}
      {isTransitionActive && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
          <div className="w-[50%] h-full bg-gradient-to-r from-transparent via-cyan-400/35 via-blue-500/40 to-transparent blur-3xl animate-light-sweep" />
        </div>
      )}

      {/* High-Impact Eye-Catching Transition Portal Card */}
      {isTransitionActive && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none animate-portal-card">
          <div
            className={`relative p-8 rounded-3xl ${
              isLight
                ? 'bg-white/95 border-blue-400/60 shadow-2xl'
                : 'bg-slate-900/90 border-blue-400/50 shadow-2xl'
            } border backdrop-blur-2xl flex flex-col items-center space-y-4 max-w-md text-center`}
          >
            {/* Pulsing ring aura */}
            <div className="absolute inset-0 rounded-3xl bg-blue-500/20 blur-xl animate-pulse" />
            <div className="relative bg-white h-13 px-6 rounded-2xl shadow-xl border border-white/95 flex items-center justify-center space-x-3.5">
              <img
                src={lufianLogo}
                alt="LUFIAN"
                className="h-7 w-auto max-w-[110px] object-contain select-none"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  if (!target.dataset.triedFallback) {
                    target.dataset.triedFallback = 'true'
                    target.src = './lufian-og.png'
                  }
                }}
              />
              <div className="h-5 w-px bg-slate-300" />
              <img
                src={jackJonesLogo}
                alt="JACK & JONES"
                className="h-4.5 w-auto max-w-[125px] object-contain select-none"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  if (!target.dataset.triedFallback) {
                    target.dataset.triedFallback = 'true'
                    target.src = './org_logo.svg'
                  }
                }}
              />
            </div>
            <div
              className={`relative flex items-center space-x-2 ${
                isLight ? 'text-blue-800' : 'text-blue-300'
              } text-base font-black tracking-wider uppercase`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
              <span>{transitionMessage || 'Ödeme Aşaması Aktifleştiriliyor'}</span>
            </div>
            <div
              className={`relative text-sm ${
                isLight ? 'text-slate-600' : 'text-blue-200/90'
              } font-medium`}
            >
              Lütfen Bekleyiniz • Güvenli Terminal Hazırlandı
            </div>
          </div>
        </div>
      )}

      {/* TOP HEADER: Centered Brand Logos & Clock */}
      <header
        className={`h-14 min-h-[56px] max-h-[56px] ${
          isLight
            ? 'bg-white/90 border-slate-200/90 shadow-sm text-slate-800'
            : 'bg-slate-900/70 border-white/10 text-white shadow-lg'
        } backdrop-blur-2xl border-b px-4 md:px-6 flex items-center justify-between z-20 shrink-0 relative`}
      >
        {/* Left: Customer Recognition Badge or Active Status */}
        <div className="flex items-center shrink-0 min-w-[180px] max-w-[320px]">
          {data.selectedCustomer ? (
            <div
              className={`flex items-center space-x-2 ${
                isLight
                  ? 'bg-slate-100 border-slate-200 shadow-2xs'
                  : 'bg-white/10 border-white/15 shadow-md'
              } border px-3.5 py-1.5 rounded-xl backdrop-blur-xl`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span
                className={`text-xs ${
                  isLight ? 'text-slate-500' : 'text-blue-200'
                } font-semibold shrink-0`}
              >
                Sayın
              </span>
              <span
                className={`text-sm md:text-base font-black ${
                  isLight ? 'text-slate-900' : 'text-white'
                } truncate`}
              >
                {data.selectedCustomer.firstName} {data.selectedCustomer.lastName}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-600 border border-blue-400/30 text-xs font-black uppercase shrink-0 shadow-2xs">
                VIP
              </span>
            </div>
          ) : (
            <div
              className={`flex items-center space-x-2 ${
                isLight
                  ? 'bg-slate-100/90 border-slate-200/80 text-slate-700'
                  : 'bg-white/[0.06] border-white/12 text-blue-200/90'
              } border px-3.5 py-1.5 rounded-xl shadow-xs`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span
                className={`font-black text-xs md:text-sm ${
                  isLight ? 'text-slate-800' : 'text-blue-100'
                } uppercase tracking-wide`}
              >
                Kasa Aktif
              </span>
            </div>
          )}
        </div>

        {/* Center: Mathematically Centered Both Logos Pill */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-10 pointer-events-auto">
          <div
            className={`bg-white h-12 md:h-13 px-5 md:px-7 rounded-2xl shadow-xl flex items-center justify-center space-x-3 md:space-x-4 border ${
              isLight ? 'border-slate-200/90 shadow-md' : 'border-white/95 shadow-2xl'
            } shrink-0 transition-transform`}
          >
            <img
              src={lufianLogo}
              alt="LUFIAN"
              className="h-6 md:h-7 w-auto max-w-[105px] md:max-w-[125px] object-contain select-none"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                if (!target.dataset.triedFallback) {
                  target.dataset.triedFallback = 'true'
                  target.src = './lufian-og.png'
                }
              }}
            />
            <div className="h-5 md:h-6 w-px bg-slate-300" />
            <img
              src={jackJonesLogo}
              alt="JACK & JONES"
              className="h-4 md:h-5 w-auto max-w-[115px] md:max-w-[140px] object-contain select-none"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                if (!target.dataset.triedFallback) {
                  target.dataset.triedFallback = 'true'
                  target.src = './org_logo.svg'
                }
              }}
            />
          </div>
        </div>

        {/* Right: Clock & Date */}
        <div className="text-right shrink-0 min-w-[180px]">
          <div
            className={`text-xl md:text-2xl font-black font-mono tracking-wider ${
              isLight ? 'text-slate-900' : 'text-white'
            } leading-tight`}
          >
            {currentTime}
          </div>
          <div
            className={`text-[11px] md:text-xs font-bold ${
              isLight ? 'text-slate-500' : 'text-blue-200'
            } capitalize`}
          >
            {currentDate}
          </div>
        </div>
      </header>

      {/* MAIN VIEW CONTAINER */}
      <main className="flex-1 min-h-0 flex overflow-hidden p-2 md:p-2.5 lg:p-3 z-10">
        {/* CASE 1: COMPLETED SALE CELEBRATION */}
        {isCompleted ? (
          <div
            className={`flex-1 flex flex-col items-center justify-center text-center p-6 ${
              isLight
                ? 'bg-white/90 border-slate-200/90 text-slate-900 shadow-2xl'
                : 'bg-slate-900/55 border-white/15 text-white shadow-2xl'
            } border rounded-3xl backdrop-blur-2xl animate-slowmotion-enter overflow-y-auto`}
          >
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mb-4 shadow-xl shadow-emerald-500/30 animate-bounce">
              <CheckCircle className="w-12 h-12 text-emerald-400" />
            </div>

            <span className="px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-600 border border-emerald-400/30 text-sm font-black uppercase tracking-wider mb-2">
              İşlem Başarılı
            </span>

            <h2
              className={`text-4xl md:text-5xl font-black ${
                isLight ? 'text-slate-900' : 'text-white'
              } mb-2 tracking-tight`}
            >
              {data.hidePrices ? 'İşleminiz Başarıyla Tamamlandı!' : 'Ödemeniz Başarıyla Alındı!'}
            </h2>

            {data.selectedCustomer && (
              <div
                className={`text-xl md:text-2xl ${
                  isLight ? 'text-blue-700' : 'text-blue-200'
                } font-black mb-1`}
              >
                Sayın {data.selectedCustomer.firstName} {data.selectedCustomer.lastName}
              </div>
            )}

            <p
              className={`text-base md:text-lg ${
                isLight ? 'text-slate-600' : 'text-blue-100/90'
              } font-semibold max-w-lg mb-6`}
            >
              Bizi tercih ettiğiniz için teşekkür eder, ürünlerinizi keyifle kullanmanızı dileriz.
            </p>

            {/* Sale summary badge card */}
            <div
              className={`${
                isLight
                  ? 'bg-slate-50 border-slate-200 text-slate-900 shadow-md'
                  : 'bg-white/[0.08] border-white/20 text-white shadow-xl'
              } border rounded-2xl p-6 w-full max-w-lg space-y-4 backdrop-blur-xl`}
            >
              {data.paymentInfo?.receiptNo && (
                <div
                  className={`flex justify-between items-center text-base border-b ${
                    isLight ? 'border-slate-200' : 'border-white/10'
                  } pb-2.5`}
                >
                  <span className={isLight ? 'text-slate-600 font-semibold' : 'text-blue-200 font-semibold'}>
                    Fiş Numarası:
                  </span>
                  <span
                    className={`font-mono font-black ${
                      isLight ? 'text-slate-900' : 'text-white'
                    } text-lg md:text-xl`}
                  >
                    {data.paymentInfo.receiptNo}
                  </span>
                </div>
              )}

              {!data.hidePrices && data.paymentInfo?.mode && (
                <div
                  className={`flex justify-between items-center text-base border-b ${
                    isLight ? 'border-slate-200' : 'border-white/10'
                  } pb-2.5`}
                >
                  <span className={isLight ? 'text-slate-600 font-semibold' : 'text-blue-200 font-semibold'}>
                    Ödeme Yöntemi:
                  </span>
                  <span
                    className={`font-black ${
                      isLight ? 'text-slate-900' : 'text-white'
                    } text-lg`}
                  >
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
                  <div className="flex justify-between items-center text-lg pt-1">
                    <span className={`font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                      Tahsil Edilen Toplam:
                    </span>
                    <span className="text-3xl md:text-4xl font-black text-emerald-500">
                      {data.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </span>
                  </div>

                  {data.paymentInfo?.mode === 'CASH' && (data.paymentInfo?.changeDue ?? 0) > 0 && (
                    <div
                      className={`p-3.5 ${
                        isLight
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                      } border rounded-xl flex justify-between items-center mt-2 animate-emerald-ring`}
                    >
                      <span className="text-sm font-black uppercase tracking-wide">
                        Verilen Para Üstü:
                      </span>
                      <span className="text-3xl font-black font-mono">
                        {(data.paymentInfo.changeDue || 0).toLocaleString('tr-TR', {
                          minimumFractionDigits: 2,
                        })}{' '}
                        ₺
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between items-center text-lg pt-1">
                  <span className={`font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                    Teslim Edilen Toplam:
                  </span>
                  <span className="text-3xl md:text-4xl font-black text-emerald-500">
                    {data.cartItems.reduce((acc, i) => acc + i.quantity, 0)} Adet Ürün
                  </span>
                </div>
              )}
            </div>

            <p
              className={`text-sm md:text-base ${
                isLight ? 'text-slate-600' : 'text-blue-200'
              } font-bold mt-5`}
            >
              🧾 Fişiniz basılıyor, lütfen kasanızdan fişinizi almayı unutmayınız.
            </p>
          </div>
        ) : isCheckout ? (
          /* CASE 2: PAYMENT STAGE (ÖDEME EKRANI) */
          <div className="flex-1 flex overflow-hidden gap-4 md:gap-5 min-h-0">
            {/* Left 58%: Payment Stage Body */}
            <div
              className={`flex-[3] flex flex-col ${
                isLight
                  ? 'bg-white/90 border-slate-200/90 shadow-xl'
                  : 'bg-slate-900/55 border-white/15 shadow-2xl'
              } border rounded-3xl overflow-hidden backdrop-blur-2xl min-h-0 animate-panel-left`}
            >
              {/* Payment Stage Header */}
              <div
                className={`px-6 py-4 border-b ${
                  isLight ? 'border-slate-200/80 bg-slate-50/80' : 'border-white/10 bg-white/[0.04]'
                } flex items-center justify-between shrink-0`}
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg font-black">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <span
                      className={`text-xs font-black ${
                        isLight ? 'text-blue-700' : 'text-blue-300'
                      } uppercase tracking-widest block`}
                    >
                      GÜVENLİ İŞLEM
                    </span>
                    <h2
                      className={`text-xl md:text-2xl font-black ${
                        isLight ? 'text-slate-900' : 'text-white'
                      } tracking-tight`}
                    >
                      {!data.hidePrices ? 'Ödeme & Tahsilat Aşaması' : 'Stok Çıkış Aşaması'}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
                  <span className="px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-700 border border-blue-400/40 text-sm font-black uppercase tracking-wide">
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
                  <div className="w-full max-w-lg space-y-5">
                    <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-3xl bg-amber-500/20 animate-emerald-ring" />
                      <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border-2 border-amber-400/50 flex items-center justify-center text-amber-500 shadow-xl">
                        <Coins className="w-10 h-10" />
                      </div>
                    </div>

                    <div>
                      <h3
                        className={`text-3xl md:text-4xl font-black ${
                          isLight ? 'text-slate-900' : 'text-white'
                        } tracking-tight`}
                      >
                        Nakit Tahsilat Yapılıyor
                      </h3>
                      <p
                        className={`text-base md:text-lg ${
                          isLight ? 'text-slate-600' : 'text-blue-100/90'
                        } font-semibold mt-1.5`}
                      >
                        Lütfen nakit ödemenizi kasa görevlisine iletiniz.
                      </p>
                    </div>

                    {/* Cash Details Grid */}
                    {!data.hidePrices && (
                      <div className="grid grid-cols-2 gap-3.5 pt-2">
                        <div
                          className={`${
                            isLight
                              ? 'bg-slate-50 border-slate-200 text-slate-900 shadow-2xs'
                              : 'bg-white/[0.06] border-white/12 text-white'
                          } border p-4 md:p-5 rounded-2xl`}
                        >
                          <span
                            className={`text-sm font-black ${
                              isLight ? 'text-slate-500' : 'text-blue-200'
                            } uppercase tracking-wider block`}
                          >
                            Alınan Tutar
                          </span>
                          <span
                            className={`text-3xl md:text-4xl font-black font-mono ${
                              isLight ? 'text-slate-900' : 'text-white'
                            } mt-1.5 block`}
                          >
                            {(data.paymentInfo.givenCash || 0).toLocaleString('tr-TR', {
                              minimumFractionDigits: 2,
                            })}{' '}
                            ₺
                          </span>
                        </div>

                        <div
                          className={`${
                            isLight
                              ? 'bg-emerald-50 border-emerald-400/80 text-emerald-800'
                              : 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                          } border-2 p-4 md:p-5 rounded-2xl animate-emerald-ring`}
                        >
                          <span className="text-sm font-black uppercase tracking-wider block">
                            Para Üstü
                          </span>
                          <span className="text-3xl md:text-4xl font-black font-mono mt-1.5 block">
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
                  /* CARD / CONTACTLESS VISUALIZATION */
                  <div className="w-full max-w-lg space-y-6">
                    <div className="relative mx-auto w-28 h-28 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-soft-ring" />
                      <div className="absolute -inset-2 rounded-full border border-blue-400/30 animate-ping duration-1000" />
                      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-blue-800 border-2 border-blue-400 flex items-center justify-center text-white shadow-2xl shadow-blue-900/50">
                        <Wifi className="w-10 h-10 rotate-90" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="px-4 py-1 rounded-full bg-blue-500/20 text-blue-700 border border-blue-400/40 text-sm font-black uppercase inline-block">
                        TEMASSIZ VEYA ÇİPLİ İŞLEM
                      </span>
                      <h3
                        className={`text-3xl md:text-4xl lg:text-5xl font-black ${
                          isLight ? 'text-slate-900' : 'text-white'
                        } tracking-tight leading-tight`}
                      >
                        Lütfen Kartınızı POS Cihazına Yaklaştırınız
                      </h3>
                      <p
                        className={`text-base md:text-lg ${
                          isLight ? 'text-slate-600' : 'text-blue-200/90'
                        } font-medium max-w-md mx-auto`}
                      >
                        Kartınızı terminale yaklaştırabilir veya çipli olarak cihaza yerleştirebilirsiniz.
                      </p>
                    </div>

                    {/* Customer Recognition Banner during Checkout */}
                    {data.selectedCustomer && (
                      <div
                        className={`${
                          isLight
                            ? 'bg-slate-100 border-slate-200 text-slate-800'
                            : 'bg-white/[0.08] border-white/15 text-white'
                        } border px-4 py-2.5 rounded-2xl inline-flex items-center space-x-2 text-base font-bold backdrop-blur-md shadow-lg`}
                      >
                        <Sparkles className="w-4.5 h-4.5 text-blue-500" />
                        <span>
                          Sayın {data.selectedCustomer.firstName} {data.selectedCustomer.lastName}
                        </span>
                        <span
                          className={`text-sm ${
                            isLight ? 'text-blue-700' : 'text-blue-300'
                          } font-semibold`}
                        >
                          • İyi Günlerde Kullanınız
                        </span>
                      </div>
                    )}

                    {/* Supported Card Badges */}
                    <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
                      <span
                        className={`px-4 py-1.5 rounded-xl ${
                          isLight
                            ? 'bg-slate-100 border-slate-200 text-slate-800'
                            : 'bg-white/[0.08] border-white/15 text-white'
                        } border text-sm font-bold flex items-center space-x-1.5 shadow-sm`}
                      >
                        <Wifi className="w-4 h-4 rotate-90 text-blue-500" />
                        <span>Temassız</span>
                      </span>
                      <span
                        className={`px-4 py-1.5 rounded-xl ${
                          isLight
                            ? 'bg-slate-100 border-slate-200 text-slate-800'
                            : 'bg-white/[0.08] border-white/15 text-white'
                        } border text-sm font-bold shadow-sm`}
                      >
                        Troy
                      </span>
                      <span
                        className={`px-4 py-1.5 rounded-xl ${
                          isLight
                            ? 'bg-slate-100 border-slate-200 text-slate-800'
                            : 'bg-white/[0.08] border-white/15 text-white'
                        } border text-sm font-bold shadow-sm`}
                      >
                        Visa
                      </span>
                      <span
                        className={`px-4 py-1.5 rounded-xl ${
                          isLight
                            ? 'bg-slate-100 border-slate-200 text-slate-800'
                            : 'bg-white/[0.08] border-white/15 text-white'
                        } border text-sm font-bold shadow-sm`}
                      >
                        Mastercard
                      </span>
                      <span
                        className={`px-4 py-1.5 rounded-xl ${
                          isLight
                            ? 'bg-slate-100 border-slate-200 text-slate-800'
                            : 'bg-white/[0.08] border-white/15 text-white'
                        } border text-sm font-bold flex items-center space-x-1.5 shadow-sm`}
                      >
                        <Smartphone className="w-4 h-4 text-blue-500" />
                        <span>Apple / Mobil Pay</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Notice */}
              <div
                className={`px-5 py-2 ${
                  isLight
                    ? 'bg-slate-50/80 border-slate-200/80 text-slate-600'
                    : 'bg-white/[0.03] border-white/10 text-blue-300/90'
                } border-t text-xs font-medium flex items-center justify-between shrink-0`}
              >
                <span className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>256-bit Uçtan Uca Şifreli Güvenli Tahsilat</span>
                </span>
                <span className={`font-bold ${isLight ? 'text-slate-800' : 'text-white'} text-xs`}>
                  {data.cartItems.reduce((acc, i) => acc + i.quantity, 0)} Ürün
                </span>
              </div>
            </div>

            {/* Right 42%: Order Summary & Giant Amount Due Card */}
            <div className="flex-[2] flex flex-col justify-between space-y-2.5 min-h-0 animate-panel-right">
              {/* Compact Cart Items Recap */}
              <div
                className={`${
                  isLight
                    ? 'bg-white/90 border-slate-200/90 shadow-xl'
                    : 'bg-slate-900/55 border-white/15 shadow-xl'
                } border rounded-2xl p-3.5 md:p-4 backdrop-blur-2xl flex-1 flex flex-col min-h-0`}
              >
                <div
                  className={`flex items-center justify-between pb-2 border-b ${
                    isLight ? 'border-slate-200/80' : 'border-white/10'
                  } mb-2 shrink-0`}
                >
                  <span
                    className={`text-xs font-black ${
                      isLight ? 'text-slate-800' : 'text-blue-200'
                    } uppercase tracking-wider flex items-center space-x-1.5`}
                  >
                    <Receipt className="w-4 h-4 text-blue-500" />
                    <span>Sipariş Özeti</span>
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      isLight ? 'text-slate-500' : 'text-blue-300/80'
                    }`}
                  >
                    {data.cartItems.length} Kalem
                  </span>
                </div>

                {/* Items scroll */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
                  {data.cartItems.map((item, idx) => {
                    const isDiscounted = item.originalPrice && item.originalPrice > item.unitPrice
                    const itemDiscountTotal = isDiscounted
                      ? (item.originalPrice - item.unitPrice) * item.quantity
                      : 0

                    return (
                      <div
                        key={item.variantId || idx}
                        className={`flex items-center justify-between p-2 rounded-xl ${
                          isLight
                            ? 'bg-slate-50/90 border-slate-200/80'
                            : 'bg-white/[0.04] border-white/[0.08]'
                        } border text-xs`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div
                            className={`font-bold ${
                              isLight ? 'text-slate-900' : 'text-white'
                            } truncate text-xs md:text-sm`}
                          >
                            {item.productName}
                          </div>
                          {!data.hidePrices ? (
                            <div
                              className={`text-[11px] ${
                                isLight ? 'text-slate-500' : 'text-blue-300/80'
                              } mt-0.5`}
                            >
                              {item.quantity} Adet × 
                              {isDiscounted ? (
                                <>
                                  <span className="line-through text-slate-400 mx-1">
                                    {(item.originalPrice ?? 0).toFixed(2)} ₺
                                  </span>
                                  <span
                                    className={`${
                                      isLight ? 'text-emerald-700' : 'text-rose-300'
                                    } font-bold`}
                                  >
                                    {(item.unitPrice ?? 0).toFixed(2)} ₺
                                  </span>
                                </>
                              ) : (
                                <span className="ml-1">{(item.unitPrice ?? 0).toFixed(2)} ₺</span>
                              )}
                            </div>
                          ) : (
                            <div
                              className={`text-[11px] ${
                                isLight ? 'text-slate-500' : 'text-blue-300/80'
                              } mt-0.5`}
                            >
                              {item.quantity} Adet
                            </div>
                          )}
                        </div>
                        {!data.hidePrices && (
                          <div className="text-right shrink-0">
                            <span
                              className={`font-black font-mono ${
                                isLight ? 'text-slate-900' : 'text-white'
                              } block text-xs md:text-sm`}
                            >
                              {(item.totalPrice ?? 0).toFixed(2)} ₺
                            </span>
                            {/* DISCOUNT DISPLAY UNDER ITEM PRICE */}
                            {isDiscounted && (
                              <span
                                className={`text-[10px] font-bold ${
                                  isLight ? 'text-emerald-600' : 'text-emerald-400'
                                } block`}
                              >
                                İndirim: -{(itemDiscountTotal ?? 0).toFixed(2)} ₺
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Breakdown totals or Stock item count */}
                {!data.hidePrices ? (
                  <div
                    className={`pt-2 border-t ${
                      isLight ? 'border-slate-200/80' : 'border-white/10'
                    } space-y-1 text-xs md:text-sm shrink-0`}
                  >
                    <div
                      className={`flex justify-between ${
                        isLight ? 'text-slate-600' : 'text-blue-200/90'
                      } font-medium`}
                    >
                      <span>Ara Toplam:</span>
                      <span
                        className={`font-bold ${
                          isLight ? 'text-slate-900' : 'text-white'
                        }`}
                      >
                        {data.subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                      </span>
                    </div>
                    {data.discountAmount > 0 && (
                      <div
                        className={`flex justify-between ${
                          isLight ? 'text-emerald-600' : 'text-amber-300'
                        } font-bold`}
                      >
                        <span>İndirim Tutarı:</span>
                        <span>
                          -{data.discountAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}{' '}
                          ₺
                        </span>
                      </div>
                    )}
                    {(data.surchargeAmount ?? 0) > 0 && (
                      <div className="flex justify-between text-orange-400 font-bold">
                        <span>Taksit / Vade Farkı:</span>
                        <span>
                          +{(data.surchargeAmount ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}{' '}
                          ₺
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className={`pt-2 border-t ${
                      isLight ? 'border-slate-200/80' : 'border-white/10'
                    } space-y-1 text-xs md:text-sm shrink-0`}
                  >
                    <div
                      className={`flex justify-between ${
                        isLight ? 'text-slate-600' : 'text-blue-200/90'
                      } font-medium`}
                    >
                      <span>Toplam Parça:</span>
                      <span
                        className={`font-bold ${
                          isLight ? 'text-slate-900' : 'text-white'
                        }`}
                      >
                        {data.cartItems.reduce((acc, item) => acc + item.quantity, 0)} Adet
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* GIANT TOTAL DUE CARD / STOCK CARD */}
              <div className="bg-gradient-to-br from-[#00268A]/95 via-[#0a359e]/90 to-[#1e3a8a]/85 border-2 border-blue-400/60 rounded-2xl p-3.5 md:p-4 text-center shadow-xl backdrop-blur-xl text-white shrink-0">
                <span className="text-xs md:text-sm font-black text-blue-200 uppercase tracking-widest block mb-0.5">
                  {!data.hidePrices ? 'ÖDENECEK TOPLAM TUTAR' : 'TOPLAM ÜRÜN ADEDİ'}
                </span>
                <div className="text-4xl md:text-5xl font-black text-white tracking-tight drop-shadow-md">
                  {!data.hidePrices ? (
                    <>
                      {data.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}{' '}
                      <span className="text-2xl md:text-3xl text-blue-200 font-bold">₺</span>
                    </>
                  ) : (
                    <>
                      {data.cartItems.reduce((acc, item) => acc + item.quantity, 0)}{' '}
                      <span className="text-2xl text-blue-200 font-bold">ADET</span>
                    </>
                  )}
                </div>
                {/* Total savings under the price */}
                {!data.hidePrices && data.discountAmount > 0 ? (
                  <div className="text-xs text-emerald-300 font-black mt-1">
                    Toplam Tasarrufunuz: -{data.discountAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </div>
                ) : (
                  <div className="text-xs text-blue-200 font-bold mt-1">
                    {!data.hidePrices ? 'Net Tutar' : 'Stok Çıkış Listesi'}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : hasCart ? (
          /* CASE 3: ACTIVE SHOPPING CART */
          <div className="flex-1 flex overflow-hidden gap-3.5 md:gap-4 min-h-0">
            {/* Left 58%: Real-Time Cart Items List */}
            <div
              className={`flex-[3] flex flex-col ${
                isLight
                  ? 'bg-white/90 border-slate-200/90 shadow-xl'
                  : 'bg-slate-900/55 border-white/15 shadow-xl'
              } border rounded-2xl overflow-hidden backdrop-blur-2xl min-h-0 animate-panel-left`}
            >
              {/* Cart List Header */}
              <div
                className={`px-5 py-2.5 border-b ${
                  isLight ? 'border-slate-200/80 bg-slate-50/80' : 'border-white/10 bg-white/[0.04]'
                } flex items-center justify-between shrink-0`}
              >
                <div className="flex items-center space-x-2.5">
                  <ShoppingBag className="w-5 h-5 text-blue-500" />
                  <h2
                    className={`text-lg md:text-xl font-black ${
                      isLight ? 'text-slate-900' : 'text-white'
                    } tracking-wide`}
                  >
                    Alışveriş Sepetiniz
                  </h2>
                </div>
                <span className="px-3 py-0.5 rounded-full bg-blue-500/20 text-blue-600 border border-blue-400/40 text-xs font-black">
                  {data.cartItems.reduce((acc, item) => acc + item.quantity, 0)} Ürün
                </span>
              </div>

              {/* Items List - Fully Scrollable */}
              <div ref={cartListRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
                {data.cartItems.map((item, idx) => {
                  const isLastItem = idx === data.cartItems.length - 1
                  const isDiscounted = item.originalPrice && item.originalPrice > item.unitPrice
                  const itemDiscountTotal = isDiscounted
                    ? (item.originalPrice - item.unitPrice) * item.quantity
                    : 0

                  return (
                    <div
                      key={item.variantId || idx}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                        isLastItem
                          ? isLight
                            ? 'bg-blue-50/90 border-blue-400 shadow-md ring-1 ring-blue-300'
                            : 'bg-blue-500/20 border-blue-400/60 shadow-md ring-1 ring-blue-400/40'
                          : isLight
                          ? 'bg-slate-50/90 border-slate-200/90 hover:bg-slate-100/90 shadow-2xs'
                          : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className="flex-1 mr-3 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3
                            className={`text-base md:text-lg font-black ${
                              isLight ? 'text-slate-900' : 'text-white'
                            } leading-snug truncate`}
                          >
                            {item.productName}
                          </h3>
                          {isLastItem && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-700 border border-blue-400/50 text-[10px] font-black uppercase shrink-0 shadow-2xs">
                              Yeni
                            </span>
                          )}
                        </div>

                        <div
                          className={`flex items-center space-x-2 mt-1 text-xs ${
                            isLight ? 'text-slate-500' : 'text-blue-200/80'
                          }`}
                        >
                          {(item.attributes?.color || item.attributes?.size) && (
                            <span
                              className={`px-2.5 py-0.5 rounded-md ${
                                isLight
                                  ? 'bg-slate-200/70 text-slate-800 border-slate-300/80'
                                  : 'bg-white/10 text-white border-white/15'
                              } border font-bold text-xs`}
                            >
                              {item.attributes.color || '-'} / {item.attributes.size || '-'}
                            </span>
                          )}
                          {item.barcode && (
                            <span
                              className={`font-mono ${
                                isLight ? 'text-slate-600' : 'text-blue-300'
                              } font-semibold text-xs`}
                            >
                              {item.barcode}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity & Unit Price */}
                      <div className="text-right flex items-center space-x-3 shrink-0">
                        <div
                          className={`text-center ${
                            isLight
                              ? 'bg-slate-200/70 border-slate-300/80'
                              : 'bg-white/10 border-white/15'
                          } border px-3 py-1.5 rounded-xl min-w-[50px]`}>
                          <span
                            className={`text-[10px] ${
                              isLight ? 'text-slate-600' : 'text-blue-200'
                            } uppercase block font-black`}
                          >
                            Adet
                          </span>
                          <span
                            className={`text-xl md:text-2xl font-black ${
                              isLight ? 'text-slate-900' : 'text-white'
                            }`}
                          >
                            {item.quantity}
                          </span>
                        </div>

                        {!data.hidePrices && (
                          <div className="text-right min-w-[105px]">
                            {isDiscounted ? (
                              <div className="flex flex-col items-end">
                                <span className="text-[11px] text-rose-400 line-through font-medium leading-none">
                                  {(item.originalPrice ?? 0).toFixed(2)} ₺
                                </span>
                                <span
                                  className={`text-[11px] ${
                                    isLight ? 'text-emerald-700' : 'text-emerald-300'
                                  } font-bold leading-tight`}
                                >
                                  İndirimli: {(item.unitPrice ?? 0).toFixed(2)} ₺
                                </span>
                              </div>
                            ) : (
                              <span
                                className={`text-xs ${
                                  isLight ? 'text-slate-500' : 'text-blue-200/80'
                                } block font-medium`}
                              >
                                Birim: {(item.unitPrice ?? 0).toFixed(2)} ₺
                              </span>
                            )}
                            <span
                              className={`text-xl md:text-2xl font-black ${
                                isLight ? 'text-slate-900' : 'text-white'
                              } block`}
                            >
                              {(item.totalPrice ?? 0).toFixed(2)} ₺
                            </span>
                            {/* DISCOUNT AMOUNT DISPLAY UNDER THE PRICE */}
                            {isDiscounted && (
                              <div
                                className={`text-[11px] font-bold ${
                                  isLight ? 'text-emerald-600' : 'text-emerald-400'
                                } leading-tight mt-0.5 whitespace-nowrap`}
                              >
                                İndirim: -{(itemDiscountTotal ?? 0).toFixed(2)} ₺
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right 42%: Financial Summary & Total Box */}
            <div className="flex-[2] flex flex-col justify-between space-y-2 min-h-0 overflow-hidden animate-panel-right">
              {data.hidePrices ? (
                /* Stock Only Mode */
                <div
                  className={`${
                    isLight
                      ? 'bg-white/90 border-slate-200/90 shadow-xl'
                      : 'bg-slate-900/55 border-white/15 shadow-xl'
                  } border rounded-2xl p-5 backdrop-blur-2xl space-y-4 flex-1 flex flex-col justify-between`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-rose-400 border-b border-slate-200/60 pb-2.5">
                      <ShoppingBag className="w-4.5 h-4.5" />
                      <span className="text-base font-black uppercase tracking-wider">
                        Ürün & Stok Bilgisi
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div
                        className={`flex justify-between items-center ${
                          isLight
                            ? 'bg-slate-50 border-slate-200'
                            : 'bg-white/[0.04] border-white/10'
                        } border p-3 rounded-xl`}
                      >
                        <span className={isLight ? 'text-slate-600 font-semibold text-sm' : 'text-blue-200 font-semibold text-sm'}>
                          Toplam Çeşit:
                        </span>
                        <span
                          className={`font-black ${
                            isLight ? 'text-slate-900' : 'text-white'
                          } text-base md:text-lg`}
                        >
                          {data.cartItems.length} Kalem
                        </span>
                      </div>
                      <div
                        className={`flex justify-between items-center ${
                          isLight
                            ? 'bg-slate-50 border-slate-200'
                            : 'bg-white/[0.04] border-white/10'
                        } border p-3 rounded-xl`}
                      >
                        <span className={isLight ? 'text-slate-600 font-semibold text-sm' : 'text-blue-200 font-semibold text-sm'}>
                          Toplam Ürün Adedi:
                        </span>
                        <span
                          className={`font-black ${
                            isLight ? 'text-slate-900' : 'text-white'
                          } text-base md:text-lg`}
                        >
                          {data.cartItems.reduce((acc, item) => acc + item.quantity, 0)} Adet
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-[#00268A]/95 via-[#0a359e]/90 to-[#1e3a8a]/85 border-2 border-blue-400/60 rounded-2xl p-4 md:p-5 text-center shadow-xl backdrop-blur-xl text-white shrink-0">
                    <span className="text-xs md:text-sm font-black text-blue-200 uppercase tracking-widest block mb-0.5">
                      SEPETTEKİ TOPLAM ÜRÜN
                    </span>
                    <div className="text-5xl md:text-6xl font-black text-white tracking-tight drop-shadow-md">
                      {data.cartItems.reduce((acc, item) => acc + item.quantity, 0)}{' '}
                      <span className="text-2xl text-blue-200 font-bold">ADET</span>
                    </div>
                    <div className="text-xs text-blue-200 font-bold mt-1.5">
                      Stok Çıkış Listesi
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Active Campaign Card if applied */}
                  {data.activeCampaign && (
                    <div className="bg-amber-500/20 border border-amber-400/40 rounded-xl p-2.5 flex items-center justify-between backdrop-blur-xl shadow-sm shrink-0">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 rounded-lg bg-amber-500/30 text-amber-500 border border-amber-400/40 shadow-2xs">
                          <Tag className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-amber-600 uppercase tracking-wide block leading-none">
                            Kampanya
                          </span>
                          <span className={`text-sm font-black ${isLight ? 'text-slate-900' : 'text-white'} leading-tight`}>
                            {data.activeCampaign.name}
                          </span>
                        </div>
                      </div>
                      {(data.discountAmount ?? 0) > 0 && (
                        <span className="text-sm font-black text-amber-600 bg-amber-400/30 px-2.5 py-0.5 rounded-lg border border-amber-400/40">
                          -{(data.discountAmount ?? 0).toFixed(2)} ₺
                        </span>
                      )}
                      {(data.surchargeAmount ?? 0) > 0 && (
                        <span className="text-sm font-black text-orange-600 bg-orange-500/30 px-2.5 py-0.5 rounded-lg border border-orange-400/40">
                          +{(data.surchargeAmount ?? 0).toFixed(2)} ₺
                        </span>
                      )}
                    </div>
                  )}

                  {/* Subtotal & Giant Total Due Card */}
                  <div
                    className={`${
                      isLight
                        ? 'bg-white/90 border-slate-200/90 shadow-xl'
                        : 'bg-slate-900/55 border-white/15 shadow-xl'
                    } border rounded-2xl p-3.5 md:p-4 backdrop-blur-2xl space-y-2.5 flex-1 flex flex-col justify-between`}
                  >
                    <div
                      className={`space-y-1.5 pb-2 border-b ${
                        isLight ? 'border-slate-200/80' : 'border-white/10'
                      } shrink-0`}
                    >
                      <div className="flex justify-between items-center text-sm md:text-base">
                        <span className={isLight ? 'text-slate-600 font-semibold' : 'text-blue-200 font-semibold'}>
                          Ara Toplam
                        </span>
                        <span
                          className={`font-black ${
                            isLight ? 'text-slate-900' : 'text-white'
                          } text-base md:text-lg`}
                        >
                          {data.subtotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </span>
                      </div>

                      {data.discountAmount > 0 && (
                        <div
                          className={`flex justify-between items-center text-sm md:text-base ${
                            isLight ? 'text-emerald-600' : 'text-amber-300'
                          } font-black`}
                        >
                          <span className="flex items-center space-x-1.5">
                            <Tag className="w-3.5 h-3.5" />
                            <span>İndirim Tutarı</span>
                          </span>
                          <span className="text-base md:text-lg">
                            -{data.discountAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}{' '}
                            ₺
                          </span>
                        </div>
                      )}

                      {(data.surchargeAmount ?? 0) > 0 && (
                        <div className="flex justify-between items-center text-sm md:text-base text-orange-500 font-black">
                          <span className="flex items-center space-x-1.5">
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Taksit / Vade Farkı</span>
                          </span>
                          <span className="text-base md:text-lg">
                            +{(data.surchargeAmount ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}{' '}
                            ₺
                          </span>
                        </div>
                      )}
                    </div>

                    {/* GIANT TOTAL CARD */}
                    <div className="bg-gradient-to-br from-[#00268A]/95 via-[#0a359e]/90 to-[#1e3a8a]/85 border-2 border-blue-400/60 rounded-2xl p-3 text-center shadow-xl relative overflow-hidden backdrop-blur-xl text-white shrink-0">
                      <span className="text-[11px] font-black text-blue-200 uppercase tracking-widest block mb-0.5">
                        ÖDENECEK TOPLAM TUTAR
                      </span>
                      <div className="text-3xl md:text-4xl font-black text-white tracking-tight drop-shadow-md">
                        {data.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}{' '}
                        <span className="text-2xl text-blue-200 font-bold">₺</span>
                      </div>
                      {/* Total savings under the price */}
                      {data.discountAmount > 0 && (
                        <div className="text-[11px] text-emerald-300 font-black mt-0.5">
                          Toplam Tasarrufunuz: -{data.discountAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                        </div>
                      )}
                    </div>

                    {/* Compact Single-Line Payment Pill */}
                    <div className="text-center shrink-0 pt-0.5">
                      <div
                        className={`inline-flex items-center space-x-2 px-3 py-0.5 rounded-full ${
                          isLight
                            ? 'bg-slate-100 border-slate-200 text-slate-600'
                            : 'bg-white/[0.06] border-white/10 text-blue-200/90'
                        } border text-[11px] md:text-xs font-medium`}
                      >
                        <CreditCard className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-blue-300'}`} />
                        <span>Nakit, Kredi Kartı ve Temassız Geçerlidir</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* CASE 4: STANDBY / IDLE STATE */
          <div
            className={`flex-1 w-full min-h-0 flex flex-col items-center justify-center p-3.5 md:p-5 lg:p-6 ${
              isLight ? 'border-slate-200/80 bg-white/40' : 'border-white/20'
            } border rounded-3xl shadow-2xl relative overflow-hidden animate-slowmotion-fade gap-3 md:gap-4`}
          >
            {/* Cinematic Store Atmosphere Background Image */}
            <div className="absolute inset-0 z-0">
              <img
                src={customerBgImage}
                alt="Karşılama Arka Planı"
                className={`w-full h-full object-cover object-center scale-100 filter ${
                  isLight ? 'brightness-[1.05] contrast-[0.95]' : 'brightness-[0.92] contrast-[1.05]'
                }`}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  if (!target.dataset.triedFallback) {
                    target.dataset.triedFallback = 'true'
                    target.src = './customerbackground.jpg'
                  }
                }}
              />
              <div
                className={`absolute inset-0 ${
                  isLight
                    ? 'bg-gradient-to-t from-white/90 via-white/40 to-white/70'
                    : 'bg-gradient-to-t from-[#060c1c]/70 via-[#0c1a38]/25 to-[#060c1c]/45'
                }`}
              />
            </div>

            {/* Top Standby Welcome */}
            <div className="text-center space-y-1 md:space-y-1.5 z-10 max-w-2xl shrink-0">
              <div>
                <span
                  className={`px-3.5 py-1 rounded-full ${
                    isLight
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-blue-500/30 text-blue-100 border-blue-400/50 shadow-lg'
                  } border text-[11px] md:text-xs font-black tracking-widest uppercase inline-block backdrop-blur-md shrink-0`}
                >
                  PREMIUM RETAIL EXPERIENCE
                </span>
              </div>

              <h2
                className={`text-2xl md:text-3xl lg:text-4xl font-black ${
                  isLight ? 'text-slate-900 drop-shadow-sm' : 'text-white drop-shadow-2xl'
                } tracking-tight leading-tight`}
              >
                Hoş Geldiniz
              </h2>

              <p
                className={`text-xs md:text-sm ${
                  isLight ? 'text-slate-700' : 'text-blue-100'
                } font-bold ${isLight ? 'drop-shadow-none' : 'drop-shadow-lg'} max-w-xl mx-auto line-clamp-2`}
              >
                {data.storeAddress || 'Yeni sezon koleksiyonumuz ve ayrıcalıklı alışveriş deneyimi için buradayız.'}
              </p>
            </div>

            {/* Center: Dynamic Auto-Rotating Campaign Banner */}
            <div className="w-full max-w-2xl z-10 shrink-0">
              <div
                className={`${
                  isLight
                    ? 'bg-white/90 border-slate-200/90 shadow-xl'
                    : 'bg-slate-900/50 border-white/25 shadow-2xl'
                } border rounded-2xl md:rounded-3xl p-3 md:p-3.5 backdrop-blur-xl transition-all duration-500 h-[115px] md:h-[125px] max-h-[125px] flex flex-col justify-between`}
              >
                <div className="flex items-center space-x-3 md:space-x-4 min-w-0">
                  <div
                    className={`p-2 md:p-2.5 rounded-2xl ${PROMO_SLIDES[currentSlide].iconBg} shadow-lg shrink-0 border border-white/20 text-xl md:text-2xl`}
                  >
                    <SlideIcon className="w-5 h-5 md:w-6 md:h-6" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-black uppercase tracking-wider border inline-block mb-0.5 ${PROMO_SLIDES[currentSlide].badgeColor}`}
                    >
                      {PROMO_SLIDES[currentSlide].badge}
                    </span>
                    <h3
                      className={`text-base md:text-lg font-black ${
                        isLight ? 'text-slate-900' : 'text-white'
                      } tracking-tight drop-shadow-md truncate`}
                    >
                      {PROMO_SLIDES[currentSlide].title}
                    </h3>
                    <p
                      className={`text-xs ${
                        isLight ? 'text-slate-600' : 'text-blue-100/90'
                      } font-medium leading-relaxed drop-shadow-sm line-clamp-1 mt-0.5`}
                    >
                      {PROMO_SLIDES[currentSlide].subtitle}
                    </p>
                  </div>
                </div>

                {/* Carousel Dots */}
                <div
                  className={`flex justify-center space-x-2 pt-1.5 border-t ${
                    isLight ? 'border-slate-200/80' : 'border-white/10'
                  } shrink-0`}
                >
                  {PROMO_SLIDES.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentSlide(idx)}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === currentSlide
                          ? 'w-6 md:w-7 bg-blue-500 shadow-xs'
                          : isLight
                          ? 'w-1.5 md:w-2 bg-slate-300 hover:bg-slate-400'
                          : 'w-1.5 md:w-2 bg-white/30 hover:bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Standby Badge Pills */}
            <div
              className={`z-10 flex flex-wrap items-center justify-center gap-2 md:gap-3 text-xs font-bold ${
                isLight ? 'text-slate-700' : 'text-blue-100/90'
              } shrink-0`}
            >
              <span
                className={`px-3 py-1 md:px-3.5 md:py-1 rounded-full ${
                  isLight
                    ? 'bg-white/95 border-slate-200 text-slate-800 shadow-sm'
                    : 'bg-slate-900/60 border-white/20 text-blue-100/90'
                } border backdrop-blur-md flex items-center gap-1.5 whitespace-nowrap`}
              >
                <span>💳</span> Nakit & Tüm Banka Kartları
              </span>
              <span
                className={`px-3 py-1 md:px-3.5 md:py-1 rounded-full ${
                  isLight
                    ? 'bg-white/95 border-slate-200 text-slate-800 shadow-sm'
                    : 'bg-slate-900/60 border-white/20 text-blue-100/90'
                } border backdrop-blur-md flex items-center gap-1.5 whitespace-nowrap`}
              >
                <span>🔄</span> 14 Gün İçinde Fiş ile Değişim
              </span>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer
        id="customerDisplayFooter"
        className={`customer-display-footer h-7 min-h-[28px] max-h-[28px] leading-none ${
          isLight
            ? 'bg-white/90 border-slate-200/80 text-slate-500'
            : 'bg-slate-900/85 border-white/10 text-blue-300/80'
        } backdrop-blur-2xl border-t px-4 md:px-5 flex items-center justify-between text-[11px] z-20 shrink-0 flex-none overflow-hidden select-none whitespace-nowrap`}
      >
        <div className="flex items-center space-x-2 shrink-0 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span
            className={`font-bold ${
              isLight ? 'text-slate-800' : 'text-blue-100'
            } text-[11px] leading-none whitespace-nowrap`}
          >
            Kasa Aktif & Canlı Bağlantı
          </span>
        </div>

        <div className="shrink-0 whitespace-nowrap overflow-hidden">
          <span
            className={`text-[10px] md:text-[11px] ${
              isLight ? 'text-slate-400' : 'text-blue-300/60'
            } font-semibold tracking-wider uppercase leading-none whitespace-nowrap`}
          >
            Design & Architecture by Atacan Gürbüz
          </span>
        </div>
      </footer>
    </div>
  )
}
