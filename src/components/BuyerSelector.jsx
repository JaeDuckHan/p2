/**
 * BuyerSelector.jsx
 *
 * 판매자가 여러 구매 수락 요청 중에서 최종 구매자를 선택하는 컴포넌트.
 * Wireframe: S07 구매자 선택
 *
 * 동작 방식:
 *   - 요청 목록을 카드 형태로 표시하며, 각 카드에 "선택" / "거절" 버튼이 있다
 *   - "선택" 클릭 → onSelect(buyerAddress) 콜백 호출 → 나머지 요청은 자동 거절
 *   - "거절" 클릭 → onReject(buyerAddress) 콜백 호출
 *   - 첫 번째 요청(가장 빠른 요청자)은 "추천" 배지와 인디고 배경으로 강조
 *
 * Avatar 그라디언트:
 *   지갑 주소 기반의 고유한 색상 그라디언트를 생성하여 각 구매자를 시각적으로 구분한다.
 *
 * @param {Object}   order     - 판매자의 현재 오더 (amount, priceKRW 포함)
 * @param {Array}    requests  - 수락 요청 목록 (buyer, orderId, timestamp 포함)
 * @param {function} onSelect  - 구매자 선택 시 호출되는 콜백 (buyer 주소 전달)
 * @param {function} onReject  - 구매자 거절 시 호출되는 콜백 (buyer 주소 전달)
 */
import { getAvatarGradient, getAvatarChar } from '@/lib/avatar'
import { getUserProfile, renderStars } from '../mockData'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Banner } from '@/components/ui/banner'
import { Card } from '@/components/ui/card'

/**
 * BuyerSelector (기본 내보내기)
 *
 * 판매자가 구매 요청 목록에서 거래 상대방을 선택하는 컴포넌트.
 * order 또는 requests가 없으면 "수락 요청 없음" 안내 배너를 표시한다.
 */
export default function BuyerSelector({ order, requests, onSelect, onReject }) {
  // 오더 또는 요청 목록이 없으면 빈 상태 메시지 표시
  if (!order || !requests || requests.length === 0) {
    return (
      <div className="p-4 fade-in">
        <Banner variant="info" icon="ℹ️">
          수락 요청이 없습니다.
        </Banner>
      </div>
    )
  }

  /**
   * 이더리움 주소를 앞 6자리 + 뒤 4자리 형태로 축약한다.
   * 주소가 없으면 '—' 반환.
   */
  function shortAddr(addr) {
    if (!addr) return '—'
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
  }

  /**
   * 타임스탬프를 사람이 읽기 쉬운 상대 시간 문자열로 변환한다.
   * 1분 미만: "방금", 1시간 미만: "N분 전", 이상: "HH:MM" 형식
   */
  function formatTime(ts) {
    const d = new Date(ts)
    const now = Date.now()
    const diff = now - ts
    if (diff < 60000) return '방금'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  /**
   * 원화 금액을 한국 통화 형식으로 포맷한다.
   * 예: 142000 → "142,000"
   */
  function formatKRW(n) {
    return new Intl.NumberFormat('ko-KR').format(n)
  }

  // 오더의 총 KRW 금액 (amount × priceKRW)
  const totalKRW = Math.round(order.amount * order.priceKRW)

  return (
    <div className="p-4 fade-in">
      {/* 수락 요청 건수 알림 배너: 1명 선택 시 나머지 자동 거절 안내 */}
      <Banner
        variant="warning"
        icon="🔔"
        title={`${requests.length}명이 구매 요청했습니다`}
        className="mb-3.5"
      >
        1명 선택 → 나머지 자동 거절
      </Banner>

      {/* 현재 판매 오더 요약 (수량, KRW 금액, 상태 배지) */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 mb-3.5">
        <div>
          <div className="text-xs text-slate-600 mb-0.5">내 오더</div>
          <div className="text-lg font-black tracking-tight">
            {order.amount.toLocaleString()} USDT{' '}
            <span className="text-xs text-teal-600">{formatKRW(totalKRW)}원</span>
          </div>
        </div>
        <Badge variant="success">오픈</Badge>
      </div>

      {/* 수락 요청 건수 레이블 */}
      <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
        수락 요청 · {requests.length}건
      </div>

      {/* 구매 요청 카드 목록 */}
      {requests.map((req, idx) => {
        // 첫 번째 요청자 = 가장 빠른 요청 → "추천" 배지 + 인디고 배경으로 강조
        const isFirst = idx === 0
        // 구매자의 거래 평점 프로필 (mockData에서 조회, 추후 온체인 데이터로 교체 예정)
        const profile = getUserProfile(req.buyer)
        return (
          <Card
            key={`${req.orderId}-${req.buyer}`}
            className={`flex items-center gap-3 p-3 mb-2 ${isFirst ? 'border-indigo-200 bg-indigo-50/40' : ''}`}
          >
            {/* 지갑 주소 기반 고유 그라디언트 Avatar */}
            <Avatar
              size="default"
              style={{ background: getAvatarGradient(req.buyer) }}
            >
              {getAvatarChar(req.buyer)}
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                {/* 구매자 주소 축약 표시 */}
                <span className="font-mono text-xs font-bold">
                  {shortAddr(req.buyer)}
                </span>
                {/* 첫 번째(가장 빠른) 요청자에게 추천 배지 표시 */}
                {isFirst && (
                  <Badge variant="success" className="text-xs px-1.5 py-0">추천</Badge>
                )}
              </div>
              {/* 구매자 평점 (별점 + 숫자): TODO 실제 온체인 API 연동 필요 */}
              <div className="text-xs text-amber-500">
                {renderStars(profile.rating)}{' '}
                <span className="text-slate-600">{profile.rating.toFixed(1)}</span>
              </div>
              {/* 요청 시간 및 서명 확인 여부 */}
              <div className="text-xs text-slate-600 mt-0.5">
                {formatTime(req.timestamp)} · 서명 ✓
              </div>
            </div>
            {/* 선택 / 거절 액션 버튼 */}
            <div className="flex flex-col gap-1.5">
              {/* 선택 버튼: 이 구매자로 거래 진행 */}
              <Button
                variant="success"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onSelect(req.buyer) }}
              >
                선택
              </Button>
              {/* 거절 버튼: 이 구매자의 요청 거절 */}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs px-2.5 py-1 h-auto"
                onClick={(e) => { e.stopPropagation(); onReject(req.buyer) }}
              >
                거절
              </Button>
            </div>
          </Card>
        )
      })}

      {/* 하단 여백 */}
      <div className="h-8" />
    </div>
  )
}
