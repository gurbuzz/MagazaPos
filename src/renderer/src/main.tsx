import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Ensure /api requests target the embedded Express server when running in production (file:// protocol)
const originalFetch = window.fetch
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  if (typeof input === 'string') {
    if (input.startsWith('/api')) {
      input = `http://localhost:3782${input}`
    }
  } else if (input instanceof URL) {
    if (input.pathname.startsWith('/api')) {
      input = new URL(`http://localhost:3782${input.pathname}${input.search}`)
    }
  } else if (input instanceof Request) {
    const url = input.url
    if (url.startsWith('/api') || (window.location.protocol === 'file:' && url.startsWith('file:///api'))) {
      const cleanPath = url.replace(/^file:\/\//, '').replace(/^\/api/, '/api')
      input = new Request(`http://localhost:3782${cleanPath}`, input)
    }
  }
  return originalFetch(input, init)
}

const originalOpen = window.open
window.open = (url?: string | URL, target?: string, features?: string) => {
  if (typeof url === 'string' && url.startsWith('/api')) {
    url = `http://localhost:3782${url}`
  } else if (url instanceof URL && url.pathname.startsWith('/api')) {
    url = new URL(`http://localhost:3782${url.pathname}${url.search}`)
  }
  return originalOpen(url, target, features)
}

const originalEventSource = window.EventSource
if (typeof originalEventSource !== 'undefined') {
  window.EventSource = function (url: string | URL, eventSourceInitDict?: EventSourceInit) {
    let resolvedUrl = url
    if (typeof resolvedUrl === 'string' && resolvedUrl.startsWith('/api')) {
      resolvedUrl = `http://localhost:3782${resolvedUrl}`
    } else if (resolvedUrl instanceof URL && resolvedUrl.pathname.startsWith('/api')) {
      resolvedUrl = new URL(`http://localhost:3782${resolvedUrl.pathname}${resolvedUrl.search}`)
    }
    return new originalEventSource(resolvedUrl, eventSourceInitDict)
  } as any
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
