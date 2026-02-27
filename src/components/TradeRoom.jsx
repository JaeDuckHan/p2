/**
 * TradeRoom.jsx — 거래 진행 화면
 *
 * 역할:
 *   - 에스크로 컨트랙트의 현재 상태를 표시하고 거래 액션(릴리즈/환불/분쟁)을 처리한다.
 *   - XMTP P2P 채팅으로 거래 당사자 간 실시간 소통을 지원한다.
 *   - 거래 완료(RELEASED/REFUNDED) 시 완료 화면(A.6)을 표시하고 자동 복귀 카운트다운을 실행한다.
 *   - 거래 데이터를 IndexedDB에 저장하여 거래내역 페이지에서 조회할 수 있게 한다.
 *
 * Props:
 *   tradeId     {string}           — 에스크로 컨트랙트 거래 ID
 *   initialRole {'seller'|'buyer'} — 최초 진입 시 역할 (컨트랙트 로드 전 임시 사용)
 *   onExit      {() => void}       — 거래방 나가기 콜백
 */
import { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import {
  useGetTrade,
  useIsRefundable,
  useRelayRelease,
  useRelayRefund,
  useRelayDispute,
  formatUsdt,
} from '../hooks/useEscrow'
import { putTrade } from '@/lib/indexeddb'
import { useXmtpChat } from '../hooks/useXmtpChat'
import { useXmtp } from '../contexts/XmtpContext'
import { TradeStatus } from '../constants'
import { cn } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Banner } from '@/components/ui/banner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Stepper } from '@/components/ui/stepper'
import {
  ArrowLeft,
  CheckCircle,
  Copy,
  Shield,
  Clock,
  AlertTriangle,
  Send,
  RotateCcw,
  Flag,
  ExternalLink,
  ScrollText,
} from 'lucide-react'

// ─── 유틸 함수 ────────────────────────────────────────────────────────────────

/**
 * 지갑 주소를 앞 6자리 + 뒤 4자리 형태로 축약해 표시한다.
 * @param {string} addr - 전체 이더리움 주소
 * @returns {string} 축약된 주소 (예: 0x1234…abcd)
 */
