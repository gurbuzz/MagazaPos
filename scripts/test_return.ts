export {}

const PORT = process.env.PORT || 3782
const BASE_URL = `http://localhost:${PORT}`

async function runReturnTests() {
  console.log('====================================================')
  console.log('🧪 Kayıtlı Müşteri İade & Stok İade Otomasyon Testi...')
  console.log('====================================================\n')

  try {
    // 1. Create a registered customer
    const timestamp = Date.now().toString().slice(-6)
    const customerPayload = {
      firstName: 'Canan',
      lastName: 'Öztürk',
      phone: `0544${timestamp}`,
      city: 'İzmir',
      district: 'Karşıyaka',
      notes: 'İade Test Müşterisi'
    }

    console.log('1️⃣ Test Müşterisi Oluşturuluyor...')
    const custRes = await fetch(`${BASE_URL}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customerPayload)
    })
    const customer: any = await custRes.json()
    console.log(`   ✅ Müşteri Oluşturuldu: ${customer.firstName} ${customer.lastName} (ID: ${customer.id})`)

    // 2. Fetch a variant for sale
    const prodRes = await fetch(`${BASE_URL}/api/products`)
    const products: any = await prodRes.json()
    const variant = products[0]?.variants[0]
    if (!variant) throw new Error('Test için ürün varyantı bulunamadı.')

    const initialStock = variant.stockQuantity
    console.log(`\n2️⃣ Varyant Başlangıç Stoğu: ${initialStock} ad (${variant.product?.name})`)

    // 3. Perform a sale of 3 units for this customer
    console.log('\n3️⃣ Müşteriye 3 Adet Ürün Satışı Yapılıyor...')
    const salePayload = {
      items: [
        {
          variantId: variant.id,
          quantity: 3,
          unitPrice: variant.salePrice,
          totalPrice: variant.salePrice * 3
        }
      ],
      totalAmount: variant.salePrice * 3,
      discountAmount: 0,
      paymentType: { cash: variant.salePrice * 3, card: 0 },
      cashierName: 'İade Test Kasiyer',
      customerId: customer.id
    }

    const saleRes = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(salePayload)
    })
    const saleData: any = await saleRes.json()
    console.log(`   ✅ Satış Fişi Oluşturuldu: ${saleData.receiptNo}`)

    // Check stock after sale
    const postSaleVariantRes = await fetch(`${BASE_URL}/api/products/variants/barcode/${variant.barcode}`)
    const postSaleVariant: any = await postSaleVariantRes.json()
    console.log(`   📦 Satış Sonrası Stok: ${postSaleVariant.stockQuantity} ad (Beklenen: ${initialStock - 3})`)

    // 4. Return 2 units from this sale
    console.log('\n4️⃣ Satılan 3 Adet Ürünün 2 Adedi İade Ediliyor (POST /api/sales/:id/return)...')
    const saleItemId = saleData.items[0].id
    const returnRes = await fetch(`${BASE_URL}/api/sales/${saleData.id}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ saleItemId, returnQuantity: 2 }],
        reason: 'Beden büyük geldi'
      })
    })

    if (!returnRes.ok) {
      const err = await returnRes.json()
      throw new Error(`İade gerçekleştirilemedi: ${err.error}`)
    }

    const returnedSale: any = await returnRes.json()
    console.log(`   ✅ İade İşlemi Başarılı! Fiş Durumu: ${returnedSale.status}`)

    // 5. Verify stock re-entry
    console.log('\n5️⃣ Stok İade Kontrolü (İade edilen 2 adet stoğa geri eklendi mi?)...')
    const postReturnVariantRes = await fetch(`${BASE_URL}/api/products/variants/barcode/${variant.barcode}`)
    const postReturnVariant: any = await postReturnVariantRes.json()
    console.log(`   📦 İade Sonrası Yeni Stok: ${postReturnVariant.stockQuantity} ad`)

    if (postReturnVariant.stockQuantity === postSaleVariant.stockQuantity + 2) {
      console.log('   🎉 DOĞRULAMA BAŞARILI: İade edilen 2 adet ürün stoğa TAM ZAMANINDA VE EKSİKSİZ eklendi!')
    } else {
      throw new Error('❌ HATA: Stok iade miktarı eşleşmiyor!')
    }

    // 6. Test anonymous sale return (feature supported with optional customer details)
    console.log('\n6️⃣ Kayıtsız (Anonim) Müşteri Fiş İadesi Testi...')
    const preAnonVariantRes = await fetch(`${BASE_URL}/api/products/variants/barcode/${variant.barcode}`)
    const preAnonVariant: any = await preAnonVariantRes.json()
    const preAnonStock = preAnonVariant.stockQuantity

    const anonSalePayload = {
      items: [{ variantId: variant.id, quantity: 1, unitPrice: variant.salePrice, totalPrice: variant.salePrice }],
      totalAmount: variant.salePrice,
      discountAmount: 0,
      paymentType: { cash: variant.salePrice, card: 0 },
      cashierName: 'Kasiyer Test',
      customerId: null // Anonymous
    }
    const anonSaleRes = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(anonSalePayload)
    })
    const anonSale: any = await anonSaleRes.json()

    // Try returning anonymous sale with customer name and reason
    const anonReturnRes = await fetch(`${BASE_URL}/api/sales/${anonSale.id}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ saleItemId: anonSale.items[0].id, returnQuantity: 1 }],
        customerName: 'Anonim Müşteri Test',
        phone: '05001112233',
        reason: 'Hediye beğenilmedi'
      })
    })

    if (anonReturnRes.ok) {
      const returnedAnon: any = await anonReturnRes.json()
      console.log(`   ✅ Kayıtsız müşteri iadesi başarıyla gerçekleşti! Fiş: ${returnedAnon.receiptNo}, Durum: ${returnedAnon.status}`)

      // Verify stock returned to pre-sale level
      const postAnonVariantRes = await fetch(`${BASE_URL}/api/products/variants/barcode/${variant.barcode}`)
      const postAnonVariant: any = await postAnonVariantRes.json()
      if (postAnonVariant.stockQuantity === preAnonStock) {
        console.log('   🎉 DOĞRULAMA BAŞARILI: Kayıtsız müşteri iadesinde ürün stoğa eksiksiz geri girdi!')
      } else {
        throw new Error('❌ HATA: Kayıtsız müşteri iadesi sonrası stok eşleşmedi!')
      }
    } else {
      const err = await anonReturnRes.json()
      throw new Error(`❌ HATA: Kayıtsız müşteri iadesi gerçekleştirilemedi: ${err.error}`)
    }

    console.log('\n====================================================')
    console.log('✨ MÜŞTERİ İADE MODÜLÜ TÜM TESTLERİ BAŞARIYLA TAMAMLANDI!')
    console.log('====================================================\n')
  } catch (err: any) {
    console.error('❌ İade testi hatası:', err.message)
  }
}

runReturnTests()
