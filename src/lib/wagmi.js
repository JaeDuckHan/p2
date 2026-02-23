import { createConfig, http } from 'wagmi'
import { arbitrum, arbitrumSepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'

// Local Hardhat chain (chainId 31337)
const hardhat = {
  id: 31337,
  name: 'Hardhat',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
}

export const SUPPORTED_CHAINS = [hardhat, arbitrum, arbitrumSepolia]

export const wagmiConfig = createConfig({
  chains: [hardhat, arbitrum, arbitrumSepolia],
  connectors: [
    injected({
      // MetaMask 인앱 브라우저 + 데스크톱 확장프로그램 모두 지원
      shimDisconnect: true,
    }),
  ],
  transports: {
    [hardhat.id]:          http('http://127.0.0.1:8545'),
    [arbitrum.id]:         http(),
    [arbitrumSepolia.id]:  http(),
  },
})
