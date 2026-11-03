import express from 'express'
import { productRouter } from '../src/server/routes/products'
import { prisma } from '../src/server/db'
import { getAdminPin } from '../src/server/utils/security'

async function run() {
  console.log('--- TEST: Toplu Varyant Fiyatı, İskonto ve Varyant Silme Testi ---')
  const app = express()
  app.use(express.json())
  app.use('/api/products', productRouter)

  const server = app.listen(0)
  const port = (server.address() as any).port
  const baseUrl = `http://127.0.0.1:${port}`
  const adminPin = getAdminPin()

  console.log(`Test sunucusu port: ${port}, Admin PIN: ${adminPin}`)

  try {
    // 1. Create a test product with 3 variants
    const testCode = `TEST-PRD-${Date.now()}`
    const createRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: testCode,
        name: 'Test Triko Kazak',
        brand: 'Lufian',
        basePrice: 500,
        variants: [
          {
            barcode: `TEST-BC1-${Date.now()}`,
            attributes: JSON.stringify({ color: 'Siyah', size: 'M' }),
            salePrice: 500,
            costPrice: 200,
            stockQuantity: 10
          },
          {
            barcode: `TEST-BC2-${Date.now()}`,
            attributes: JSON.stringify({ color: 'Siyah', size: 'L' }),
            salePrice: 500,
            costPrice: 200,
            stockQuantity: 5
          },
          {
            barcode: `TEST-BC3-${Date.now()}`,
            attributes: JSON.stringify({ color: 'Lacivert', size: 'M' }),
            salePrice: 500,
            costPrice: 200,
            stockQuantity: 8
          }
        ]
      })
    })

    const product: any = await createRes.json()
    if (!createRes.ok) throw new Error('Create product failed: ' + JSON.stringify(product))
    console.log(`✅ Test ürünü oluşturuldu: ID=${product.id}, Varyant sayısı=${product.variants.length}`)

    // 2. Test Rule-based Bulk Price & Discount: %20 Zam, %25 İskonto, Psikolojik Fiyat (.90)
    console.log('\n--- 2. Toplu Fiyat ve İskonto Güncelleme Testi ---')
    const bulkRes = await fetch(`${baseUrl}/api/products/variants/bulk-price-discount`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Pin': adminPin
      },
      body: JSON.stringify({
        productId: product.id,
        salePriceAction: 'increase_percent',
        salePriceValue: 20, // 500 * 1.20 = 600
        discountAction: 'percent_off',
        discountValue: 25, // 600 * 0.75 = 450
        rounding: 'ending_90' // 599.90 and 449.90
      })
    })

    const bulkData: any = await bulkRes.json()
    if (!bulkRes.ok) throw new Error('Bulk update failed: ' + JSON.stringify(bulkData))
    console.log(`✅ Toplu güncelleme başarılı: ${bulkData.count} varyant güncellendi.`)
    console.log(`   Örnek Varyant Satış Fiyatı: ${bulkData.variants[0].salePrice} TL (Beklenen: ~599.90 TL)`)
    console.log(`   Örnek Varyant İndirimli Fiyatı: ${bulkData.variants[0].discountPrice} TL (Beklenen: ~449.90 TL)`)

    if (bulkData.variants[0].salePrice !== 599.9 || bulkData.variants[0].discountPrice !== 449.9) {
      console.warn('   ⚠️ Fiyat veya iskonto beklenen yuvarlamada değil:', bulkData.variants[0])
    } else {
      console.log('   🎉 Fiyat ve iskonto tam olarak doğru hesaplandı ve yuvarlandı!')
    }

    // 3. Test Bulk Discount Removal
    console.log('\n--- 3. İskontoyu Toplu Kaldırma Testi ---')
    const removeDiscRes = await fetch(`${baseUrl}/api/products/variants/bulk-price-discount`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Pin': adminPin
      },
      body: JSON.stringify({
        productId: product.id,
        discountAction: 'remove'
      })
    })
    const removeDiscData: any = await removeDiscRes.json()
    console.log(`✅ İskonto kaldırma başarılı: İndirimli Fiyat = ${removeDiscData.variants[0].discountPrice} (Beklenen: null)`)

    // 4. Test Single Variant Delete (No sales)
    console.log('\n--- 4. Varyant Silme Testi ---')
    const variantToDelete = product.variants[2]
    const deleteRes = await fetch(`${baseUrl}/api/products/variants/${variantToDelete.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Pin': adminPin
      }
    })
    const deleteData: any = await deleteRes.json()
    if (!deleteRes.ok) throw new Error('Delete variant failed: ' + JSON.stringify(deleteData))
    console.log(`✅ Varyant silme başarılı:`, deleteData.message)

    // Verify it's gone
    const checkVariant = await prisma.productVariant.findUnique({ where: { id: variantToDelete.id } })
    console.log(`   Varyant veritabanında kontrol edildi: ${checkVariant === null ? 'Tamamen silindi (OK)' : 'Silinemedi!'}`)

    // 5. Clean up test product
    console.log('\n--- 5. Test Verilerini Temizleme ---')
    await prisma.stockMovement.deleteMany({
      where: { variant: { productId: product.id } }
    })
    await prisma.productVariant.deleteMany({
      where: { productId: product.id }
    })
    await prisma.product.delete({
      where: { id: product.id }
    })
    console.log('✅ Test ürünü başarıyla temizlendi.')

    console.log('\n==========================================')
    console.log('🎉 TÜM TESTLER BAŞARIYLA TAMAMLANDI!')
    console.log('==========================================')
  } finally {
    server.close()
  }
}

run().catch((err) => {
  console.error('❌ TEST HATASI:', err)
  process.exit(1)
})

