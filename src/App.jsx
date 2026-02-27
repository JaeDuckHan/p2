/**
 * App.jsx — MiniSwap 메인 앱 컴포넌트
 *
 * 역할:
 *   - 전체 라우팅 흐름 관리 (미연결 → 히어로, 잘못된 네트워크 → 가이드, 거래중 → 거래방, 그 외 → 메인)
 *   - 하단 네비게이션 렌더링 (홈 / 내 오더 / 거래내역)
 *   - 지갑 연결 상태 및 네트워크 감지
 *   - OrderDetail 수락 요청 이벤트를 오더북 훅으로 중계
 *   - 판매자 에스크로 생성 시 구매자 자동 거래방 이동 처리
 *
 * 주요 상태:
 *   activeTrade — 현재 진행중인 거래 정보 (tradeId, role)
 *   page        — 현재 탭 (orderbook | my-orders | history)
 */
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Home, ClipboardList, ScrollText, Shield, Zap, Coins, AlertTriangle, ArrowLeft } from 'lucide-react'
import WalletButton   from './components/WalletButton'
import NetworkGuide   from './components/NetworkGuide'
import OnboardBanner  from './components/OnboardBanner'
import TradeRoom      from './components/TradeRoom'
import OrderbookView  from './components/OrderbookView'
import TradeHistory   from './components/TradeHistory'
import CreateTrade    from './components/CreateTrade'
import { useOrderbook } from './hooks/useOrderbook'
import { Banner } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Arbitrum One 체인 ID (16진수) — MetaMask wallet_switchEthereumChain 호출 시 사용 */
const ARBITRUM_CHAIN_ID_HEX = '0xA4B1'

/**
 * Arbitrum One 네트워크 메타데이터
 * MetaMask에 해당 네트워크가 없을 때 wallet_addEthereumChain으로 자동 추가하기 위한 정보
 */
const ARBITRUM_PARAMS = {
  chainId: ARBITRUM_CHAIN_ID_HEX,
  chainName: 'Arbitrum One',
  rpcUrls: ['https://arb1.arbitrum.io/rpc'],
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  blockExplorerUrls: ['https://arbiscan.io'],
}

