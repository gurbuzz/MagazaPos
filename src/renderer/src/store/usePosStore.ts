import { create } from 'zustand'
import { syncCustomerDisplay } from '../utils/customerDisplaySync'

export interface CartItem {
  variantId: string
  productId: string
  productName: string
  brand: string
  sku: string
  barcode: string
  attributes: { color?: string; size?: string }
  unitPrice: number
  originalPrice?: number
  quantity: number
  totalPrice: number
}

export interface Campaign {
  id: string
  name: string
  type: 'PERCENTAGE' | 'FIXED'
  action?: 'DISCOUNT' | 'SURCHARGE' // 'DISCOUNT' = Indirim (-), 'SURCHARGE' = Fiyat Artirimi / Taksit Farki (+)
  value: number // e.g. 10 for 10%, 50 for 50 TL
  badgeColor?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple' | 'orange' | 'blue'
}

export interface Customer {
  id: string
  firstName: string
  lastName: string
  phone: string
  city: string
  district: string
  notes?: string | null
  createdAt?: string
  _count?: { sales: number }
}

interface PosState {
  activeTab: 'pos' | 'stock' | 'sales' | 'labels' | 'customers'
  setActiveTab: (tab: 'pos' | 'stock' | 'sales' | 'labels' | 'customers') => void

  // Stock Only / Privacy Mode (Fiyatsız Gizlilik Modu)
  isStockOnlyMode: boolean
  toggleStockOnlyMode: () => void

  // Lock Screen & System Settings
  isLocked: boolean
  pinCode: string
  storeName: string
  storeAddress: string
  storePhone: string
  cashierName: string
  receiptPrefix: string
  receiptFooterNote: string
  vatRate: number
  lowStockThreshold: number
  autoPrintReceipt: boolean
  receiptPrinter: string
  receiptPrintMode: 'ESC_POS' | 'HTML'
  customIp: string
  autoOpenCustomerDisplay: boolean
  customerDisplayMessage: string
  customerDisplayTheme: 'dark' | 'light'

  unlockApp: (enteredPin: string) => boolean
  lockApp: () => void
  updateSystemSettings: (settings: {
    storeName?: string
    storeAddress?: string
    storePhone?: string
    cashierName?: string
    pinCode?: string
    receiptPrefix?: string
    receiptFooterNote?: string
    vatRate?: number
    lowStockThreshold?: number
    autoPrintReceipt?: boolean
    receiptPrinter?: string
    receiptPrintMode?: 'ESC_POS' | 'HTML'
    customIp?: string
    autoOpenCustomerDisplay?: boolean
    customerDisplayMessage?: string
    customerDisplayTheme?: 'dark' | 'light'
  }) => void

  cartItems: CartItem[]
  selectedCustomer: Customer | null
  setSelectedCustomer: (customer: Customer | null) => void
  clearSelectedCustomer: () => void

  discountAmount: number
  surchargeAmount: number
  customTotal: number | null
  activeCampaign: Campaign | null
  localIp: string
  setLocalIp: (ip: string) => void

  // Campaign preset management
  campaigns: Campaign[]
  addCampaign: (campaign: Omit<Campaign, 'id'>) => void
  deleteCampaign: (id: string) => void

  addToCart: (variant: any) => void
  removeFromCart: (variantId: string) => void
  updateQuantity: (variantId: string, quantity: number) => void

  applyDiscount: (amount: number) => void
  setCustomTotal: (amount: number | null) => void
  applyCampaign: (campaign: Campaign | null) => void
  clearCart: () => void

  getSubtotal: () => number
  getTotal: () => number
}

