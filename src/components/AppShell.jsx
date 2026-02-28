/**
 * AppShell.jsx — 앱 레이아웃 셸 컴포넌트
 *
 * 역할:
 *   - 헤더(로고 + 지갑 버튼) 렌더링
 *   - 네트워크 경고 배너 조건부 렌더링
 *   - 하단 네비게이션 조건부 렌더링
 *   - showHeader / showBottomNav props로 레이아웃 제어
 */
import { AlertTriangle } from 'lucide-react'
import WalletButton from './WalletButton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CHAIN_NAME } from '../constants/network'

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
  return (
    <div className="max-w-[520px] mx-auto min-h-screen bg-white relative shadow-xl">

      {/* ── 헤더 ─────────────────────────────────────────────────────── */}
      {showHeader && (
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
          <button
            className="flex items-center gap-3 cursor-pointer"
            onClick={onLogoClick}
          >
            <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-base select-none">
              M
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="text-base font-bold text-slate-900">
                Mini<span className="text-primary-600">Swap</span>
              </span>
              <span className="text-xs text-gray-700 font-normal mt-0.5">P2P USDT ↔ KRW</span>
            </div>
          </button>
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
              <div className="text-sm font-semibold text-amber-800">{CHAIN_NAME} 네트워크 전환 필요</div>
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
                  'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  isActive ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'
                )}
                onClick={() => onPageChange(id)}
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
      )}
    </div>
  )
}
