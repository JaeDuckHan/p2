/**
 * useNetworkSwitch — 네트워크 전환 커스텀 훅
 *
 * NetworkContext의 활성 네트워크로 EVM 지갑의 체인을 전환한다.
 * Tron은 네트워크 전환 개념이 없으므로 EVM 전용.
 *
 * 3단계 fallback:
 *   1. wallet_switchEthereumChain 시도
 *   2. 실패(4902) → wallet_addEthereumChain 시도
 *   3. 그래도 실패 → "수동 변경 가이드" 안내
 */
import { useState } from 'react'
import { useNetwork } from '../contexts/NetworkContext'

export function useNetworkSwitch() {
  const { network, isEvm } = useNetwork()
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState(null)

  async function switchNetwork() {
    if (!isEvm) return

    if (!window.ethereum) {
      setError('EVM 지갑이 설치되어 있지 않습니다.')
      return
    }

    const chainIdHex = network.chainIdHex
    const chainParams = network.chainParams

    if (!chainIdHex) {
      setError('네트워크 설정이 올바르지 않습니다.')
      return
    }

    setSwitching(true)
    setError(null)

    try {
      // 1단계: 체인 전환 시도
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      })
    } catch (err) {
      if (err.code === 4902 && chainParams) {
        try {
          // 2단계: 체인 추가 시도
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [chainParams],
          })
        } catch (_) {
          // 3단계: 수동 변경 안내
          setError(`자동 추가에 실패했습니다. 지갑에서 직접 ${network.name} 네트워크를 추가해 주세요. chainlist.org에서 "${network.chainlistSearch ?? network.name}" 검색 후 추가할 수 있습니다.`)
        }
      } else if (err.code === 4001) {
        setError('전환이 취소되었습니다.')
      } else {
        // 3단계: 수동 변경 안내
        setError(`네트워크 전환에 실패했습니다. 지갑에서 직접 ${network.name} 네트워크를 추가해 주세요.`)
      }
    } finally {
      setSwitching(false)
    }
  }

  return { switchNetwork, switching, error }
}
