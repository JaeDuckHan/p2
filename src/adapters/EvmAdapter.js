/**
 * EvmAdapter.js — EVM 지갑 어댑터
 *
 * wagmi 훅을 래핑하여 통합 지갑 인터페이스를 제공한다.
 * React 훅 규칙을 준수하기 위해 항상 호출되며,
 * WalletContext에서 활성 어댑터 판별에 사용된다.
 */
import { useAccount, useConnect, useDisconnect } from 'wagmi'

/**
 * EVM 지갑 어댑터 훅
 * @returns {{
 *   type: 'evm',
 *   address: string|null,
 *   isConnected: boolean,
 *   isConnecting: boolean,
 *   connect: () => void,
 *   disconnect: () => void,
 *   connectorName: string|null,
 *   chainId: number|null,
 *   chain: object|null,
 * }}
 */
export function useEvmAdapter() {
  const { address, isConnected, chain, chainId, connector } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  const injector = connectors.find(c => c.id === 'injected')

  return {
    type: 'evm',
    address: address ?? null,
    isConnected,
    isConnecting: isPending,
    connect: () => {
      if (injector) connect({ connector: injector })
    },
    disconnect,
    connectorName: connector?.name ?? null,
    chainId: chainId ?? null,
    chain: chain ?? null,
  }
}
