/**
 * OrderDetail — 오더 상세 페이지
 *
 * 판매/구매 오더 정보를 표시하고, 구매자가 수락 요청을 전송하거나
 * 판매자가 에스크로 락을 실행할 수 있는 인터페이스를 제공합니다.
 *
 * 주요 기능:
 * - 오더 정보 표시 (금액, 환율, 유효기간, 총 거래금액)
 * - 구매자: 수락 요청 서명 전송 → 판매자 응답 대기 (5분 타임아웃)
 * - 판매자: 에스크로 락 바로 실행 버튼 표시
 * - 내 오더인 경우: 수정/취소 버튼 표시
 * - 거래 알림(tradeNotification) 수신 시 거래방 입장 버튼 표시
 */

import { useState, useEffect, useRef } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { BrowserProvider } from 'ethers'
import { signAcceptRequest } from '../lib/signature'
import { getAvatarGradient, getAvatarChar } from '@/lib/avatar'
import { getUserProfile, renderStars } from '../mockData'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/banner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/contexts/ToastContext'

/**
 * OrderDetail 컴포넌트
 *
 * @param {Object}   order             - 표시할 오더 객체 (id, type, amount, priceKRW, expiry, seller/buyer)
 * @param {Function} onAcceptSent      - 수락 요청 전송 완료 콜백
 * @param {Function} onCancel          - 뒤로가기/취소 콜백
 * @param {Object}   acceptResponse    - 판매자로부터 받은 수락/거절 응답 객체
 * @param {Object}   tradeNotification - 에스크로 생성 완료 알림 (tradeId 포함)
 * @param {Function} onStartTrade      - 거래방 입장 콜백 (tradeId, role)
 * @param {Function} onCancelOrder     - 내 오더 취소 콜백
 * @param {Function} onEditOrder       - 내 오더 수정 콜백
 */
