/**
 * EvmAdapter.js — EVM 지갑 어댑터
 *
 * wagmi 훅을 래핑하여 통합 지갑 인터페이스를 제공한다.
 * React 훅 규칙을 준수하기 위해 항상 호출되며,
 * WalletContext에서 활성 어댑터 판별에 사용된다.
 *
 * 커넥터 선택 전략:
 * - 데스크톱 / 인앱 브라우저 (window.ethereum 존재): injected 우선
 * - 모바일 일반 브라우저 (window.ethereum 없음): walletConnect 우선
 */
import { useAccount, useConnect, useDisconnect } from 'wagmi'

/** 모바일 일반 브라우저인지 (세션 중 변하지 않으므로 모듈 레벨에서 1회만 평가) */
const IS_MOBILE_WITHOUT_PROVIDER =
  /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  && typeof window.ethereum === 'undefined'

export function useEvmAdapter() {
  const { address, isConnected, chain, chainId, connector } = useAccount()
  const { connect, connectors, isPending, error: connectError, reset } = useConnect()
  const { disconnect } = useDisconnect()

  const injector = connectors.find(c => c.id === 'injected')
  const wc = connectors.find(c => c.id === 'walletConnect')

  // 모바일 일반 브라우저이고 WC 커넥터가 있으면 WC 우선, 아니면 injected
  const preferredConnector = (IS_MOBILE_WITHOUT_PROVIDER && wc) ? wc : (injector ?? wc)

  return {
    type: 'evm',
    address: address ?? null,
    isConnected,
    isConnecting: isPending,
    connectError: connectError ?? null,
    resetError: reset,
    connect: () => {
      reset()
      if (preferredConnector) {
        connect({ connector: preferredConnector })
      }
    },
    disconnect,
    connectorName: connector?.name ?? null,
    chainId: chainId ?? null,
    chain: chain ?? null,
    hasWalletConnect: !!wc,
  }
}
