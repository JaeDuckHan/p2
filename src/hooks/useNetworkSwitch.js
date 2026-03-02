/**
 * useNetworkSwitch — 네트워크 전환 커스텀 훅
 *
 * wagmi의 useSwitchChain을 사용하여 체인을 전환한다.
 * wagmi 커넥터를 통해 전환하므로 상태가 자동 동기화된다.
 *
 * fallback:
 *   1. wagmi switchChain 시도
 *   2. 실패(체인 미등록) → wallet_addEthereumChain 후 재시도
 *   3. 그래도 실패 → "수동 변경 가이드" 안내
 */
import { useState, useCallback } from 'react'
import { useSwitchChain } from 'wagmi'
import { useNetwork } from '../contexts/NetworkContext'

export function useNetworkSwitch() {
  const { network, isEvm } = useNetwork()
  const { switchChainAsync } = useSwitchChain()
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState(null)

  const switchNetwork = useCallback(async () => {
    if (!isEvm) return

    const targetChainId = network.chainId
    if (!targetChainId) {
      setError('네트워크 설정이 올바르지 않습니다.')
      return
    }

    setSwitching(true)
    setError(null)

    try {
      // wagmi switchChain — 커넥터 상태가 자동 동기화됨
      await switchChainAsync({ chainId: targetChainId })
    } catch (err) {
      // 체인 미등록(4902) → addEthereumChain 후 재시도
      const isChainNotAdded = err?.cause?.code === 4902 || err?.code === 4902 ||
        err?.message?.includes('Unrecognized chain') || err?.message?.includes('wallet_addEthereumChain')

      if (isChainNotAdded && network.chainParams && window.ethereum) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [network.chainParams],
          })
          // 체인 추가 후 wagmi로 다시 전환 시도
          await switchChainAsync({ chainId: targetChainId })
        } catch (_) {
          setError(`자동 추가에 실패했습니다. 지갑에서 직접 ${network.name} 네트워크를 추가해 주세요. chainlist.org에서 "${network.chainlistSearch ?? network.name}" 검색 후 추가할 수 있습니다.`)
        }
      } else if (err?.cause?.code === 4001 || err?.code === 4001) {
        setError('전환이 취소되었습니다.')
      } else {
        setError(`네트워크 전환에 실패했습니다. 지갑에서 직접 ${network.name} 네트워크로 변경해 주세요.`)
      }
    } finally {
      setSwitching(false)
    }
  }, [isEvm, network, switchChainAsync])

  return { switchNetwork, switching, error }
}
