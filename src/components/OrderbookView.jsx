/**
 * OrderbookView.jsx
 *
 * 오더북 메인 뷰 컴포넌트.
 * 판매/구매 오더 목록을 탭으로 구분하여 표시하고,
 * 오더 생성·수정·취소, 오더 상세보기, 구매자 선택 화면을 순차적으로 렌더링한다.
 *
 * 뷰 전환 우선순위:
 *   1. formMode가 있으면 → 오더 생성/수정 폼
 *   2. selectedOrder가 있으면 → 오더 상세보기
 *   3. selectingBuyerForOrder가 있으면 → 구매자 선택 화면
 *   4. 기본 → 메인 오더 목록
 */
import { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import SellOrderForm from './SellOrderForm'
import BuyOrderForm from './BuyOrderForm'
import OrderDetail from './OrderDetail'
import BuyerSelector from './BuyerSelector'
import { getUserProfile, renderStars } from '../mockData'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Banner } from '@/components/ui/banner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getAvatarGradient, getAvatarChar } from '@/lib/avatar'
import { useToast } from '@/contexts/ToastContext'

// 하위 호환성 유지를 위한 재내보내기 (OrderDetail에서 이 파일을 통해 임포트하는 경우 대비)
export { getAvatarGradient, getAvatarChar } from '@/lib/avatar'

/**
 * OrderbookView — 오더북 메인 컨테이너 컴포넌트.
 * 판매/구매 탭, 오더 목록, 오더 폼, 상세보기, 구매자 선택을 통합 관리한다.
 *
 * @param {Object}   orderbook        - useOrderbook 훅의 반환값 (오더 목록, P2P 연결 상태 등)
 * @param {function} onStartTrade     - 거래 시작 시 호출되는 콜백 (거래방 이동)
 * @param {boolean}  [myOrdersOnly]   - true이면 내 오더만 표시 (내 오더 탭에서 사용)
 */
