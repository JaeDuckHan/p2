// ─── XMTP React Context ───────────────────────────────────────────────────────
//
// Provides a shared XMTP client to all hooks (useXmtpChat, useXmtpAccept).
// Initializes when wallet is connected, tears down on disconnect.
//
// NOTE: XMTP is EVM-only. Tron 네트워크에서는 초기화를 스킵하고
//       isReady=false, isTronSkipped=true 를 노출하여 UI에서 안내한다.

import { createContext, useContext, useState, useEffect } from 'react'
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

  useEffect(() => {
    // Tron 네트워크: XMTP는 EVM 전용이므로 초기화 스킵
    if (isTron) {
      setClient(null)
      setIsReady(false)
      setError(null)
      resetClient()
      return
    }

    if (!isConnected || !walletClient) {
      setClient(null)
      setIsReady(false)
      setError(null)
      resetClient()
      return
    }

    let cancelled = false

    getOrCreateClient(walletClient)
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
  }, [walletClient, address, isConnected, isTron])

  return (
    <XmtpContext.Provider value={{ client, isReady, error, isTronSkipped: isTron }}>
      {children}
    </XmtpContext.Provider>
  )
}

export function useXmtp() {
  return useContext(XmtpContext)
}
