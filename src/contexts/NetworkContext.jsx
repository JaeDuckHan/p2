/**
 * NetworkContext — 런타임 네트워크 선택 컨텍스트
 *
 * 기존 ACTIVE_NETWORK 빌드타임 상수를 대체한다.
 * localStorage('miniswap:network')에 저장하여 세션 간 유지.
 * useState initializer에서 동기적으로 읽어 깜빡임을 방지한다.
 */
import { createContext, useContext, useState, useCallback } from 'react'
import { NETWORKS } from '../constants/network'

const STORAGE_KEY = 'miniswap:network'
const DEFAULT_NETWORK = 'arbitrum'

const NetworkContext = createContext(null)

/**
 * @param {string} key
 * @returns {boolean}
 */
function isValidNetworkKey(key) {
  return key != null && key in NETWORKS
}

export function NetworkProvider({ children }) {
  // useState initializer로 동기 하이드레이션 — 깜빡임 방지
  const [networkKey, setNetworkKeyState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return isValidNetworkKey(stored) ? stored : DEFAULT_NETWORK
    } catch {
      return DEFAULT_NETWORK
    }
  })

  const setNetwork = useCallback((key) => {
    if (!isValidNetworkKey(key)) return
    setNetworkKeyState(key)
    try {
      localStorage.setItem(STORAGE_KEY, key)
    } catch {
      // localStorage 사용 불가 환경 무시
    }
  }, [])

  const network = NETWORKS[networkKey] ?? NETWORKS[DEFAULT_NETWORK]
  const isEvm = network.chainType === 'evm'
  const isTron = network.chainType === 'tron'

  const value = {
    networkKey,
    network,
    setNetwork,
    isEvm,
    isTron,
  }

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  )
}

/**
 * @returns {{
 *   networkKey: string,
 *   network: object,
 *   setNetwork: (key: string) => void,
 *   isEvm: boolean,
 *   isTron: boolean,
 * }}
 */
export function useNetwork() {
  const ctx = useContext(NetworkContext)
  if (!ctx) throw new Error('useNetwork must be used within NetworkProvider')
  return ctx
}
