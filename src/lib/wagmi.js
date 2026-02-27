/**
 * wagmi.js
 *
 * Wagmi (이더리움 지갑 라이브러리) 설정 파일.
 * 지원 네트워크: Arbitrum One (메인넷) + Arbitrum Sepolia (테스트넷)
 *
 * - Hardhat 로컬 체인은 제거됨 (메인넷 전환 완료)
 * - MetaMask injected 커넥터 사용 (인앱 브라우저 + 데스크톱 확장프로그램)
 */
import { createConfig, http } from 'wagmi'
import { arbitrum, arbitrumSepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

/** 지원하는 체인 목록 (메인넷 우선) */
export const SUPPORTED_CHAINS = [arbitrum, arbitrumSepolia]

export const wagmiConfig = createConfig({
  chains: [arbitrum, arbitrumSepolia],
  connectors: [
    injected({
      // MetaMask 인앱 브라우저 + 데스크톱 확장프로그램 모두 지원
      shimDisconnect: true,
    }),
  ],
  transports: {
    [arbitrum.id]:         http(),          // Arbitrum One (42161)
    [arbitrumSepolia.id]:  http(),          // Arbitrum Sepolia (421614)
  },
})