const DEFAULT_CAMPAIGNS: Campaign[] = [
  { id: 'c_t1', name: '+%10 Taksit', type: 'PERCENTAGE', action: 'SURCHARGE', value: 10, badgeColor: 'orange' },
  { id: 'c_t2', name: '+%15 Taksit', type: 'PERCENTAGE', action: 'SURCHARGE', value: 15, badgeColor: 'orange' },
  { id: 'c1', name: '%10 Genel İndirim', type: 'PERCENTAGE', action: 'DISCOUNT', value: 10, badgeColor: 'amber' },
  { id: 'c2', name: '%20 Sezon Sonu', type: 'PERCENTAGE', action: 'DISCOUNT', value: 20, badgeColor: 'rose' },
  { id: 'c3', name: '-50 ₺ Nakit İndirimi', type: 'FIXED', action: 'DISCOUNT', value: 50, badgeColor: 'emerald' },
  { id: 'c4', name: '-100 ₺ Hoşgeldin Kuponu', type: 'FIXED', action: 'DISCOUNT', value: 100, badgeColor: 'indigo' },
  { id: 'c5', name: '%15 VIP Müşteri İndirimi', type: 'PERCENTAGE', action: 'DISCOUNT', value: 15, badgeColor: 'purple' },
]

const parsePrice = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (!val) return 0
  const clean = String(val).replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(clean)
  return isNaN(num) ? 0 : num
}

function computeCampaignAmounts(
  subtotal: number,
  campaign: Campaign | null
): { discountAmount: number; surchargeAmount: number } {
  if (!campaign || subtotal <= 0) {
    return { discountAmount: 0, surchargeAmount: 0 }
  }

  const isSurcharge = campaign.action === 'SURCHARGE'
  let calculated = 0
  if (campaign.type === 'PERCENTAGE') {
    calculated = (subtotal * campaign.value) / 100
  } else {
    calculated = campaign.value
  }
  calculated = Math.round(calculated * 100) / 100

  if (isSurcharge) {
    return {
      discountAmount: 0,
      surchargeAmount: Math.max(0, calculated),
    }
  } else {
    return {
      discountAmount: Math.round(Math.min(subtotal, Math.max(0, calculated)) * 100) / 100,
      surchargeAmount: 0,
    }
  }
}

