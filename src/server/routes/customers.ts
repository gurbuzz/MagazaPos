import { Router } from 'express'
import { prisma } from '../db'

export const customersRouter = Router()

// GET /api/customers - List all customers with optional search filter
customersRouter.get('/', async (req, res) => {
  try {
    const { search } = req.query
    const whereClause: any = {}

    if (search && typeof search === 'string' && search.trim() !== '') {
      const query = search.trim()
      whereClause.OR = [
        { firstName: { contains: query } },
        { lastName: { contains: query } },
        { phone: { contains: query } },
        { city: { contains: query } },
        { district: { contains: query } },
      ]
    }

    const customers = await prisma.customer.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { sales: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.json(customers)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// GET /api/customers/:id - Get single customer details with purchase history
customersRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          include: {
            items: {
              include: {
                variant: {
                  include: {
                    product: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    })

    if (!customer) {
      res.status(404).json({ error: 'Müşteri bulunamadı.' })
      return
    }

    // Format sales items and payment type JSON
    const formattedSales = customer.sales.map((s: any) => {
      let pay = s.paymentType
      if (typeof pay === 'string') {
        try { pay = JSON.parse(pay) } catch (e) { pay = {} }
      }
      const items = s.items?.map((item: any) => {
        let attrs = item.variant?.attributes
        if (typeof attrs === 'string') {
          try { attrs = JSON.parse(attrs) } catch (e) { attrs = {} }
        }
        return {
          ...item,
          variant: item.variant ? { ...item.variant, attributes: attrs } : undefined,
        }
      })
      return { ...s, paymentType: pay, items }
    })

    res.json({
      ...customer,
      sales: formattedSales
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// POST /api/customers - Create new customer
customersRouter.post('/', async (req, res) => {
  try {
    const { firstName, lastName, phone, city, district, notes } = req.body

    if (!firstName || !lastName || !phone) {
      res.status(400).json({ error: 'Ad, Soyad ve Telefon Numarası zorunludur.' })
      return
    }

    const cleanPhone = phone.trim()

    // Check for duplicate phone
    const existing = await prisma.customer.findUnique({
      where: { phone: cleanPhone }
    })

    if (existing) {
      res.status(400).json({ error: 'Bu telefon numarasına sahip bir müşteri zaten kayıtlı.' })
      return
    }

    const newCustomer = await prisma.customer.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: cleanPhone,
        city: (city || '').trim(),
        district: (district || '').trim(),
        notes: notes ? notes.trim() : null
      }
    })

    res.status(201).json(newCustomer)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// PUT /api/customers/:id - Update existing customer
customersRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { firstName, lastName, phone, city, district, notes } = req.body

    if (!firstName || !lastName || !phone) {
      res.status(400).json({ error: 'Ad, Soyad ve Telefon Numarası zorunludur.' })
      return
    }

    const cleanPhone = phone.trim()

    // Check duplicate phone for other customers
    const existing = await prisma.customer.findFirst({
      where: {
        phone: cleanPhone,
        NOT: { id }
      }
    })

    if (existing) {
      res.status(400).json({ error: 'Bu telefon numarası başka bir müşteriye ait.' })
      return
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: cleanPhone,
        city: (city || '').trim(),
        district: (district || '').trim(),
        notes: notes ? notes.trim() : null
      }
    })

    res.json(updatedCustomer)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// DELETE /api/customers/:id - Delete customer
customersRouter.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    await prisma.customer.delete({
      where: { id }
    })

    res.json({ message: 'Müşteri başarıyla silindi.' })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})
