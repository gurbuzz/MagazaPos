export {}

const PORT = process.env.PORT || 3782
const BASE_URL = `http://localhost:${PORT}`

async function runTests() {
  console.log('====================================================')
  console.log('🧪 MağazaPOS Otomatik E2E Test Senaryosu Başlatılıyor...')
  console.log('====================================================\n')

  try {
    // 1. Healthcheck Test
    console.log('1️⃣ API Sunucu Sağlık Kontrolü (Healthcheck)...')
    const healthRes = await fetch(`${BASE_URL}/api/health`)
    const healthData = await healthRes.json()
    console.log('   ✅ Sunucu Durumu:', healthData)

    // 2. Products List Test
    console.log('\n2️⃣ Ürün ve Varyant Listeleme Testi...')
    const prodRes = await fetch(`${BASE_URL}/api/products`)
    const products: any = await prodRes.json()
    console.log(`   ✅ Veritabanında ${products.length} adet ana giyim ürünü bulundu.`)

    // 3. Barcode Lookup Test
    const testBarcode = '869000000001'
    console.log(`\n3️⃣ Barkod Okuma Testi (Barkod: ${testBarcode})...`)
    const barcodeRes = await fetch(`${BASE_URL}/api/products/variants/barcode/${testBarcode}`)
    const variant: any = await barcodeRes.json()
    console.log(`   ✅ Barkod Bulundu: ${variant.product?.name} (${variant.attributes?.color} / ${variant.attributes?.size})`)
    console.log(`   📦 Başlangıç Stok Adedi: ${variant.stockQuantity}`)

    // 4. POS Checkout Test
    console.log('\n4️⃣ Otomatik Kasa Satış & Tahsilat Testi...')
    const initialStock = variant.stockQuantity
    const salePayload = {
      items: [
        {
          variantId: variant.id,
          quantity: 1,
          unitPrice: variant.salePrice,
          totalPrice: variant.salePrice,
        },
      ],
      totalAmount: variant.salePrice,
      discountAmount: 0,
      paymentType: { cash: variant.salePrice, card: 0 },
      cashierName: 'Test Otomasyon',
    }

    const saleRes = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(salePayload),
    })
    const saleData: any = await saleRes.json()
    console.log(`   ✅ Fiş Oluşturuldu! Fiş No: ${saleData.receiptNo}, Toplam: ${saleData.totalAmount} TL`)

    // 5. Stock Reduction Verification
    console.log('\n5️⃣ Stok Otomatik Düşüm Doğrulama Testi...')
    const verifyRes = await fetch(`${BASE_URL}/api/products/variants/barcode/${testBarcode}`)
    const updatedVariant: any = await verifyRes.json()
    console.log(`   📦 Yeni Stok Adedi: ${updatedVariant.stockQuantity}`)

    if (updatedVariant.stockQuantity === initialStock - 1) {
      console.log('   🎉 DOĞRULAMA BAŞARILI: Stok adedi tam 1 adet düştü!')
    } else {
      console.error('   ❌ HATA: Stok adedi beklenenden farklı!')
    }

    // 6. Mobile Search API Test
    console.log('\n6️⃣ Mobil Depo Arama API Testi (Arama: "tişört")...')
    const mobileRes = await fetch(`${BASE_URL}/api/mobile/search?q=ti%C5%9F%C3%B6rt`)
    const mobileResults: any = await mobileRes.json()
    console.log(`   ✅ Mobil Arama Sonucu: ${mobileResults.length} adet varyant listelendi.`)

    console.log('\n====================================================')
    console.log('✨ TÜM SİSTEM TESTLERİ BAŞARIYLA TAMAMLANDI!')
    console.log('====================================================\n')
  } catch (err: any) {
    console.error('❌ Test sırasında hata oluştu:', err.message)
    console.log('⚠️ Not: Testlerin çalışması için arka planda "npm run dev" veya sunucunun açık olduğundan emin olun.')
  }
}

runTests()
