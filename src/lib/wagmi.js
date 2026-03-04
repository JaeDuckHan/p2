/**
 * wagmi.js
 *
 * Wagmi (이더리움 지갑 라이브러리) 설정 파일.
 * 모든 EVM 체인을 한번에 등록하여 런타임 네트워크 전환을 지원한다.
 *
 * 커넥터:
 * - injected: MetaMask, Trust Wallet 등 브라우저 주입 지갑 (데스크톱·인앱 브라우저)
 * - walletConnect: QR코드/딥링크로 외부 지갑 앱 연결 (모바일 일반 브라우저)
 */
import { createConfig, http } from 'wagmi'
import { arbitrum, arbitrumSepolia, polygon, polygonAmoy } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

/** 모든 지원 EVM 체인 (메인넷 + 테스트넷) */
const ALL_CHAINS = [arbitrum, arbitrumSepolia, polygon, polygonAmoy]

/** WalletConnect projectId — 없으면 walletConnect 커넥터를 등록하지 않는다 */
const wcProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID
const origin = typeof window !== 'undefined' ? window.location.origin : ''

export const wagmiConfig = createConfig({
  chains: ALL_CHAINS,
  connectors: [
    injected(),
    ...(wcProjectId
      ? [walletConnect({
          projectId: wcProjectId,
          metadata: {
            name: 'MiniSwap',
            description: 'P2P USDT ↔ KRW 직거래 플랫폼',
            url: origin,
            icons: [origin ? `${origin}/favicon.ico` : ''],
          },
          showQrModal: true,
        })]
      : []),
  ],
  transports: {
    [arbitrum.id]: http(),
    [arbitrumSepolia.id]: http(),
    [polygon.id]: http(),
    [polygonAmoy.id]: http(),
  },
})