/** MiniSwap 루트 컴포넌트 */
export default function App() {
  const { isConnected, chain, chainId, address } = useAccount()

  /**
   * 현재 진행중인 거래 정보
   * null이면 거래 없음, 값이 있으면 TradeRoom 화면으로 라우팅됨
   * 형태: null | { tradeId: string, role: 'seller' | 'buyer' }
   */
  const [activeTrade, setActiveTrade] = useState(null)

  /**
   * 현재 표시 중인 탭
   * 'orderbook' | 'my-orders' | 'history'
   */
  const [page, setPage] = useState('orderbook')

  /**
   * 에스크로 생성 대기 옵션 (판매자가 구매자를 선택한 후 CreateTrade 화면 표시)
   * null이면 비활성, 값이 있으면 CreateTrade 화면을 렌더링
   * 형태: null | { orderId: string, buyerAddress: string }
   */
  const [createTradeOptions, setCreateTradeOptions] = useState(null)

  const orderbook = useOrderbook({ enabled: isConnected })

  /** 앱이 지원하는 체인 ID 목록 (로컬넷 / Arbitrum One / Arbitrum Sepolia) */
  // 지원 체인 ID: Arbitrum One(42161) + Arbitrum Sepolia(421614)
  const SUPPORTED = [42161, 421614]

  /** 지갑은 연결됐으나 지원하지 않는 네트워크에 있는 경우 true */
  const wrongNetwork = isConnected && chainId && !SUPPORTED.includes(chainId)

  // 네트워크 경고 배너 표시 조건 (wrongNetwork와 동일)
  const showNetworkWarn = isConnected && chainId && !SUPPORTED.includes(chainId)

  /** 네트워크 전환 요청 진행 중 여부 — 버튼 비활성화에 사용 */
  const [networkSwitching, setNetworkSwitching] = useState(false)

  /**
   * MetaMask에 Arbitrum One 네트워크 전환을 요청한다.
   * 네트워크가 MetaMask에 등록되지 않은 경우(에러 코드 4902) wallet_addEthereumChain으로 추가 후 전환한다.
   */
  async function handleNetworkSwitch() {
    if (!window.ethereum) return
    setNetworkSwitching(true)
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARBITRUM_CHAIN_ID_HEX }],
      })
    } catch (err) {
      // 에러 코드 4902: MetaMask에 해당 네트워크가 없음 → 네트워크 추가 시도
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [ARBITRUM_PARAMS],
          })
        } catch (_) {}
      }
    } finally {
      setNetworkSwitching(false)
    }
  }

  /**
   * OrderDetail 컴포넌트에서 발생하는 'miniswap:accept-req' 커스텀 이벤트를 감지해
   * orderbook.requestAccept()로 수락 요청을 전달한다.
   * 트리거: orderbook.requestAccept 참조가 변경될 때
   */
  useEffect(() => {
    function handleAcceptReq(e) {
      orderbook.requestAccept(e.detail)
    }
    window.addEventListener('miniswap:accept-req', handleAcceptReq)
    return () => window.removeEventListener('miniswap:accept-req', handleAcceptReq)
  }, [orderbook.requestAccept])

  /**
   * 거래방에 진입한다.
   * @param {string} tradeId - 에스크로 컨트랙트 거래 ID
   * @param {'seller'|'buyer'} role - 현재 사용자의 역할
   */
  function handleJoined(tradeId, role) {
    setActiveTrade({ tradeId, role })
  }

  /** 거래방에서 나가 activeTrade를 초기화한다. */
  function handleExit() {
    setActiveTrade(null)
  }

  /**
   * 판매자가 에스크로를 생성하면 구매자를 자동으로 거래방으로 이동시킨다.
   * tradeNotifications에서 현재 지갑 주소가 buyer인 알림을 찾아 activeTrade를 설정한다.
   * 트리거: tradeNotifications 목록 또는 현재 주소가 변경될 때
   */
  useEffect(() => {
    if (!address || activeTrade?.tradeId) return
    const notif = orderbook.tradeNotifications.find(
      n => n.buyer?.toLowerCase() === address?.toLowerCase()
    )
    if (notif?.tradeId) {
      setActiveTrade({ tradeId: notif.tradeId, role: 'buyer' })
    }
  }, [orderbook.tradeNotifications, address, activeTrade])

  /**
   * 거래방 진입 함수 — 오더북/거래내역에서 특정 거래를 열 때 호출된다.
   * @param {string} tradeId - 거래 ID
   * @param {'seller'|'buyer'} role - 현재 사용자의 역할
   */
  function handleStartTrade(tradeId, role, options) {
    if (tradeId) {
      setActiveTrade({ tradeId, role })
    } else if (options?.buyerAddress) {
      // 판매자가 구매자를 선택한 경우 → 에스크로 생성 화면으로 이동
      setCreateTradeOptions(options)
    }
  }

  /**
   * 하단 네비게이션 아이템 목록
   * id는 page 상태값과 일치하며, 클릭 시 setPage()로 탭을 전환한다.
   */
  // ── 하단 네비게이션 아이템 ──────────────────────────────────────────────────────
  const navItems = [
    { id: 'orderbook',  label: '홈',     Icon: Home },
    { id: 'my-orders',  label: '내 오더', Icon: ClipboardList },
    { id: 'history',    label: '거래내역', Icon: ScrollText },
  ]

  return (
    <div className="max-w-[520px] mx-auto min-h-screen bg-white relative">

      {/* ── 헤더 ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
        <button
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => { setActiveTrade(null); setPage('orderbook') }}
        >
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-sm select-none">
            M
          </div>
          <div className="flex flex-col items-start leading-none">
            <span className="text-sm font-bold text-slate-900">
              Mini<span className="text-primary-600">Swap</span>
            </span>
            <span className="text-[10px] text-slate-400 font-normal mt-0.5">P2P USDT ↔ KRW</span>
          </div>
        </button>
        <WalletButton />
      </div>

      {/* ── 네트워크 경고 배너 ─────────────────────────────────────── */}
      {isConnected && showNetworkWarn && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 cursor-pointer"
          onClick={handleNetworkSwitch}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-amber-800">Arbitrum One 네트워크 전환 필요</div>
              <div className="text-[11px] text-amber-600">USDT 거래를 위해 네트워크를 변경하세요</div>
            </div>
          </div>
          <Button
            size="sm"
            variant="warning"
            disabled={networkSwitching}
            className="shrink-0 text-xs"
            onClick={e => { e.stopPropagation(); handleNetworkSwitch() }}
          >
            {networkSwitching ? '전환 중...' : '전환하기 →'}
          </Button>
        </div>
      )}

      {/* ── 메인 콘텐츠 라우팅 ───────────────────────────────────────── */}
      {!isConnected ? (

        /* ── 히어로: 지갑 미연결 상태 ───────────────────────────────── */
        <div className="flex flex-col items-center px-5 py-10 animate-fade-in">

          {/* 타이틀 */}
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
            Mini<span className="text-primary-600">Swap</span>
          </h1>
          <p className="text-base font-medium text-slate-500 mb-1">
            P2P USDT ↔ KRW 직거래 플랫폼
          </p>
          <p className="text-sm text-slate-400 text-center mb-8 leading-relaxed">
            서버 없는 탈중앙 에스크로 거래<br/>
            스마트 컨트랙트가 당신의 자산을 보호합니다
          </p>

          {/* 특징 카드 3개 */}
          <div className="grid grid-cols-3 gap-3 w-full mb-8">
            <Card className="p-3 flex flex-col items-center text-center gap-1.5">
              <Shield className="w-5 h-5 text-primary-600" />
              <div className="text-xs font-semibold text-slate-800">에스크로 보호</div>
              <div className="text-[11px] text-slate-500 leading-tight">
                USDT가 컨트랙트에 잠기고 양쪽 확인 후 전송됩니다
              </div>
            </Card>
            <Card className="p-3 flex flex-col items-center text-center gap-1.5">
              <Zap className="w-5 h-5 text-amber-500" />
              <div className="text-xs font-semibold text-slate-800">Arbitrum L2</div>
              <div className="text-[11px] text-slate-500 leading-tight">
                이더리움 보안 + L2 속도, 수십 원으로 즉시 거래
              </div>
            </Card>
            <Card className="p-3 flex flex-col items-center text-center gap-1.5">
              <Coins className="w-5 h-5 text-emerald-500" />
              <div className="text-xs font-semibold text-slate-800">수수료 2%</div>
              <div className="text-[11px] text-slate-500 leading-tight">
                숨겨진 비용 없이 투명한 수수료, 자동 계산
              </div>
            </Card>
          </div>

          {/* 지갑 연결 CTA */}
          <div className="flex flex-col items-center gap-3 mb-10 w-full">
            <WalletButton />
            <p className="text-xs text-slate-400">
              MetaMask 또는 호환 지갑이 필요합니다
            </p>
          </div>

          {/* 이용 방법 단계 안내 */}
          <div className="w-full">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 text-center">
              이용 방법
            </div>
            <div className="flex items-start justify-center gap-1">
              {[
                { num: '1', title: '지갑 연결', desc: 'MetaMask로 로그인' },
                { num: '2', title: 'USDT 예치', desc: '에스크로에 안전 보관' },
                { num: '3', title: 'KRW 송금', desc: 'P2P 채팅으로 확인' },
                { num: '4', title: 'USDT 수령', desc: '자동 전송 완료' },
              ].map((step, i, arr) => (
                <div key={step.num} className="flex items-start">
                  <div className="flex flex-col items-center gap-1 w-16">
                    <div className="w-7 h-7 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {step.num}
                    </div>
                    <div className="text-center">
                      <div className="text-[11px] font-semibold text-slate-700">{step.title}</div>
                      <div className="text-[10px] text-slate-400 leading-tight">{step.desc}</div>
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="text-slate-300 text-sm mt-2 mx-0.5">→</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      ) : wrongNetwork ? (

        /* ── 잘못된 네트워크 → 네트워크 가이드 화면 ─────────────────── */
        <NetworkGuide />

      ) : activeTrade && activeTrade.tradeId ? (

        /* ── 진행 중인 거래방 화면 ─────────────────────────────────── */
        <div className="px-4 py-4 animate-fade-in">
          <TradeRoom
            tradeId={activeTrade.tradeId}
            initialRole={activeTrade.role}
            onExit={handleExit}
            onGoToHistory={() => { setActiveTrade(null); setPage('history') }}
          />
        </div>

      ) : createTradeOptions ? (

        /* ── 에스크로 생성 화면 (판매자가 구매자 선택 후) ─────────────── */
        <div className="px-4 py-4 animate-fade-in">
          <div className="flex items-center gap-2 -mx-4 px-4 pb-3 mb-4 border-b border-slate-200">
            <Button variant="ghost" size="sm" onClick={() => setCreateTradeOptions(null)} className="p-1.5">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="text-base font-semibold flex-1 text-center">에스크로 생성</div>
            <div className="w-9" />
          </div>
          <CreateTrade
            prefillBuyer={createTradeOptions.buyerAddress}
            onCreated={(tradeId) => {
              setCreateTradeOptions(null)
              setActiveTrade({ tradeId, role: 'seller' })
            }}
          />
        </div>

      ) : (

        /* ── 홈 화면 (연결됨, 거래 없음) ────────────────────────────── */
        <>
          <OnboardBanner />

          <div className="px-4 pb-24 animate-fade-in">
            {page === 'orderbook' || page === 'my-orders' ? (
              <OrderbookView
                orderbook={orderbook}
                onStartTrade={handleStartTrade}
                myOrdersOnly={page === 'my-orders'}
              />
            ) : (
              <TradeHistory onOpenTrade={(tradeId, role) => {
                setActiveTrade({ tradeId, role })
              }} />
            )}
          </div>

          {/* ── 하단 네비게이션 바 ──────────────────────────────────── */}
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[520px] bg-white border-t border-slate-100 flex z-20"
               style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {navItems.map(({ id, label, Icon }) => {
              const isActive = page === id
              return (
                <button
                  key={id}
                  className={cn(
                    'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                    isActive ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'
                  )}
                  onClick={() => setPage(id)}
                >
                  <Icon
                    className={cn(
                      'w-5 h-5 transition-colors',
                      isActive ? 'text-primary-600' : 'text-slate-400'
                    )}
                    strokeWidth={isActive ? 2.5 : 1.75}
                  />
                  <span>{label}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
