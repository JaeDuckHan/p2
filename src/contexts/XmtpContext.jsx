// ─── XMTP React Context ───────────────────────────────────────────────────────
//
// Provides a shared XMTP client to all hooks (useXmtpChat, useXmtpAccept).
// Initializes when wallet is connected, tears down on disconnect.
//
// NOTE: XMTP is EVM-only. Tron 네트워크에서는 초기화를 스킵하고
//       isReady=false, isTronSkipped=true 를 노출하여 UI에서 안내한다.

import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useWalletClient, useAccount } from 'wagmi'
import { getOrCreateClient, resetClient } from '../lib/xmtp-client'
import { useNetwork } from './NetworkContext'

const XmtpContext = createContext({
  client: null,
  isReady: false,
  error: null,
  isTronSkipped: false,
})

export function XmtpProvider({ children }) {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { isTron } = useNetwork()
  const [client, setClient] = useState(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)

  // walletClient 참조 안정화 — wagmi가 매 렌더링마다 새 객체를 반환하므로
  // deps에서 제외하고 ref로 접근하여 불필요한 signMessage 재호출 방지
  const walletClientRef = useRef(walletClient)
  walletClientRef.current = walletClient

  useEffect(() => {
    // Tron 네트워크: XMTP는 EVM 전용이므로 초기화 스킵
    if (isTron) {
      setClient(null)
      setIsReady(false)
      setError(null)
      resetClient()
      return
    }

    if (!isConnected) {
      setClient(null)
      setIsReady(false)
      setError(null)
      resetClient()
      return
    }

    // walletClient가 아직 준비되지 않은 경우 대기 (캐시 초기화하지 않음)
    const wc = walletClientRef.current
    if (!wc) return

    let cancelled = false

    getOrCreateClient(wc)
      .then((c) => {
        if (!cancelled) {
          setClient(c)
          setIsReady(true)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[XmtpProvider] Failed to create client:', err)
          setError(err)
          setIsReady(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [address, isConnected, isTron])

  return (
    <XmtpContext.Provider value={{ client, isReady, error, isTronSkipped: isTron }}>
      {children}
    </XmtpContext.Provider>
  )
}

export function useXmtp() {
  return useContext(XmtpContext)
}
