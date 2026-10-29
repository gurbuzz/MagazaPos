import { generateCode128Svg } from './barcode128'
import { generateEscposReceipt, uint8ArrayToBase64 } from './escposReceipt'

export interface ReceiptItem {
  productName: string
  color?: string
  size?: string
  quantity: number
  unitPrice: number
  totalPrice: number
  barcode?: string
}

export interface ReceiptData {
  receiptNo: string
  createdAt?: string | Date
  cashierName?: string
  totalAmount: number
  subtotal?: number
  discountAmount?: number
  surchargeAmount?: number
  paymentMode?: string // 'CASH' | 'CARD' | 'SPLIT' or custom
  givenCash?: number
  changeDue?: number
  cashAmount?: number
  cardAmount?: number
  customer?: {
    firstName?: string
    lastName?: string
    phone?: string
  } | null
  items: ReceiptItem[]
  storeInfo: {
    storeName?: string
    storeAddress?: string
    storePhone?: string
    receiptFooterNote?: string
    vatRate?: number
    receiptPrinter?: string
    receiptPrintMode?: 'ESC_POS' | 'HTML'
  }
  isGiftReceipt?: boolean
}

/**
 * Normalizes different sale shapes (CartItems or DB Sale) into a uniform ReceiptData object.
 */
export function normalizeSaleToReceiptData(
  sale: any,
  storeState: any,
  extra?: {
    cartItems?: any[]
    givenCash?: number
    paymentMode?: string
    cashAmount?: number
    cardAmount?: number
    isGiftReceipt?: boolean
  }
): ReceiptData {
  const rawItems = (sale?.items && sale.items.length > 0) ? sale.items : (extra?.cartItems || storeState.cartItems || [])

  const items: ReceiptItem[] = rawItems.map((it: any) => {
    let color = ''
    let size = ''

    // Handle attributes safely (whether object, stringified JSON, or nested under variant)
    const rawAttrs = it.attributes || it.variant?.attributes
    if (rawAttrs) {
      let parsed = rawAttrs
      if (typeof rawAttrs === 'string') {
        try {
          parsed = JSON.parse(rawAttrs)
        } catch {
          parsed = {}
        }
      }
      color = parsed.color || parsed.renk || ''
      size = parsed.size || parsed.beden || ''
    }

    const productName = it.productName || it.variant?.product?.name || 'Ürün'
    const quantity = Math.max(1, Number(it.quantity) || 1)
    const unitPrice = Number(it.unitPrice) || (Number(it.totalPrice) / quantity) || 0
    const totalPrice = Number(it.totalPrice) || (unitPrice * quantity) || 0

    return {
      productName,
      color,
      size,
      quantity,
      unitPrice,
      totalPrice,
      barcode: it.barcode || it.variant?.barcode || '',
    }
  })

  const totalAmount = Number(sale?.totalAmount ?? storeState.getTotal?.() ?? 0)
  const discountAmount = Number(sale?.discountAmount ?? storeState.discountAmount ?? 0)
  const surchargeAmount = Number(sale?.surchargeAmount ?? storeState.surchargeAmount ?? 0)
  const subtotal = Number(sale?.subtotal ?? storeState.getSubtotal?.() ?? (totalAmount + discountAmount - surchargeAmount))

  const cust = sale?.customer || storeState.selectedCustomer || null

  let paymentMode = extra?.paymentMode || 'CASH'
  let cashAmount = extra?.cashAmount
  let cardAmount = extra?.cardAmount

  if (sale?.paymentType) {
    if (typeof sale.paymentType === 'string') {
      try {
        const pt = JSON.parse(sale.paymentType)
        if (pt.cash > 0 && pt.card > 0) {
          paymentMode = 'SPLIT'
          cashAmount = Number(pt.cash)
          cardAmount = Number(pt.card)
        } else if (pt.card > 0) {
          paymentMode = 'CARD'
        } else {
          paymentMode = 'CASH'
        }
      } catch {
        paymentMode = sale.paymentType
      }
    } else if (typeof sale.paymentType === 'object') {
      const pt = sale.paymentType
      if (pt.cash > 0 && pt.card > 0) {
        paymentMode = 'SPLIT'
        cashAmount = Number(pt.cash)
        cardAmount = Number(pt.card)
      } else if (pt.card > 0) {
        paymentMode = 'CARD'
      } else {
        paymentMode = 'CASH'
      }
    }
  }

  const givenCash = extra?.givenCash !== undefined ? Number(extra.givenCash) : undefined
  const changeDue = (givenCash !== undefined && givenCash >= totalAmount) ? (givenCash - totalAmount) : undefined

  return {
    receiptNo: sale?.receiptNo || 'FIS-0000',
    createdAt: sale?.createdAt || new Date(),
    cashierName: sale?.cashierName || storeState.cashierName || 'Kasiyer 1',
    totalAmount,
    subtotal,
    discountAmount,
    surchargeAmount,
    paymentMode,
    givenCash,
    changeDue,
    cashAmount,
    cardAmount,
    customer: cust ? {
      firstName: cust.firstName || '',
      lastName: cust.lastName || '',
      phone: cust.phone || '',
    } : null,
    items,
    storeInfo: {
      storeName: storeState.storeName || 'JACK & JONES',
      storeAddress: storeState.storeAddress || '',
      storePhone: storeState.storePhone || '',
      receiptFooterNote: storeState.receiptFooterNote || 'Ürün değişimleri fiş ile 14 gün içinde yapılır. Teşekkürler!',
      vatRate: storeState.vatRate ?? 10,
      receiptPrinter: storeState.receiptPrinter || '',
      receiptPrintMode: storeState.receiptPrintMode || 'ESC_POS',
    },
    isGiftReceipt: !!extra?.isGiftReceipt,
  }
}