export default function OrderbookView({ orderbook, onStartTrade, myOrdersOnly = false }) {
  // 현재 연결된 지갑 주소
  const { address } = useAccount()
  const { toast } = useToast()

  // 현재 선택된 탭: 'sell' (판매 오더) | 'buy' (구매 오더)
  const [tab, setTab] = useState('sell')
  // 오더 생성 폼 표시 모드: null | 'sell-form' | 'buy-form'
  const [formMode, setFormMode] = useState(null)
  // 수정 중인 오더 객체 (수정 모드일 때만 설정)
  const [editingOrder, setEditingOrder] = useState(null)
  // 상세보기 중인 오더 객체 (클릭한 오더)
  const [selectedOrder, setSelectedOrder] = useState(null)
  // 구매자 선택 화면을 표시 중인 오더 ID (내 판매 오더에 수락 요청이 들어왔을 때)
  const [selectingBuyerForOrder, setSelectingBuyerForOrder] = useState(null)

  // 내 오더 탭: 판매+구매 오더 중 내 지갑 주소와 일치하는 것만 합산
  const allMyOrders = [
    ...orderbook.sellOrders.filter(o => o.seller?.toLowerCase() === address?.toLowerCase()),
    ...orderbook.buyOrders.filter(o => o.buyer?.toLowerCase() === address?.toLowerCase()),
  ]

  // 현재 탭에 맞는 오더 목록.
  // myOrdersOnly 모드이면 내 것만 필터링, 아니면 전체 목록 사용
  const orders = myOrdersOnly
    ? (tab === 'sell'
        ? orderbook.sellOrders.filter(o => o.seller?.toLowerCase() === address?.toLowerCase())
        : orderbook.buyOrders.filter(o => o.buyer?.toLowerCase() === address?.toLowerCase()))
    : (tab === 'sell' ? orderbook.sellOrders : orderbook.buyOrders)

  // 내 판매 오더에 들어온 수락 요청 목록 (알림 배너 표시 및 구매자 선택에 사용)
  const myAcceptRequests = orderbook.acceptRequests.filter(r => {
    const order = orderbook.sellOrders.find(o => o.id === r.orderId)
    return order && order.seller?.toLowerCase() === address?.toLowerCase()
  })

  // 새 수락 요청이 도착하면 토스트 알림 표시
  const prevReqCountRef = useRef(myAcceptRequests.length)
  useEffect(() => {
    if (myAcceptRequests.length > prevReqCountRef.current) {
      const newCount = myAcceptRequests.length - prevReqCountRef.current
      toast(`새 수락 요청이 ${newCount}건 도착했습니다`, 'info')
    }
    prevReqCountRef.current = myAcceptRequests.length
  }, [myAcceptRequests.length])

  /**
   * 오더 카드 클릭 핸들러.
   * - 내 판매 오더에 수락 요청이 존재하면 → 구매자 선택 화면으로 전환
   * - 그 외 → 오더 상세보기 화면으로 전환
   */
  function handleOrderClick(order) {
    if (
      order.type === 'SELL' &&
      order.seller?.toLowerCase() === address?.toLowerCase()
    ) {
      const reqs = orderbook.acceptRequests.filter(r => r.orderId === order.id)
      if (reqs.length > 0) {
        // 수락 요청이 1건 이상이면 구매자 선택 화면으로 이동
        setSelectingBuyerForOrder(order.id)
        return
      }
    }
    // 수락 요청이 없거나 내 오더가 아니면 상세보기
    setSelectedOrder(order)
  }

  /**
   * 수락 요청 전송 완료 후 호출되는 콜백.
   * 오더 상세보기 화면을 닫는다.
   */
  function handleAcceptSent() {
    setSelectedOrder(null)
  }

  /**
   * 구매자 선택 완료 핸들러.
   * 구매자 선택 화면을 닫고, onStartTrade 콜백으로 거래방 진입을 요청한다.
   *
   * @param {string} orderId       - 거래가 시작될 오더 ID
   * @param {string} buyerAddress  - 선택된 구매자 지갑 주소
   */
  function handleBuyerSelected(orderId, buyerAddress) {
    setSelectingBuyerForOrder(null)
    if (onStartTrade) {
      onStartTrade(null, 'seller', { orderId, buyerAddress })
    }
  }

  /**
   * 오더 만료 시간을 사람이 읽기 좋은 형식으로 변환.
   * - 60분 미만: "N분"
   * - 60분 이상: "Nh"
   * - 이미 만료: "만료됨"
   *
   * @param {number} expiry - 만료 타임스탬프 (ms)
   * @returns {string} 포맷된 남은 시간 문자열
   */
  function formatExpiry(expiry) {
    const remaining = expiry - Date.now()
    if (remaining <= 0) return '만료됨'
    const min = Math.floor(remaining / 60000)
    if (min < 60) return `${min}분`
    const hr = Math.floor(min / 60)
    return `${hr}h`
  }

  /**
   * 숫자를 한국 원화(KRW) 표기 형식으로 변환 (천 단위 콤마 삽입).
   *
   * @param {number} n - 변환할 숫자
   * @returns {string} 콤마가 삽입된 숫자 문자열
   */
  function formatKRW(n) {
    return new Intl.NumberFormat('ko-KR').format(n)
  }

  /**
   * 지갑 주소를 축약 형식으로 변환 (앞 6자 + "…" + 뒤 4자).
   *
   * @param {string} addr - 전체 지갑 주소
   * @returns {string} 축약된 주소 문자열
   */
  function shortAddr(addr) {
    if (!addr) return '—'
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
  }

  // ── 폼 뷰: 판매 오더 생성/수정 ──────────────────────────────────────────

  if (formMode === 'sell-form') {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFormMode(null); setEditingOrder(null) }}
          >
            ←
          </Button>
          <div className="text-base font-semibold flex-1 text-center">
            {editingOrder ? '✏️ 판매 오더 수정' : '📤 판매 오더 올리기'}
          </div>
          <div className="w-8" />
        </div>
        <div className="px-4 py-4">
          <SellOrderForm
            initialValues={editingOrder}
            onCreated={(order) => {
              if (editingOrder) {
                orderbook.cancelOrder(editingOrder.id)  // 수정 시 기존 오더 먼저 취소
              }
              orderbook.postSellOrder(order)
              setFormMode(null)
              setEditingOrder(null)
            }}
          />
        </div>
      </div>
    )
  }

  // ── 폼 뷰: 구매 오더 생성/수정 ──────────────────────────────────────────

  if (formMode === 'buy-form') {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFormMode(null); setEditingOrder(null) }}
          >
            ←
          </Button>
          <div className="text-base font-semibold flex-1 text-center">
            {editingOrder ? '✏️ 구매 오더 수정' : '📥 구매 오더 올리기'}
          </div>
          <div className="w-8" />
        </div>
        <div className="px-4 py-4">
          <BuyOrderForm
            initialValues={editingOrder}
            onCreated={(order) => {
              if (editingOrder) {
                orderbook.cancelOrder(editingOrder.id)  // 수정 시 기존 오더 먼저 취소
              }
              orderbook.postBuyOrder(order)
              setFormMode(null)
              setEditingOrder(null)
            }}
          />
        </div>
      </div>
    )
  }

  // ── 오더 상세보기 뷰 ─────────────────────────────────────────────────────

  if (selectedOrder) {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
          <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)}>
            ←
          </Button>
          <div className="text-base font-semibold flex-1 text-center">
            {selectedOrder.type === 'SELL' ? '판매 오더 상세' : '구매 오더 상세'}
          </div>
          <div className="w-9" />
        </div>
        {/*
          acceptResponse: 내가 보낸 수락 요청에 대한 판매자 응답 (구매자 측에서 확인용)
          tradeNotification: 거래 시작 알림 (판매자가 구매자를 선택했을 때 전파됨)
        */}
        <OrderDetail
          order={selectedOrder}
          onAcceptSent={handleAcceptSent}
          onCancel={() => setSelectedOrder(null)}
          acceptResponse={orderbook.acceptResponses.find(
            r => r.orderId === selectedOrder.id &&
                 r.buyer?.toLowerCase() === address?.toLowerCase()
          )}
          tradeNotification={orderbook.tradeNotifications?.find(
            n => n.orderId === selectedOrder.id
          )}
          onStartTrade={onStartTrade}
          onCancelOrder={(orderId) => {
            orderbook.cancelOrder(orderId)
            setSelectedOrder(null)
          }}
          onEditOrder={(order) => {
            setEditingOrder(order)
            setFormMode(order.type === 'SELL' ? 'sell-form' : 'buy-form')
            setSelectedOrder(null)
          }}
        />
      </div>
    )
  }

  // ── 구매자 선택 뷰 ───────────────────────────────────────────────────────

  if (selectingBuyerForOrder) {
    // 구매자 선택 대상 오더와 해당 오더의 수락 요청 목록
    const order = orderbook.sellOrders.find(o => o.id === selectingBuyerForOrder)
    const reqs = orderbook.acceptRequests.filter(r => r.orderId === selectingBuyerForOrder)
    return (
      <div className="animate-fade-in">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
          <Button variant="ghost" size="sm" onClick={() => setSelectingBuyerForOrder(null)}>
            ←
          </Button>
          <div className="text-base font-semibold flex-1 text-center">구매 요청</div>
          <div className="w-9" />
        </div>
        <BuyerSelector
          order={order}
          requests={reqs}
          onSelect={(buyerAddress) => {
            // 선택한 구매자에게 수락 응답 전송 (은행 계좌 정보 포함)
            orderbook.respondAccept({
              orderId: selectingBuyerForOrder,
              buyer: buyerAddress,
              accepted: true,
              bankAccount: order?.bankAccount || '',
            })
            handleBuyerSelected(selectingBuyerForOrder, buyerAddress)
          }}
          onReject={(buyerAddress) => {
            // 선택하지 않은 구매자에게 거절 응답 전송
            orderbook.respondAccept({
              orderId: selectingBuyerForOrder,
              buyer: buyerAddress,
              accepted: false,
            })
          }}
        />
      </div>
    )
  }

  // ── 메인 오더 목록 뷰 ────────────────────────────────────────────────────

  // 전체 오더 수 (판매 + 구매)
  const totalOrders = orderbook.sellOrders.length + orderbook.buyOrders.length

  return (
    <div className="animate-fade-in">
      {/* 페이지 헤더: 제목 + P2P 연결 상태 + 내 아바타 */}
      <div className="flex items-center justify-between mb-4 px-4 pt-4">
        <div>
          <div className="text-lg font-bold text-slate-900">
            {myOrdersOnly ? '내 오더' : '거래소'}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
            {/* P2P 연결 상태 인디케이터: 연결됨(초록 점멸) / 연결 중(회색) */}
            <span
              className={
                orderbook.connected
                  ? 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse'
                  : 'w-2 h-2 rounded-full bg-slate-300'
              }
            />
            P2P · {
              !orderbook.connected
                ? '연결 중...'
                : orderbook.peerCount === 0
                  ? '접속 중'
                  : `${orderbook.peerCount + 1}명 접속`
            }
          </div>
        </div>
        {/* 내 지갑 주소 기반 그라디언트 아바타 */}
        <Avatar
          size="default"
          style={{ background: getAvatarGradient(address) }}
          className="cursor-pointer"
        >
          {getAvatarChar(address)}
        </Avatar>
      </div>

      {/* 히어로 CTA 섹션: 서비스 소개 + 판매/구매 빠른 시작 버튼 */}
      <Card className="mx-4 mb-4 bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
        <div className="p-4">
          <div className="text-lg font-semibold text-slate-900 mb-1">
            P2P USDT ↔ KRW<br/>
            <span className="text-primary-600">안전한 에스크로</span> 기반 거래
          </div>
          <div className="text-sm text-slate-500 mb-3">
            스마트 컨트랙트가 자금을 보호합니다
          </div>
          <div className="flex gap-2">
            <Button
              variant="warning"
              size="sm"
              className="flex-1"
              onClick={() => setFormMode('sell-form')}
            >
              📤 판매 시작하기
            </Button>
            <Button
              variant="info"
              size="sm"
              className="flex-1"
              onClick={() => setFormMode('buy-form')}
            >
              📥 구매 시작하기
            </Button>
          </div>
        </div>
      </Card>

      {/* 실시간 통계: 전체 오더 수 + 접속 중인 피어 수 */}
      <div className="flex gap-3 text-xs text-slate-500 px-4 mb-3">
        <div>
          📊 오더 <span className="text-primary-600 font-medium">{totalOrders}건</span>
        </div>
        <div>
          👥 접속 <span className="text-emerald-600 font-medium">{orderbook.peerCount || 0}명</span>
        </div>
      </div>

      {/* 수락 요청 알림 배너: 내 판매 오더에 구매 요청이 들어왔을 때 표시 */}
      {myAcceptRequests.length > 0 && (
        <div className="px-4 mb-3">
          <Banner
            variant="warning"
            icon="🔔"
            title={`${myAcceptRequests.length}건의 수락 요청`}
          >
            내 주문을 클릭하여 구매자를 선택하세요
          </Banner>
        </div>
      )}

      {/* 판매/구매 탭 전환 */}
      <Tabs value={tab} onChange={setTab}>
        <TabsList className="w-full px-4">
          <TabsTrigger value="sell">📤 판매 오더</TabsTrigger>
          <TabsTrigger value="buy">📥 구매 오더</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 탭 설명 텍스트 */}
      <div className="px-4 py-2 text-xs text-slate-500">
        {tab === 'sell' ? (
          <>🛡️ <strong className="text-amber-600">판매 오더</strong> — 에스크로 보호 하에 USDT 구매 가능</>
        ) : (
          <>🛡️ <strong className="text-blue-600">구매 오더</strong> — 에스크로 보호 하에 USDT 판매 가능</>
        )}
      </div>

      {/* 오더 생성 CTA 버튼 (탭 타입에 따라 색상 변경) */}
      <div className="px-4 mb-3">
        <Button
          variant={tab === 'sell' ? 'warning' : 'info'}
          className="w-full"
          onClick={() => setFormMode(tab === 'sell' ? 'sell-form' : 'buy-form')}
        >
          + {tab === 'sell' ? '판매 오더 생성하기' : '구매 오더 생성하기'}
        </Button>
      </div>

      {/* 금액대 필터 칩 — 현재 UI만 구현, 실제 필터링 기능 미구현 */}
      <div className="flex gap-2 px-4 mb-3">
        {['전체', '~100', '100~500', '신뢰'].map((label, i) => (
          <button
            key={label}
            className={
              i === 0
                ? 'rounded-full px-3 py-1 text-xs bg-primary-600 text-white'
                : 'rounded-full px-3 py-1 text-xs bg-slate-100 text-slate-600 hover:bg-slate-200'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* 현재 탭의 오더 건수 표시 */}
      <div className="px-4 mb-2">
        <div className="text-xs text-slate-500">
          {tab === 'sell' ? '📤' : '📥'} {tab === 'sell' ? '판매' : '구매'} 오더 · {orders.length}건
        </div>
      </div>

      {/* 오더 목록 또는 빈 상태 안내 */}
      {orders.length === 0 ? (
        // 오더가 없을 때 빈 상태 UI
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <div className="text-4xl mb-2">
            {tab === 'sell' ? '📤' : '📥'}
          </div>
          <div className="text-base font-semibold text-slate-700 mb-1">
            아직 등록된 {tab === 'sell' ? '판매' : '구매'} 오더가 없습니다
          </div>
          <div className="text-sm text-slate-400 mb-4">
            첫 번째 거래자가 되어보세요.<br/>
            지금 등록하면 상단에 노출됩니다.
          </div>
          <Button
            variant={tab === 'sell' ? 'warning' : 'info'}
            onClick={() => setFormMode(tab === 'sell' ? 'sell-form' : 'buy-form')}
          >
            + {tab === 'sell' ? '판매 오더 등록하기' : '구매 오더 등록하기'}
          </Button>
        </div>
      ) : (
        // 오더 카드 목록
        <div className="px-4 flex flex-col gap-3">
          {orders.map(order => {
            const isSell = order.type === 'SELL'
            // 오더 소유자 주소 (판매 오더면 seller, 구매 오더면 buyer)
            const ownerAddr = isSell ? order.seller : order.buyer
            // 현재 사용자의 오더인지 여부
            const isOwn = ownerAddr?.toLowerCase() === address?.toLowerCase()
            // 이 오더에 들어온 수락 요청 건수
            const reqCount = orderbook.acceptRequests.filter(r => r.orderId === order.id).length
            // USDT 금액 × KRW 단가 = 총 원화 금액
            const totalKRW = Math.round(order.amount * order.priceKRW)
            // 모의 사용자 프로필 (별점, 거래 횟수)
            const profile = getUserProfile(ownerAddr)

            return (
              <Card
                key={order.id}
                className={
                  // 판매 오더: 좌측 앰버 보더 / 구매 오더: 좌측 블루 보더
                  isSell
                    ? 'border-l-4 border-l-amber-400 cursor-pointer hover:shadow-md transition-shadow'
                    : 'border-l-4 border-l-blue-400 cursor-pointer hover:shadow-md transition-shadow'
                }
                onClick={() => handleOrderClick(order)}
              >
                <div className="p-3.5">
                  {/* 상단: 판매자/구매자 정보 + 상태 배지 */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      {/* 지갑 주소 기반 그라디언트 아바타 */}
                      <Avatar
                        size="sm"
                        style={{ background: getAvatarGradient(ownerAddr) }}
                      >
                        {getAvatarChar(ownerAddr)}
                      </Avatar>
                      <div>
                        {/* 축약된 지갑 주소 */}
                        <div className="text-xs font-mono text-slate-500">
                          {shortAddr(ownerAddr)}
                        </div>
                        {/* 별점 및 평점 수치 */}
                        <div className="text-xs text-amber-500">
                          {renderStars(profile.rating)}{' '}
                          <span className="text-slate-400">{profile.rating.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                    {/* 상태 배지: 내 오더+요청있음 → 요청 알림 / 내 오더 → 내 주문 / 타인 판매 → 에스크로 / 타인 구매 → 구매 희망 */}
                    {isOwn && reqCount > 0 ? (
                      <Badge variant="warning">🔔 요청 {reqCount}건</Badge>
                    ) : isOwn ? (
                      <Badge variant="success">내 주문</Badge>
                    ) : isSell ? (
                      <Badge variant="secondary">🔒 에스크로</Badge>
                    ) : (
                      <Badge variant="info">📥 구매 희망</Badge>
                    )}
                  </div>

                  {/* 중단: USDT 수량 + 원화 환산 금액 */}
                  <div className="flex items-end justify-between mb-2.5">
                    <div>
                      <span className="text-xl font-bold text-slate-900">
                        {order.amount.toLocaleString()}
                      </span>
                      <span className="text-sm text-slate-400 ml-1">USDT</span>
                    </div>
                    <div className="text-right">
                      {/* 총 원화 금액 (판매: 앰버, 구매: 블루) */}
                      <div className={isSell ? 'text-amber-600 font-semibold' : 'text-blue-600 font-semibold'}>
                        {formatKRW(totalKRW)}원
                      </div>
                      {/* USDT당 단가 */}
                      <div className="text-xs text-slate-400">
                        {formatKRW(order.priceKRW)}원/USDT
                      </div>
                    </div>
                  </div>

                  {/* 하단: 만료 시간 + 거래 횟수 + 액션 버튼 */}
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex gap-3">
                      <span>⏱ {formatExpiry(order.expiry)}</span>
                      <span>거래 {profile.tradeCount}회</span>
                    </div>
                    {isOwn ? (
                      // 내 오더: 수정 버튼 + 삭제 버튼
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()  // 카드 클릭 이벤트 전파 방지
                            setEditingOrder(order)
                            setFormMode(order.type === 'SELL' ? 'sell-form' : 'buy-form')
                          }}
                        >
                          ✏️
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation()  // 카드 클릭 이벤트 전파 방지
                            if (window.confirm('이 오더를 취소하시겠습니까?')) {
                              orderbook.cancelOrder(order.id)
                            }
                          }}
                        >
                          🗑
                        </Button>
                      </div>
                    ) : (
                      // 타인 오더: 판매 오더이면 "구매하기", 구매 오더이면 "판매하기"
                      <Button
                        variant={isSell ? 'info' : 'warning'}
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleOrderClick(order) }}
                      >
                        {isSell ? '구매하기' : '판매하기'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* 하단 여백 */}
      <div className="h-8" />
    </div>
  )
}
