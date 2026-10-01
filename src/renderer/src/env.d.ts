export {}

export interface CustomerDisplayStatus {
  isOpen: boolean
  hasSecondary: boolean
  displaysCount: number
  secondaryResolution?: string | null
}

declare global {
  interface Window {
    electron?: {
      printSilent: (htmlContent: string, printerName?: string) => Promise<{ success: boolean; failureReason?: string }>
      getPrinters: () => Promise<any[]>
      getLocalIp: () => Promise<string>
      toggleFullscreen: () => Promise<boolean>
      isFullscreen: () => Promise<boolean>

      // Customer Display methods
      openCustomerDisplay: () => Promise<CustomerDisplayStatus>
      closeCustomerDisplay: () => Promise<boolean>
      toggleCustomerDisplay: () => Promise<CustomerDisplayStatus>
      getCustomerDisplayStatus: () => Promise<CustomerDisplayStatus>
      updateCustomerDisplay: (data: any) => Promise<boolean>
      getCustomerDisplayState: () => Promise<any>
      onCustomerDisplayUpdate: (callback: (data: any) => void) => () => void
      onCustomerDisplayStatusChange: (callback: (status: CustomerDisplayStatus) => void) => () => void
    }
  }
}

