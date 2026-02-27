/**
 * main.jsx — 앱 진입점
 *
 * React 루트를 생성하고 전역 Provider를 중첩하여 렌더링합니다.
 * Provider 순서 (바깥→안):
 *   WagmiProvider      — 지갑 연결 및 온체인 상호작용 (wagmi)
 *   QueryClientProvider — 서버 상태 캐싱 (TanStack React Query)
 *   XmtpProvider       — P2P 메시지 레이어 (XMTP 프로토콜)
 *   ToastProvider      — 전역 토스트 알림 시스템
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig } from './lib/wagmi'
import { XmtpProvider } from './contexts/XmtpContext'
import { ToastProvider } from './contexts/ToastContext'
import App from './App'
import './index.css'

// React Query 클라이언트: 쿼리 재시도 1회, 2초 staletime
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 2000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <XmtpProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </XmtpProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
