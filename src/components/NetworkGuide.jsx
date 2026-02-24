import { useState } from 'react'
import { useAccount } from 'wagmi'

const ARBITRUM_CHAIN_ID = '0xA4B1' // 42161

const ARBITRUM_PARAMS = {
  chainId: ARBITRUM_CHAIN_ID,
  chainName: 'Arbitrum One',
  rpcUrls: ['https://arb1.arbitrum.io/rpc'],
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  blockExplorerUrls: ['https://arbiscan.io'],
}

export default function NetworkGuide() {
  const { chain } = useAccount()
  const [showManual, setShowManual] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState(null)

  async function handleSwitch() {
    if (!window.ethereum) {
      setError('MetaMask가 설치되어 있지 않습니다.')
      return
    }
    setSwitching(true)
    setError(null)
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARBITRUM_CHAIN_ID }],
      })
    } catch (err) {
      // 4902 = chain not added yet
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [ARBITRUM_PARAMS],
          })
        } catch (addErr) {
          setError('네트워크 추가가 취소되었습니다. 수동으로 추가해 주세요.')
        }
      } else if (err.code === 4001) {
        setError('전환이 취소되었습니다.')
      } else {
        setError('네트워크 전환에 실패했습니다. 수동으로 추가해 주세요.')
      }
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="network-guide">
      <div className="guide-icon">&#x26A0;&#xFE0F;</div>
      <h2 className="guide-title">Arbitrum 네트워크 연결이 필요합니다</h2>
      <p className="guide-sub">
        MiniSwap은 <strong>Arbitrum One</strong> 네트워크에서 작동합니다.
      </p>

      <div className="guide-current">
        <div className="guide-current-item">
          <span className="guide-label">현재 네트워크</span>
          <span className="guide-value red">{chain?.name || '알 수 없음'}</span>
        </div>
        <div className="guide-current-item">
          <span className="guide-label">필요한 네트워크</span>
          <span className="guide-value green">Arbitrum One</span>
        </div>
      </div>

      <button
        className="btn btn-blue btn-lg btn-block guide-switch-btn"
        onClick={handleSwitch}
        disabled={switching}
      >
        {switching ? '전환 중...' : 'Arbitrum One으로 전환하기'}
      </button>

      {error && (
        <div className="alert alert-error" style={{ marginTop: '1rem' }}>
          {error}
        </div>
      )}

      {/* Manual toggle */}
      <button
        className="guide-toggle"
        onClick={() => setShowManual(v => !v)}
      >
        {showManual ? '▲' : '▼'} 자동 전환이 안 되나요? (수동 추가 방법)
      </button>

      {showManual && (
        <div className="guide-manual">
          {/* Method 1: ChainList */}
          <div className="guide-method">
            <div className="guide-method-title">
              방법 1 — ChainList <span className="badge badge-released">추천</span>
            </div>
            <div className="guide-steps">
              <div className="guide-step">
                <span className="guide-step-num">1</span>
                <span>
                  <a href="https://chainlist.org" target="_blank" rel="noopener noreferrer" className="guide-link">
                    chainlist.org
                  </a>
                  {' '}접속
                </span>
              </div>
              <div className="guide-step">
                <span className="guide-step-num">2</span>
                <span>검색창에 <strong>"Arbitrum"</strong> 입력</span>
              </div>
              <div className="guide-step">
                <span className="guide-step-num">3</span>
                <span><strong>"Add to MetaMask"</strong> 클릭 후 승인</span>
              </div>
            </div>
          </div>

          {/* Method 2: Arbitrum Bridge */}
          <div className="guide-method">
            <div className="guide-method-title">방법 2 — Arbitrum 공식 브릿지</div>
            <div className="guide-steps">
              <div className="guide-step">
                <span className="guide-step-num">1</span>
                <span>
                  <a href="https://bridge.arbitrum.io" target="_blank" rel="noopener noreferrer" className="guide-link">
                    bridge.arbitrum.io
                  </a>
                  {' '}접속
                </span>
              </div>
              <div className="guide-step">
                <span className="guide-step-num">2</span>
                <span>우측 상단 <strong>"Connect Wallet"</strong> 클릭</span>
              </div>
              <div className="guide-step">
                <span className="guide-step-num">3</span>
                <span><strong>"Switch Network"</strong> → <strong>"Add Network"</strong> → 승인</span>
              </div>
            </div>
          </div>

          {/* Mobile notice */}
          <div className="guide-mobile">
            <div className="guide-mobile-icon">&#x1F4F1;</div>
            <div className="guide-mobile-body">
              <div className="guide-mobile-title">아이폰 / 모바일 사용자</div>
              <div className="guide-mobile-desc">
                일반 Safari/Chrome에서는 MetaMask에 직접 연결할 수 없습니다.<br/>
                <strong>MetaMask 앱</strong>을 설치한 후, 앱 내 브라우저에서 이 사이트를 열어주세요.
              </div>
              <div className="guide-mobile-steps">
                <span>MetaMask 앱 열기</span>
                <span className="guide-arrow">→</span>
                <span>좌측 상단 메뉴</span>
                <span className="guide-arrow">→</span>
                <span>브라우저</span>
                <span className="guide-arrow">→</span>
                <span>이 사이트 주소 입력</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
