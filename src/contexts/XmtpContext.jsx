// ─── XMTP React Context ───────────────────────────────────────────────────────
//
// Provides a shared XMTP client to all hooks (useXmtpChat, useXmtpAccept).
// Initializes when wallet is connected, tears down on disconnect.

import { createContext, useContext, useState, useEffect } from 'react'
import { useWalletClient, useAccount } from 'wagmi'
import { getOrCreateClient, resetClient } from '../lib/xmtp-client'

const XmtpContext = createContext({
  client: null,
  isReady: false,
  error: null,
})

export function XmtpProvider({ children }) {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [client, setClient] = useState(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
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
  }, [walletClient, address, isConnected])

  return (
    <XmtpContext.Provider value={{ client, isReady, error }}>
      {children}
    </XmtpContext.Provider>
  )
}

export function useXmtp() {
  return useContext(XmtpContext)
}