export const usePosStore = create<PosState>((set, get) => ({
  activeTab: 'pos',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Default security & system settings
  isLocked: true, // App starts locked on launch!
  pinCode: localStorage.getItem('pos_pin_code') || '1234',
  storeName: (() => {
    const saved = localStorage.getItem('pos_store_name')
    if (!saved || saved === 'MağazaPOS Giyim' || saved.includes('MağazaPOS') || saved.includes('Lufian')) {
      return 'JACK & JONES'
    }
    return saved
  })(),
  storeAddress: localStorage.getItem('pos_store_address') || 'Atatürk Cad. No:14/A Kadıköy / İstanbul',
  storePhone: localStorage.getItem('pos_store_phone') || '0216 345 67 89',
  cashierName: localStorage.getItem('pos_cashier_name') || 'Kasiyer 1',
  receiptPrefix: localStorage.getItem('pos_receipt_prefix') || 'FIS-',
  receiptFooterNote: localStorage.getItem('pos_receipt_footer') || 'Ürün değişimleri fiş ile 14 gün içinde yapılır. Teşekkürler!',
  vatRate: parseFloat(localStorage.getItem('pos_vat_rate') || '10'),
  lowStockThreshold: parseInt(localStorage.getItem('pos_low_stock') || '5', 10),
  autoPrintReceipt: localStorage.getItem('pos_auto_print') !== 'false',
  receiptPrinter: localStorage.getItem('pos_receipt_printer') || '',
  receiptPrintMode: (localStorage.getItem('pos_receipt_print_mode') as 'ESC_POS' | 'HTML') || 'ESC_POS',
  customIp: localStorage.getItem('pos_custom_ip') || '',
  autoOpenCustomerDisplay: localStorage.getItem('pos_auto_customer_display') !== 'false',
  customerDisplayMessage: localStorage.getItem('pos_customer_display_msg') || 'JACK & JONES Kalitesiyle Keyifli Alışverişler Dileriz',
  customerDisplayTheme: (localStorage.getItem('pos_customer_display_theme') as 'dark' | 'light') || 'dark',

  unlockApp: (enteredPin) => {
    const currentPin = get().pinCode
    if (enteredPin === currentPin) {
      set({ isLocked: false })
      return true
    }
    return false
  },

  lockApp: () => set({ isLocked: true }),

  isStockOnlyMode: localStorage.getItem('pos_stock_only_mode') === 'true',
  toggleStockOnlyMode: () => {
    const next = !get().isStockOnlyMode
    localStorage.setItem('pos_stock_only_mode', next ? 'true' : 'false')
    set({ isStockOnlyMode: next })
    if (next && get().activeTab === 'sales') {
      set({ activeTab: 'pos' })
    }
    syncCustomerDisplay({
      hidePrices: next,
    })
  },

  updateSystemSettings: (settings) => {
    if (settings.storeName !== undefined) localStorage.setItem('pos_store_name', settings.storeName)
    if (settings.storeAddress !== undefined) localStorage.setItem('pos_store_address', settings.storeAddress)
    if (settings.storePhone !== undefined) localStorage.setItem('pos_store_phone', settings.storePhone)
    if (settings.cashierName !== undefined) localStorage.setItem('pos_cashier_name', settings.cashierName)
    if (settings.pinCode !== undefined) localStorage.setItem('pos_pin_code', settings.pinCode)
    if (settings.receiptPrefix !== undefined) localStorage.setItem('pos_receipt_prefix', settings.receiptPrefix)
    if (settings.receiptFooterNote !== undefined) localStorage.setItem('pos_receipt_footer', settings.receiptFooterNote)
    if (settings.vatRate !== undefined) localStorage.setItem('pos_vat_rate', settings.vatRate.toString())
    if (settings.lowStockThreshold !== undefined) localStorage.setItem('pos_low_stock', settings.lowStockThreshold.toString())
    if (settings.autoPrintReceipt !== undefined) localStorage.setItem('pos_auto_print', settings.autoPrintReceipt ? 'true' : 'false')
    if (settings.receiptPrinter !== undefined) localStorage.setItem('pos_receipt_printer', settings.receiptPrinter)
    if (settings.receiptPrintMode !== undefined) localStorage.setItem('pos_receipt_print_mode', settings.receiptPrintMode)
    if (settings.customIp !== undefined) localStorage.setItem('pos_custom_ip', settings.customIp)
    if (settings.autoOpenCustomerDisplay !== undefined) localStorage.setItem('pos_auto_customer_display', settings.autoOpenCustomerDisplay ? 'true' : 'false')
    if (settings.customerDisplayMessage !== undefined) localStorage.setItem('pos_customer_display_msg', settings.customerDisplayMessage)
    if (settings.customerDisplayTheme !== undefined) localStorage.setItem('pos_customer_display_theme', settings.customerDisplayTheme)

    set((state) => ({
      storeName: settings.storeName ?? state.storeName,
      storeAddress: settings.storeAddress ?? state.storeAddress,
      storePhone: settings.storePhone ?? state.storePhone,
      cashierName: settings.cashierName ?? state.cashierName,
      pinCode: settings.pinCode ?? state.pinCode,
      receiptPrefix: settings.receiptPrefix ?? state.receiptPrefix,
      receiptFooterNote: settings.receiptFooterNote ?? state.receiptFooterNote,
      vatRate: settings.vatRate ?? state.vatRate,
      lowStockThreshold: settings.lowStockThreshold ?? state.lowStockThreshold,
      autoPrintReceipt: settings.autoPrintReceipt ?? state.autoPrintReceipt,
      receiptPrinter: settings.receiptPrinter ?? state.receiptPrinter,
      receiptPrintMode: settings.receiptPrintMode ?? state.receiptPrintMode,
      customIp: settings.customIp ?? state.customIp,
      autoOpenCustomerDisplay: settings.autoOpenCustomerDisplay ?? state.autoOpenCustomerDisplay,
      customerDisplayMessage: settings.customerDisplayMessage ?? state.customerDisplayMessage,
      customerDisplayTheme: settings.customerDisplayTheme ?? state.customerDisplayTheme,
    }))
  },

  cartItems: [],
  selectedCustomer: null,
  setSelectedCustomer: (customer) => set({ selectedCustomer: customer }),
  clearSelectedCustomer: () => set({ selectedCustomer: null }),

  discountAmount: 0,
  surchargeAmount: 0,
  customTotal: null,
  activeCampaign: null,
  localIp: '127.0.0.1',
  setLocalIp: (ip) => set({ localIp: ip }),

  campaigns: (() => {
    try {
      const saved = localStorage.getItem('pos_campaigns')
      if (saved) {
        const parsed: Campaign[] = JSON.parse(saved)
        const hasTaksit = parsed.some((c) => c.action === 'SURCHARGE' || c.name.includes('Taksit'))
        if (!hasTaksit) {
          const merged = [DEFAULT_CAMPAIGNS[0], DEFAULT_CAMPAIGNS[1], ...parsed]
          localStorage.setItem('pos_campaigns', JSON.stringify(merged))
          return merged
        }
        return parsed
      }
    } catch (e) {}
    return DEFAULT_CAMPAIGNS
  })(),

  addCampaign: (newCamp) => {
    const campaignWithId: Campaign = {
      ...newCamp,
      id: `camp_${Date.now()}`,
    }
    const updated = [...get().campaigns, campaignWithId]
    try {
      localStorage.setItem('pos_campaigns', JSON.stringify(updated))
    } catch (e) {}
    set({ campaigns: updated })
  },

  deleteCampaign: (id) => {
    const updated = get().campaigns.filter((c) => c.id !== id)
    try {
      localStorage.setItem('pos_campaigns', JSON.stringify(updated))
    } catch (e) {}
    const wasActive = get().activeCampaign?.id === id
    set({
      campaigns: updated,
      activeCampaign: wasActive ? null : get().activeCampaign,
      discountAmount: wasActive ? 0 : get().discountAmount,
      surchargeAmount: wasActive ? 0 : get().surchargeAmount,
    })
  },

  addToCart: (variant) => {
    const targetVariantId = String(variant.id || variant.variantId || '')
    const { cartItems, activeCampaign, customTotal, discountAmount, surchargeAmount } = get()
    const existingIndex = cartItems.findIndex((item) => String(item.variantId) === targetVariantId)
    let newItems: CartItem[]

    if (existingIndex > -1) {
      newItems = cartItems.map((item, idx) => {
        if (idx !== existingIndex) return item
        const q = (Number(item.quantity) || 0) + 1
        const u = Number(item.unitPrice) || 0
        return {
          ...item,
          quantity: q,
          totalPrice: Math.round(q * u * 100) / 100,
        }
      })
    } else {
      let attrs = variant.attributes || {}
      if (typeof attrs === 'string') {
        try {
          attrs = JSON.parse(attrs)
        } catch {
          attrs = {}
        }
      }

      const rawSale =
        variant.salePrice ??
        variant.price ??
        variant.product?.basePrice ??
        variant.basePrice ??
        0
      const salePriceNum = Math.round(parsePrice(rawSale) * 100) / 100

      const rawDisc =
        variant.discountPrice !== undefined && variant.discountPrice !== null
          ? parsePrice(variant.discountPrice)
          : null
      const hasDiscount = rawDisc !== null && rawDisc > 0 && rawDisc < salePriceNum
      const unitPrice = hasDiscount && rawDisc !== null ? Math.round(rawDisc * 100) / 100 : salePriceNum

      const newItem: CartItem = {
        variantId: targetVariantId,
        productId: variant.productId || variant.product?.id || '',
        productName: variant.product?.name || variant.productName || 'Ürün',
        brand: variant.product?.brand || variant.brand || '',
        sku: variant.sku || '',
        barcode: variant.barcode || '',
        attributes: attrs,
        unitPrice,
        originalPrice: hasDiscount ? salePriceNum : undefined,
        quantity: 1,
        totalPrice: unitPrice,
      }
      newItems = [...cartItems, newItem]
    }

    const newSubtotal = Math.round(
      newItems.reduce(
        (sum, item) => sum + (Number(item.totalPrice) || (Number(item.unitPrice) * Number(item.quantity)) || 0),
        0
      ) * 100
    ) / 100

    let newDiscount = discountAmount
    let newSurcharge = surchargeAmount

    if (activeCampaign) {
      const camp = computeCampaignAmounts(newSubtotal, activeCampaign)
      newDiscount = camp.discountAmount
      newSurcharge = camp.surchargeAmount
    } else if (customTotal !== null) {
      newDiscount = 0
      newSurcharge = 0
    } else {
      if (newDiscount > newSubtotal) {
        newDiscount = newSubtotal
      }
    }

    set({
      cartItems: newItems,
      customTotal: null,
      discountAmount: Math.round(newDiscount * 100) / 100,
      surchargeAmount: Math.round(newSurcharge * 100) / 100,
    })
  },

  removeFromCart: (variantId) => {
    const { cartItems, activeCampaign, customTotal, discountAmount, surchargeAmount } = get()
    const newItems = cartItems.filter((item) => String(item.variantId) !== String(variantId))

    if (newItems.length === 0) {
      set({
        cartItems: [],
        customTotal: null,
        discountAmount: 0,
        surchargeAmount: 0,
        activeCampaign: null,
      })
      return
    }

    const newSubtotal = Math.round(
      newItems.reduce(
        (sum, item) => sum + (Number(item.totalPrice) || (Number(item.unitPrice) * Number(item.quantity)) || 0),
        0
      ) * 100
    ) / 100

    let newDiscount = discountAmount
    let newSurcharge = surchargeAmount

    if (activeCampaign) {
      const camp = computeCampaignAmounts(newSubtotal, activeCampaign)
      newDiscount = camp.discountAmount
      newSurcharge = camp.surchargeAmount
    } else if (customTotal !== null) {
      newDiscount = 0
      newSurcharge = 0
    } else {
      if (newDiscount > newSubtotal) {
        newDiscount = newSubtotal
      }
    }

    set({
      cartItems: newItems,
      customTotal: null,
      discountAmount: Math.round(newDiscount * 100) / 100,
      surchargeAmount: Math.round(newSurcharge * 100) / 100,
    })
  },

  updateQuantity: (variantId, quantity) => {
    const qty = Math.max(0, parseInt(String(quantity), 10) || 0)
    if (qty <= 0) {
      get().removeFromCart(variantId)
      return
    }

    const { cartItems, activeCampaign, customTotal, discountAmount, surchargeAmount } = get()
    const newItems = cartItems.map((item) => {
      if (String(item.variantId) !== String(variantId)) return item
      const u = Number(item.unitPrice) || 0
      return {
        ...item,
        quantity: qty,
        totalPrice: Math.round(qty * u * 100) / 100,
      }
    })

    const newSubtotal = Math.round(
      newItems.reduce(
        (sum, item) => sum + (Number(item.totalPrice) || (Number(item.unitPrice) * Number(item.quantity)) || 0),
        0
      ) * 100
    ) / 100

    let newDiscount = discountAmount
    let newSurcharge = surchargeAmount

    if (activeCampaign) {
      const camp = computeCampaignAmounts(newSubtotal, activeCampaign)
      newDiscount = camp.discountAmount
      newSurcharge = camp.surchargeAmount
    } else if (customTotal !== null) {
      newDiscount = 0
      newSurcharge = 0
    } else {
      if (newDiscount > newSubtotal) {
        newDiscount = newSubtotal
      }
    }

    set({
      cartItems: newItems,
      customTotal: null,
      discountAmount: Math.round(newDiscount * 100) / 100,
      surchargeAmount: Math.round(newSurcharge * 100) / 100,
    })
  },

  applyDiscount: (amount) => {
    const subtotal = get().getSubtotal()
    const parsed = Math.max(0, Math.round(parsePrice(amount) * 100) / 100)
    set({
      discountAmount: subtotal > 0 ? Math.min(subtotal, parsed) : parsed,
      surchargeAmount: 0,
      activeCampaign: null,
      customTotal: null,
    })
  },

  setCustomTotal: (amount) => {
    if (amount === null) {
      set({ customTotal: null })
      return
    }
    const subtotal = get().getSubtotal()
    const val = Math.max(0, Math.round(parsePrice(amount) * 100) / 100)
    if (val < subtotal) {
      const discount = Math.round((subtotal - val) * 100) / 100
      set({
        customTotal: val,
        discountAmount: discount,
        surchargeAmount: 0,
        activeCampaign: null,
      })
    } else {
      const surcharge = Math.round((val - subtotal) * 100) / 100
      set({
        customTotal: val,
        discountAmount: 0,
        surchargeAmount: surcharge,
        activeCampaign: null,
      })
    }
  },

  applyCampaign: (campaign) => {
    if (!campaign) {
      set({ discountAmount: 0, surchargeAmount: 0, activeCampaign: null, customTotal: null })
      return
    }

    const subtotal = get().getSubtotal()

    if (subtotal <= 0) {
      set({
        discountAmount: 0,
        surchargeAmount: 0,
        activeCampaign: campaign,
        customTotal: null,
      })
      return
    }

    const camp = computeCampaignAmounts(subtotal, campaign)
    set({
      discountAmount: camp.discountAmount,
      surchargeAmount: camp.surchargeAmount,
      activeCampaign: campaign,
      customTotal: null,
    })
  },

  clearCart: () =>
    set({
      cartItems: [],
      discountAmount: 0,
      surchargeAmount: 0,
      activeCampaign: null,
      customTotal: null,
      selectedCustomer: null,
    }),

  getSubtotal: () => {
    const raw = get().cartItems.reduce((sum, item) => {
      const p = Number(item.totalPrice)
      if (!isNaN(p) && p > 0) return sum + p
      const unit = Number(item.unitPrice) || 0
      const qty = Number(item.quantity) || 0
      return sum + unit * qty
    }, 0)
    return Math.round(raw * 100) / 100
  },

  getTotal: () => {
    const { customTotal, discountAmount, surchargeAmount, cartItems } = get()
    if (!cartItems || cartItems.length === 0) return 0
    if (customTotal !== null && !isNaN(customTotal) && customTotal >= 0) {
      return Math.round(customTotal * 100) / 100
    }
    const subtotal = get().getSubtotal()
    const disc = Math.min(subtotal, Math.max(0, Number(discountAmount) || 0))
    const sur = Math.max(0, Number(surchargeAmount) || 0)
    const raw = Math.max(0, subtotal - disc + sur)
    return Math.round(raw * 100) / 100
  },
}))