/**
 * Generates thermal receipt HTML strictly formatted for standard 80mm POS receipt printers.
 */
export function generateReceiptHtml(data: ReceiptData): string {
  const store = data.storeInfo
  const dateStr = data.createdAt
    ? new Date(data.createdAt).toLocaleString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : new Date().toLocaleString('tr-TR')

  const vatRate = store.vatRate ?? 10
  const vatAmount = data.totalAmount > 0
    ? Math.round((data.totalAmount - data.totalAmount / (1 + vatRate / 100)) * 100) / 100
    : 0

  let paymentText = 'Nakit'
  if (data.paymentMode === 'CARD') paymentText = 'Kredi Kartı'
  else if (data.paymentMode === 'SPLIT') {
    paymentText = `Parçalı (Nakit: ${(data.cashAmount || 0).toFixed(2)} TL, Kart: ${(data.cardAmount || 0).toFixed(2)} TL)`
  } else if (data.totalAmount === 0) {
    paymentText = 'Sıfır Fark Değişim'
  }

  const barcodeSvg = generateCode128Svg(data.receiptNo, 36)

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${data.isGiftReceipt ? 'Hediye Değişim Fişi' : 'Fiş'} - ${data.receiptNo}</title>
    <style>
      @page {
        margin: 0;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      body {
        font-family: Arial, Helvetica, sans-serif;
        width: 72mm;
        max-width: 72mm;
        margin: 0 auto;
        padding: 4mm 2mm 8mm 2mm;
        font-size: 11px;
        font-weight: 600;
        line-height: 1.35;
        color: #000000 !important;
        background-color: #ffffff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .center {
        text-align: center;
      }
      .bold {
        font-weight: 900;
      }
      .store-name {
        font-size: 16px;
        font-weight: 900;
        letter-spacing: 0.5px;
        margin-bottom: 3px;
        text-transform: uppercase;
      }
      .store-info {
        font-size: 10px;
        color: #000000 !important;
        margin-bottom: 2px;
      }
      .divider {
        border-top: 1px dashed #000000;
        margin: 6px 0;
      }
      .double-divider {
        border-top: 2px solid #000000;
        margin: 6px 0;
      }
      .row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin: 2px 0;
      }
      .item-row {
        margin: 4px 0;
      }
      .item-name {
        font-weight: 800;
        word-break: break-word;
      }
      .item-desc {
        font-size: 10px;
        color: #000000 !important;
      }
      .total-row {
        font-size: 14px;
        font-weight: 900;
        margin-top: 4px;
      }
      .barcode-box {
        margin-top: 10px;
        text-align: center;
      }
      .barcode-box svg {
        margin: 0 auto;
        max-width: 62mm;
      }
      .barcode-text {
        font-family: monospace;
        font-size: 11px;
        letter-spacing: 2px;
        margin-top: 3px;
        font-weight: 900;
      }
      .footer-note {
        font-size: 10px;
        text-align: center;
        margin-top: 6px;
        line-height: 1.3;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <!-- Store Header -->
    <div class="center">
      <div class="store-name">${store.storeName || 'JACK & JONES'}</div>
      ${store.storeAddress ? `<div class="store-info">${store.storeAddress}</div>` : ''}
      ${store.storePhone ? `<div class="store-info">Tel: ${store.storePhone}</div>` : ''}
      ${
        data.isGiftReceipt
          ? `
      <div style="display: inline-block; margin-top: 6px; padding: 4px 10px; border: 2px solid #000000; font-size: 13px; font-weight: 900; letter-spacing: 0.8px; text-transform: uppercase;">
        🎁 HEDİYE DEĞİŞİM FİŞİ
      </div>
      <div style="font-size: 10px; font-weight: 900; margin-top: 3px; letter-spacing: 0.5px;">( FİYATSIZDIR )</div>
      `
          : ''
      }
    </div>

    <div class="divider"></div>

    <!-- Metadata -->
    <div class="row">
      <span>Fiş No:</span>
      <span class="bold">${data.receiptNo}</span>
    </div>
    <div class="row">
      <span>Tarih:</span>
      <span>${dateStr}</span>
    </div>
    <div class="row">
      <span>Kasiyer:</span>
      <span>${data.cashierName || 'Kasiyer 1'}</span>
    </div>
    ${
      !data.isGiftReceipt && data.customer
        ? `
    <div class="row">
      <span>Müşteri:</span>
      <span class="bold">${data.customer.firstName || ''} ${data.customer.lastName || ''}</span>
    </div>
    ${data.customer.phone ? `<div class="row"><span>Telefon:</span><span>${data.customer.phone}</span></div>` : ''}
    `
        : ''
    }

    <div class="divider"></div>

    <!-- Item List -->
    <div>
      ${data.items
        .map((item) => {
          const attrStr = [item.color, item.size].filter(Boolean).join(' / ')
          if (data.isGiftReceipt) {
            return `
        <div class="item-row">
          <div class="item-name">${item.productName}</div>
          <div class="row item-desc" style="font-size: 11px;">
            <span>${attrStr ? `Beden/Renk: ${attrStr}` : 'Standart'}</span>
            <span class="bold" style="font-size: 11px;">${item.quantity} Adet</span>
          </div>
          ${item.barcode ? `<div class="item-desc" style="font-family: monospace; font-size: 9px; margin-top: 1px;">Barkod: ${item.barcode}</div>` : ''}
        </div>
      `
          }
          return `
        <div class="item-row">
          <div class="item-name">${item.productName}</div>
          <div class="row item-desc">
            <span>${attrStr ? `(${attrStr}) ` : ''}${item.quantity} Ad x ${item.unitPrice.toFixed(2)} TL</span>
            <span class="bold">${item.totalPrice.toFixed(2)} TL</span>
          </div>
        </div>
      `
        })
        .join('')}
    </div>

    ${
      !data.isGiftReceipt
        ? `
    <div class="double-divider"></div>

    <!-- Financial Totals -->
    ${
      (data.discountAmount || 0) > 0
        ? `
    <div class="row">
      <span>İndirim / Mahsup:</span>
      <span class="bold">-${data.discountAmount!.toFixed(2)} TL</span>
    </div>`
        : ''
    }
    ${
      (data.surchargeAmount || 0) > 0
        ? `
    <div class="row">
      <span>Vade / Taksit Farkı:</span>
      <span class="bold">+${data.surchargeAmount!.toFixed(2)} TL</span>
    </div>`
        : ''
    }

    <div class="row total-row">
      <span>GENEL TOPLAM:</span>
      <span>${data.totalAmount.toFixed(2)} TL</span>
    </div>

    <div class="row" style="font-size: 10px; margin-top: 3px;">
      <span>KDV (%${vatRate}) Dahil:</span>
      <span class="bold">${vatAmount.toFixed(2)} TL</span>
    </div>

    <div class="divider"></div>

    <!-- Payment Info -->
    <div class="row">
      <span>Ödeme Şekli:</span>
      <span class="bold">${paymentText}</span>
    </div>
    ${
      data.paymentMode === 'CASH' && data.givenCash && data.givenCash > 0
        ? `
    <div class="row">
      <span>Alınan Nakit:</span>
      <span class="bold">${data.givenCash.toFixed(2)} TL</span>
    </div>
    `
        : ''
    }
    ${
      data.paymentMode === 'CASH' && (data.changeDue ?? 0) > 0
        ? `
    <div class="row" style="font-weight: bold; font-size: 12px; margin-top: 2px;">
      <span>PARA ÜSTÜ:</span>
      <span class="bold">${data.changeDue!.toFixed(2)} TL</span>
    </div>
    `
        : ''
    }
    `
        : `
    <div class="double-divider"></div>

    <!-- Gift Exchange Terms (NO PRICES) -->
    <div class="center" style="margin: 8px 0 6px 0;">
      <div style="font-weight: 900; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">DEĞİŞİM BİLGİLENDİRMESİ</div>
      <div class="footer-note" style="font-size: 10px; line-height: 1.4; text-align: center;">
        Bu hediye değişim fişi ile birlikte ürünlerinizi <strong>30 gün</strong> içerisinde mağazamızdan fiyatsız olarak değiştirebilirsiniz.
        <br/><br/>
        Değişim yapılacak ürünlerin kullanılmamış, yıkanmamış ve etiketlerinin sökülmemiş olması gerekmektedir.
      </div>
    </div>
    `
    }

    <div class="divider"></div>

    <!-- Footer Note / Policy -->
    ${
      !data.isGiftReceipt
        ? `
    <div class="footer-note">
      ${store.receiptFooterNote || 'Ürün değişimleri fiş ile 14 gün içinde yapılır. Teşekkürler!'}
    </div>
    `
        : ''
    }

    <!-- Barcode for Quick Return / Exchange Scanner -->
    <div class="barcode-box">
      ${barcodeSvg}
      <div class="barcode-text">*${data.receiptNo}*</div>
    </div>

    <div class="center" style="font-size: 9px; font-weight: 700; color: #000000 !important; margin-top: 8px;">
      ${data.isGiftReceipt ? '- Fiyatsız Hediye Değişim Fişi / Mali Değeri Yoktur -' : '- Mali Değeri Yoktur / Bilgi Fişidir -'}
    </div>
  </body>
</html>`
}

/**
 * Dispatches receipt printing to Electron thermal printer via ESC/POS (direct raw)
 * or falls back to silent HTML rendering or native browser window.
 */
export async function printReceipt(
  data: ReceiptData,
  modeOverride?: 'ESC_POS' | 'HTML'
): Promise<{ success: boolean; error?: string }> {
  const printer = data.storeInfo.receiptPrinter ? data.storeInfo.receiptPrinter.trim() : undefined
  const mode = modeOverride || data.storeInfo.receiptPrintMode || 'ESC_POS'

  // 1. ESC/POS Direct RAW printing (Bypasses Windows graphics/GDI entirely - 100% compatible with Generic/Text and all thermal receipt printers)
  if (mode === 'ESC_POS' && typeof window !== 'undefined' && window.electron?.printRaw) {
    try {
      const escposBytes = generateEscposReceipt(data)
      const base64 = uint8ArrayToBase64(escposBytes)
      const rawRes = await window.electron.printRaw(printer || undefined, base64)

      if (rawRes?.success) {
        return { success: true }
      }
      console.warn('ESC/POS print failed, falling back to HTML print:', rawRes?.failureReason)
    } catch (err: any) {
      console.error('ESC/POS exception, falling back to HTML:', err)
    }
  }

  // 2. Electron Silent HTML printing
  const html = generateReceiptHtml(data)
  if (typeof window !== 'undefined' && window.electron?.printSilent) {
    try {
      // NOTE: We deliberately do NOT pass customPageSize to receipt printers!
      // Receipt printers are continuous roll printers; passing custom DEVMODE microns causes
      // POS-80/thermal drivers to reject the size and feed blank paper without printing.
      const result = await window.electron.printSilent(
        html,
        printer || undefined,
        undefined, // Continuous roll paper
        true
      )

      if (result && !result.success && result.failureReason) {
        console.warn('Electron silent print failed, attempting browser popup fallback:', result.failureReason)
        return openPrintWindow(html)
      }

      return { success: true }
    } catch (err: any) {
      console.error('Electron printSilent exception, trying popup fallback:', err)
      return openPrintWindow(html)
    }
  }

  // 3. Web browser popup fallback
  return openPrintWindow(html)
}

function openPrintWindow(html: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    try {
      const printWin = window.open('', '_blank', 'width=380,height=650,menubar=no,toolbar=no,location=no,status=no')
      if (!printWin) {
        resolve({
          success: false,
          error: 'Yazdırma penceresi açılamadı. Lütfen tarayıcı pop-up engelleyicisini kapatınız.',
        })
        return
      }

      printWin.document.open()
      printWin.document.write(html)
      printWin.document.close()

      setTimeout(() => {
        try {
          printWin.focus()
          printWin.print()
          setTimeout(() => {
            try {
              printWin.close()
            } catch {}
            resolve({ success: true })
          }, 1500)
        } catch (err: any) {
          resolve({ success: false, error: err.message || 'Yazdırma iletişim kutusu açılamadı.' })
        }
      }, 400)
    } catch (err: any) {
      resolve({ success: false, error: err.message || 'Yazdırma penceresi oluşturulamadı.' })
    }
  })
}
