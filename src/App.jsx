/**
 * App.jsx — MiniSwap 메인 앱 컴포넌트
 *
 * 역할:
 *   - 전체 라우팅 흐름 관리 (useAppRouter → view 결정)
 *   - view 기반 레이아웃 제어 (layout 객체 → AppShell props)
 *   - 거래 상태 관리 (activeTrade, createTradeOptions)
 *
 * 위임된 책임:
 *   AppShell       — 헤더, 네트워크 배너, 하단 네비게이션 렌더링
 *   useAppRouter   — view 문자열 결정
 *   useTradeEvents — 이벤트 리스너 (accept-req 중계, 구매자 자동 이동)
 *   useNetworkSwitch — 네트워크 전환 로직
 *
 * 주요 상태:
 *   activeTrade — 현재 진행중인 거래 정보 (tradeId, role)
 *   page        — 현재 탭 (orderbook | my-orders | history)
 */
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Home, ClipboardList, ScrollText, ArrowLeft } from 'lucide-react'
import AppShell       from './components/AppShell'
import HeroSection    from './components/HeroSection'
import NetworkGuide   from './components/NetworkGuide'
import OnboardBanner  from './components/OnboardBanner'
import TradeRoom      from './components/TradeRoom'
import OrderbookView  from './components/OrderbookView'
import TradeHistory   from './components/TradeHistory'
import CreateTrade    from './components/CreateTrade'
import { useOrderbook } from './hooks/useOrderbook'
import { useNetworkSwitch } from './hooks/useNetworkSwitch'
import { useAppRouter } from './hooks/useAppRouter'
import { useTradeEvents } from './hooks/useTradeEvents'
import { SUPPORTED_CHAINS } from './constants/network'
import { Button } from '@/components/ui/button'

/** MiniSwap 루트 컴포넌트 */
export default function App() {
  const { isConnected, chain, chainId, address, status } = useAccount()

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
  const { switchNetwork, switching: networkSwitching } = useNetworkSwitch()

  /** 지갑은 연결됐으나 지원하지 않는 네트워크에 있는 경우 true */
  const wrongNetwork = isConnected && chainId && !SUPPORTED_CHAINS.includes(chainId)

  /** 현재 표시할 화면 */
  const view = useAppRouter({ status, isConnected, wrongNetwork, activeTrade, createTradeOptions })

  /** 거래 이벤트 리스너 (accept-req 중계 + 구매자 자동 거래방 이동) */
  useTradeEvents({ orderbook, address, activeTrade, setActiveTrade })

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

  /** view 값에 따른 메인 콘텐츠 렌더링 */
  function renderContent() {
    switch (view) {
      case 'loading':
        return (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin w-10 h-10 border-3 border-primary-600 border-t-transparent rounded-full" />
          </div>
        )
      case 'hero':
        return <HeroSection />
      case 'network':
        return <NetworkGuide />
      case 'trade-room':
        return (
          <div className="px-4 py-4 animate-fade-in">
            <TradeRoom
              tradeId={activeTrade.tradeId}
              initialRole={activeTrade.role}
              onExit={handleExit}
              onGoToHistory={() => { setActiveTrade(null); setPage('history') }}
            />
          </div>
        )
      case 'create-trade':
        return (
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
        )
      default: // 'home'
        return (
          <>
            <OnboardBanner />
            <div className="px-5 pb-28 animate-fade-in">
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
          </>
        )
    }
  }

  /**
   * view 기반 레이아웃 제어 객체
   * 각 view에서 헤더/하단 네비게이션 표시 여부를 결정한다.
   */
  const layout = {
    loading:      { showHeader: true,  showBottomNav: false },
    hero:         { showHeader: true,  showBottomNav: false },
    network:      { showHeader: true,  showBottomNav: false },
    'trade-room': { showHeader: true,  showBottomNav: false },
    'create-trade': { showHeader: true, showBottomNav: false },
    home:         { showHeader: true,  showBottomNav: true  },
  }[view] || { showHeader: true, showBottomNav: false }

  return (
    <AppShell
      showHeader={layout.showHeader}
      showBottomNav={layout.showBottomNav}
      page={page}
      onPageChange={setPage}
      onLogoClick={() => { setActiveTrade(null); setPage('orderbook') }}
      navItems={navItems}
      showNetworkWarning={isConnected && wrongNetwork}
      onSwitchNetwork={switchNetwork}
      networkSwitching={networkSwitching}
    >
      {renderContent()}
    </AppShell>
  )
}
