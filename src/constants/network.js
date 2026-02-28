/**
 * network.js — 네트워크 관련 상수
 *
 * Arbitrum One 체인 정보와 앱에서 지원하는 체인 ID 목록을 정의한다.
 * App.jsx, NetworkGuide.jsx 등에서 공통으로 사용한다.
 */

/** Arbitrum One 체인 ID (16진수) — MetaMask wallet_switchEthereumChain 호출 시 사용 */
export const ARBITRUM_CHAIN_ID_HEX = '0xA4B1'

/**
 * Arbitrum One 네트워크 메타데이터
 * MetaMask에 해당 네트워크가 없을 때 wallet_addEthereumChain으로 자동 추가하기 위한 정보
 */
export const ARBITRUM_PARAMS = {
  chainId: ARBITRUM_CHAIN_ID_HEX,
  chainName: 'Arbitrum One',
  rpcUrls: ['https://arb1.arbitrum.io/rpc'],
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  blockExplorerUrls: ['https://arbiscan.io'],
}

/** 앱이 지원하는 체인 ID 목록: Arbitrum One(42161) + Arbitrum Sepolia(421614) */
export const SUPPORTED_CHAINS = [42161, 421614]
