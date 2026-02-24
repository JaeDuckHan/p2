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
function MetaMaskModal({ onClose }) {
  const mobile = isMobile()

  return (
    <div className="mm-overlay" onClick={onClose}>
      <div className="mm-modal" onClick={e => e.stopPropagation()}>
        <button className="mm-close" onClick={onClose}>&times;</button>

        <div className="mm-icon">🦊</div>
        <h3 className="mm-title">MetaMask 지갑이 필요합니다</h3>
        <p className="mm-desc">
          MiniSwap은 MetaMask 지갑을 통해 블록체인에 연결합니다.<br />
          아래 안내를 따라 설치해 주세요.
        </p>

        {mobile ? (
          <>
            <div className="mm-section">
              <div className="mm-section-title">모바일 설치 방법</div>
              <div className="mm-steps">
                <div className="mm-step">
                  <span className="mm-step-num">1</span>
                  <span>앱스토어에서 <strong>MetaMask</strong> 검색 후 설치</span>
                </div>
                <div className="mm-step">
                  <span className="mm-step-num">2</span>
                  <span>MetaMask 앱 실행 → 지갑 생성</span>
                </div>
                <div className="mm-step">
                  <span className="mm-step-num">3</span>
                  <span>앱 내 <strong>브라우저</strong>에서 이 사이트 접속</span>
                </div>
              </div>
            </div>
            <a
              href={getMetaMaskDeepLink()}
              className="btn btn-teal mm-btn"
            >
              MetaMask 앱에서 열기
            </a>
          </>
        ) : (
          <>
            <div className="mm-section">
              <div className="mm-section-title">데스크톱 설치 방법</div>
              <div className="mm-steps">
                <div className="mm-step">
                  <span className="mm-step-num">1</span>
                  <span>아래 버튼으로 Chrome 확장 설치</span>
                </div>
                <div className="mm-step">
                  <span className="mm-step-num">2</span>
                  <span>MetaMask에서 지갑 생성 또는 복구</span>
                </div>
                <div className="mm-step">
                  <span className="mm-step-num">3</span>
                  <span>이 페이지 새로고침 후 <strong>지갑 연결</strong> 클릭</span>
                </div>
              </div>
            </div>
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-teal mm-btn"
            >
              MetaMask 설치 페이지 열기
            </a>
          </>
        )}

        <div className="mm-note">
          설치 후 이 페이지를 새로고침하면 자동으로 연결 버튼이 활성화됩니다.
        </div>
      </div>
    </div>
  )
}

export default function WalletButton() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const [showModal, setShowModal] = useState(false)

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
      <>
        <button
          className="wallet-btn"
          onClick={() => setShowModal(true)}
        >
          🦊 MetaMask에서 열기
        </button>
        {showModal && <MetaMaskModal onClose={() => setShowModal(false)} />}
      </>
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
          if (injector && window.ethereum) {
            connect({ connector: injector })
          } else {
            // MetaMask 미설치 → 모달 표시
            setShowModal(true)
          }
        }}
      >
        {isPending ? '연결 중…' : '🦊 지갑 연결'}
      </button>
      {showModal && <MetaMaskModal onClose={() => setShowModal(false)} />}
    </>
  )
}
