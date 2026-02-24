import { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import {
  useGetTrade,
  useIsRefundable,
  useRelease,
  useRefund,
  useDispute,
  formatUsdt,
} from '../hooks/useEscrow'
import { useXmtpChat } from '../hooks/useXmtpChat'
import { useXmtp } from '../contexts/XmtpContext'
import { TradeStatus, STATUS_LABEL, STATUS_CLASS } from '../constants'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(addr) {
  if (!addr) return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function useCountdown(expiresAt) {
  const [text, setText] = useState('')
  const [cls,  setCls]  = useState('ok')

  useEffect(() => {
    if (!expiresAt) return
    const tick = () => {
      const diff = Number(expiresAt) - Math.floor(Date.now() / 1000)
      if (diff <= 0) { setText('만료됨'); setCls('expired'); return }
      const d = Math.floor(diff / 86400)
      const h = Math.floor((diff % 86400) / 3600)
      const m = Math.floor((diff % 3600) / 60)
      const s = diff % 60
      setText(d > 0 ? `${d}일 ${h}시간 ${m}분` : h > 0 ? `${h}시간 ${m}분 ${s}초` : `${m}분 ${s}초`)
      setCls(diff < 3600 ? 'urgent' : diff < 86400 ? 'warn' : 'ok')
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  return { text, cls }
}

function formatCountdownShort(expiresAt) {
  if (!expiresAt) return '--:--'
  const diff = Number(expiresAt) - Math.floor(Date.now() / 1000)
  if (diff <= 0) return '00:00'
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// ─── MessageBubble ─────────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
  if (msg.type === 'sys') {
    return (
      <div className="msg sys">
        <div className="bubble">— {msg.text} —</div>
      </div>
    )
  }
  return (
    <div className={`msg ${msg.fromMe ? 'me' : 'peer'}`}>
      <div className="bubble">{msg.text}</div>
      <div className="msg-time">{fmtTime(msg.timestamp)}</div>
    </div>
  )
}

// ─── Step Indicator Row ─────────────────────────────────────────────────────────
function StepRow({ steps, current }) {
  return (
    <div className="steps-row">
      {steps.map((step, i) => {
        const isDone = i < current
        const isActive = i === current
        const cls = isDone ? 'done' : isActive ? 'active' : 'waiting'

        return (
          <div key={i} style={{ display: 'contents' }}>
            <div className="step-item">
              <div className={`step-circle ${cls}`}>
                {isDone ? '✓' : i + 1}
              </div>
              <div className="step-label">
                {step.split('<br>').map((line, j) => (
                  <span key={j}>{j > 0 && <br />}{line}</span>
                ))}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className={`step-connector ${isDone ? 'done' : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── TradeRoom ─────────────────────────────────────────────────────────────────
export default function TradeRoom({ tradeId, initialRole, onExit }) {
  const { address, chainId } = useAccount()
  const { trade, isLoading, refetch } = useGetTrade(tradeId)
  const isRefundable = useIsRefundable(tradeId, chainId)

  const { release, isPending: relPending, isConfirming: relConfirming, isSuccess: relSuccess, error: relErr } = useRelease(chainId)
  const { refund,  isPending: refPending, isConfirming: refConfirming, isSuccess: refSuccess, error: refErr } = useRefund(chainId)
  const { dispute, isPending: disPending, isConfirming: disConfirming, isSuccess: disSuccess, error: disErr } = useDispute(chainId)

  const { isReady: xmtpReady } = useXmtp()
  const peerAddress = trade
    ? (trade.seller.toLowerCase() === address?.toLowerCase() ? trade.buyer : trade.seller)
    : null
  const { peers, messages, send, connected } = useXmtpChat(peerAddress, tradeId)

  const [chatText, setChatText] = useState('')
  const chatRef = useRef(null)
  const [confirm, setConfirm] = useState(null)
  const [shortCountdown, setShortCountdown] = useState('--:--')

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  // Refetch after tx confirms
  useEffect(() => { if (relSuccess || refSuccess || disSuccess) refetch() }, [relSuccess, refSuccess, disSuccess])

  // Notify peers after release
  useEffect(() => {
    if (relSuccess) send({ type: 'signal', text: '판매자가 USDT를 전송했습니다! 잔고를 확인하세요 ✓' })
  }, [relSuccess])

  // Short countdown for timer circle
  useEffect(() => {
    if (!trade?.expiresAt) return
    const tick = () => setShortCountdown(formatCountdownShort(trade.expiresAt))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [trade?.expiresAt])

  const role = trade
    ? (trade.seller.toLowerCase() === address?.toLowerCase() ? 'seller' : 'buyer')
    : initialRole

  const status = trade?.status
  const { text: countdownText, cls: countdownCls } = useCountdown(trade?.expiresAt)

  // ── Send chat message ────────────────────────────────────────────────────────
  function handleSend(e) {
    e.preventDefault()
    const t = chatText.trim()
    if (!t) return
    send({ type: 'text', text: t })
    setChatText('')
  }

  // ── Confirm then execute ─────────────────────────────────────────────────────
  function doConfirmedAction() {
    if (!confirm) return
    if (confirm.action === 'release') release(tradeId)
    if (confirm.action === 'refund')  refund(tradeId)
    if (confirm.action === 'dispute') dispute(tradeId)
    setConfirm(null)
  }

  const isWorking = relPending || relConfirming || refPending || refConfirming || disPending || disConfirming
  const txError   = relErr || refErr || disErr

  function copyId() {
    navigator.clipboard.writeText(tradeId).then(() => alert('거래 ID 복사됨')).catch(() => {})
  }

  // ── Determine step for step indicator ────────────────────────────────────────
  function getStepInfo() {
    if (role === 'seller') {
      const steps = ['구매자<br>선택', '에스크로<br>락', 'KRW<br>확인', '릴리즈']
      if (status === TradeStatus.RELEASED) return { steps, current: 4 }
      if (status === TradeStatus.REFUNDED) return { steps, current: 4 }
      if (status === TradeStatus.DISPUTED) return { steps, current: 3 }
      if (status === TradeStatus.LOCKED) return { steps, current: 2 }
      return { steps, current: 1 }
    } else {
      const steps = ['수락<br>요청', '에스크로<br>대기', 'KRW<br>송금', '완료']
      if (status === TradeStatus.RELEASED) return { steps, current: 4 }
      if (status === TradeStatus.REFUNDED) return { steps, current: 4 }
      if (status === TradeStatus.DISPUTED) return { steps, current: 3 }
      if (status === TradeStatus.LOCKED) return { steps, current: 2 }
      return { steps, current: 1 }
    }
  }

  const stepInfo = getStepInfo()

  return (
    <div className="fade-in">
      {/* App bar */}
      <div className="app-bar">
        <button className="app-bar-back" onClick={onExit}>←</button>
        <div className="app-bar-title">
          {status === TradeStatus.RELEASED ? '거래 완료' :
           status === TradeStatus.REFUNDED ? '환불 완료' :
           status === TradeStatus.DISPUTED ? '분쟁 중' :
           '거래 진행중'}
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* Step indicators */}
      <StepRow steps={stepInfo.steps} current={stepInfo.current} />

      <div style={{ paddingBottom: 20 }}>
        {/* Timer circle (for LOCKED status) */}
        {status === TradeStatus.LOCKED && (
          <div style={{ textAlign: 'center', padding: '12px 0 14px' }}>
            <div
              className="timer-circle amber"
              style={{ width: 84, height: 84, margin: '0 auto' }}
            >
              <div className="timer-num" style={{ color: 'var(--amber)' }}>{shortCountdown}</div>
              <div className="timer-label">남은시간</div>
            </div>
          </div>
        )}

        {/* Status header badge */}
        <div className="pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
            <span className={`badge ${trade ? STATUS_CLASS[status] : 'badge-gray'}`}>
              {trade ? STATUS_LABEL[status] : '로드 중...'}
            </span>
            <span className="badge badge-gray">
              {role === 'seller' ? '📤 판매자' : '📥 구매자'}
            </span>
          </div>

          {/* Trade ID */}
          <div className="card" style={{ padding: '10px 14px', marginBottom: 9 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--snow3)', textTransform: 'uppercase', marginBottom: 4 }}>거래 ID</div>
            <div className="trade-id-box" onClick={copyId} title="클릭하여 복사">
              <span>{tradeId}</span>
              <span style={{ color: 'var(--teal)', flexShrink: 0, fontSize: 11, fontWeight: 700 }}>복사</span>
            </div>
          </div>

          {/* Trade info card */}
          {trade && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 7 }}>
                <span className="muted">거래 금액</span>
                <span style={{ fontWeight: 800, fontSize: 15 }}>{formatUsdt(trade.amount)} USDT</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 7 }}>
                <span className="muted">수수료 (2%)</span>
                <span style={{ fontWeight: 700 }}>{formatUsdt(trade.feeAmount)} USDT</span>
              </div>
              <div className="divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 7 }}>
                <span className="muted">판매자</span>
                <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>{shortAddr(trade.seller)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 7 }}>
                <span className="muted">구매자</span>
                <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>{shortAddr(trade.buyer)}</span>
              </div>
              {status === TradeStatus.LOCKED && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span className="muted">만료까지</span>
                  <span className={`countdown ${countdownCls}`} style={{ fontSize: 12 }}>{countdownText}</span>
                </div>
              )}
            </div>
          )}

          {/* Completed status banners */}
          {status === TradeStatus.RELEASED && (
            <div className="banner banner-green">
              <span className="banner-icon">✓</span>
              <div className="banner-body">
                <div className="banner-title">거래 완료</div>
                <div className="banner-text">USDT가 구매자에게 전송되었습니다</div>
              </div>
            </div>
          )}
          {status === TradeStatus.REFUNDED && (
            <div className="banner banner-blue">
              <span className="banner-icon">↩</span>
              <div className="banner-body">
                <div className="banner-title">거래 환불</div>
                <div className="banner-text">USDT가 판매자에게 반환되었습니다</div>
              </div>
            </div>
          )}
          {status === TradeStatus.DISPUTED && (
            <div className="banner banner-red">
              <span className="banner-icon">⚠</span>
              <div className="banner-body">
                <div className="banner-title">분쟁 접수됨</div>
                <div className="banner-text">운영자가 검토 중입니다 (최대 30일)</div>
              </div>
            </div>
          )}

          {/* P1: MiniSwap 에스크로 보호 시스템 안내 */}
          {status === TradeStatus.LOCKED && (
            <div className="escrow-info">
              <div className="escrow-info-title">
                🛡 MiniSwap 에스크로 보호 시스템
              </div>
              <div className="escrow-info-item">
                <span className="escrow-info-icon">🔒</span>
                <span>스마트 컨트랙트가 USDT를 안전하게 보관합니다. 양측 합의 없이는 자금이 이동하지 않습니다.</span>
              </div>
              <div className="escrow-info-item">
                <span className="escrow-info-icon">⏱</span>
                <span>타임아웃 보호 — 기한 초과 시 판매자가 환불받을 수 있습니다.</span>
              </div>
              <div className="escrow-info-item">
                <span className="escrow-info-icon">⚖️</span>
                <span>분쟁 발생 시 제3자 중재를 통해 공정하게 해결됩니다.</span>
              </div>
            </div>
          )}

          {/* P2P Chat */}
          <div className="card" style={{ marginBottom: 9 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--snow3)', textTransform: 'uppercase' }}>P2P 채팅</div>
              <div className="p2p-bar" style={{ padding: 0 }}>
                <div className={`p2p-dot ${connected ? 'on' : 'off'}`} />
                <span>{connected ? 'XMTP 연결됨' : xmtpReady ? '연결 중...' : 'XMTP 준비 중...'}</span>
              </div>
            </div>

            {/* Signal buttons */}
            {status === TradeStatus.LOCKED && (
              <div className="signal-btns">
                {role === 'buyer' && (
                  <button
                    className="btn btn-sm btn-green"
                    onClick={() => send({ type: 'signal', text: '💸 KRW 송금 완료했습니다. 확인 부탁드립니다!' })}
                  >
                    💸 KRW 보냈습니다
                  </button>
                )}
                {role === 'seller' && (
                  <>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => send({ type: 'signal', text: '🔍 입금 확인 중입니다...' })}
                    >
                      🔍 확인 중
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => send({ type: 'signal', text: '✓ 입금 확인했습니다. USDT 전송합니다!' })}
                    >
                      ✓ 입금 확인
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="chat-area" ref={chatRef}>
              {messages.length === 0 && (
                <div className="msg sys">
                  <div className="bubble">
                    {connected ? '채팅 기록이 없습니다. 메시지를 보내보세요.' :
                     xmtpReady ? '상대방과 연결 중...' : 'XMTP 초기화 중...'}
                  </div>
                </div>
              )}
              {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            </div>

            {/* Chat input */}
            <form className="chat-input-row" onSubmit={handleSend}>
              <input
                className="input"
                placeholder="메시지 입력..."
                value={chatText}
                onChange={e => setChatText(e.target.value)}
                disabled={!connected}
              />
              <button type="submit" className="btn btn-sm btn-teal" disabled={!connected || !chatText.trim()}>
                전송
              </button>
            </form>
          </div>

          {/* TX error */}
          {txError && (
            <div className="alert alert-error">
              오류: {txError.shortMessage ?? txError.message}
            </div>
          )}

          {/* Confirm dialog */}
          {confirm && (
            <div className="banner banner-amber" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="banner-icon">⚠️</span>
              <div className="banner-body" style={{ flex: 1 }}>
                <div className="banner-title">정말 {confirm.label}하시겠습니까?</div>
              </div>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <button className="btn btn-sm btn-red" onClick={doConfirmedAction} style={{ color: 'var(--red)' }}>확인</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setConfirm(null)}>취소</button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {status === TradeStatus.LOCKED && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 11 }}>
              {role === 'seller' && (
                <button
                  className="btn btn-green"
                  disabled={isWorking}
                  onClick={() => setConfirm({ action: 'release', label: 'USDT 릴리즈' })}
                >
                  {relPending || relConfirming ? '처리 중...' : '✅ 입금 확인 · USDT 릴리즈'}
                </button>
              )}
              {isRefundable && (
                <button
                  className="btn btn-amber"
                  disabled={isWorking}
                  onClick={() => setConfirm({ action: 'refund', label: '환불' })}
                >
                  {refPending || refConfirming ? '처리 중...' : '↩ 환불 (만료)'}
                </button>
              )}
              <button
                className="btn btn-red"
                disabled={isWorking}
                onClick={() => setConfirm({ action: 'dispute', label: '분쟁 신청' })}
              >
                {disPending || disConfirming ? '처리 중...' : '⚑ 분쟁 신청'}
              </button>
            </div>
          )}

          {/* Completed — back to orderbook */}
          {(status === TradeStatus.RELEASED || status === TradeStatus.REFUNDED || status === TradeStatus.DISPUTED) && (
            <button className="btn btn-teal" style={{ marginTop: 11 }} onClick={onExit}>
              오더북으로
            </button>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="muted sm" style={{ textAlign: 'center', padding: '1rem' }}>
              거래 데이터 로드 중...
            </div>
          )}
        </div>

        <div className="scroll-gap" />
      </div>
    </div>
  )
}
