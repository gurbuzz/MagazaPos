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

    // 6. Test blocking anonymous sale return
    console.log('\n6️⃣ Kayıtsız (Anonim) Müşteri Fiş İade Engeli Testi...')
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

    // Try returning anonymous sale
    const anonReturnRes = await fetch(`${BASE_URL}/api/sales/${anonSale.id}/return`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ saleItemId: anonSale.items[0].id, returnQuantity: 1 }] })
    })

    if (!anonReturnRes.ok) {
      const err = await anonReturnRes.json()
      console.log(`   🛡️ GÜVENLİK ENGELİ ÇALIŞTI: ${err.error}`)
      console.log('   🎉 DOĞRULAMA BAŞARILI: Kayıtsız müşterilerin iadesi başarıyla engellendi!')
    } else {
      throw new Error('❌ HATA: Kayıtsız müşterinin iadesi engellenmedi!')
    }

    console.log('\n====================================================')
    console.log('✨ MÜŞTERİ İADE MODÜLÜ TÜM TESTLERİ BAŞARIYLA TAMAMLANDI!')
    console.log('====================================================\n')
  } catch (err: any) {
    console.error('❌ İade testi hatası:', err.message)
  }
}

runReturnTests()
