import { create } from 'zustand'

export interface CartItem {
  variantId: string
  productId: string
  productName: string
  brand: string
  sku: string
  barcode: string
  attributes: { color?: string; size?: string }
  unitPrice: number
  quantity: number
  totalPrice: number
}

export interface Campaign {
  id: string
  name: string
  type: 'PERCENTAGE' | 'FIXED'
  value: number // e.g. 10 for 10%, 50 for 50 TL
  badgeColor?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple'
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
  customIp: string

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
    customIp?: string
  }) => void

  cartItems: CartItem[]
  selectedCustomer: Customer | null
  setSelectedCustomer: (customer: Customer | null) => void
  clearSelectedCustomer: () => void

  discountAmount: number
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
  { id: 'c1', name: '%10 Genel İndirim', type: 'PERCENTAGE', value: 10, badgeColor: 'amber' },
  { id: 'c2', name: '%20 Sezon Sonu', type: 'PERCENTAGE', value: 20, badgeColor: 'rose' },
  { id: 'c3', name: '-50 ₺ Nakit İndirimi', type: 'FIXED', value: 50, badgeColor: 'emerald' },
  { id: 'c4', name: '-100 ₺ Hoşgeldin Kuponu', type: 'FIXED', value: 100, badgeColor: 'indigo' },
  { id: 'c5', name: '%15 VIP Müşteri İndirimi', type: 'PERCENTAGE', value: 15, badgeColor: 'purple' },
]

export const usePosStore = create<PosState>((set, get) => ({
  activeTab: 'pos',
  setActiveTab: (tab) => set({ activeTab: tab }),

  // Default security & system settings
  isLocked: true, // App starts locked on launch!
  pinCode: localStorage.getItem('pos_pin_code') || '1234',
  storeName: localStorage.getItem('pos_store_name') || 'MağazaPOS Giyim',
  storeAddress: localStorage.getItem('pos_store_address') || 'Atatürk Cad. No:14/A Kadıköy / İstanbul',
  storePhone: localStorage.getItem('pos_store_phone') || '0216 345 67 89',
  cashierName: localStorage.getItem('pos_cashier_name') || 'Kasiyer 1',
  receiptPrefix: localStorage.getItem('pos_receipt_prefix') || 'FIS-',
  receiptFooterNote: localStorage.getItem('pos_receipt_footer') || 'Ürün değişimleri fiş ile 14 gün içinde yapılır. Teşekkürler!',
  vatRate: parseFloat(localStorage.getItem('pos_vat_rate') || '10'),
  lowStockThreshold: parseInt(localStorage.getItem('pos_low_stock') || '5', 10),
  autoPrintReceipt: localStorage.getItem('pos_auto_print') === 'true',
  customIp: localStorage.getItem('pos_custom_ip') || '',

  unlockApp: (enteredPin) => {
    const currentPin = get().pinCode
    if (enteredPin === currentPin) {
      set({ isLocked: false })
      return true
    }
    return false
  },

  lockApp: () => set({ isLocked: true }),

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
    if (settings.customIp !== undefined) localStorage.setItem('pos_custom_ip', settings.customIp)

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
      customIp: settings.customIp ?? state.customIp,
    }))
  },

  cartItems: [],
  selectedCustomer: null,
  setSelectedCustomer: (customer) => set({ selectedCustomer: customer }),
  clearSelectedCustomer: () => set({ selectedCustomer: null }),

  discountAmount: 0,
  customTotal: null,
  activeCampaign: null,
  localIp: '127.0.0.1',
  setLocalIp: (ip) => set({ localIp: ip }),

  campaigns: DEFAULT_CAMPAIGNS,

  addCampaign: (newCamp) => {
    const campaignWithId: Campaign = {
      ...newCamp,
      id: `camp_${Date.now()}`,
    }
    set((state) => ({ campaigns: [...state.campaigns, campaignWithId] }))
  },

  deleteCampaign: (id) => {
    set((state) => ({
      campaigns: state.campaigns.filter((c) => c.id !== id),
      activeCampaign: state.activeCampaign?.id === id ? null : state.activeCampaign,
    }))
  },

  addToCart: (variant) => {
    const { cartItems } = get()
    const existingIndex = cartItems.findIndex((item) => item.variantId === variant.id)
    let newItems: CartItem[]

    if (existingIndex > -1) {
      newItems = [...cartItems]
      const item = newItems[existingIndex]
      item.quantity += 1
      item.totalPrice = item.quantity * item.unitPrice
    } else {
      const newItem: CartItem = {
        variantId: variant.id,
        productId: variant.productId || variant.product?.id,
        productName: variant.product?.name || 'Ürün',
        brand: variant.product?.brand || '',
        sku: variant.sku,
        barcode: variant.barcode,
        attributes: variant.attributes || {},
        unitPrice: variant.salePrice,
        quantity: 1,
        totalPrice: variant.salePrice,
      }
      newItems = [...cartItems, newItem]
    }

    set({ cartItems: newItems, customTotal: null })

    const { activeCampaign } = get()
    if (activeCampaign) {
      get().applyCampaign(activeCampaign)
    }
  },

  removeFromCart: (variantId) => {
    const newItems = get().cartItems.filter((item) => item.variantId !== variantId)
    set({ cartItems: newItems, customTotal: null })

    const { activeCampaign } = get()
    if (activeCampaign) {
      get().applyCampaign(activeCampaign)
    }
  },

  updateQuantity: (variantId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(variantId)
      return
    }

    const newItems = get().cartItems.map((item) =>
      item.variantId === variantId
        ? { ...item, quantity, totalPrice: quantity * item.unitPrice }
        : item
    )
    set({ cartItems: newItems, customTotal: null })

    const { activeCampaign } = get()
    if (activeCampaign) {
      get().applyCampaign(activeCampaign)
    }
  },

  applyDiscount: (amount) => set({ discountAmount: Math.max(0, amount), activeCampaign: null, customTotal: null }),

  setCustomTotal: (amount) => {
    if (amount === null) {
      set({ customTotal: null })
      return
    }
    const subtotal = get().getSubtotal()
    const val = Math.max(0, amount)
    const discount = subtotal > val ? subtotal - val : 0
    set({
      customTotal: val,
      discountAmount: discount,
      activeCampaign: null,
    })
  },

  applyCampaign: (campaign) => {
    if (!campaign) {
      set({ discountAmount: 0, activeCampaign: null, customTotal: null })
      return
    }

    const subtotal = get().getSubtotal()
    let discount = 0

    if (campaign.type === 'PERCENTAGE') {
      discount = (subtotal * campaign.value) / 100
    } else {
      discount = campaign.value
    }

    set({
      discountAmount: Math.min(subtotal, Math.max(0, discount)),
      activeCampaign: campaign,
      customTotal: null,
    })
  },

  clearCart: () => set({ cartItems: [], discountAmount: 0, activeCampaign: null, customTotal: null, selectedCustomer: null }),

  getSubtotal: () => {
    return get().cartItems.reduce((sum, item) => sum + item.totalPrice, 0)
  },

  getTotal: () => {
    const { customTotal, discountAmount } = get()
    if (customTotal !== null) {
      return customTotal
    }
    const subtotal = get().getSubtotal()
    return Math.max(0, subtotal - discountAmount)
  },
}))