// Automatically synchronize POS changes to Customer Display when relevant state changes
let prevSyncedState = ''
usePosStore.subscribe((state) => {
  const syncKey = JSON.stringify({
    items: state.cartItems.map((i) => ({ id: i.variantId, q: i.quantity, p: i.totalPrice })),
    discount: state.discountAmount,
    surcharge: state.surchargeAmount,
    customTotal: state.customTotal,
    campaign: state.activeCampaign?.id,
    customer: state.selectedCustomer?.id,
    stockMode: state.isStockOnlyMode,
    store: state.storeName,
    theme: state.customerDisplayTheme,
  })

  if (syncKey === prevSyncedState) return
  prevSyncedState = syncKey

  syncCustomerDisplay({
    status: state.cartItems.length > 0 ? 'cart' : 'idle',
    storeName: state.storeName,
    storeAddress: state.storeAddress,
    storePhone: state.storePhone,
    cashierName: state.cashierName,
    cartItems: state.cartItems,
    subtotal: state.getSubtotal(),
    discountAmount: state.discountAmount,
    surchargeAmount: state.surchargeAmount,
    total: state.getTotal(),
    activeCampaign: state.activeCampaign,
    selectedCustomer: state.selectedCustomer,
    hidePrices: state.isStockOnlyMode,
    theme: state.customerDisplayTheme,
  })
})
