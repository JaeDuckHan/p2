import { useState } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { useGetTrade, getEscrowAddress, formatUsdt } from '../hooks/useEscrow'
import { TradeStatus, STATUS_LABEL, STATUS_CLASS } from '../constants'

export default function JoinTrade({ onJoined }) {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const [input, setInput] = useState('')

  // Normalise tradeId: ensure 0x prefix and 64 hex chars
  const raw = input.trim()
  const tradeId = raw.startsWith('0x') ? raw : raw ? `0x${raw}` : ''
  const validLen = tradeId.length === 66

  const { trade, isLoading, isNotFound } = useGetTrade(validLen ? tradeId : null)
  const escrowAddr = getEscrowAddress(chainId)

  const isBuyer  = trade && address && trade.buyer.toLowerCase()  === address.toLowerCase()
  const isSeller = trade && address && trade.seller.toLowerCase() === address.toLowerCase()
  const status   = trade?.status

  const canJoin = !!trade && (isBuyer || isSeller) && (
    status === TradeStatus.LOCKED || status === TradeStatus.DISPUTED
  )

  function handleJoin() {
    if (!canJoin) return
    const role = isSeller ? 'seller' : 'buyer'
    onJoined(tradeId, role)
  }

  if (!escrowAddr) {
    return (
      <div className="no-contract">
        <h2>네트워크 전환 필요</h2>
        <p>이 앱은 <strong>Arbitrum One</strong> 메인넷에서 동작합니다.</p>
        <button className="btn" onClick={() => switchChain({ chainId: 42161 })}>
          Arbitrum One으로 전환
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="form-group">
        <label className="label">거래 ID (Trade ID)</label>
        <input
          className="input"
          placeholder="0x1a2b3c... (판매자에게 받은 64자리 ID)"
          value={input}
          onChange={e => setInput(e.target.value.trim())}
        />
      </div>

      {/* Trade preview */}
      {validLen && (
        <div style={{ marginBottom: '1rem' }}>
          {isLoading && (
            <div className="alert alert-info">거래 조회 중...</div>
          )}
          {isNotFound && !isLoading && (
            <div className="alert alert-error">존재하지 않는 거래 ID입니다</div>
          )}
          {trade && !isLoading && (
            <div className="card" style={{ marginTop: 0, padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span className={`badge ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
                <span className="sm muted">거래 정보</span>
              </div>
              <div className="info-grid">
                <div className="info-item">
                  <div className="label">금액</div>
                  <div className="info-value">{formatUsdt(trade.amount)} USDT</div>
                </div>
                <div className="info-item">
                  <div className="label">수수료 (2%)</div>
                  <div className="info-value">{formatUsdt(trade.feeAmount)} USDT</div>
                </div>
                <div className="info-item">
                  <div className="label">판매자</div>
                  <div className="info-value mono">{trade.seller.slice(0,10)}...{trade.seller.slice(-6)}</div>
                </div>
                <div className="info-item">
                  <div className="label">구매자</div>
                  <div className="info-value mono">{trade.buyer.slice(0,10)}...{trade.buyer.slice(-6)}</div>
                </div>
              </div>

              {!isBuyer && !isSeller && (
                <div className="alert alert-error" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                  연결된 지갑이 이 거래의 참여자가 아닙니다
                </div>
              )}
              {(status === TradeStatus.RELEASED || status === TradeStatus.REFUNDED) && (
                <div className="alert alert-info" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                  이미 완료된 거래입니다 ({STATUS_LABEL[status]})
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button
        className="btn btn-blue btn-lg btn-block"
        disabled={!canJoin}
        onClick={handleJoin}
      >
        거래방 입장
      </button>
    </div>
  )
}
