import { useState } from 'react'
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

/** MetaMask 미설치 안내 모달 */
function InstallMetaMaskModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: 'linear-gradient(135deg, #f6851b, #e2761b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, margin: '0 auto 16px',
          }}>
            🦊
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>
            MetaMask가 필요합니다
          </div>
          <div style={{ fontSize: 13, color: 'var(--snow3)', lineHeight: 1.7, marginBottom: 20 }}>
            MiniSwap은 <strong style={{ color: 'var(--teal)' }}>MetaMask</strong> 지갑으로
            작동합니다.<br />
            아래 버튼을 눌러 설치한 뒤 새로고침하세요.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-teal"
              style={{ textDecoration: 'none', textAlign: 'center' }}
            >
              🦊 MetaMask 설치하기
            </a>
            <button className="btn btn-ghost" onClick={onClose}>
              닫기
            </button>
          </div>

          <div style={{ fontSize: 11, color: 'var(--snow3)', marginTop: 16, lineHeight: 1.6 }}>
            <strong>설치 후 이용 방법:</strong><br />
            1. MetaMask 확장 프로그램 설치<br />
            2. 지갑 생성 또는 기존 지갑 가져오기<br />
            3. 이 페이지 새로고침 후 지갑 연결
          </div>
        </div>
      </div>
    </div>
  )
}

export default function WalletButton() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const [showInstallModal, setShowInstallModal] = useState(false)

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
    <>
      <button
        className="wallet-btn"
        disabled={isPending}
        onClick={() => {
          if (injector && typeof window.ethereum !== 'undefined') {
            connect({ connector: injector })
          } else {
            // injected provider가 없는 경우 (데스크톱에 MetaMask 미설치)
            setShowInstallModal(true)
          }
        }}
      >
        {isPending ? '연결 중…' : '🦊 지갑 연결'}
      </button>

      {showInstallModal && (
        <InstallMetaMaskModal onClose={() => setShowInstallModal(false)} />
      )}
    </>
  )
}
