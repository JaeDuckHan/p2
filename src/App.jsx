import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import WalletButton   from './components/WalletButton'
import NetworkGuide   from './components/NetworkGuide'
import OnboardBanner  from './components/OnboardBanner'
import CreateTrade    from './components/CreateTrade'
import JoinTrade      from './components/JoinTrade'
import TradeRoom      from './components/TradeRoom'
import OrderbookView  from './components/OrderbookView'
import { useOrderbook } from './hooks/useOrderbook'
import './App.css'

const ARBITRUM_CHAIN_ID_HEX = '0xA4B1'
const ARBITRUM_PARAMS = {
  chainId: ARBITRUM_CHAIN_ID_HEX,
  chainName: 'Arbitrum One',
  rpcUrls: ['https://arb1.arbitrum.io/rpc'],
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  blockExplorerUrls: ['https://arbiscan.io'],
}

export default function App() {
  const { isConnected, chain, chainId, address } = useAccount()

  // null | { tradeId, role }
  const [activeTrade, setActiveTrade] = useState(null)

  // 'orderbook' | 'direct' | 'my-orders'
  const [page, setPage] = useState('orderbook')

  // 'sell' | 'buy' (for direct trade mode)
  const [mode, setMode] = useState('sell')

  const orderbook = useOrderbook({ enabled: isConnected })

  const SUPPORTED = [31337, 42161, 421614]
  const wrongNetwork = isConnected && chainId && !SUPPORTED.includes(chainId)

  // Network warning: connected but on wrong network (partial — still usable)
  const showNetworkWarn = isConnected && chainId && !SUPPORTED.includes(chainId)

  const [networkSwitching, setNetworkSwitching] = useState(false)

  async function handleNetworkSwitch() {
    if (!window.ethereum) return
    setNetworkSwitching(true)
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARBITRUM_CHAIN_ID_HEX }],
      })
    } catch (err) {
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [ARBITRUM_PARAMS],
          })
        } catch (_) {}
      }
    } finally {
      setNetworkSwitching(false)
    }
  }

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

      {/* Network Warning Banner — clickable, auto-switch */}
      {isConnected && showNetworkWarn && (
        <div className="network-warn-banner" onClick={handleNetworkSwitch}>
          <div className="nw-left">
            <span className="nw-icon">&#x26A0;&#xFE0F;</span>
            <div>
              <div className="nw-text">Arbitrum One 네트워크 전환 필요</div>
              <div className="nw-sub">USDT 거래를 위해 네트워크를 변경하세요</div>
            </div>
          </div>
          <button className="nw-btn" disabled={networkSwitching}>
            {networkSwitching ? '전환 중...' : '전환하기 →'}
          </button>
        </div>
      )}

      {/* Main content */}
      {!isConnected ? (
        /* ── Hero: Not connected ─────────────────────── */
        <div className="hero">
          <h1 className="hero-title hero-3d">
            <span className="hero-3d-text" data-text="Mini">Mini</span><span className="hero-3d-accent" data-text="Swap">Swap</span>
          </h1>
          <p className="hero-sub">
            P2P USDT ↔ KRW 직거래 플랫폼
          </p>
          <p className="hero-desc">
            서버 없는 탈중앙 에스크로 거래<br/>
            스마트 컨트랙트가 당신의 자산을 보호합니다
          </p>

          {/* Feature cards */}
          <div className="feature-grid">
            <div className="feature-card">
              <div className="feature-icon">&#x1F512;</div>
              <div className="feature-title">에스크로 보호</div>
              <div className="feature-desc">
                USDT가 스마트 컨트랙트에 안전하게 잠기고,
                양쪽 모두 확인 후 전송됩니다
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">&#x26A1;</div>
              <div className="feature-title">Arbitrum L2</div>
              <div className="feature-desc">
                이더리움 보안 + L2 속도,
                가스비 수십 원으로 즉시 거래
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">&#x1F4B0;</div>
              <div className="feature-title">수수료 2%</div>
              <div className="feature-desc">
                숨겨진 비용 없이 투명한 수수료,
                컨트랙트에서 자동 계산
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="hero-cta">
            <WalletButton />
            <p className="hero-hint">
              MetaMask 또는 호환 지갑이 필요합니다
            </p>
          </div>

          {/* How it works */}
          <div className="hero-how">
            <div className="hero-how-title">이용 방법</div>
            <div className="hero-steps">
              <div className="hero-step">
                <div className="hero-step-num">1</div>
                <div className="hero-step-text">
                  <strong>지갑 연결</strong>
                  <span>MetaMask로 로그인</span>
                </div>
              </div>
              <div className="hero-step-arrow">→</div>
              <div className="hero-step">
                <div className="hero-step-num">2</div>
                <div className="hero-step-text">
                  <strong>USDT 예치</strong>
                  <span>에스크로에 안전 보관</span>
                </div>
              </div>
              <div className="hero-step-arrow">→</div>
              <div className="hero-step">
                <div className="hero-step-num">3</div>
                <div className="hero-step-text">
                  <strong>KRW 송금</strong>
                  <span>P2P 채팅으로 확인</span>
                </div>
              </div>
              <div className="hero-step-arrow">→</div>
              <div className="hero-step">
                <div className="hero-step-num">4</div>
                <div className="hero-step-text">
                  <strong>USDT 수령</strong>
                  <span>자동 전송 완료</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      ) : wrongNetwork ? (
        /* ── Wrong network → Guide ───────────────────── */
        <NetworkGuide />

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
          {/* Onboarding guide for new users */}
          <OnboardBanner />

          {/* Top-level tabs: 오더북 | 직접거래 */}
          <div className="page-tabs">
            <button
              className={`page-tab ${page === 'orderbook' || page === 'my-orders' ? 'active' : ''}`}
              onClick={() => setPage('orderbook')}
            >
              거래소
            </button>
            <button
              className={`page-tab ${page === 'direct' ? 'active' : ''}`}
              onClick={() => setPage('direct')}
            >
              직접거래
            </button>
          </div>

          <div className="main-content">
            {page === 'orderbook' || page === 'my-orders' ? (
              /* ── Orderbook / 내 오더 view ─────────────── */
              <OrderbookView
                orderbook={orderbook}
                onStartTrade={handleStartTrade}
                myOrdersOnly={page === 'my-orders'}
              />

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
                  <div className="card" style={{ borderColor: 'var(--teal-b)' }}>
                    <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>&#x1F6E1;&#xFE0F;</span> 에스크로 보호 거래 흐름
                    </div>
                    <div className="steps" style={{ margin: 0 }}>
                      <div className="step">
                        <div className="step-num">1</div>
                        <div className="step-body">
                          <div className="step-title">&#x1F512; 판매자 — USDT 예치</div>
                          <div className="step-desc">USDT가 스마트 컨트랙트에 안전하게 잠기고, 구매자에게 거래 ID를 공유합니다</div>
                        </div>
                      </div>
                      <div className="step">
                        <div className="step-num">2</div>
                        <div className="step-body">
                          <div className="step-title">&#x1F4B1; 구매자 — KRW 송금</div>
                          <div className="step-desc">P2P 암호화 채팅으로 계좌를 교환하고 KRW를 이체합니다</div>
                        </div>
                      </div>
                      <div className="step">
                        <div className="step-num">3</div>
                        <div className="step-body">
                          <div className="step-title">&#x2705; 판매자 — USDT 릴리즈</div>
                          <div className="step-desc">입금 확인 후 릴리즈 → 구매자에게 USDT 자동 전송 완료</div>
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
            <button
              className={`bnav-item ${page === 'my-orders' ? 'active' : ''}`}
              onClick={() => setPage('my-orders')}
            >
              <span className="bnav-icon">📋</span>
              <span className="bnav-label">내 오더</span>
            </button>
            <button className="bnav-item" onClick={() => setPage('direct')}>
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
