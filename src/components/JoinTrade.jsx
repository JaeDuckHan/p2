/**
 * JoinTrade — 거래 참여 컴포넌트 (구매자/판매자 공용)
 *
 * 이미 생성된 에스크로 거래에 참여하기 위한 화면입니다.
 * 판매자로부터 받은 거래 ID(tradeId)를 입력하면 온체인 데이터를 조회하고,
 * 유효성을 검증한 뒤 거래방으로 이동합니다.
 *
 * 유효성 검증 항목:
 * - 거래 ID 형식 (0x + 64자리 16진수)
 * - 온체인 거래 존재 여부
 * - 현재 지갑이 판매자 또는 구매자인지 확인
 * - 거래 상태가 참여 가능한지 확인 (LOCKED 또는 DISPUTED)
 */

import { useState } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import { useGetTrade, getEscrowAddress, formatUsdt } from '../hooks/useEscrow'
import { TradeStatus, STATUS_LABEL } from '../constants'
import { MAINNET_CHAIN_ID, CHAIN_NAME } from '../constants/network'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

// TradeStatus 숫자값을 Badge 변형 문자열로 매핑
const STATUS_BADGE_VARIANT = {
  [TradeStatus.LOCKED]:   'warning',
  [TradeStatus.RELEASED]: 'success',
  [TradeStatus.DISPUTED]: 'destructive',
  [TradeStatus.REFUNDED]: 'info',
}

/**
 * JoinTrade 컴포넌트
 *
 * @param {Function} onJoined - 거래방 입장 콜백 (tradeId: string, role: 'buyer'|'seller')
 */
export default function JoinTrade({ onJoined }) {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  // 사용자가 입력한 거래 ID 문자열
  const [input, setInput] = useState('')

  // 입력값 정규화: 0x 접두사 추가, 길이 66자(0x + 64자리 hex) 여부 확인
  const raw = input.trim()
  const tradeId = raw.startsWith('0x') ? raw : raw ? `0x${raw}` : ''
  const validLen = tradeId.length === 66

  // 유효한 길이일 때만 온체인 데이터 조회
  const { trade, isLoading, isNotFound } = useGetTrade(validLen ? tradeId : null)
  // 현재 체인의 에스크로 컨트랙트 주소 (지원 체인 여부 확인용)
  const escrowAddr = getEscrowAddress(chainId)

  // 현재 연결된 지갑이 해당 거래의 구매자/판매자인지 확인
  const isBuyer  = trade && address && trade.buyer.toLowerCase()  === address.toLowerCase()
  const isSeller = trade && address && trade.seller.toLowerCase() === address.toLowerCase()
  const status   = trade?.status

  // 거래방 입장 가능 여부: 참여자이고 거래가 활성 상태(LOCKED/DISPUTED)인 경우
  const canJoin = !!trade && (isBuyer || isSeller) && (
    status === TradeStatus.LOCKED || status === TradeStatus.DISPUTED
  )

  /**
   * 거래방 입장 처리: 역할(seller/buyer)을 결정하고 onJoined 콜백 호출
   */
  function handleJoin() {
    if (!canJoin) return
    const role = isSeller ? 'seller' : 'buyer'
    onJoined(tradeId, role)
  }

  if (!escrowAddr) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Alert variant="warning">
          <AlertDescription>
            <p className="font-semibold mb-1">네트워크 전환 필요</p>
            <p className="mb-3">이 앱은 <strong>{CHAIN_NAME}</strong> 메인넷에서 동작합니다.</p>
            <Button variant="warning" size="sm" onClick={() => switchChain({ chainId: MAINNET_CHAIN_ID })}>
              {CHAIN_NAME}으로 전환
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-slate-500 uppercase">거래 ID (Trade ID)</label>
        <Input
          className="font-mono"
          placeholder="0x1a2b3c... (판매자에게 받은 64자리 ID)"
          value={input}
          onChange={e => setInput(e.target.value.trim())}
        />
      </div>

      {/* 거래 미리보기: ID 길이가 유효할 때 온체인 조회 결과 표시 */}
      {validLen && (
        <div>
          {isLoading && (
            <Alert variant="info">
              <AlertDescription>거래 조회 중...</AlertDescription>
            </Alert>
          )}
          {isNotFound && !isLoading && (
            <Alert variant="destructive">
              <AlertDescription>존재하지 않는 거래 ID입니다</AlertDescription>
            </Alert>
          )}
          {trade && !isLoading && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={STATUS_BADGE_VARIANT[status]}>
                    {STATUS_LABEL[status]}
                  </Badge>
                  <span className="text-xs text-slate-500">거래 정보</span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase">금액</div>
                    <div className="text-sm font-semibold text-slate-900">{formatUsdt(trade.amount)} USDT</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase">수수료 (2%)</div>
                    <div className="text-sm font-semibold text-slate-900">{formatUsdt(trade.feeAmount)} USDT</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase">판매자</div>
                    <div className="text-sm font-mono text-slate-900">{trade.seller.slice(0,10)}...{trade.seller.slice(-6)}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase">구매자</div>
                    <div className="text-sm font-mono text-slate-900">{trade.buyer.slice(0,10)}...{trade.buyer.slice(-6)}</div>
                  </div>
                </div>

                {!isBuyer && !isSeller && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertDescription>연결된 지갑이 이 거래의 참여자가 아닙니다</AlertDescription>
                  </Alert>
                )}
                {(status === TradeStatus.RELEASED || status === TradeStatus.REFUNDED) && (
                  <Alert variant="info" className="mt-3">
                    <AlertDescription>이미 완료된 거래입니다 ({STATUS_LABEL[status]})</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Button
        variant="info"
        size="lg"
        className="w-full"
        disabled={!canJoin}
        onClick={handleJoin}
      >
        거래방 입장
      </Button>
    </div>
  )
}
