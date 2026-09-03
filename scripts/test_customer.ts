export {}

const PORT = process.env.PORT || 3782
const BASE_URL = `http://localhost:${PORT}`

async function runCustomerTests() {
  console.log('====================================================')
  console.log('🧪 Müşteri Modülü API Uçtan Uca Test Senaryosu...')
  console.log('====================================================\n')

  try {
    // 1. Create a test customer with unique phone
    const timestamp = Date.now().toString().slice(-6)
    const testCustomerPayload = {
      firstName: 'Mehmet',
      lastName: 'Kaya',
      phone: `0555${timestamp}`,
      city: 'İstanbul',
      district: 'Kadıköy',
      notes: 'Test Otomasyon Müşterisi'
    }

    console.log('1️⃣ Müşteri Kaydı Oluşturma (POST /api/customers)...')
    const createRes = await fetch(`${BASE_URL}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCustomerPayload)
    })

    if (!createRes.ok) {
      const err = await createRes.json()
      throw new Error(`Müşteri eklenemedi: ${err.error}`)
    }

    const createdCustomer: any = await createRes.json()
    console.log(`   ✅ Müşteri Oluşturuldu: ID=${createdCustomer.id}, Ad Soyad=${createdCustomer.firstName} ${createdCustomer.lastName}, Telefon=${createdCustomer.phone}`)

    // 2. Search customer
    console.log('\n2️⃣ Müşteri Arama Testi (GET /api/customers?search=Mehmet)...')
    const searchRes = await fetch(`${BASE_URL}/api/customers?search=Mehmet`)
    const searchResults: any = await searchRes.json()
    console.log(`   ✅ Arama Sonucu: ${searchResults.length} müşteri bulundu.`)

    // 3. Perform a sale with customerId
    console.log('\n3️⃣ Müşteriye Bağlı POS Satışı Gerçekleştirme (POST /api/sales)...')
    // Get first available product variant
    const prodRes = await fetch(`${BASE_URL}/api/products`)
    const products: any = await prodRes.json()
    const variant = products[0]?.variants[0]

    if (!variant) {
      throw new Error('Test için sistemde ürün varyantı bulunamadı.')
    }

    const salePayload = {
      items: [
        {
          variantId: variant.id,
          quantity: 2,
          unitPrice: variant.salePrice,
          totalPrice: variant.salePrice * 2
        }
      ],
      totalAmount: variant.salePrice * 2,
      discountAmount: 0,
      paymentType: { cash: variant.salePrice * 2, card: 0 },
      cashierName: 'Kasiyer Test',
      customerId: createdCustomer.id
    }

    const saleRes = await fetch(`${BASE_URL}/api/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(salePayload)
    })

    if (!saleRes.ok) {
      const err = await saleRes.json()
      throw new Error(`Satış yapılamadı: ${err.error}`)
    }

    const saleData: any = await saleRes.json()
    console.log(`   ✅ Satış Başarılı! Fiş No: ${saleData.receiptNo}, Müşteri: ${saleData.customer?.firstName} ${saleData.customer?.lastName}, Tutar: ${saleData.totalAmount} TL`)

    // 4. Verify customer purchase history
    console.log('\n4️⃣ Müşteri Alışveriş Geçmişi ve Detay Kontrolü (GET /api/customers/:id)...')
    const historyRes = await fetch(`${BASE_URL}/api/customers/${createdCustomer.id}`)
    const historyData: any = await historyRes.json()

    console.log(`   ✅ Müşteri Geçmişi Çekildi: Toplam ${historyData.sales?.length || 0} adet geçmiş alışveriş fişi listelendi.`)

    if (historyData.sales && historyData.sales.length > 0) {
      const firstSale = historyData.sales[0]
      console.log(`   📦 Fiş Detayı: ${firstSale.receiptNo} | Satın Alınan Kalem Sayısı: ${firstSale.items?.length}`)
      console.log('   🎉 DOĞRULAMA BAŞARILI: Satış kaydı müşteri hesabına eksiksiz işlenmiş!')
    } else {
      throw new Error('Satış kaydı müşteri alışveriş geçmişinde görünmüyor!')
    }

    console.log('\n====================================================')
    console.log('✨ MÜŞTERİ MODÜLÜ TÜM TESTLERİ BAŞARIYLA TAMAMLANDI!')
    console.log('====================================================\n')
  } catch (err: any) {
    console.error('❌ Müşteri testi hatası:', err.message)
  }
}

runCustomerTests()
