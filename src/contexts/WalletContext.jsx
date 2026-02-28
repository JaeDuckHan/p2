/**
 * WalletContext — 통합 지갑 컨텍스트
 *
 * NetworkContext의 활성 네트워크에 따라 적절한 어댑터(EVM/Tron)를 선택하고,
 * 활성 어댑터의 상태만 외부에 노출한다.
 *
 * 두 어댑터 훅은 항상 호출된다 (React 훅 규칙 준수).
 * 비활성 어댑터의 연결 상태는 UI에 숨긴다.
 */
import { createContext, useContext, useMemo } from 'react'
import { useNetwork } from './NetworkContext'
import { useEvmAdapter } from '../adapters/EvmAdapter'
import { useTronAdapter } from '../adapters/TronAdapter'

const WalletCtx = createContext(null)

export function WalletProvider({ children }) {
  const { isEvm, isTron } = useNetwork()

  // 두 어댑터 항상 호출 (React 훅 규칙)
  const evm = useEvmAdapter()
  const tron = useTronAdapter()

  // 활성 어댑터만 노출
  const active = isEvm ? evm : isTron ? tron : evm

  const value = useMemo(() => ({
    // 활성 어댑터 상태
    address: active.address,
    isConnected: active.isConnected,
    isConnecting: active.isConnecting,
    connect: active.connect,
    disconnect: active.disconnect,
    connectorName: active.connectorName,
    walletType: active.type,
    chainId: active.chainId,
    chain: active.chain,

    // 어댑터 직접 접근 (고급 사용)
    evm,
    tron,

    // Tron 전용
    isTronInstalled: tron.isInstalled,
  }), [active, evm, tron, isEvm, isTron])

  return (
    <WalletCtx.Provider value={value}>
      {children}
    </WalletCtx.Provider>
  )
}

/**
 * @returns {{
 *   address: string|null,
 *   isConnected: boolean,
 *   isConnecting: boolean,
 *   connect: () => void,
 *   disconnect: () => void,
 *   connectorName: string|null,
 *   walletType: 'evm'|'tron',
 *   chainId: number|null,
 *   chain: object|null,
 *   evm: object,
 *   tron: object,
 *   isTronInstalled: boolean,
 * }}
 */
export function useWallet() {
  const ctx = useContext(WalletCtx)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}
