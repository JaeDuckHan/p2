/**
 * AppShell.jsx — 앱 레이아웃 셸 컴포넌트
 *
 * 역할:
 *   - 헤더(로고 + 네트워크 선택 + 지갑 버튼) 렌더링
 *   - 네트워크 경고 배너 조건부 렌더링
 *   - 하단 네비게이션 조건부 렌더링
 *   - showHeader / showBottomNav props로 레이아웃 제어
 */
import { AlertTriangle } from 'lucide-react'
import WalletButton from './WalletButton'
import NetworkSelector from './NetworkSelector'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useNetwork } from '../contexts/NetworkContext'

export default function AppShell({
  children,
  showHeader = true,
  showBottomNav = false,
  page,
  onPageChange,
  onLogoClick,
  navItems = [],
  showNetworkWarning = false,
  onSwitchNetwork,
  networkSwitching = false,
}) {
  const { network } = useNetwork()

  return (
    <div className="max-w-[520px] mx-auto min-h-screen bg-white relative shadow-xl">

      {/* ── 헤더 ─────────────────────────────────────────────────────── */}
      {showHeader && (
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-3 py-2.5 flex items-center justify-between gap-2 overflow-hidden">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              className="flex items-center gap-2 cursor-pointer shrink-0"
              onClick={onLogoClick}
            >
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-sm select-none shrink-0">
                M
              </div>
              <div className="hidden sm:flex flex-col items-start leading-none">
                <span className="text-sm font-bold text-slate-900">
                  Mini<span className="text-primary-600">Swap</span>
                </span>
              </div>
            </button>
            <NetworkSelector />
          </div>
          <WalletButton />
        </div>
      )}

      {/* ── 네트워크 경고 배너 ─────────────────────────────────────── */}
      {showNetworkWarning && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 cursor-pointer"
          onClick={onSwitchNetwork}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-amber-800">{network.name} 네트워크 전환 필요</div>
              <div className="text-xs text-amber-600">USDT 거래를 위해 네트워크를 변경하세요</div>
            </div>
          </div>
          <Button
            size="sm"
            variant="warning"
            disabled={networkSwitching}
            className="shrink-0"
            onClick={e => { e.stopPropagation(); onSwitchNetwork() }}
          >
            {networkSwitching ? '전환 중...' : '전환하기 →'}
          </Button>
        </div>
      )}

      {/* ── 메인 콘텐츠 ───────────────────────────────────────────── */}
      {children}

      {/* ── 하단 네비게이션 바 ──────────────────────────────────── */}
      {showBottomNav && (
        <div
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[520px] bg-white border-t border-slate-100 flex z-20"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {navItems.map(({ id, label, Icon }) => {
            const isActive = page === id
            return (
              <button
                key={id}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors',
                  isActive ? 'text-primary-600' : 'text-slate-600 hover:text-slate-600'
                )}
                onClick={() => onPageChange(id)}
              >
                <Icon
                  className={cn(
                    'w-5 h-5 transition-colors',
                    isActive ? 'text-primary-600' : 'text-slate-600'
                  )}
                  strokeWidth={isActive ? 2.5 : 1.75}
                />
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
