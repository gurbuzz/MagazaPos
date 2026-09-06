import { Router, Request, Response } from 'express'
import { checkLicenseStatus, activateLicense, getDeviceId } from '../utils/license'

export const licenseRouter = Router()

// GET /api/license/status - Check if machine is licensed
licenseRouter.get('/status', (_req: Request, res: Response) => {
  try {
    const status = checkLicenseStatus()
    res.json(status)
  } catch (err: any) {
    res.status(500).json({
      isLicensed: false,
      deviceId: getDeviceId(),
      error: err.message
    })
  }
})

// POST /api/license/activate - Submit activation key
licenseRouter.post('/activate', (req: Request, res: Response) => {
  const { activationKey } = req.body

  if (!activationKey || typeof activationKey !== 'string') {
    res.status(400).json({ success: false, message: 'Lütfen 6 haneli aktivasyon şifresini giriniz.' })
    return
  }

  const result = activateLicense(activationKey)
  if (result.success) {
    res.json(result)
  } else {
    res.status(400).json(result)
  }
})