export default function OrderDetail({ order, onAcceptSent, onCancel, acceptResponse, tradeNotification, onStartTrade, onCancelOrder, onEditOrder }) {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { toast } = useToast()

  // 수락 요청 전송 상태
  const [sending, setSending] = useState(false)
  // 수락 요청이 이미 전송되었는지 여부 (대기 화면 전환 기준)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  // 수락 요청 전송 후 경과 시간 (밀리초) — 대기 화면에서 표시
  const [elapsedMs, setElapsedMs] = useState(0)
  // 요청 전송 시각을 기록하는 ref (리렌더링 없이 유지)
  const sentAtRef = useRef(null)

  // sent 상태가 되면 1초 간격으로 경과 시간을 업데이트
  useEffect(() => {
    if (!sent) {
      setElapsedMs(0)
      sentAtRef.current = null
      return
    }
    // 요청 전송 시각 기록
    sentAtRef.current = Date.now()
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - sentAtRef.current)
    }, 1000)
    return () => clearInterval(interval)
  }, [sent])

  if (!order) return null

  const isSellOrder = order.type === 'SELL'
  // 오더 소유자 주소: SELL 오더면 판매자, BUY 오더면 구매자
  const ownerAddr = isSellOrder ? order.seller : order.buyer
  // 현재 연결된 지갑이 오더 소유자인지 확인
  const isOwn = ownerAddr?.toLowerCase() === address?.toLowerCase()
  const totalKRW = Math.round(order.amount * order.priceKRW)

  // 수락 요청 응답 대기 타임아웃: 5분
  const TIMEOUT_MS = 5 * 60 * 1000

  /**
   * 오더 만료까지 남은 시간을 한국어 문자열로 반환
   * @param {number} expiry - 만료 시각 (Unix ms)
   * @returns {string} 남은 시간 문자열
   */
  function formatExpiry(expiry) {
    const remaining = expiry - Date.now()
    if (remaining <= 0) return '만료됨'
    const min = Math.floor(remaining / 60000)
    if (min < 60) return `${min}분 남음`
    const hr = Math.floor(min / 60)
    return `${hr}시간 ${min % 60}분 남음`
  }

  /**
   * 이더리움 주소를 앞 6자리 + 뒤 4자리 형식으로 축약
   * @param {string} addr - 이더리움 주소
   * @returns {string} 축약된 주소
   */
  function shortAddr(addr) {
    if (!addr) return '—'
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
  }

  /**
   * 숫자를 한국 원화 형식 (천 단위 구분자)으로 포맷
   * @param {number} n
   * @returns {string}
   */
  function formatKRW(n) {
    return new Intl.NumberFormat('ko-KR').format(n)
  }

  /**
   * 수락 요청 전송 후 경과 시간을 한국어 문자열로 반환
   * @param {number} ms - 경과 시간 (밀리초)
   * @returns {string}
   */
  function formatElapsed(ms) {
    const totalSec = Math.floor(ms / 1000)
    const min = Math.floor(totalSec / 60)
    if (min === 0) return '방금 요청함'
    if (min === 1) return '1분 전 요청함'
    return `${min}분 전 요청함`
  }

  /**
   * 수락 요청 처리 함수
   * 1. 지갑 클라이언트로 서명 생성
   * 2. CustomEvent('miniswap:accept-req')를 발행해 P2P 레이어에 전달
   * 3. sent 상태를 true로 전환해 대기 화면을 표시
   */
  async function handleAccept() {
    if (!walletClient) {
      setError('지갑이 연결되어 있지 않습니다')
      return
    }

    setSending(true)
    setError('')

    try {
      const provider = new BrowserProvider(walletClient.transport)
      const signer = await provider.getSigner()
      // 오더 ID와 구매자 주소를 포함한 수락 서명 생성
      const signature = await signAcceptRequest(signer, order.id, address)

      // P2P 메시지 레이어로 수락 요청 이벤트 전달
      window.dispatchEvent(new CustomEvent('miniswap:accept-req', {
        detail: {
          orderId: order.id,
          buyer: address,
          timestamp: Date.now(),
          signature,
        }
      }))

      setSent(true)
      toast('수락 요청이 전송되었습니다', 'success')
      if (onAcceptSent) onAcceptSent()
    } catch (err) {
      // 사용자가 MetaMask 서명 요청을 거부한 경우
      if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
        setError('서명이 거부되었습니다')
      } else {
        setError(`오류: ${err.message}`)
      }
    } finally {
      setSending(false)
    }
  }

  // ── 수락 응답 처리: 판매자로부터 응답을 받은 경우 분기 ──────────────────

  if (acceptResponse) {
    if (acceptResponse.accepted) {
      const tradeId = tradeNotification?.tradeId
      return (
        <div className="flex flex-col gap-3 animate-in fade-in">
          <Banner variant="success" icon="✓" title="수락 완료">
            {tradeId ? '거래방에 입장하세요.' : '에스크로 생성을 기다리는 중...'}
          </Banner>
          {acceptResponse.bankAccount && (
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs font-semibold text-slate-500 uppercase mb-2">입금 계좌</div>
                <div className="font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  {acceptResponse.bankAccount}
                </div>
              </CardContent>
            </Card>
          )}
          {tradeId ? (
            <Button
              variant="default"
              className="w-full"
              onClick={() => onStartTrade && onStartTrade(tradeId, 'buyer')}
            >
              거래방 입장
            </Button>
          ) : (
            <p className="text-xs text-slate-500 text-center py-4">
              판매자가 USDT를 에스크로에 예치하면 자동으로 거래방에 입장합니다...
            </p>
          )}
        </div>
      )
    } else {
      return (
        <div className="flex flex-col gap-3 animate-in fade-in">
          <Banner variant="warning" icon="😔" title="수락 거절">
            판매자가 다른 구매자를 선택했습니다. 다른 주문을 찾아보세요.
          </Banner>
        </div>
      )
    }
  }

  // ── 오더 상세 기본 뷰 (응답 대기 전 초기 화면) ─────────────────────────

  const profile = getUserProfile(ownerAddr)

  return (
    <div className="flex flex-col gap-3 animate-in fade-in pb-4">
      {/* 금액 히어로 섹션: 오더 유형(구매/판매), USDT 수량, 원화 금액 표시 */}
      <div className="py-2 text-center">
        <Badge
          variant={isSellOrder ? 'info' : 'warning'}
          className="mb-2 inline-flex"
        >
          {isSellOrder ? '📥 구매 플로우 A' : '🤝 판매 플로우 B'}
        </Badge>
        <div className="flex items-baseline justify-center gap-1 mt-1.5">
          <span className={`text-4xl font-black tracking-tight ${isSellOrder ? 'text-blue-600' : 'text-amber-600'}`}>
            {order.amount.toLocaleString()}
          </span>
          <span className="text-lg text-slate-400">USDT</span>
        </div>
        <div className={`text-xl font-bold mt-1.5 ${isSellOrder ? 'text-blue-600' : 'text-amber-600'}`}>
          {formatKRW(totalKRW)}원
        </div>
      </div>

      {/* 판매자/구매자 정보 카드: 아바타, 평점, 거래 세부 내역 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 mb-3">
            <Avatar
              size="lg"
              style={{ background: getAvatarGradient(ownerAddr) }}
            >
              {getAvatarChar(ownerAddr)}
            </Avatar>
            <div>
              <div className="font-mono text-xs font-bold text-slate-900">{shortAddr(ownerAddr)}</div>
              {/* TODO: 실제 온체인 API 연동 필요 */}
              <div className="text-xs text-amber-500">
                {renderStars(profile.rating)}{' '}
                <span className="text-slate-400">{profile.rating.toFixed(1)}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-500">{isSellOrder ? '구매 수량' : '판매 수량'}</span>
            <span className="font-extrabold text-[15px] text-slate-900">{order.amount.toLocaleString()} USDT</span>
          </div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-500">환율</span>
            <span className="font-bold text-slate-900">{formatKRW(order.priceKRW)}원/USDT</span>
          </div>
          <div className="flex justify-between text-xs mb-2">
            <span className="text-slate-500">유효기간</span>
            <span className="font-bold text-slate-900">{formatExpiry(order.expiry)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">총 거래 금액</span>
            <span className={`font-extrabold ${isSellOrder ? 'text-blue-600' : 'text-amber-600'}`}>
              {formatKRW(totalKRW)}원
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 구매자용 안내 배너: MetaMask 없이 KRW 계좌이체만 필요함을 안내 */}
      {isSellOrder && !isOwn && (
        <Banner variant="default" icon="ℹ️">
          MetaMask 없이 KRW 계좌이체만 하면 됩니다
        </Banner>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 액션 버튼 영역: 내 오더/대기중/구매자/판매자 분기 */}
      {isOwn ? (
        <>
          <Banner variant="info" icon="📋">
            내가 등록한 주문입니다. 수락 요청이 오면 알림이 표시됩니다.
          </Banner>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onEditOrder && onEditOrder(order)}
            >
              ✏️ 수정
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              onClick={() => {
                if (window.confirm('이 오더를 취소하시겠습니까?')) {
                  onCancelOrder && onCancelOrder(order.id)
                  onCancel && onCancel()
                }
              }}
            >
              🗑 취소
            </Button>
          </div>
        </>
      ) : sent ? (
        /* 대기 상태: 구매자가 수락 요청을 전송하고 판매자 응답을 기다리는 중 */
        <div className="flex flex-col gap-3">
          <Card className="border-blue-100 bg-blue-50/40">
            <CardContent className="pt-4 text-center">
              {/* 펄스 스피너: 대기 중임을 시각적으로 표현 */}
              <div className="flex justify-center mb-3">
                <span className="relative flex h-10 w-10">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
                  <span className="relative inline-flex h-10 w-10 rounded-full bg-blue-500 items-center justify-center">
                    <svg className="text-white" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                  </span>
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-800 mb-1">판매자 응답 대기 중...</p>
              <p className="text-xs text-slate-500">{formatElapsed(elapsedMs)}</p>
            </CardContent>
          </Card>

          {elapsedMs >= TIMEOUT_MS ? (
            <Banner variant="warning" icon="⏰" title="아직 응답이 없습니다.">
              <span>다른 오더를 찾아볼까요?</span>
              <Button
                variant="warning"
                size="sm"
                className="mt-2 w-full"
                onClick={() => onCancel && onCancel()}
              >
                오더북으로 돌아가기
              </Button>
            </Banner>
          ) : (
            <p className="text-xs text-slate-400 text-center">
              판매자가 요청을 확인하면 자동으로 다음 단계로 진행됩니다.
            </p>
          )}
        </div>
      ) : isSellOrder ? (
        /* 구매자가 판매 오더를 보는 경우: 수락 요청 전송 버튼 표시 */
        <>
          <Button
            variant="info"
            className="w-full"
            onClick={handleAccept}
            disabled={sending || order.expiry < Date.now()}
          >
            {sending ? '서명 중…' : '수락 요청 보내기'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={onCancel}>취소</Button>
        </>
      ) : (
        /* 판매자가 구매 오더를 보는 경우: 수락 + 에스크로 락 바로 실행 버튼 표시 */
        <>
          <Button
            variant="warning"
            className="w-full"
            onClick={() => {
              if (onStartTrade) {
                onStartTrade(null, 'seller', {
                  orderId: order.id,
                  buyerAddress: order.buyer,
                })
              }
            }}
            disabled={order.expiry < Date.now()}
          >
            수락 + 에스크로 락 바로 실행
          </Button>
          <Button variant="ghost" className="w-full" onClick={onCancel}>취소</Button>
        </>
      )}

      <div className="h-8" />
    </div>
  )
}