function shortAddr(addr) {
  if (!addr) return '—'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/**
 * 체인 ID에 따른 Arbiscan 탐색기 기본 URL을 반환한다.
 * @param {number} cid - 체인 ID
 * @returns {string} Arbiscan 탐색기 URL
 */
function getExplorerUrl(cid) {
  if (cid === 421614) return 'https://sepolia.arbiscan.io'
  return 'https://arbiscan.io'
}

/**
 * 타임스탬프(ms)를 한국 시간 형식 HH:MM:SS 문자열로 변환한다.
 * 채팅 메시지 하단의 시간 표시에 사용된다.
 * @param {number} ts - 밀리초 타임스탬프
 * @returns {string} 포맷된 시간 문자열
 */
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * 에스크로 만료까지 남은 시간을 카운트다운 텍스트와 긴급도 클래스로 반환하는 커스텀 훅
 * - 1시간 미만: cls = 'urgent' (빨간색 표시)
 * - 24시간 미만: cls = 'warn'  (주황색 표시)
 * - 그 외:       cls = 'ok'   (초록색 표시)
 *
 * @param {number|bigint} expiresAt - 만료 시각 (유닉스 타임스탬프, 초 단위)
 * @returns {{ text: string, cls: 'ok'|'warn'|'urgent' }}
 */
function useCountdown(expiresAt) {
  /** 카운트다운 표시 텍스트 (예: "2일 3시간 15분") */
  const [text, setText] = useState('')
  /** 긴급도에 따른 CSS 클래스 ('ok' | 'warn' | 'urgent') */
  const [cls,  setCls]  = useState('ok')

  // 1초마다 남은 시간을 재계산하여 text와 cls를 업데이트한다.
  // 트리거: expiresAt이 변경될 때 (새 거래 로드 시)
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

/**
 * 원형 타이머에 표시할 짧은 MM:SS 형식의 카운트다운 문자열을 반환한다.
 * (상태가 업데이트되지 않는 순수 함수 — setInterval 내부에서 직접 호출)
 * @param {number|bigint} expiresAt - 만료 시각 (유닉스 타임스탬프, 초 단위)
 * @returns {string} MM:SS 형식 문자열 (예: "05:42")
 */
function formatCountdownShort(expiresAt) {
  if (!expiresAt) return '--:--'
  const diff = Number(expiresAt) - Math.floor(Date.now() / 1000)
  if (diff <= 0) return '00:00'
  const m = Math.floor(diff / 60)
  const s = diff % 60
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// ─── 거래 상태 → Badge 색상 매핑 ─────────────────────────────────────────────
/**
 * 거래 상태 코드에 해당하는 Badge 컴포넌트의 variant를 정의한다.
 * TradeStatus 상수는 constants.js에서 가져온다.
 */
const STATUS_BADGE_VARIANT = {
  [TradeStatus.LOCKED]:   'warning',
  [TradeStatus.RELEASED]: 'success',
  [TradeStatus.DISPUTED]: 'destructive',
  [TradeStatus.REFUNDED]: 'info',
}

/** 거래 상태 코드 → 표시 레이블 매핑 */
const STATUS_LABEL = {
  [TradeStatus.LOCKED]:   'LOCKED',
  [TradeStatus.RELEASED]: 'RELEASED',
  [TradeStatus.DISPUTED]: 'DISPUTED',
  [TradeStatus.REFUNDED]: 'REFUNDED',
}

// ─── 메시지 버블 컴포넌트 ─────────────────────────────────────────────────────
/**
 * XMTP 채팅 메시지 하나를 버블 형태로 렌더링한다.
 * - type === 'sys': 시스템 메시지 (중앙 정렬, 회색 pill 형태)
 * - msg.fromMe === true: 내 메시지 (오른쪽 정렬, 파란 배경)
 * - msg.fromMe === false: 상대 메시지 (왼쪽 정렬, 회색 배경)
 *
 * @param {{ msg: { id: string, type: string, text: string, fromMe: boolean, timestamp: number } }} props
 */
function MessageBubble({ msg }) {
  if (msg.type === 'sys') {
    return (
      <div className="flex justify-center my-1.5">
        <div className="bg-slate-100 text-slate-500 text-[11px] rounded-full px-3 py-0.5">
          — {msg.text} —
        </div>
      </div>
    )
  }
  return (
    <div className={cn('flex flex-col mb-2', msg.fromMe ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed break-words',
          msg.fromMe
            ? 'bg-primary-600 text-white rounded-br-sm'
            : 'bg-slate-100 text-slate-800 rounded-bl-sm'
        )}
      >
        {msg.text}
      </div>
      <div className="text-[10px] text-slate-400 mt-0.5 px-1">
        {fmtTime(msg.timestamp)}
      </div>
    </div>
  )
}

// ─── TradeRoom 메인 컴포넌트 ──────────────────────────────────────────────────
/**
 * 거래 진행 화면 컴포넌트
 * 에스크로 상태 조회, P2P 채팅, 릴리즈/환불/분쟁 액션을 통합 관리한다.
 */
export default function TradeRoom({ tradeId, initialRole, onExit, onGoToHistory }) {
  const { address, chainId } = useAccount()

  /** 에스크로 컨트랙트에서 거래 데이터를 조회하는 훅 */
  const { trade, isLoading, refetch } = useGetTrade(tradeId)

  /** 에스크로 만료 여부 (환불 가능 조건 판단에 사용) */
  const isRefundable = useIsRefundable(tradeId, chainId)

  /** 가스비 대납 릴리즈 릴레이 훅 — 판매자가 USDT를 구매자에게 전송할 때 사용 */
  const { release, isPending: relPending, isConfirming: relConfirming, isSuccess: relSuccess, error: relErr } = useRelayRelease(chainId)

  /** 가스비 대납 환불 릴레이 훅 — 에스크로 만료 후 판매자가 USDT를 돌려받을 때 사용 */
  const { refund,  isPending: refPending, isConfirming: refConfirming, isSuccess: refSuccess, error: refErr } = useRelayRefund(chainId)

  /** 가스비 대납 분쟁 릴레이 훅 — 거래 당사자가 분쟁을 접수할 때 사용 */
  const { dispute, isPending: disPending, isConfirming: disConfirming, isSuccess: disSuccess, error: disErr } = useRelayDispute(chainId)

  /** XMTP 초기화 완료 여부 */
  const { isReady: xmtpReady } = useXmtp()

  /**
   * 거래 상대방 지갑 주소
   * 현재 사용자가 판매자이면 구매자 주소, 구매자이면 판매자 주소를 반환한다.
   */
  const peerAddress = trade
    ? (trade.seller.toLowerCase() === address?.toLowerCase() ? trade.buyer : trade.seller)
    : null

  /** XMTP P2P 채팅 훅 — peerAddress와 tradeId를 기반으로 채팅 세션을 초기화한다 */
  const { peers, messages, send, connected } = useXmtpChat(peerAddress, tradeId)

  /** 채팅 입력창 텍스트 상태 */
  const [chatText, setChatText] = useState('')

  /** 채팅 메시지 목록의 스크롤 컨테이너 ref — 새 메시지 수신 시 자동 스크롤에 사용 */
  const chatRef = useRef(null)

  /**
   * 확인 다이얼로그 상태
   * null이면 다이얼로그 숨김, 값이 있으면 배너로 표시
   * 형태: null | { action: 'release'|'refund'|'dispute', label: string }
   */
  const [confirm, setConfirm] = useState(null)

  /** 원형 타이머에 표시할 MM:SS 형식 카운트다운 문자열 */
  const [shortCountdown, setShortCountdown] = useState('--:--')

  /** 완료 화면의 자동 복귀 카운트다운 (초) */
  const [exitCountdown, setExitCountdown] = useState(10)

  const { toast } = useToast()

  /**
   * 동일한 트랜잭션 성공 이벤트에 대해 토스트가 중복 발생하는 것을 방지하는 플래그
   * useEffect 재실행 시에도 ref 값은 유지된다.
   */
  const toastFiredRef = useRef({ release: false, refund: false, dispute: false })

  // 새 메시지가 도착하면 채팅 영역을 최하단으로 자동 스크롤한다.
  // 트리거: messages 배열이 변경될 때
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  /**
   * 거래 데이터를 IndexedDB에 저장한다.
   * 거래내역 페이지(TradeHistory)에서 오프라인으로 거래 목록을 조회하기 위해 사용된다.
   * 트리거: trade 객체 또는 tradeId가 변경될 때 (컨트랙트 데이터 로드 완료 시)
   */
  useEffect(() => {
    if (trade && tradeId) {
      putTrade({
        tradeId,
        seller: trade.seller,
        buyer: trade.buyer,
        amount: trade.amount.toString(),
        feeAmount: trade.feeAmount.toString(),
        status: Number(trade.status),
        createdAt: Number(trade.createdAt) * 1000,
        expiresAt: Number(trade.expiresAt) * 1000,
      }).catch(() => {})  // 저장 실패는 무시 (UI에 영향 없음)
    }
  }, [trade, tradeId])

  // 트랜잭션 확정 후 컨트랙트 상태를 최신화한다.
  // 트리거: 릴리즈/환불/분쟁 트랜잭션 중 하나라도 성공할 때
  useEffect(() => { if (relSuccess || refSuccess || disSuccess) refetch() }, [relSuccess, refSuccess, disSuccess])

  // 릴리즈 성공 시 채팅으로 상대방에게 완료 시그널 메시지를 발송한다.
  // 트리거: relSuccess가 true로 변경될 때
  useEffect(() => {
    if (relSuccess) send({ type: 'signal', text: '판매자가 USDT를 전송했습니다! 잔고를 확인하세요 ✓' })
  }, [relSuccess])

  // 릴리즈 성공 토스트 — 중복 발생 방지를 위해 toastFiredRef 플래그를 확인한다.
  // 트리거: relSuccess가 true로 변경될 때
  useEffect(() => {
    if (relSuccess && !toastFiredRef.current.release) {
      toastFiredRef.current.release = true
      toast('거래가 성공적으로 완료되었습니다!', 'success')
    }
  }, [relSuccess])

  // 환불 성공 토스트
  // 트리거: refSuccess가 true로 변경될 때
  useEffect(() => {
    if (refSuccess && !toastFiredRef.current.refund) {
      toastFiredRef.current.refund = true
      toast('환불이 처리되었습니다', 'info')
    }
  }, [refSuccess])

  // 분쟁 접수 성공 토스트
  // 트리거: disSuccess가 true로 변경될 때
  useEffect(() => {
    if (disSuccess && !toastFiredRef.current.dispute) {
      toastFiredRef.current.dispute = true
      toast('분쟁이 접수되었습니다', 'warning')
    }
  }, [disSuccess])

  // 트랜잭션 오류 발생 시 에러 토스트를 표시한다.
  // 트리거: 릴리즈/환불/분쟁 오류 중 하나라도 변경될 때
  useEffect(() => {
    const err = relErr || refErr || disErr
    if (err) {
      toast(`트랜잭션 실패: ${err.shortMessage ?? err.message}`, 'error')
    }
  }, [relErr, refErr, disErr])

  // 원형 타이머 카운트다운을 1초 간격으로 업데이트한다.
  // 트리거: trade.expiresAt이 변경될 때
  useEffect(() => {
    if (!trade?.expiresAt) return
    const tick = () => setShortCountdown(formatCountdownShort(trade.expiresAt))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [trade?.expiresAt])

  /**
   * 거래 완료 여부 (RELEASED 또는 REFUNDED 상태)
   * true이면 완료 화면(A.6)을 렌더링하고 자동 복귀 카운트다운을 시작한다.
   */
  const isCompleted = trade && (
    trade.status === TradeStatus.RELEASED ||
    trade.status === TradeStatus.REFUNDED
  )

  // 거래 완료 시 10초 카운트다운 후 onExit()을 호출해 자동으로 오더북으로 복귀한다.
  // 트리거: isCompleted가 true로 변경될 때
  useEffect(() => {
    if (!isCompleted) return
    setExitCountdown(10)
    const id = setInterval(() => {
      setExitCountdown(prev => {
        if (prev <= 1) {
          clearInterval(id)
          onExit()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [isCompleted])

  /**
   * 현재 사용자의 역할 ('seller' | 'buyer')
   * 컨트랙트 데이터가 로드된 경우 seller 주소 비교로 확정하고,
   * 로드 전에는 initialRole을 임시로 사용한다.
   */
  const role = trade
    ? (trade.seller.toLowerCase() === address?.toLowerCase() ? 'seller' : 'buyer')
    : initialRole

  /** 현재 거래 상태 코드 (TradeStatus 상수) */
  const status = trade?.status

  /** 에스크로 만료까지 남은 시간 텍스트와 긴급도 클래스 */
  const { text: countdownText, cls: countdownCls } = useCountdown(trade?.expiresAt)

  // ── 채팅 메시지 전송 ────────────────────────────────────────────────────────
  /** 채팅 입력 폼 제출 핸들러 — 빈 메시지는 무시한다. */
  function handleSend(e) {
    e.preventDefault()
    const t = chatText.trim()
    if (!t) return
    send({ type: 'text', text: t })
    setChatText('')
  }

  // ── 확인 후 액션 실행 ─────────────────────────────────────────────────────────
  /**
   * confirm 상태에 저장된 액션을 실제로 실행한다.
   * confirm 다이얼로그에서 "확인" 버튼을 누를 때 호출된다.
   */
  function doConfirmedAction() {
    if (!confirm) return
    if (confirm.action === 'release') release(tradeId)
    if (confirm.action === 'refund')  refund(tradeId)
    if (confirm.action === 'dispute') dispute(tradeId)
    setConfirm(null)
  }

  /** 트랜잭션 처리 중 여부 — 버튼 비활성화에 사용 */
  const isWorking = relPending || relConfirming || refPending || refConfirming || disPending || disConfirming

  /** 가장 최근 트랜잭션 오류 */
  const txError   = relErr || refErr || disErr

  /** 거래 ID를 클립보드에 복사하고 토스트 알림을 표시한다. */
  function copyId() {
    navigator.clipboard.writeText(tradeId)
      .then(() => toast('거래 ID가 복사되었습니다', 'info'))
      .catch(() => {})
  }

  // ── 통합 단계 표시기 (A.7) ──────────────────────────────────────────────────
  /**
   * 거래 진행 단계를 4단계로 표시한다.
   * 각 문자열의 <br> 태그는 Stepper 컴포넌트 내부에서 HTML로 렌더링된다.
   */
  const UNIFIED_STEPS = ['에스크로<br>락', 'KRW<br>송금 대기', '입금<br>확인', '완료']

  /** 현재 거래 상태에 해당하는 단계 인덱스(0~4)를 반환한다. */
  function getUnifiedStepCurrent() {
    if (status === TradeStatus.RELEASED || status === TradeStatus.REFUNDED) return 4
    if (status === TradeStatus.DISPUTED) return 2
    if (status === TradeStatus.LOCKED) return 1
    return 0
  }

  /**
   * 현재 단계와 역할에 맞는 안내 메시지를 반환한다.
   * 채팅에서 구매자가 보낸 시그널 메시지 감지 여부로 단계 2와 단계 3을 구분한다.
   * @returns {string|null} 안내 문자열, 또는 표시 불필요 시 null
   */
  function getStepGuidance() {
    if (status === TradeStatus.LOCKED) {
      // 채팅에서 구매자 측 시그널 메시지 감지
      // - 판매자 입장: 상대방(구매자)이 보낸 시그널 = !m.fromMe
      // - 구매자 입장: 자신이 보낸 시그널 = m.fromMe
      const hasBuyerSignal = messages.some(m => m.type === 'signal' && !m.fromMe && role === 'seller')
        || messages.some(m => m.type === 'signal' && m.fromMe && role === 'buyer')

      if (hasBuyerSignal) {
        // 단계 3: KRW 송금 완료 시그널이 감지된 상태
        if (role === 'seller') return '입금을 확인하고 USDT를 릴리즈하세요.'
        if (role === 'buyer') return '판매자가 입금을 확인 중입니다.'
      } else {
        // 단계 2: KRW 송금 대기 중
        if (role === 'seller') return '구매자가 KRW를 보내는 중입니다. 계좌를 확인하세요.'
        if (role === 'buyer') return '판매자의 계좌로 KRW를 송금해주세요.'
      }
    }
    return null
  }

  const stepGuidance = getStepGuidance()

  // ── 앱 바 타이틀 ─────────────────────────────────────────────────────────────
  /** 현재 거래 상태에 맞는 앱 바 타이틀 문자열을 반환한다. */
  function getTitle() {
    if (status === TradeStatus.RELEASED) return '거래 완료'
    if (status === TradeStatus.REFUNDED) return '환불 완료'
    if (status === TradeStatus.DISPUTED) return '분쟁 중'
    return '거래 진행중'
  }

  // ── 카운트다운 텍스트 색상 ────────────────────────────────────────────────────
  /** 긴급도 클래스에 따라 카운트다운 텍스트에 적용할 Tailwind 색상 클래스를 반환한다. */
  const countdownColorClass = countdownCls === 'urgent'
    ? 'text-red-600 font-bold'
    : countdownCls === 'warn'
      ? 'text-amber-600 font-semibold'
      : 'text-emerald-600 font-semibold'

  // ─────────────────────────────────────────────────────────────────────────────
  // 완료 화면 (A.6) — RELEASED 또는 REFUNDED 상태
  // 큰 체크마크 + 거래 정보 카드 + 자동 복귀 카운트다운을 표시한다.
  // ─────────────────────────────────────────────────────────────────────────────
  if (trade && (status === TradeStatus.RELEASED || status === TradeStatus.REFUNDED)) {
    const isReleased = status === TradeStatus.RELEASED

    return (
      <div className="animate-in fade-in flex flex-col min-h-screen bg-white">
        {/* 앱 바 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
          <Button variant="ghost" size="sm" onClick={onExit} className="p-1.5">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="text-base font-semibold flex-1 text-center">
            {isReleased ? '거래 완료' : '환불 완료'}
          </div>
          <div className="w-9" />
        </div>

        {/* 완료 본문 */}
        <div className="flex flex-col items-center justify-center flex-1 px-6 py-12 text-center gap-5">
          {/* 큰 체크마크 아이콘 */}
          <div className={cn(
            'w-24 h-24 rounded-full flex items-center justify-center',
            isReleased ? 'bg-emerald-100' : 'bg-blue-100'
          )}>
            <CheckCircle className={cn('w-14 h-14', isReleased ? 'text-emerald-500' : 'text-blue-500')} />
          </div>

          {/* 완료 메시지 + 금액 표시 */}
          <div>
            <div className="text-3xl font-black text-slate-900 mb-1">
              {isReleased ? '거래 완료!' : '환불 완료!'}
            </div>
            <div className="text-base text-slate-500 mt-1">
              {isReleased
                ? `${formatUsdt(trade.amount)} USDT가 지갑으로 전송되었습니다`
                : `${formatUsdt(trade.amount)} USDT가 판매자에게 반환되었습니다`}
            </div>
          </div>

          {/* 거래 정보 카드 (txHash는 useGetTrade에서 미노출 — 거래 ID로 대체) */}
          <Card className="w-full max-w-sm">
            <CardContent className="pt-4">
              <div className="text-xs font-semibold text-slate-500 uppercase mb-2">거래 정보</div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-500">거래 ID</span>
                <button
                  onClick={copyId}
                  className="font-mono text-[11px] text-primary-600 flex items-center gap-1 hover:underline"
                >
                  {tradeId.slice(0, 10)}…{tradeId.slice(-6)}
                  <Copy className="w-3 h-3" />
                </button>
              </div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-slate-500">금액</span>
                <span className="font-bold">{formatUsdt(trade.amount)} USDT</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">상태</span>
                <Badge variant={isReleased ? 'success' : 'info'}>
                  {isReleased ? 'RELEASED' : 'REFUNDED'}
                </Badge>
              </div>
              <div className="flex justify-between text-xs mt-1.5">
                <span className="text-slate-500">탐색기</span>
                <a
                  href={`${getExplorerUrl(chainId)}/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 flex items-center gap-1 hover:underline text-[11px] font-bold"
                >
                  Arbiscan에서 확인
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </CardContent>
          </Card>

          {/* 자동 복귀 카운트다운 — 10초 후 onExit() 호출 */}
          <div className="text-sm text-slate-400">
            {exitCountdown}초 후 오더북으로 돌아갑니다
          </div>

          {/* 수동 복귀 버튼 */}
          <div className="flex flex-col gap-2 w-full max-w-sm">
            <Button
              variant="outline"
              className="w-full"
              onClick={onGoToHistory || onExit}
            >
              <ScrollText className="w-4 h-4" />
              거래 내역 보기
            </Button>
            <Button
              variant={isReleased ? 'success' : 'default'}
              className="w-full"
              onClick={onExit}
            >
              오더북으로 돌아가기
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 메인 거래방 화면 (LOCKED / DISPUTED 상태)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in">
      {/* 앱 바 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
        <Button variant="ghost" size="sm" onClick={onExit} className="p-1.5">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="text-base font-semibold flex-1 text-center">
          {getTitle()}
        </div>
        <div className="w-9" />
      </div>

      {/* 통합 단계 표시기 (A.7) */}
      <div className="px-4 pt-3 pb-2">
        <Stepper steps={UNIFIED_STEPS} current={getUnifiedStepCurrent()} />
        {stepGuidance && (
          <div className="mt-2 text-center text-xs text-slate-500 bg-slate-50 rounded-lg py-1.5 px-3">
            {stepGuidance}
          </div>
        )}
      </div>

      <div className="pb-5">
        {/* 원형 타이머 (LOCKED 상태에서만 표시) */}
        {status === TradeStatus.LOCKED && (
          <div className="flex justify-center py-3">
            <div className="flex flex-col items-center justify-center w-20 h-20 rounded-full border-4 border-amber-300 bg-amber-50">
              <div className="text-amber-600 font-mono font-bold text-sm leading-tight">
                {shortCountdown}
              </div>
              <div className="text-amber-500 text-[10px] font-medium mt-0.5">남은시간</div>
            </div>
          </div>
        )}

        <div className="px-4 flex flex-col gap-2.5">
          {/* 거래 상태 배지 + 역할 배지 */}
          <div className="flex items-center gap-2">
            <Badge variant={trade ? STATUS_BADGE_VARIANT[status] : 'secondary'}>
              {trade ? STATUS_LABEL[status] : '로드 중...'}
            </Badge>
            <Badge variant="secondary">
              {role === 'seller' ? '📤 판매자' : '📥 구매자'}
            </Badge>
          </div>

          {/* 거래 ID 복사 카드 */}
          <Card>
            <CardContent className="pt-3 pb-3">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                거래 ID
              </div>
              <button
                onClick={copyId}
                className="flex items-center justify-between w-full gap-2 group"
                title="클릭하여 복사"
              >
                <span className="font-mono text-xs text-slate-700 truncate">{tradeId}</span>
                <span className="flex items-center gap-1 text-primary-600 text-[11px] font-bold shrink-0 group-hover:underline">
                  <Copy className="w-3 h-3" />
                  복사
                </span>
              </button>
            </CardContent>
          </Card>

          {/* 거래 정보 카드 (금액, 수수료, 판매자/구매자 주소, 만료 시간) */}
          {trade && (
            <Card>
              <CardContent className="pt-3 pb-3 flex flex-col gap-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">거래 금액</span>
                  <span className="font-extrabold text-[15px] text-slate-900">{formatUsdt(trade.amount)} USDT</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">수수료 (2%)</span>
                  <span className="font-bold text-slate-700">{formatUsdt(trade.feeAmount)} USDT</span>
                </div>
                <Separator className="my-0" />
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">판매자</span>
                  <span className="font-mono text-[11px] font-bold text-slate-700">{shortAddr(trade.seller)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">구매자</span>
                  <span className="font-mono text-[11px] font-bold text-slate-700">{shortAddr(trade.buyer)}</span>
                </div>
                {status === TradeStatus.LOCKED && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">만료까지</span>
                    <span className={cn('text-xs', countdownColorClass)}>{countdownText}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 에스크로 보호 안내 카드 (LOCKED 상태에서만 표시) */}
          {status === TradeStatus.LOCKED && (
            <Card className="border-emerald-200">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-2 mb-2.5">
                  <Shield className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="text-sm font-semibold text-emerald-700">에스크로 보호 시스템</span>
                </div>
                <div className="text-[11px] text-slate-500 leading-relaxed flex flex-col gap-1.5">
                  {/* 스마트 컨트랙트 잠금 안내 */}
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-500 shrink-0 mt-0.5">&#x1F512;</span>
                    <span>USDT가 <strong className="text-slate-700">스마트 컨트랙트</strong>에 안전하게 잠겨 있습니다. 어느 누구도 임의로 인출할 수 없습니다.</span>
                  </div>
                  {/* 7일 자동 환불 안내 */}
                  <div className="flex items-start gap-2">
                    <span className="text-amber-500 shrink-0 mt-0.5">&#x23F0;</span>
                    <span>7일 안에 거래가 완료되지 않으면 판매자가 <strong className="text-slate-700">자동 환불</strong> 받을 수 있습니다.</span>
                  </div>
                  {/* 분쟁 중재 안내 */}
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500 shrink-0 mt-0.5">&#x2696;&#xFE0F;</span>
                    <span>문제 발생 시 <strong className="text-slate-700">분쟁 시스템</strong>으로 운영자가 30일 내 중재합니다.</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* DISPUTED 상태 배너 */}
          {status === TradeStatus.DISPUTED && (
            <Banner variant="destructive" icon={<AlertTriangle className="w-4 h-4" />} title="분쟁 접수됨">
              운영자가 검토 중입니다 (최대 30일)
            </Banner>
          )}

          {/* P2P 채팅 카드 */}
          <Card>
            <CardContent className="pt-3 pb-3">
              {/* 채팅 헤더 — 연결 상태 표시 */}
              <div className="flex items-center justify-between mb-2.5">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                  P2P 채팅
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    connected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                  )} />
                  <span className="text-[11px] text-slate-500">
                    {connected ? 'XMTP 연결됨' : xmtpReady ? '연결 중...' : 'XMTP 준비 중...'}
                  </span>
                </div>
              </div>

              {/* 시그널 버튼 (LOCKED 상태에서만 표시) — 빠른 상태 전달용 프리셋 메시지 */}
              {status === TradeStatus.LOCKED && (
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {/* 구매자: KRW 송금 완료 시그널 버튼 */}
                  {role === 'buyer' && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => send({ type: 'signal', text: '💸 KRW 송금 완료했습니다. 확인 부탁드립니다!' })}
                    >
                      💸 KRW 보냈습니다
                    </Button>
                  )}
                  {/* 판매자: 입금 확인 중 / 입금 확인 완료 시그널 버튼 */}
                  {role === 'seller' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => send({ type: 'signal', text: '🔍 입금 확인 중입니다...' })}
                      >
                        🔍 확인 중
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => send({ type: 'signal', text: '✓ 입금 확인했습니다. USDT 전송합니다!' })}
                      >
                        ✓ 입금 확인
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* 메시지 목록 — 자동 스크롤 컨테이너 */}
              <div
                ref={chatRef}
                className="max-h-52 overflow-y-auto flex flex-col mb-2.5 pr-0.5"
              >
                {messages.length === 0 && (
                  <div className="flex justify-center my-3">
                    <div className="bg-slate-100 text-slate-400 text-[11px] rounded-full px-3 py-1">
                      {connected
                        ? '채팅 기록이 없습니다. 메시지를 보내보세요.'
                        : xmtpReady
                          ? '상대방과 연결 중...'
                          : 'XMTP 초기화 중...'}
                    </div>
                  </div>
                )}
                {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
              </div>

              {/* 채팅 입력창 — 연결 전에는 비활성화 */}
              <form className="flex items-center gap-2" onSubmit={handleSend}>
                <Input
                  placeholder="메시지 입력..."
                  value={chatText}
                  onChange={e => setChatText(e.target.value)}
                  disabled={!connected}
                  className="flex-1 h-9 text-sm"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!connected || !chatText.trim()}
                  className="h-9 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  전송
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* 트랜잭션 오류 메시지 */}
          {txError && (
            <Alert variant="destructive">
              <AlertDescription>
                오류: {txError.shortMessage ?? txError.message}
              </AlertDescription>
            </Alert>
          )}

          {/* 확인 다이얼로그 — 릴리즈/환불/분쟁 실행 전 사용자에게 확인을 요청한다 */}
          {confirm && (
            <Banner
              variant="warning"
              icon={<AlertTriangle className="w-4 h-4" />}
              title={`정말 ${confirm.label}하시겠습니까?`}
              className="items-center"
            >
              <div className="flex gap-2 mt-2">
                <Button variant="destructive" size="sm" onClick={doConfirmedAction}>
                  확인
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>
                  취소
                </Button>
              </div>
            </Banner>
          )}

          {/* 거래 액션 버튼 (LOCKED 상태에서만 표시) */}
          {status === TradeStatus.LOCKED && (
            <div className="flex flex-col gap-2 mt-1">
              {/* 판매자 전용: KRW 입금 확인 후 USDT 릴리즈 버튼 */}
              {role === 'seller' && (
                <Button
                  variant="success"
                  className="w-full"
                  disabled={isWorking}
                  onClick={() => setConfirm({ action: 'release', label: 'USDT 릴리즈' })}
                >
                  <CheckCircle className="w-4 h-4" />
                  {relPending || relConfirming ? '처리 중...' : '입금 확인 · USDT 릴리즈'}
                </Button>
              )}
              {/* 에스크로 만료 시 표시: 환불 버튼 */}
              {isRefundable && (
                <Button
                  variant="warning"
                  className="w-full"
                  disabled={isWorking}
                  onClick={() => setConfirm({ action: 'refund', label: '환불' })}
                >
                  <RotateCcw className="w-4 h-4" />
                  {refPending || refConfirming ? '처리 중...' : '환불 (만료)'}
                </Button>
              )}
              {/* 분쟁 신청 버튼 — 거래 당사자 모두 사용 가능 */}
              <Button
                variant="destructive"
                className="w-full"
                disabled={isWorking}
                onClick={() => setConfirm({ action: 'dispute', label: '분쟁 신청' })}
              >
                <Flag className="w-4 h-4" />
                {disPending || disConfirming ? '처리 중...' : '분쟁 신청'}
              </Button>
            </div>
          )}

          {/* DISPUTED 상태: 오더북으로 돌아가기 버튼 */}
          {status === TradeStatus.DISPUTED && (
            <Button
              variant="outline"
              className="w-full mt-1"
              onClick={onExit}
            >
              오더북으로
            </Button>
          )}

          {/* 거래 데이터 로드 중 표시 */}
          {isLoading && (
            <div className="text-sm text-slate-400 text-center py-4">
              거래 데이터 로드 중...
            </div>
          )}
        </div>

        <div className="h-8" />
      </div>
    </div>
  )
}
