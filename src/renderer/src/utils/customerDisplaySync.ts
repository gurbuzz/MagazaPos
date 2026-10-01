export interface CustomerDisplayPayload {
  status: 'idle' | 'cart' | 'checkout' | 'completed'
  storeName: string
  storeAddress?: string
  storePhone?: string
  cashierName?: string
  cartItems: any[]
  subtotal: number
  discountAmount: number
  total: number
  activeCampaign?: any
  selectedCustomer?: any
  paymentInfo?: {
    mode: 'CASH' | 'CARD' | 'SPLIT' | string
    givenCash?: number
    changeDue?: number
    receiptNo?: string
    isFinished?: boolean
  } | null
  lastItemAdded?: any
  updatedAt?: string
}

let broadcastChannel: BroadcastChannel | null = null

try {
  if (typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel('pos_customer_display')
  }
} catch (e) {
  console.warn('BroadcastChannel not supported:', e)
}

/**
 * Broadcasts customer display updates simultaneously via Electron IPC, BroadcastChannel, and Express API.
 */
export function syncCustomerDisplay(payload: Partial<CustomerDisplayPayload>) {
  const fullPayload: CustomerDisplayPayload = {
    status: payload.status || (payload.cartItems && payload.cartItems.length > 0 ? 'cart' : 'idle'),
    storeName: payload.storeName || localStorage.getItem('pos_store_name') || 'JACK & JONES',
    storeAddress: payload.storeAddress || localStorage.getItem('pos_store_address') || '',
    storePhone: payload.storePhone || localStorage.getItem('pos_store_phone') || '',
    cashierName: payload.cashierName || localStorage.getItem('pos_cashier_name') || 'Kasiyer 1',
    cartItems: payload.cartItems || [],
    subtotal: payload.subtotal ?? 0,
    discountAmount: payload.discountAmount ?? 0,
    total: payload.total ?? 0,
    activeCampaign: payload.activeCampaign || null,
    selectedCustomer: payload.selectedCustomer || null,
    paymentInfo: payload.paymentInfo || null,
    lastItemAdded: payload.lastItemAdded || null,
    updatedAt: new Date().toISOString(),
  }

  // 1. Electron IPC (Native dual-screen window)
  if (window.electron?.updateCustomerDisplay) {
    window.electron.updateCustomerDisplay(fullPayload).catch((e) => {
      console.warn('[CustomerDisplay] Electron IPC error:', e)
    })
  }

  // 2. BroadcastChannel (Same-origin tab/window sync)
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(fullPayload)
    } catch (e) {
      console.warn('[CustomerDisplay] BroadcastChannel error:', e)
    }
  }

  // 3. LocalStorage backup
  try {
    localStorage.setItem('pos_customer_display_state', JSON.stringify(fullPayload))
  } catch {}

  // 4. Express API (For wireless tablet / remote customer screens)
  try {
    fetch('/api/customer-display/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullPayload),
    }).catch(() => {
      // Silently fail if offline or dev server reload
    })
  } catch {}
}

/**
 * Helper to subscribe to customer display updates in the display component.
 */
export function subscribeCustomerDisplay(callback: (data: CustomerDisplayPayload) => void): () => void {
  const cleanupFns: Array<() => void> = []

  // 1. Listen via Electron IPC
  if (window.electron?.onCustomerDisplayUpdate) {
    const unsubIpc = window.electron.onCustomerDisplayUpdate((data) => {
      if (data) callback(data)
    })
    cleanupFns.push(unsubIpc)
  }

  // 2. Listen via BroadcastChannel
  if (broadcastChannel) {
    const handleBc = (event: MessageEvent) => {
      if (event.data) callback(event.data)
    }
    broadcastChannel.addEventListener('message', handleBc)
    cleanupFns.push(() => {
      broadcastChannel?.removeEventListener('message', handleBc)
    })
  }

  // 3. Listen via Storage event
  const handleStorage = (event: StorageEvent) => {
    if (event.key === 'pos_customer_display_state' && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue)
        callback(parsed)
      } catch {}
    }
  }
  window.addEventListener('storage', handleStorage)
  cleanupFns.push(() => window.removeEventListener('storage', handleStorage))

  // 4. Listen via Server-Sent Events (SSE)
  try {
    const eventSource = new EventSource('/api/customer-display/events')
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data) callback(data)
      } catch {}
    }
    cleanupFns.push(() => eventSource.close())
  } catch {}

  // 5. Initial state load
  if (window.electron?.getCustomerDisplayState) {
    window.electron.getCustomerDisplayState().then((state) => {
      if (state) callback(state)
    })
  } else {
    // Try localStorage or API
    try {
      const saved = localStorage.getItem('pos_customer_display_state')
      if (saved) {
        callback(JSON.parse(saved))
      }
    } catch {}

    fetch('/api/customer-display/state')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.updatedAt) callback(data)
      })
      .catch(() => {})
  }

  return () => {
    cleanupFns.forEach((fn) => fn())
  }
}
