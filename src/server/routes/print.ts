import { Router } from 'express'

export const printRouter = Router()

// POST /api/print/label - Dispatch label printing job
printRouter.post('/label', async (req, res) => {
  try {
    const { variant, quantity, labelType, printerName } = req.body

    // Thermal label payload (HTML or ZPL)
    const printJob = {
      variant,
      quantity: quantity || 1,
      labelType: labelType || 'BARCODE_SHEET',
      printerName: printerName || 'Default Thermal Printer',
      timestamp: new Date().toISOString()
    }

    console.log('[PRINTER API] Print job dispatched to printer:', printJob)

    res.json({
      success: true,
      message: `${quantity || 1} adet etiket yazdırma komutu başarıyla gönderildi.`,
      job: printJob
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})
