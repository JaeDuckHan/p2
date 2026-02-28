/**
 * NetworkSelector.jsx — 네트워크 선택 UI
 *
 * 헤더에 현재 네트워크를 표시하는 트리거 버튼과,
 * 클릭 시 전체 네트워크 목록을 카드 형태로 보여주는 모달을 제공한다.
 *
 * 기능:
 *   - 현재 네트워크 표시 (아이콘 + 이름)
 *   - 네트워크별 상세 설명 카드 (특징, 가스비, 지갑 타입 등)
 *   - EVM ↔ Tron 전환 시 확인 다이얼로그
 */
import { useState, useCallback } from 'react'
import { ChevronDown, Check, AlertTriangle } from 'lucide-react'
import { useNetwork } from '../contexts/NetworkContext'
import { NETWORKS, NETWORK_KEYS } from '../constants/network'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * 네트워크 아이콘 (텍스트 기반 심볼)
 */
const NETWORK_ICONS = {
  arbitrum: 'A',
  polygon: 'P',
  tron: 'T',
}

const NETWORK_COLORS = {
  arbitrum: 'bg-blue-600',
  polygon: 'bg-purple-600',
  tron: 'bg-red-600',
}

/**
 * NetworkSelector (기본 내보내기)
 *
 * 헤더에 배치되는 네트워크 선택 컴포넌트.
 * 클릭 시 모달 열림 → 네트워크 카드 선택 → 전환.
 */
export default function NetworkSelector() {
  const { networkKey, network, setNetwork } = useNetwork()
  const [open, setOpen] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState(null) // EVM↔Tron 전환 확인용

  const handleSelect = useCallback((key) => {
    const current = NETWORKS[networkKey]
    const target = NETWORKS[key]

    // 같은 네트워크면 무시
    if (key === networkKey) {
      setOpen(false)
      return
    }

    // EVM ↔ Tron 전환 시 확인 다이얼로그
    if (current.chainType !== target.chainType) {
      setConfirmTarget(key)
      return
    }

    // 같은 타입 내 전환은 즉시 적용
    setNetwork(key)
    setOpen(false)
  }, [networkKey, setNetwork])

  const confirmSwitch = useCallback(() => {
    if (confirmTarget) {
      setNetwork(confirmTarget)
      setConfirmTarget(null)
      setOpen(false)
    }
  }, [confirmTarget, setNetwork])

  return (
    <>
      {/* ── 트리거 버튼 ────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <span className={cn(
          'w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-bold',
          NETWORK_COLORS[networkKey] ?? 'bg-slate-600'
        )}>
          {NETWORK_ICONS[networkKey] ?? '?'}
        </span>
        <span className="text-xs font-medium text-slate-700">
          {network.name}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {/* ── 네트워크 선택 모달 ─────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>네트워크 선택</DialogTitle>
            <DialogDescription>
              거래에 사용할 블록체인 네트워크를 선택하세요
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 mt-2">
            {NETWORK_KEYS.map((key) => {
              const net = NETWORKS[key]
              const isActive = key === networkKey
              return (
                <Card
                  key={key}
                  className={cn(
                    'cursor-pointer transition-all duration-150',
                    isActive
                      ? 'ring-2 ring-primary-500 border-primary-300 bg-primary-50/30'
                      : 'hover:border-slate-300 hover:shadow-md'
                  )}
                  onClick={() => handleSelect(key)}
                >
                  <CardContent className="pt-4 pb-3">
                    {/* 헤더: 아이콘 + 이름 + 체크/배지 */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0',
                        NETWORK_COLORS[key] ?? 'bg-slate-600'
                      )}>
                        {NETWORK_ICONS[key] ?? '?'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{net.name}</span>
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                            {net.tokenStandard}
                          </Badge>
                          {isActive && <Check className="w-4 h-4 text-primary-600 shrink-0" />}
                        </div>
                        <div className="text-xs text-slate-500">{net.description}</div>
                      </div>
                    </div>

                    {/* 특징 리스트 */}
                    <div className="flex flex-col gap-1 ml-11">
                      {net.features?.map((feat, i) => (
                        <div key={i} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                          <span className="text-slate-400 mt-0.5 shrink-0">·</span>
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>

                    {/* 가스비 + 지갑 경고 */}
                    <div className="flex items-center gap-2 mt-2 ml-11">
                      {net.gasInfo && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {net.gasInfo}
                        </span>
                      )}
                      {net.walletWarning && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          {net.walletWarning}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── EVM ↔ Tron 전환 확인 다이얼로그 ─────────────────────── */}
      <Dialog open={!!confirmTarget} onOpenChange={(v) => !v && setConfirmTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <DialogTitle className="text-base">네트워크 유형 변경</DialogTitle>
            </div>
            <DialogDescription className="text-sm leading-relaxed">
              {confirmTarget && NETWORKS[confirmTarget]?.chainType === 'tron' ? (
                <>
                  <strong>Tron</strong> 네트워크는 EVM과 다른 지갑(<strong>TronLink</strong>)이 필요합니다.
                  MetaMask/Trust Wallet 등 EVM 지갑은 사용할 수 없습니다.
                </>
              ) : (
                <>
                  <strong>EVM</strong> 네트워크로 전환하면 MetaMask/Trust Wallet 등 EVM 지갑이 필요합니다.
                  TronLink 지갑은 사용할 수 없습니다.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmTarget(null)}
            >
              취소
            </Button>
            <Button
              variant="default"
              className="flex-1"
              onClick={confirmSwitch}
            >
              전환하기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
