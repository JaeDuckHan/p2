import { useState } from 'react'
import { useAccount } from 'wagmi'
import WalletButton   from './components/WalletButton'
import CreateTrade    from './components/CreateTrade'
import JoinTrade      from './components/JoinTrade'
import TradeRoom      from './components/TradeRoom'
import './App.css'

export default function App() {
  const { isConnected, chain, chainId } = useAccount()

  // null | { tradeId, role }
  const [activeTrade, setActiveTrade] = useState(null)

  // 'sell' | 'buy'
  const [mode, setMode] = useState('sell')

  const SUPPORTED = [31337, 42161, 421614]
  const wrongNetwork = isConnected && chainId && !SUPPORTED.includes(chainId)

  function handleCreated(tradeId) {
    setActiveTrade({ tradeId, role: 'seller' })
  }

  function handleJoined(tradeId, role) {
    setActiveTrade({ tradeId, role })
  }

  function handleExit() {
    setActiveTrade(null)
  }

  return (
    <div className="app">
      {/* Wrong network banner */}
      {wrongNetwork && (
        <div className="network-warn">
          ⚠ 지원하지 않는 네트워크입니다. Arbitrum One 또는 로컬 Hardhat으로 전환하세요.
        </div>
      )}

      {/* Header */}
      <div className="header">
        <div className="logo">
          Mini<span className="accent">Swap</span>
          <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--muted)', marginLeft: '0.4rem' }}>
            P2P USDT ↔ KRW
          </span>
        </div>
        <WalletButton />
      </div>

      {/* Main content */}
      {!isConnected ? (
        /* ── Not connected ────────────────────────────── */
        <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>MiniSwap에 오신 것을 환영합니다</h1>
          <p className="muted" style={{ marginBottom: '2rem' }}>
            서버 없는 P2P USDT ↔ KRW 직거래 플랫폼<br/>
            스마트 컨트랙트 에스크로 · Arbitrum One
          </p>
          <WalletButton />
          <div style={{ marginTop: '2rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
            MetaMask 또는 호환 지갑이 필요합니다
          </div>
        </div>

      ) : activeTrade ? (
        /* ── Active trade room ────────────────────────── */
        <TradeRoom
          tradeId={activeTrade.tradeId}
          initialRole={activeTrade.role}
          onExit={handleExit}
        />

      ) : (
        /* ── Home: select mode ────────────────────────── */
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

          <div className="card">
            <div className="card-title">
              {mode === 'sell' ? '📤 거래 생성 (판매자)' : '📥 거래 참여 (구매자)'}
            </div>
            {mode === 'sell'
              ? <CreateTrade onCreated={handleCreated} />
              : <JoinTrade   onJoined={handleJoined}  />
            }
          </div>

          {/* Info section */}
          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="card-title">거래 흐름</div>
            <div className="steps" style={{ margin: 0 }}>
              <div className="step">
                <div className="step-num" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>1</div>
                <div className="step-body">
                  <div className="step-title">판매자 — USDT 예치</div>
                  <div className="step-desc">USDT가 에스크로에 잠기고, 구매자에게 거래 ID를 공유합니다</div>
                </div>
              </div>
              <div className="step">
                <div className="step-num" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>2</div>
                <div className="step-body">
                  <div className="step-title">구매자 — KRW 송금</div>
                  <div className="step-desc">P2P 채팅으로 계좌를 교환하고 KRW를 이체합니다</div>
                </div>
              </div>
              <div className="step">
                <div className="step-num" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>3</div>
                <div className="step-body">
                  <div className="step-title">판매자 — USDT 릴리즈</div>
                  <div className="step-desc">입금 확인 후 release() 호출 → 구매자에게 USDT 전송</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
