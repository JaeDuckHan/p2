import { useAccount, useConnect, useDisconnect } from 'wagmi'

function shortAddr(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** 모바일 환경인지 감지 */
function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

/** MetaMask 인앱 브라우저인지 감지 */
function isMetaMaskBrowser() {
  return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask
}

/**
 * MetaMask 딥링크 생성
 * MetaMask 앱의 인앱 브라우저에서 현재 dApp을 열어줌
 */
function getMetaMaskDeepLink() {
  const dappUrl = window.location.href.replace(/^https?:\/\//, '')
  return `https://metamask.app.link/dapp/${dappUrl}`
}

export default function WalletButton() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {chain && (
          <span className="badge badge-teal" style={{ fontSize: 9, padding: '2px 7px' }}>
            {chain.name}
          </span>
        )}
        <button
          className="wallet-btn connected"
          onClick={() => disconnect()}
          title={address}
        >
          <span className="p2p-dot on" style={{ width: 5, height: 5 }} />
          {shortAddr(address)}
        </button>
      </div>
    )
  }

  // 모바일인데 MetaMask 인앱 브라우저가 아닌 경우 (Safari, Chrome 등)
  // → MetaMask 앱으로 딥링크
  if (isMobile() && !isMetaMaskBrowser()) {
    return (
      <a
        href={getMetaMaskDeepLink()}
        className="wallet-btn"
        style={{ textDecoration: 'none', textAlign: 'center' }}
      >
        🦊 MetaMask에서 열기
      </a>
    )
  }

  // 데스크톱 또는 MetaMask 인앱 브라우저 → injected connector 사용
  const injector = connectors.find(c => c.id === 'injected')

  return (
    <button
      className="wallet-btn"
      disabled={isPending}
      onClick={() => {
        if (injector) {
          connect({ connector: injector })
        } else {
          // injected provider가 없는 경우 (데스크톱에 MetaMask 미설치)
          window.open('https://metamask.io/download/', '_blank')
        }
      }}
    >
      {isPending ? '연결 중…' : '🦊 지갑 연결'}
    </button>
  )
}
