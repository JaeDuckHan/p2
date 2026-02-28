/**
 * wagmi.js
 *
 * Wagmi (이더리움 지갑 라이브러리) 설정 파일.
 * 모든 EVM 체인을 한번에 등록하여 런타임 네트워크 전환을 지원한다.
 *
 * - injected 커넥터 사용 (MetaMask, Trust Wallet, Coinbase Wallet 등 모든 EVM 지갑 자동 감지)
 */
import { createConfig, http } from 'wagmi'
import { arbitrum, arbitrumSepolia, polygon, polygonAmoy } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

/** 모든 지원 EVM 체인 (메인넷 + 테스트넷) */
const ALL_CHAINS = [arbitrum, arbitrumSepolia, polygon, polygonAmoy]

export const wagmiConfig = createConfig({
  chains: ALL_CHAINS,
  connectors: [
    injected({
      // MetaMask, Trust Wallet 등 인앱 브라우저 + 데스크톱 확장프로그램 모두 지원
      shimDisconnect: true,
    }),
  ],
  transports: {
    [arbitrum.id]: http(),
    [arbitrumSepolia.id]: http(),
    [polygon.id]: http(),
    [polygonAmoy.id]: http(),
  },
})
