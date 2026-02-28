/**
 * useNetworkSwitch — 네트워크 전환 커스텀 훅
 *
 * MetaMask를 통해 활성 네트워크로 전환하는 로직을 캡슐화한다.
 * ACTIVE_NETWORK 설정에 따라 대상 네트워크가 자동 결정된다.
 *
 * 반환값:
 *   switchNetwork  — 네트워크 전환 요청 함수
 *   switching      — 전환 요청 진행 중 여부
 *   error          — 전환 실패 시 에러 메시지 (null이면 에러 없음)
 */
import { useState } from 'react'
import { CHAIN_ID_HEX, CHAIN_PARAMS } from '../constants/network'

export function useNetworkSwitch() {
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState(null)

  async function switchNetwork() {
    if (!window.ethereum) {
      setError('MetaMask가 설치되어 있지 않습니다.')
      return
    }
    setSwitching(true)
    setError(null)
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CHAIN_ID_HEX }],
      })
    } catch (err) {
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [CHAIN_PARAMS],
          })
        } catch (_) {
          setError('네트워크 추가가 취소되었습니다. 수동으로 추가해 주세요.')
        }
      } else if (err.code === 4001) {
        setError('전환이 취소되었습니다.')
      } else {
        setError('네트워크 전환에 실패했습니다. 수동으로 추가해 주세요.')
      }
    } finally {
      setSwitching(false)
    }
  }

  return { switchNetwork, switching, error }
}
