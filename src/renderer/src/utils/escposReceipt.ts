import { ReceiptData } from './printReceipt'

/**
 * Normalizes Turkish characters to ASCII safe equivalents for thermal POS printers.
 * Many thermal printer firmwares do not have UTF-8 or CP857 code pages installed,
 * causing garbled characters or blank feeds. Clean ASCII guarantees 100% legibility.
 */
export function cleanTurkish(str: string): string {
  if (!str) return ''
  return String(str)
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 'S')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .replace(/[^\x20-\x7E\r\n]/g, '')
}

/**
 * Formats a two-column line with left-aligned label and right-aligned value.
 */
export function formatTwoCols(left: string, right: string, width = 42): string {
  const l = cleanTurkish(left)
  const r = cleanTurkish(right)
  const spaceCount = width - l.length - r.length
  if (spaceCount <= 0) {
    return `${l}\n${' '.repeat(Math.max(0, width - r.length))}${r}\n`
  }
  return `${l}${' '.repeat(spaceCount)}${r}\n`
}

/**
 * Centers text within the specified line width.
 */
export function formatCenterText(text: string, width = 42): string {
  const clean = cleanTurkish(text)
  if (clean.length >= width) return clean + '\n'
  const leftPad = Math.floor((width - clean.length) / 2)
  return ' '.repeat(leftPad) + clean + '\n'
}

/**
 * Builds standard ESC/POS binary command buffer for 80mm thermal receipt printers.
 * Returns Uint8Array that can be dispatched directly to Windows spooler via RAW printing.
 */
