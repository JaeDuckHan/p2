import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import WalletButton   from './components/WalletButton'
import CreateTrade    from './components/CreateTrade'
import JoinTrade      from './components/JoinTrade'
import TradeRoom      from './components/TradeRoom'
import OrderbookView  from './components/OrderbookView'
import { useOrderbook } from './hooks/useOrderbook'
import './App.css'

export default function App() {
  const { isConnected, chain, chainId, address } = useAccount()

  // null | { tradeId, role }
  const [activeTrade, setActiveTrade] = useState(null)

  // 'orderbook' | 'direct'
  const [page, setPage] = useState('orderbook')

  // 'sell' | 'buy' (for direct trade mode)
  const [mode, setMode] = useState('sell')

  const orderbook = useOrderbook({ enabled: isConnected })

  // Onboarding guide: 첫 접속 유저에게만 표시, 닫으면 localStorage에 저장
  const [showGuide, setShowGuide] = useState(() => {
    return !localStorage.getItem('miniswap_guide_dismissed')
  })
  const dismissGuide = useCallback(() => {
    setShowGuide(false)
    localStorage.setItem('miniswap_guide_dismissed', '1')
  }, [])

  const SUPPORTED = [31337, 42161, 421614]
  const wrongNetwork = isConnected && chainId && !SUPPORTED.includes(chainId)

  // P1: 네트워크 자동 전환 — wallet_addEthereumChain 사용
  const switchToArbitrum = useCallback(async () => {
    if (!window.ethereum) return
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x66eee' }], // 421614 = Arbitrum Sepolia
      })
    } catch (switchError) {
      // 4902: chain not added yet → add it
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x66eee',
            chainName: 'Arbitrum Sepolia',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
            blockExplorerUrls: ['https://sepolia.arbiscan.io'],
          }],
        })
      }
    }
  }, [])

  // Listen for accept-req events from OrderDetail component
  useEffect(() => {
    function handleAcceptReq(e) {
      orderbook.requestAccept(e.detail)
    }
    window.addEventListener('miniswap:accept-req', handleAcceptReq)
    return () => window.removeEventListener('miniswap:accept-req', handleAcceptReq)
  }, [orderbook.requestAccept])

  function handleCreated(tradeId) {
    if (activeTrade?.fromOrderbook && activeTrade?.prefillBuyer && activeTrade?.orderId) {
      orderbook.notifyTradeCreated(activeTrade.prefillBuyer, activeTrade.orderId, tradeId)
    }
    setActiveTrade({ tradeId, role: 'seller' })
  }

  function handleJoined(tradeId, role) {
    setActiveTrade({ tradeId, role })
  }

  function handleExit() {
    setActiveTrade(null)
  }

  // Auto-navigate buyer to TradeRoom when seller creates escrow
  useEffect(() => {
    if (!address || activeTrade?.tradeId) return
    const notif = orderbook.tradeNotifications.find(
      n => n.buyer?.toLowerCase() === address?.toLowerCase()
    )
    if (notif?.tradeId) {
      setActiveTrade({ tradeId: notif.tradeId, role: 'buyer' })
    }
  }, [orderbook.tradeNotifications, address, activeTrade])

  function handleStartTrade(tradeId, role, meta) {
    if (tradeId) {
      setActiveTrade({ tradeId, role })
    } else if (meta?.buyerAddress) {
      setPage('direct')
      setMode('sell')
      setActiveTrade({ prefillBuyer: meta.buyerAddress, orderId: meta.orderId, role: 'seller', fromOrderbook: true })
    }
  }

  return (
    <div className="app">
      {/* Wrong network banner — P1: 클릭 한 번에 네트워크 자동 전환 */}
      {wrongNetwork && (
        <div className="network-warn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>⚠ 지원하지 않는 네트워크입니다.</span>
          <button
            onClick={switchToArbitrum}
            style={{
              background: 'var(--amber)', color: 'var(--ink)', border: 'none',
              borderRadius: 8, padding: '4px 12px', fontSize: 11, fontWeight: 800,
              cursor: 'pointer', fontFamily: 'var(--sans)',
            }}
          >
            Arbitrum Sepolia로 전환
          </button>
        </div>
      )}

      {/* Header */}
      <div className="header">
        <div className="logo" onClick={() => { setActiveTrade(null); setPage('orderbook') }} style={{ cursor: 'pointer' }}>
          <div className="logo-icon">M</div>
          <div>
            <div className="logo-text">Mini<span className="accent">Swap</span></div>
            <div className="logo-sub">P2P USDT ↔ KRW</div>
          </div>
        </div>
        <WalletButton />
      </div>

      {/* Main content */}
      {!isConnected ? (
        /* ── Splash / Not connected ──────────────────── */
        <div className="splash">
          <div className="splash-logo">M</div>
          <div className="splash-title">MiniSwap</div>
          <div className="splash-sub">USDT ↔ KRW</div>
          <div className="splash-pills">
            <span className="splash-pill">🛡 서버리스</span>
            <span className="splash-pill">⚡ P2P</span>
            <span className="splash-pill">🔒 에스크로</span>
            <span className="splash-pill">💎 Arbitrum</span>
          </div>
          <WalletButton />
          <div className="splash-note">
            회원가입 없음 · 개인정보 수집 없음
          </div>
        </div>

      ) : activeTrade && activeTrade.tradeId ? (
        /* ── Active trade room ────────────────────────── */
        <div className="main-content">
          <TradeRoom
            tradeId={activeTrade.tradeId}
            initialRole={activeTrade.role}
            onExit={handleExit}
          />
        </div>

      ) : (
        /* ── Home ─────────────────────────────────────── */
        <>
          {/* P1~P2: 'No KYC, No 가입' 상시 신뢰 배너 */}
          <div className="trust-banner">
            <span className="trust-banner-item">🔒 No KYC</span>
            <span className="trust-banner-item">🛡 개인정보 수집 없음</span>
            <span className="trust-banner-item">⚡ 가입 불필요</span>
          </div>

          {/* P0: 온보딩 가이드 배너 — 첫 접속 유저용 */}
          {showGuide && (
            <div className="guide-banner">
              <button className="guide-banner-close" onClick={dismissGuide}>✕</button>
              <div className="guide-banner-title">처음이신가요? 3단계로 시작하세요</div>
              <div className="guide-steps">
                <div className="guide-step">
                  <div className="guide-step-icon">🦊</div>
                  <div className="guide-step-label">지갑 연결</div>
                </div>
                <div className="guide-arrow">→</div>
                <div className="guide-step">
                  <div className="guide-step-icon">💎</div>
                  <div className="guide-step-label">USDT 준비</div>
                </div>
                <div className="guide-arrow">→</div>
                <div className="guide-step">
                  <div className="guide-step-icon">🤝</div>
                  <div className="guide-step-label">P2P 거래</div>
                </div>
              </div>
            </div>
          )}

          {/* Top-level tabs: 오더북 | 직접거래 */}
          <div className="page-tabs">
            <button
              className={`page-tab ${page === 'orderbook' ? 'active' : ''}`}
              onClick={() => setPage('orderbook')}
            >
              오더북
            </button>
            <button
              className={`page-tab ${page === 'direct' ? 'active' : ''}`}
              onClick={() => setPage('direct')}
            >
              직접거래
            </button>
          </div>

          <div className="main-content">
            {page === 'orderbook' ? (
              /* ── Orderbook view ───────────────────────── */
              <OrderbookView orderbook={orderbook} onStartTrade={handleStartTrade} />

            ) : (
              /* ── Direct trade (original) ──────────────── */
              <>
                <div className="home-grid">
                  <div
                    className={`role-card ${mode === 'sell' ? 'active' : ''}`}
                    onClick={() => setMode('sell')}
                  >
                    <div className="role-icon">📤</div>
                    <div className="role-title">USDT 팔기</div>
                    <div className="role-desc">
                      USDT를 에스크로에 예치하고<br/>
                      구매자의 KRW 송금을 기다립니다
                    </div>
                  </div>
                  <div
                    className={`role-card ${mode === 'buy' ? 'active' : ''}`}
                    onClick={() => setMode('buy')}
                  >
                    <div className="role-icon">📥</div>
                    <div className="role-title">USDT 사기</div>
                    <div className="role-desc">
                      판매자에게 거래 ID를 받아<br/>
                      입장하고 KRW를 송금합니다
                    </div>
                  </div>
                </div>

                <div className="pad">
                  <div className="card">
                    <div className="card-title">
                      {mode === 'sell' ? '📤 거래 생성 (판매자)' : '📥 거래 참여 (구매자)'}
                    </div>
                    {mode === 'sell'
                      ? <CreateTrade onCreated={handleCreated} prefillBuyer={activeTrade?.prefillBuyer} />
                      : <JoinTrade   onJoined={handleJoined}  />
                    }
                  </div>

                  {/* Info section */}
                  <div className="card">
                    <div className="card-title">거래 흐름</div>
                    <div className="steps" style={{ margin: 0 }}>
                      <div className="step">
                        <div className="step-num">1</div>
                        <div className="step-body">
                          <div className="step-title">판매자 — USDT 예치</div>
                          <div className="step-desc">USDT가 에스크로에 잠기고, 구매자에게 거래 ID를 공유합니다</div>
                        </div>
                      </div>
                      <div className="step">
                        <div className="step-num">2</div>
                        <div className="step-body">
                          <div className="step-title">구매자 — KRW 송금</div>
                          <div className="step-desc">P2P 채팅으로 계좌를 교환하고 KRW를 이체합니다</div>
                        </div>
                      </div>
                      <div className="step">
                        <div className="step-num">3</div>
                        <div className="step-body">
                          <div className="step-title">판매자 — USDT 릴리즈</div>
                          <div className="step-desc">입금 확인 후 release() 호출 → 구매자에게 USDT 전송</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Bottom Navigation */}
          <div className="bottom-nav">
            <button
              className={`bnav-item ${page === 'orderbook' ? 'active' : ''}`}
              onClick={() => setPage('orderbook')}
            >
              <span className="bnav-icon">📊</span>
              <span className="bnav-label">거래소</span>
            </button>
            <button className="bnav-item" onClick={() => { setPage('orderbook'); /* TODO: filter to my orders */ }}>
              <span className="bnav-icon">📋</span>
              <span className="bnav-label">내 오더</span>
            </button>
            <button className="bnav-item" onClick={() => { setPage('direct'); /* TODO: trade history */ }}>
              <span className="bnav-icon">🕐</span>
              <span className="bnav-label">내역</span>
            </button>
            <button
              className={`bnav-item ${page === 'direct' ? 'active' : ''}`}
              onClick={() => setPage('direct')}
            >
              <span className="bnav-icon">👤</span>
              <span className="bnav-label">직접거래</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
