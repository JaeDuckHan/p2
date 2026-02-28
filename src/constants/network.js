/**
 * network.js — 멀티체인 네트워크 레지스트리
 *
 * 모든 네트워크별 상수(체인 ID, RPC, 탐색기, USDT 주소 등)를 중앙 관리한다.
 * 런타임 네트워크 선택은 NetworkContext에서 담당한다.
 */

// ─── 네트워크 정의 ──────────────────────────────────────────────────────────────

export const NETWORKS = {
  arbitrum: {
    key: 'arbitrum',
    chainType: 'evm',
    name: 'Arbitrum One',
    chainId: 42161,
    chainIdHex: '0xA4B1',
    nativeSymbol: 'ETH',
    usdtDecimals: 6,
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
    explorerTxTemplate: 'https://arbiscan.io/tx/{hash}',
    explorerAddressTemplate: 'https://arbiscan.io/address/{addr}',
    testnetExplorerUrl: 'https://sepolia.arbiscan.io',
    testnetExplorerTxTemplate: 'https://sepolia.arbiscan.io/tx/{hash}',
    testnetExplorerAddressTemplate: 'https://sepolia.arbiscan.io/address/{addr}',
    bridgeUrl: 'https://bridge.arbitrum.io',
    chainlistSearch: 'Arbitrum',
    usdtAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    testnetUsdtAddress: '0x3f14920c99BEB920Afa163031c4e47a3e03B3e4A',
    layerLabel: 'Arbitrum L2',
    layerDescription: '이더리움 보안 + L2 속도, 수십 원으로 즉시 거래',
    description: '이더리움 보안을 계승하는 L2 네트워크',
    gasInfo: '가스비 ~$0.10/건',
    features: [
      '이더리움 보안 계승',
      '빠른 확정 (< 1초)',
      'EVM 지갑 사용 (MetaMask, Trust Wallet 등)',
      'USDT (ERC-20)',
    ],
    walletType: 'evm',
    tokenStandard: 'ERC-20',
    wagmiChains: { mainnet: 'arbitrum', testnet: 'arbitrumSepolia' },
  },

  polygon: {
    key: 'polygon',
    chainType: 'evm',
    name: 'Polygon',
    chainId: 137,
    chainIdHex: '0x89',
    nativeSymbol: 'POL',
    usdtDecimals: 6,
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
    explorerTxTemplate: 'https://polygonscan.com/tx/{hash}',
    explorerAddressTemplate: 'https://polygonscan.com/address/{addr}',
    testnetExplorerUrl: 'https://amoy.polygonscan.com',
    testnetExplorerTxTemplate: 'https://amoy.polygonscan.com/tx/{hash}',
    testnetExplorerAddressTemplate: 'https://amoy.polygonscan.com/address/{addr}',
    bridgeUrl: 'https://portal.polygon.technology',
    chainlistSearch: 'Polygon',
    usdtAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    testnetUsdtAddress: null,
    layerLabel: 'Polygon',
    layerDescription: '빠르고 저렴한 거래, PoS 보안',
    description: 'PoS 합의 기반의 고속 저비용 체인',
    gasInfo: '가스비 ~$0.01/건',
    features: [
      '매우 저렴한 수수료',
      '높은 처리량 (7,000 TPS)',
      'EVM 지갑 사용 (MetaMask, Trust Wallet 등)',
      'USDT (ERC-20)',
    ],
    walletType: 'evm',
    tokenStandard: 'ERC-20',
    wagmiChains: { mainnet: 'polygon', testnet: 'polygonAmoy' },
  },

  tron: {
    key: 'tron',
    chainType: 'tron',
    name: 'Tron',
    chainId: null,
    chainIdHex: null,
    nativeSymbol: 'TRX',
    usdtDecimals: 6,
    testnet: {
      chainId: null,
      chainIdHex: null,
      name: 'Tron Nile Testnet',
    },
    chainParams: null,
    explorerName: 'Tronscan',
    explorerUrl: 'https://tronscan.org',
    explorerTxTemplate: 'https://tronscan.org/#/transaction/{hash}',
    explorerAddressTemplate: 'https://tronscan.org/#/address/{addr}',
    testnetExplorerUrl: 'https://nile.tronscan.org',
    testnetExplorerTxTemplate: 'https://nile.tronscan.org/#/transaction/{hash}',
    testnetExplorerAddressTemplate: 'https://nile.tronscan.org/#/address/{addr}',
    bridgeUrl: null,
    chainlistSearch: null,
    usdtAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    testnetUsdtAddress: null,
    layerLabel: 'Tron',
    layerDescription: '빠르고 저렴한 USDT 전송, 전 세계 최대 USDT 유통량',
    description: '에너지/대역폭 기반의 독립 체인',
    gasInfo: '에너지/대역폭 (거의 무료)',
    features: [
      '전 세계 최대 USDT 유통량',
      '거래 수수료 거의 무료',
      'TronLink 지갑 전용',
      'USDT (TRC-20)',
    ],
    walletType: 'tron',
    tokenStandard: 'TRC-20',
    walletWarning: 'TronLink 지갑이 필요합니다 (MetaMask 사용 불가)',
    wagmiChains: null,
  },
}

// ─── 네트워크 키 목록 ────────────────────────────────────────────────────────────

export const NETWORK_KEYS = Object.keys(NETWORKS)

// ─── 헬퍼 함수 ──────────────────────────────────────────────────────────────────

/**
 * 네트워크 키로 설정 객체를 반환한다.
 * @param {string} key - 'arbitrum' | 'polygon' | 'tron'
 * @returns {object} 네트워크 설정
 */
export function getNetwork(key) {
  return NETWORKS[key] ?? NETWORKS.arbitrum
}

/**
 * 체인 ID로 네트워크 설정을 반환한다 (EVM 전용).
 * @param {number} chainId
 * @returns {object|null}
 */
export function getNetworkByChainId(chainId) {
  for (const net of Object.values(NETWORKS)) {
    if (net.chainType !== 'evm') continue
    if (net.chainId === chainId || net.testnet?.chainId === chainId) return net
  }
  return null
}

/**
 * 블록 탐색기 URL을 반환한다.
 * @param {string} networkKey - 네트워크 키
 * @param {{ type: 'tx'|'address', value: string }} opts
 * @param {{ testnet?: boolean }} [extra]
 * @returns {string}
 */
export function getExplorerUrl(networkKey, { type, value }, extra = {}) {
  const net = NETWORKS[networkKey] ?? NETWORKS.arbitrum
  let template
  if (extra.testnet) {
    template = type === 'tx' ? net.testnetExplorerTxTemplate : net.testnetExplorerAddressTemplate
  } else {
    template = type === 'tx' ? net.explorerTxTemplate : net.explorerAddressTemplate
  }
  const placeholder = type === 'tx' ? '{hash}' : '{addr}'
  return template.replace(placeholder, value)
}

/**
 * 해당 네트워크가 지원하는 체인 ID 목록 반환 (EVM 전용).
 * @param {string} networkKey
 * @returns {number[]}
 */
export function getSupportedChainIds(networkKey) {
  const net = NETWORKS[networkKey]
  if (!net || net.chainType !== 'evm') return []
  const ids = [net.chainId]
  if (net.testnet?.chainId) ids.push(net.testnet.chainId)
  return ids
}
