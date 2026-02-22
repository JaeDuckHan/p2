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
import { useP2P } from '../hooks/useP2P'
import { TradeStatus, STATUS_LABEL, STATUS_CLASS } from '../constants'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(addr) {
  if (!addr) return '—'
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`
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

// ─── TradeRoom ─────────────────────────────────────────────────────────────────
export default function TradeRoom({ tradeId, initialRole, onExit }) {
  const { address, chainId } = useAccount()
  const { trade, isLoading, refetch } = useGetTrade(tradeId)
  const isRefundable = useIsRefundable(tradeId, chainId)

  const { release, isPending: relPending, isConfirming: relConfirming, isSuccess: relSuccess, error: relErr } = useRelease(chainId)
  const { refund,  isPending: refPending, isConfirming: refConfirming, isSuccess: refSuccess, error: refErr } = useRefund(chainId)
  const { dispute, isPending: disPending, isConfirming: disConfirming, isSuccess: disSuccess, error: disErr } = useDispute(chainId)

  const { peers, messages, send, connected } = useP2P(tradeId)

  const [chatText, setChatText] = useState('')
  const chatRef = useRef(null)
  const [confirm, setConfirm] = useState(null) // { action, label }

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

  // ── Copy trade ID ────────────────────────────────────────────────────────────
  function copyId() {
    navigator.clipboard.writeText(tradeId).then(() => alert('거래 ID 복사됨')).catch(() => {})
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <span className={`badge ${trade ? STATUS_CLASS[status] : ''}`}>
          {trade ? STATUS_LABEL[status] : '로드 중...'}
        </span>
        <span className="sm muted">거래방</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <span className="sm muted">
            {role === 'seller' ? '📤 판매자' : '📥 구매자'} 역할
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onExit}>← 나가기</button>
        </div>
      </div>

      {/* Trade ID */}
      <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
        <div className="label" style={{ marginBottom: '0.25rem' }}>거래 ID (구매자에게 공유)</div>
        <div className="trade-id-box" onClick={copyId} title="클릭하여 복사">
          <span>{tradeId}</span>
          <span style={{ color: 'var(--muted)', flexShrink: 0 }}>복사</span>
        </div>
      </div>

      {/* Trade info */}
      {trade && (
        <div className="card" style={{ marginBottom: '0.75rem' }}>
          <div className="card-title">거래 정보</div>
          <div className="info-grid">
            <div className="info-item">
              <div className="label">거래 금액</div>
              <div className="info-value">{formatUsdt(trade.amount)} USDT</div>
            </div>
            <div className="info-item">
              <div className="label">수수료 (2%)</div>
              <div className="info-value">{formatUsdt(trade.feeAmount)} USDT</div>
            </div>
            <div className="info-item">
              <div className="label">판매자</div>
              <div className="info-value mono">{shortAddr(trade.seller)}</div>
            </div>
            <div className="info-item">
              <div className="label">구매자</div>
              <div className="info-value mono">{shortAddr(trade.buyer)}</div>
            </div>
            {status === TradeStatus.LOCKED && (
              <div className="info-item">
                <div className="label">만료까지</div>
                <div className={`info-value countdown ${countdownCls}`}>{countdownText}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status messages for completed trades */}
      {status === TradeStatus.RELEASED && (
        <div className="alert alert-success">
          ✓ 거래 완료 — USDT가 구매자에게 전송되었습니다
        </div>
      )}
      {status === TradeStatus.REFUNDED && (
        <div className="alert alert-info">
          ↩ 거래 환불 — USDT가 판매자에게 반환되었습니다
        </div>
      )}
      {status === TradeStatus.DISPUTED && (
        <div className="alert alert-warning">
          ⚠ 분쟁 접수됨 — 운영자가 검토 중입니다 (최대 30일)
        </div>
      )}

      {/* P2P Chat */}
      <div className="card" style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div className="card-title" style={{ marginBottom: 0 }}>P2P 채팅</div>
          <div className="p2p-bar" style={{ padding: 0 }}>
            <div className={`p2p-dot ${connected ? 'on' : 'off'}`} />
            <span>{connected ? `상대방 연결됨 (${peers.length}명)` : '상대방 대기 중...'}</span>
          </div>
        </div>

        {/* Signal buttons */}
        {status === TradeStatus.LOCKED && (
          <div className="signal-btns" style={{ marginBottom: '0.75rem' }}>
            {role === 'buyer' && (
              <button
                className="btn btn-green btn-sm"
                onClick={() => send({ type: 'signal', text: '💸 KRW 송금 완료했습니다. 확인 부탁드립니다!' })}
              >
                💸 KRW 보냈습니다
              </button>
            )}
            {role === 'seller' && (
              <>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => send({ type: 'signal', text: '🔍 입금 확인 중입니다...' })}
                >
                  🔍 확인 중
                </button>
                <button
                  className="btn btn-ghost btn-sm"
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
              <div className="bubble">채팅 기록이 없습니다. 상대방이 연결되기를 기다리는 중...</div>
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
          <button type="submit" className="btn btn-ghost btn-sm" disabled={!connected || !chatText.trim()}>
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
        <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <span>정말 {confirm.label}하시겠습니까?</span>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button className="btn btn-red btn-sm"   onClick={doConfirmedAction}>확인</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>취소</button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {status === TradeStatus.LOCKED && (
        <div className="actions">
          {role === 'seller' && (
            <button
              className="btn btn-green btn-lg"
              disabled={isWorking}
              onClick={() => setConfirm({ action: 'release', label: 'USDT 릴리즈' })}
            >
              {relPending || relConfirming ? '처리 중...' : '✓ USDT 릴리즈'}
            </button>
          )}
          {isRefundable && (
            <button
              className="btn btn-yellow"
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
            {disPending || disConfirming ? '처리 중...' : '⚠ 분쟁 신청'}
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="muted sm" style={{ textAlign: 'center', padding: '1rem' }}>
          거래 데이터 로드 중...
        </div>
      )}
    </div>
  )
}
