/**
 * wagmi.js
 *
 * Wagmi (이더리움 지갑 라이브러리) 설정 파일.
 * ACTIVE_NETWORK에 따라 지원 체인이 자동 결정된다.
 *
 * - MetaMask injected 커넥터 사용 (인앱 브라우저 + 데스크톱 확장프로그램)
 */
import { createConfig, http } from 'wagmi'
import { arbitrum, arbitrumSepolia, polygon, polygonAmoy } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { ACTIVE_NETWORK, NETWORKS } from '../constants/network'

/** wagmi 체인 객체 매핑 */
const CHAIN_MAP = {
  arbitrum,
  arbitrumSepolia,
  polygon,
  polygonAmoy,
}

const net = NETWORKS[ACTIVE_NETWORK]
const mainChain  = CHAIN_MAP[net.wagmiChains.mainnet]
const testChain  = CHAIN_MAP[net.wagmiChains.testnet]

/** 지원하는 체인 목록 (메인넷 우선) */
export const SUPPORTED_CHAINS = [mainChain, testChain]

export const wagmiConfig = createConfig({
  chains: [mainChain, testChain],
  connectors: [
    injected({
      // MetaMask 인앱 브라우저 + 데스크톱 확장프로그램 모두 지원
      shimDisconnect: true,
    }),
  ],
  transports: {
    [mainChain.id]: http(),
    [testChain.id]: http(),
  },
})