export function generateEscposReceipt(data: ReceiptData, openDrawer = false): Uint8Array {
  const bytes: number[] = []

  const pushBytes = (...arr: number[]) => {
    bytes.push(...arr)
  }

  const pushText = (str: string) => {
    const clean = cleanTurkish(str)
    for (let i = 0; i < clean.length; i++) {
      bytes.push(clean.charCodeAt(i) & 0xff)
    }
  }

  const pushLine = (str: string = '') => {
    pushText(str + '\n')
  }

  // 1. Initialize Printer (ESC @)
  pushBytes(0x1b, 0x40)

  // 2. Select Code Page 0 (PC437 Standard ASCII)
  pushBytes(0x1b, 0x74, 0x00)

  // 3. Optional Cash Drawer Kick (ESC p 0 25 250)
  if (openDrawer) {
    pushBytes(0x1b, 0x70, 0x00, 0x19, 0xfa)
  }

  const width = 42
  const store = data.storeInfo

  // --- HEADER (CENTERED) ---
  pushBytes(0x1b, 0x61, 0x01) // Align Center

  // Store Name: Double Height & Double Width (GS ! 0x11) + Bold (ESC E 1)
  pushBytes(0x1d, 0x21, 0x11, 0x1b, 0x45, 0x01)
  pushLine(store.storeName || 'JACK & JONES')

  // Reset to Normal text (GS ! 0x00, ESC E 0)
  pushBytes(0x1d, 0x21, 0x00, 0x1b, 0x45, 0x00)

  if (store.storeAddress) {
    pushLine(store.storeAddress)
  }
  if (store.storePhone) {
    pushLine(`Tel: ${store.storePhone}`)
  }

  if (data.isGiftReceipt) {
    pushLine('')
    pushBytes(0x1b, 0x45, 0x01) // Bold on
    pushLine(formatCenterText('*** HEDIYE DEGISIM FISI ***', width))
    pushLine(formatCenterText('(FIYATSIZ)', width))
    pushBytes(0x1b, 0x45, 0x00) // Bold off
  }

  pushLine('='.repeat(width))

  // --- METADATA (LEFT ALIGNED) ---
  pushBytes(0x1b, 0x61, 0x00) // Align Left

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

  pushText(formatTwoCols('Fis No  : ' + data.receiptNo, '', width))
  pushText(formatTwoCols('Tarih   : ' + dateStr, '', width))
  pushText(formatTwoCols('Kasiyer : ' + (data.cashierName || 'Kasiyer 1'), '', width))

  if (!data.isGiftReceipt && data.customer) {
    const custName = `${data.customer.firstName || ''} ${data.customer.lastName || ''}`.trim()
    if (custName) {
      pushText(formatTwoCols('Musteri : ' + custName, '', width))
    }
    if (data.customer.phone) {
      pushText(formatTwoCols('Telefon : ' + data.customer.phone, '', width))
    }
  }

  pushLine('-'.repeat(width))

  // --- ITEMS TABLE ---
  if (data.isGiftReceipt) {
    pushText(formatTwoCols('URUN BILGISI', 'ADET', width))
    pushLine('-'.repeat(width))

    for (const item of data.items) {
      pushBytes(0x1b, 0x45, 0x01) // Bold on
      pushLine(item.productName)
      pushBytes(0x1b, 0x45, 0x00) // Bold off

      const attrStr = [item.color, item.size].filter(Boolean).join(' / ')
      const leftDesc = `  ${attrStr ? `(${attrStr})` : 'Standart'}`
      const rightQty = `${item.quantity} Adet`
      pushText(formatTwoCols(leftDesc, rightQty, width))
      if (item.barcode) {
        pushLine(`  Barkod: ${item.barcode}`)
      }
    }
  } else {
    pushText(formatTwoCols('URUN BILGISI', 'TUTAR', width))
    pushLine('-'.repeat(width))

    for (const item of data.items) {
      // Product Name (Bold)
      pushBytes(0x1b, 0x45, 0x01) // Bold on
      pushLine(item.productName)
      pushBytes(0x1b, 0x45, 0x00) // Bold off

      const attrStr = [item.color, item.size].filter(Boolean).join(' / ')
      const leftDesc = `  ${attrStr ? `(${attrStr}) ` : ''}${item.quantity} Ad x ${item.unitPrice.toFixed(2)} TL`
      const rightPrice = `${item.totalPrice.toFixed(2)} TL`
      pushText(formatTwoCols(leftDesc, rightPrice, width))
    }
  }

  // --- FINANCIAL TOTALS / TERMS ---
  if (data.isGiftReceipt) {
    pushLine('='.repeat(width))
    pushBytes(0x1b, 0x61, 0x01) // Align Center
    pushBytes(0x1b, 0x45, 0x01) // Bold on
    pushLine('DEGISIM KOSULLARI')
    pushBytes(0x1b, 0x45, 0x00) // Bold off
    pushLine('Bu hediye degisim fisi ile')
    pushLine('urunlerinizi 30 gun icinde')
    pushLine('magazamizdan degistirebilirsiniz.')
    pushLine('Urunlerin kullanilmamis ve')
    pushLine('etiketli olmasi gerekmektedir.')
    pushLine('-'.repeat(width))
  } else {
    pushLine('='.repeat(width))

    if ((data.discountAmount || 0) > 0) {
      pushText(formatTwoCols('Indirim / Mahsup:', `-${data.discountAmount!.toFixed(2)} TL`, width))
    }
    if ((data.surchargeAmount || 0) > 0) {
      pushText(formatTwoCols('Vade / Taksit Farki:', `+${data.surchargeAmount!.toFixed(2)} TL`, width))
    }

    // GENEL TOPLAM: Double Height (GS ! 0x01) + Bold
    pushBytes(0x1d, 0x21, 0x01, 0x1b, 0x45, 0x01)
    pushText(formatTwoCols('GENEL TOPLAM:', `${data.totalAmount.toFixed(2)} TL`, width))
    pushBytes(0x1d, 0x21, 0x00, 0x1b, 0x45, 0x00) // Normal

    const vatRate = store.vatRate ?? 10
    const vatAmount = data.totalAmount > 0
      ? Math.round((data.totalAmount - data.totalAmount / (1 + vatRate / 100)) * 100) / 100
      : 0
    pushText(formatTwoCols(`KDV (%${vatRate}) Dahil:`, `${vatAmount.toFixed(2)} TL`, width))

    pushLine('-'.repeat(width))

    // --- PAYMENT DETAILS ---
    let paymentText = 'Nakit'
    if (data.paymentMode === 'CARD') paymentText = 'Kredi Karti'
    else if (data.paymentMode === 'SPLIT') {
      paymentText = `Parcali (Nakit: ${(data.cashAmount || 0).toFixed(2)}, Kart: ${(data.cardAmount || 0).toFixed(2)})`
    } else if (data.totalAmount === 0) {
      paymentText = 'Sifir Fark Degisim'
    }

    pushText(formatTwoCols('Odeme Sekli:', paymentText, width))

    if (data.paymentMode === 'CASH' && data.givenCash && data.givenCash > 0) {
      pushText(formatTwoCols('Alinan Nakit:', `${data.givenCash.toFixed(2)} TL`, width))
    }
    if (data.paymentMode === 'CASH' && (data.changeDue ?? 0) > 0) {
      pushBytes(0x1b, 0x45, 0x01)
      pushText(formatTwoCols('PARA USTU:', `${data.changeDue!.toFixed(2)} TL`, width))
      pushBytes(0x1b, 0x45, 0x00)
    }

    pushLine('-'.repeat(width))

    // --- FOOTER & POLICY ---
    pushBytes(0x1b, 0x61, 0x01) // Align Center
    const footerNote = store.receiptFooterNote || 'Urun degisimleri fis ile 14 gun icinde yapilir. Tesekkurler!'
    pushLine(footerNote)
    pushLine('')
  }

  // --- BARCODE (CODE 128) ---
  const rawBarcode = String(data.receiptNo || '').trim()
  if (rawBarcode) {
    try {
      // Barcode Height 60 dots (GS h 60)
      pushBytes(0x1d, 0x68, 60)
      // Barcode Width (GS w 2)
      pushBytes(0x1d, 0x77, 2)
      // HRI font below barcode (GS H 2)
      pushBytes(0x1d, 0x48, 2)
      // Barcode Code 128 (GS k 73 len '{B' data)
      const code128Data = '{B' + rawBarcode
      pushBytes(0x1d, 0x6b, 73, code128Data.length)
      for (let i = 0; i < code128Data.length; i++) {
        pushBytes(code128Data.charCodeAt(i) & 0xff)
      }
      pushLine('')
    } catch {
      pushLine(`*${rawBarcode}*`)
    }
  }

  if (data.isGiftReceipt) {
    pushLine('- Fiyatsiz Hediye Degisim Fisidir -')
    pushLine('- Mali Degeri Yoktur -')
  } else {
    pushLine('- Mali Degeri Yoktur / Bilgi Fisidir -')
  }

  // --- FEED & PAPER CUT ---
  // Feed 4 lines
  pushBytes(0x0a, 0x0a, 0x0a, 0x0a)
  // Partial cut with feed (GS V 66 0)
  pushBytes(0x1d, 0x56, 0x42, 0x00)

  return new Uint8Array(bytes)
}

/**
 * Converts Uint8Array binary to Base64 string for IPC transmission.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
