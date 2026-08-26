import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Zengin Mağaza Stok & Satış Test Verisi Yükleniyor...')

  // Clean existing tables
  await prisma.saleItem.deleteMany()
  await prisma.sale.deleteMany()
  await prisma.stockMovement.deleteMany()
  await prisma.productVariant.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()

  // 1. Categories
  const catUst = await prisma.category.create({ data: { name: 'Üst Giyim' } })
  const catAlt = await prisma.category.create({ data: { name: 'Alt Giyim' } })
  const catDis = await prisma.category.create({ data: { name: 'Dış Giyim' } })
  const catAksesuar = await prisma.category.create({ data: { name: 'Aksesuar' } })

  // Helper for variant attributes
  const attr = (color: string, size: string) => JSON.stringify({ color, size })

  // 2. Products & Variants
  // Product 1: Boğazlı Örme Kazak
  const kzk = await prisma.product.create({
    data: {
      code: 'PRD-KZK-001',
      name: 'Boğazlı Örme Kazak',
      brand: 'Show Apparel',
      basePrice: 899.90,
      description: '%100 Pamuklu kışlık boğazlı erkek kazak',
      categoryId: catUst.id,
      variants: {
        create: [
          { sku: 'KZK-RED-S', barcode: '869000000001', attributes: attr('Kırmızı', 'S'), costPrice: 400, salePrice: 899.90, stockQuantity: 15 },
          { sku: 'KZK-RED-M', barcode: '869000000002', attributes: attr('Kırmızı', 'M'), costPrice: 400, salePrice: 899.90, stockQuantity: 24 },
          { sku: 'KZK-BLK-L', barcode: '869000000003', attributes: attr('Siyah', 'L'), costPrice: 400, salePrice: 899.90, stockQuantity: 8 },
          { sku: 'KZK-GRY-XL', barcode: '869000000010', attributes: attr('Gri', 'XL'), costPrice: 400, salePrice: 899.90, stockQuantity: 18 },
        ]
      }
    },
    include: { variants: true }
  })

  // Product 2: Slim Fit Denim Pantolon
  const jns = await prisma.product.create({
    data: {
      code: 'PRD-JNS-002',
      name: 'Slim Fit Denim Pantolon',
      brand: 'Show Denim',
      basePrice: 1299.00,
      description: 'Esnek kot kumaş slim fit tasarım',
      categoryId: catAlt.id,
      variants: {
        create: [
          { sku: 'JNS-BLU-30', barcode: '869000000004', attributes: attr('Mavi', '30/32'), costPrice: 600, salePrice: 1299.00, stockQuantity: 12 },
          { sku: 'JNS-BLU-32', barcode: '869000000005', attributes: attr('Mavi', '32/32'), costPrice: 600, salePrice: 1299.00, stockQuantity: 30 },
          { sku: 'JNS-BLK-34', barcode: '869000000011', attributes: attr('Siyah', '34/32'), costPrice: 600, salePrice: 1299.00, stockQuantity: 5 },
        ]
      }
    },
    include: { variants: true }
  })

  // Product 3: Oversize Basic Tişört
  const tsh = await prisma.product.create({
    data: {
      code: 'PRD-TSH-003',
      name: 'Oversize Basic Tişört',
      brand: 'Show Basic',
      basePrice: 349.90,
      description: '%100 Süprem pamuk basic unisex tişört',
      categoryId: catUst.id,
      variants: {
        create: [
          { sku: 'TSH-WHT-M', barcode: '869000000006', attributes: attr('Beyaz', 'M'), costPrice: 120, salePrice: 349.90, stockQuantity: 50 },
          { sku: 'TSH-WHT-L', barcode: '869000000007', attributes: attr('Beyaz', 'L'), costPrice: 120, salePrice: 349.90, stockQuantity: 42 },
          { sku: 'TSH-BLK-M', barcode: '869000000008', attributes: attr('Siyah', 'M'), costPrice: 120, salePrice: 349.90, stockQuantity: 18 },
          { sku: 'TSH-BEG-S', barcode: '869000000012', attributes: attr('Bej', 'S'), costPrice: 120, salePrice: 349.90, stockQuantity: 35 },
        ]
      }
    },
    include: { variants: true }
  })

  // Product 4: Klasik Ekoseli Oduncu Gömlek
  const gmk = await prisma.product.create({
    data: {
      code: 'PRD-GMK-004',
      name: 'Ekoseli Oduncu Gömlek',
      brand: 'Show Casual',
      basePrice: 649.90,
      description: 'Çift cepli sıcak tutan ekoseli gömlek',
      categoryId: catUst.id,
      variants: {
        create: [
          { sku: 'GMK-RED-M', barcode: '869000000020', attributes: attr('Kırmızı-Siyah', 'M'), costPrice: 280, salePrice: 649.90, stockQuantity: 16 },
          { sku: 'GMK-RED-L', barcode: '869000000021', attributes: attr('Kırmızı-Siyah', 'L'), costPrice: 280, salePrice: 649.90, stockQuantity: 22 },
          { sku: 'GMK-GRN-L', barcode: '869000000022', attributes: attr('Yeşil-Lacivert', 'L'), costPrice: 280, salePrice: 649.90, stockQuantity: 9 },
        ]
      }
    },
    include: { variants: true }
  })

  // Product 5: Kapüşonlu Kanguru Cepli Sweatshirt
  const swt = await prisma.product.create({
    data: {
      code: 'PRD-SWT-005',
      name: 'Kapüşonlu Basic Sweatshirt',
      brand: 'Show Sport',
      basePrice: 799.00,
      description: ' içi şardonlu sıcak tutan kapüşonlu sweatshirt',
      categoryId: catUst.id,
      variants: {
        create: [
          { sku: 'SWT-ANT-M', barcode: '869000000030', attributes: attr('Antrasit', 'M'), costPrice: 350, salePrice: 799.00, stockQuantity: 28 },
          { sku: 'SWT-ANT-L', barcode: '869000000031', attributes: attr('Antrasit', 'L'), costPrice: 350, salePrice: 799.00, stockQuantity: 14 },
          { sku: 'SWT-NVY-XL', barcode: '869000000032', attributes: attr('Lacivert', 'XL'), costPrice: 350, salePrice: 799.00, stockQuantity: 40 },
        ]
      }
    },
    include: { variants: true }
  })

  // Product 6: Klasik Chino Kanvas Pantolon
  const chn = await prisma.product.create({
    data: {
      code: 'PRD-CHN-006',
      name: 'Klasik Chino Kanvas Pantolon',
      brand: 'Show Elegant',
      basePrice: 1149.00,
      description: 'Ofis ve günlük kullanıma uygun pamuk kanvas pantolon',
      categoryId: catAlt.id,
      variants: {
        create: [
          { sku: 'CHN-BEG-32', barcode: '869000000040', attributes: attr('Bej', '32/32'), costPrice: 500, salePrice: 1149.00, stockQuantity: 19 },
          { sku: 'CHN-BEG-34', barcode: '869000000041', attributes: attr('Bej', '34/32'), costPrice: 500, salePrice: 1149.00, stockQuantity: 11 },
          { sku: 'CHN-NVY-32', barcode: '869000000042', attributes: attr('Lacivert', '32/32'), costPrice: 500, salePrice: 1149.00, stockQuantity: 25 },
        ]
      }
    },
    include: { variants: true }
  })

  // Product 7: Şişme Kuş Tüyü Mont
  const mnt = await prisma.product.create({
    data: {
      code: 'PRD-MNT-007',
      name: 'Kaz Tüyü Şişme Mont',
      brand: 'Show Outdoor',
      basePrice: 2499.00,
      description: 'Su geçirmez rüzgar kesici hafif kışlık şişme mont',
      categoryId: catDis.id,
      variants: {
        create: [
          { sku: 'MNT-BLK-M', barcode: '869000000050', attributes: attr('Siyah', 'M'), costPrice: 1100, salePrice: 2499.00, stockQuantity: 7 },
          { sku: 'MNT-BLK-L', barcode: '869000000051', attributes: attr('Siyah', 'L'), costPrice: 1100, salePrice: 2499.00, stockQuantity: 15 },
          { sku: 'MNT-KHA-L', barcode: '869000000052', attributes: attr('Haki', 'L'), costPrice: 1100, salePrice: 2499.00, stockQuantity: 6 },
        ]
      }
    },
    include: { variants: true }
  })

  // Product 8: Hakiki Deri Kemer
  const kmr = await prisma.product.create({
    data: {
      code: 'PRD-KMR-008',
      name: 'Hakiki Deri Erkek Kemer',
      brand: 'Show Leather',
      basePrice: 399.00,
      description: '%100 Hakiki dana derisi metal tokalı kemer',
      categoryId: catAksesuar.id,
      variants: {
        create: [
          { sku: 'KMR-BRN-110', barcode: '869000000060', attributes: attr('Kahverengi', '110 cm'), costPrice: 150, salePrice: 399.00, stockQuantity: 30 },
          { sku: 'KMR-BLK-115', barcode: '869000000061', attributes: attr('Siyah', '115 cm'), costPrice: 150, salePrice: 399.00, stockQuantity: 45 },
        ]
      }
    },
    include: { variants: true }
  })

  // 3. Sample Past Sales Receipts for Z Report & History
  console.log('🧾 Örnek Geçmiş Satış Fişleri ve Z Raporu Verileri Ekleniyor...')

  // Sale 1
  await prisma.sale.create({
    data: {
      receiptNo: 'FIS-98214101',
      totalAmount: 1249.80,
      discountAmount: 0,
      paymentType: JSON.stringify({ cash: 1249.80, card: 0 }),
      cashierName: 'Ahmet (Kasa 1)',
      items: {
        create: [
          { variantId: kzk.variants[0].id, quantity: 1, unitPrice: 899.90, totalPrice: 899.90 },
          { variantId: tsh.variants[0].id, quantity: 1, unitPrice: 349.90, totalPrice: 349.90 },
        ]
      }
    }
  })

  // Sale 2
  await prisma.sale.create({
    data: {
      receiptNo: 'FIS-98214102',
      totalAmount: 2499.00,
      discountAmount: 0,
      paymentType: JSON.stringify({ cash: 0, card: 2499.00 }),
      cashierName: 'Zeynep (Kasa 1)',
      items: {
        create: [
          { variantId: mnt.variants[0].id, quantity: 1, unitPrice: 2499.00, totalPrice: 2499.00 },
        ]
      }
    }
  })

  // Sale 3
  await prisma.sale.create({
    data: {
      receiptNo: 'FIS-98214103',
      totalAmount: 2048.90,
      discountAmount: 100.00,
      paymentType: JSON.stringify({ cash: 1000.00, card: 1048.90 }),
      cashierName: 'Ahmet (Kasa 1)',
      items: {
        create: [
          { variantId: jns.variants[0].id, quantity: 1, unitPrice: 1299.00, totalPrice: 1299.00 },
          { variantId: swt.variants[0].id, quantity: 1, unitPrice: 799.00, totalPrice: 799.00 },
          { variantId: kmr.variants[0].id, quantity: 1, unitPrice: 399.00, totalPrice: 399.00 },
        ]
      }
    }
  })

  console.log('✨ Zengin Test Veritabanı Başarıyla Oluşturuldu!')
}

main()
  .catch((e) => {
    console.error('Seed hatası:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
