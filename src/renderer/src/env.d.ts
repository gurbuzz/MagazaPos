/// <reference types="vite/client" />

export interface CustomerDisplayStatus {
  isOpen: boolean
  hasSecondary: boolean
  displaysCount: number
  secondaryResolution?: string | null
}

declare global {
  interface Window {
    electron?: {
      printSilent: (
        htmlContent: string,
        printerName?: string,
        customPageSize?: { width: number; height: number },
        silent?: boolean
      ) => Promise<{ success: boolean; failureReason?: string }>
      printRaw: (
        printerName?: string,
        rawBase64?: string
      ) => Promise<{ success: boolean; failureReason?: string }>
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

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.svg' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

declare module '*.jpeg' {
  const content: string
  export default content
}


