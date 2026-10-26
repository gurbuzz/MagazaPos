import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught React Error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[99999] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6 text-white select-none">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto ring-8 ring-rose-500/10">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">
                {this.props.fallbackTitle || 'Beklenmeyen Bir Görsel Hata Oluştu'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Arayüz bileşeni yüklenirken bir hata meydana geldi. Veritabanınız ve kayıtlarınız güvendedir. Sayfayı yenileyerek çalışmaya devam edebilirsiniz.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-left font-mono text-[11px] text-rose-400 max-h-32 overflow-y-auto break-all">
                {this.state.error.message}
              </div>
            )}

            <button
              type="button"
              onClick={this.handleReset}
              className="w-full py-3 bg-[#00268A] hover:bg-[#001f70] active:scale-98 text-white rounded-xl text-xs font-black shadow-lg transition flex items-center justify-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Ekranı Yenile ve Devam Et</span>
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
