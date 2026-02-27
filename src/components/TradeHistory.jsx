/**
 * TradeHistory.jsx
 *
 * 거래 내역 페이지 컴포넌트.
 * IndexedDB에 저장된 거래 기록을 불러오고, 각 거래의 온체인 최신 상태를 조회하여 표시한다.
 * 필터 탭(전체/진행중/완료/분쟁·환불)으로 목록을 구분하며,
 * 총 거래 횟수·완료 횟수·완료율 통계를 제공한다.
 */
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getTradesByAddress } from '@/lib/indexeddb'
import { useGetTrade, formatUsdt } from '@/hooks/useEscrow'
import { TradeStatus } from '@/constants'
import { ArrowUpRight, ArrowDownLeft, RefreshCw } from 'lucide-react'

// ─── TradeHistoryItem ─────────────────────────────────────────────────────────

/**
 * 개별 거래 내역 카드 컴포넌트.
 * IndexedDB의 캐시 데이터를 기반으로 렌더링하되, useGetTrade 훅으로 온체인 최신 상태를 오버라이드한다.
 * 카드 클릭 시 해당 거래방으로 이동한다.
 *
 * @param {Object}   trade         - IndexedDB 거래 레코드 { tradeId, seller, buyer, amount, status, createdAt }
 * @param {string}   address       - 현재 사용자의 지갑 주소 (역할 판별에 사용)
 * @param {function} onOpenTrade   - 거래방 이동 콜백 (tradeId, role) => void
 */
