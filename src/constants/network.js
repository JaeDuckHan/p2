/**
 * network.js — 멀티체인 네트워크 레지스트리
 *
 * ACTIVE_NETWORK 값 하나만 변경하면 앱 전체가 해당 네트워크로 전환된다.
 * 모든 네트워크별 상수(체인 ID, RPC, 탐색기, USDT 주소 등)를 중앙 관리한다.
 */

// ─── 네트워크 정의 ──────────────────────────────────────────────────────────────

export const NETWORKS = {
  arbitrum: {
    key: 'arbitrum',
    name: 'Arbitrum One',
    chainId: 42161,
    chainIdHex: '0xA4B1',
    testnet: {
      chainId: 421614,
      chainIdHex: '0x66EEE',
      name: 'Arbitrum Sepolia',
    },
    chainParams: {
      chainId: '0xA4B1',
      chainName: 'Arbitrum One',
      rpcUrls: ['https://arb1.arbitrum.io/rpc'],
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      blockExplorerUrls: ['https://arbiscan.io'],
    },
    explorerName: 'Arbiscan',
    explorerUrl: 'https://arbiscan.io',
    testnetExplorerUrl: 'https://sepolia.arbiscan.io',
    bridgeUrl: 'https://bridge.arbitrum.io',
    chainlistSearch: 'Arbitrum',
    usdtAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    testnetUsdtAddress: '0x3f14920c99BEB920Afa163031c4e47a3e03B3e4A',
    layerLabel: 'Arbitrum L2',
    layerDescription: '이더리움 보안 + L2 속도, 수십 원으로 즉시 거래',
    wagmiChains: { mainnet: 'arbitrum', testnet: 'arbitrumSepolia' },
  },

  polygon: {
    key: 'polygon',
    name: 'Polygon',
    chainId: 137,
    chainIdHex: '0x89',
    testnet: {
      chainId: 80002,
      chainIdHex: '0x13882',
      name: 'Polygon Amoy',
    },
    chainParams: {
      chainId: '0x89',
      chainName: 'Polygon',
      rpcUrls: ['https://polygon-rpc.com'],
      nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
      blockExplorerUrls: ['https://polygonscan.com'],
    },
    explorerName: 'Polygonscan',
    explorerUrl: 'https://polygonscan.com',
    testnetExplorerUrl: 'https://amoy.polygonscan.com',
    bridgeUrl: 'https://portal.polygon.technology',
    chainlistSearch: 'Polygon',
    usdtAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    testnetUsdtAddress: null, // 배포 후 추가
    layerLabel: 'Polygon',
    layerDescription: '빠르고 저렴한 거래, PoS 보안',
    wagmiChains: { mainnet: 'polygon', testnet: 'polygonAmoy' },
  },
}

// ─── 활성 네트워크 선택 ─────────────────────────────────────────────────────────
// 이 값만 'polygon'으로 변경하면 전체 앱이 Polygon으로 전환된다.
export const ACTIVE_NETWORK = 'arbitrum'

// ─── 파생 상수 (다른 파일에서 import하여 사용) ──────────────────────────────────

const net = NETWORKS[ACTIVE_NETWORK]

/** 메인넷 체인 ID (숫자) */
export const MAINNET_CHAIN_ID = net.chainId

/** 메인넷 체인 ID (16진수) — wallet_switchEthereumChain에 사용 */
export const CHAIN_ID_HEX = net.chainIdHex

/** wallet_addEthereumChain용 네트워크 메타데이터 */
export const CHAIN_PARAMS = net.chainParams

/** 앱이 지원하는 체인 ID 목록 (메인넷 + 테스트넷) */
export const SUPPORTED_CHAINS = [net.chainId, net.testnet.chainId]

/** 활성 네트워크 이름 ("Arbitrum One" / "Polygon") */
export const CHAIN_NAME = net.name

/** 네트워크 레이어 레이블 ("Arbitrum L2" / "Polygon") */
export const LAYER_LABEL = net.layerLabel

/** 네트워크 레이어 설명 */
export const LAYER_DESCRIPTION = net.layerDescription

/** ChainList 검색 키워드 */
export const CHAINLIST_SEARCH = net.chainlistSearch

/** 블록 탐색기 이름 ("Arbiscan" / "Polygonscan") */
export const EXPLORER_NAME = net.explorerName

/** 공식 브릿지 URL */
export const BRIDGE_URL = net.bridgeUrl

/** 공식 브릿지 도메인 (표시용) */
export const BRIDGE_DOMAIN = net.bridgeUrl.replace(/^https?:\/\//, '')

/**
 * 체인 ID에 따른 블록 탐색기 URL을 반환한다.
 * @param {number} chainId - 체인 ID
 * @returns {string} 탐색기 URL
 */
export function getExplorerUrl(chainId) {
  if (chainId === net.testnet.chainId) return net.testnetExplorerUrl
  return net.explorerUrl
}
