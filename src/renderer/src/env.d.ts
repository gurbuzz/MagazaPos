export {}

declare global {
  interface Window {
    electron?: {
      printSilent: (htmlContent: string) => Promise<{ success: boolean; failureReason?: string }>
      getPrinters: () => Promise<any[]>
      getLocalIp: () => Promise<string>
    }
  }
}