function TradeHistoryItem({ trade, address, onOpenTrade }) {
  // 온체인에서 최신 거래 상태 조회 (컨트랙트 직접 호출)
  const { trade: onchain } = useGetTrade(trade.tradeId)

  // 온체인 데이터가 있으면 온체인 상태 우선 사용, 없으면 IDB 캐시 상태 사용
  const currentStatus = onchain ? Number(onchain.status) : trade.status
  // amount: 온체인 데이터 우선, 없으면 IDB 캐시 값을 BigInt로 변환
  const amount = onchain ? onchain.amount : BigInt(trade.amount || '0')
  // 현재 사용자가 판매자인지 여부
  const isSeller = trade.seller?.toLowerCase() === address?.toLowerCase()
  // 거래에서의 역할 ('seller' | 'buyer')
  const role = isSeller ? 'seller' : 'buyer'
  // 상대방 지갑 주소 (판매자이면 구매자 주소, 구매자이면 판매자 주소)
  const peerAddr = isSeller ? trade.buyer : trade.seller

  // 거래 상태별 한글 레이블 및 Badge 색상 매핑
  const statusConfig = {
    [TradeStatus.LOCKED]:   { label: '진행중', variant: 'warning' },
    [TradeStatus.RELEASED]: { label: '완료',   variant: 'success' },
    [TradeStatus.DISPUTED]: { label: '분쟁',   variant: 'destructive' },
    [TradeStatus.REFUNDED]: { label: '환불',   variant: 'info' },
  }
  // 알 수 없는 상태에 대한 폴백 설정
  const config = statusConfig[currentStatus] || { label: '알 수 없음', variant: 'secondary' }

  return (
    <Card
      className="cursor-pointer hover:border-slate-300 transition-colors"
      onClick={() => onOpenTrade(trade.tradeId, role)}
    >
      <CardContent className="p-3.5">
        {/* 상단: 상태 배지 + 거래 생성 날짜 */}
        <div className="flex items-center justify-between mb-2">
          <Badge variant={config.variant}>{config.label}</Badge>
          <span className="text-[11px] text-slate-400">
            {trade.createdAt ? new Date(trade.createdAt).toLocaleDateString('ko-KR') : '—'}
          </span>
        </div>
        {/* 중단: 역할 아이콘 + USDT 금액 + 판매/구매 레이블 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* 판매자: 위로 향하는 앰버 화살표 / 구매자: 아래로 향하는 블루 화살표 */}
            {isSeller ? (
              <ArrowUpRight className="w-4 h-4 text-amber-500" />
            ) : (
              <ArrowDownLeft className="w-4 h-4 text-blue-500" />
            )}
            <span className="text-sm font-bold text-slate-900">
              {formatUsdt(amount)} USDT
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            {isSeller ? '📤 판매' : '📥 구매'}
          </span>
        </div>
        {/* 하단: 상대방 지갑 주소 (축약 표시) */}
        <div className="mt-1.5 text-[11px] text-slate-400 font-mono">
          상대방: {peerAddr ? `${peerAddr.slice(0, 6)}…${peerAddr.slice(-4)}` : '—'}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── TradeHistory ─────────────────────────────────────────────────────────────

/**
 * 거래 내역 페이지 컴포넌트.
 * 현재 연결된 지갑 주소를 기준으로 IndexedDB에서 관련 거래를 조회하고,
 * 필터 탭과 통계 카드, 거래 목록을 렌더링한다.
 *
 * @param {function} onOpenTrade   - 거래방 이동 콜백 (tradeId, role) => void
 */
export default function TradeHistory({ onOpenTrade }) {
  // 현재 연결된 지갑 주소
  const { address } = useAccount()
  // IndexedDB에서 로드한 거래 목록 (판매자 또는 구매자로 참여한 거래 전체)
  const [trades, setTrades] = useState([])
  // 현재 선택된 필터 탭: 'all' | 'active' | 'completed' | 'disputed'
  const [filter, setFilter] = useState('all')
  // 데이터 로딩 중 여부 (스피너 표시 및 새로고침 버튼 비활성화에 사용)
  const [loading, setLoading] = useState(true)

  /**
   * address가 변경될 때마다 IndexedDB에서 거래 목록을 새로 조회한다.
   * 지갑 미연결 시 빈 배열로 초기화한다.
   */
  useEffect(() => {
    if (!address) { setTrades([]); setLoading(false); return }
    setLoading(true)
    getTradesByAddress(address)
      .then(setTrades)
      .catch(() => setTrades([]))
      .finally(() => setLoading(false))
  }, [address])

  /**
   * 수동 새로고침 핸들러.
   * IndexedDB에서 거래 목록을 다시 조회하여 상태를 갱신한다.
   */
  async function handleRefresh() {
    if (!address) return
    setLoading(true)
    try {
      const result = await getTradesByAddress(address)
      setTrades(result)
    } catch {}
    setLoading(false)
  }

  // 필터 탭 정의 목록
  const filters = [
    { id: 'all',      label: '전체' },
    { id: 'active',   label: '진행중' },
    { id: 'completed', label: '완료' },
    { id: 'disputed', label: '분쟁/환불' },
  ]

  // 필터 적용된 거래 목록.
  // 실제 온체인 상태는 각 TradeHistoryItem 내부에서 조회하므로,
  // 여기서는 IDB 캐시 상태(t.status)를 기준으로 필터링한다.
  const filteredTrades = trades.filter(t => {
    if (filter === 'all') return true
    if (filter === 'active') return t.status === TradeStatus.LOCKED
    if (filter === 'completed') return t.status === TradeStatus.RELEASED
    if (filter === 'disputed') return t.status === TradeStatus.DISPUTED || t.status === TradeStatus.REFUNDED
    return true
  })

  // 통계 계산 (IDB 캐시 상태 기준)
  // 총 거래 건수
  const totalCount = trades.length
  // 완료된 거래 건수 (RELEASED 상태)
  const completedCount = trades.filter(t => t.status === TradeStatus.RELEASED).length

  return (
    <div className="space-y-4">
      {/* 헤더: 제목 + 수동 새로고침 버튼 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">거래 내역</h2>
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading}>
          {/* 로딩 중일 때 아이콘 회전 애니메이션 */}
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* 필터 탭 버튼 목록 */}
      <div className="flex gap-2">
        {filters.map(f => (
          <button
            key={f.id}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              // 선택된 탭: 주요 색상 배경 / 비선택 탭: 회색 배경
              filter === f.id
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            )}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 통계 요약 카드: 거래가 1건 이상일 때만 표시 */}
      {totalCount > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {/* 총 거래 건수 */}
          <div className="bg-slate-50 rounded-lg p-2.5 text-center">
            <div className="text-lg font-bold text-slate-900">{totalCount}</div>
            <div className="text-[11px] text-slate-500">총 거래</div>
          </div>
          {/* 완료된 거래 건수 */}
          <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
            <div className="text-lg font-bold text-emerald-700">{completedCount}</div>
            <div className="text-[11px] text-emerald-600">완료</div>
          </div>
          {/* 완료율: 완료 건수 / 전체 건수 × 100 (소수점 반올림) */}
          <div className="bg-primary-50 rounded-lg p-2.5 text-center">
            <div className="text-lg font-bold text-primary-700">
              {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
            </div>
            <div className="text-[11px] text-primary-600">완료율</div>
          </div>
        </div>
      )}

      {/* 거래 목록 영역 */}
      {loading ? (
        // 로딩 중: 스피너 표시
        <div className="flex justify-center py-12">
          <RefreshCw className="w-5 h-5 text-slate-300 animate-spin" />
        </div>
      ) : filteredTrades.length === 0 ? (
        // 빈 상태: 필터에 해당하는 거래가 없을 때 안내 문구 표시
        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
          <span className="text-4xl mb-3">📜</span>
          <p className="text-sm font-medium">
            {filter === 'all' ? '아직 거래 내역이 없습니다' : '해당하는 거래가 없습니다'}
          </p>
          <p className="text-xs mt-1 text-slate-300">거래를 시작하면 여기에 기록됩니다</p>
        </div>
      ) : (
        // 거래 카드 목록 렌더링
        <div className="space-y-2.5">
          {filteredTrades.map(trade => (
            <TradeHistoryItem
              key={trade.tradeId}
              trade={trade}
              address={address}
              onOpenTrade={onOpenTrade}
            />
          ))}
        </div>
      )}
    </div>
  )
}
