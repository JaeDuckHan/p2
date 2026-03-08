/**
 * WalletButton.jsx
 *
 * 통합 지갑 연결/해제 버튼 컴포넌트.
 * WalletContext를 통해 EVM(MetaMask 등) / Tron(TronLink) 지갑을 분기 처리한다.
 *
 * 동작 시나리오:
 *   EVM 네트워크:
 *     1. 미연결 + 데스크톱: "지갑 연결" 버튼 → injected connector 연결
 *     2. 미연결 + 모바일(일반 브라우저): MetaMask 딥링크 또는 설치 안내 모달
 *     3. 연결됨: 주소 축약 표시 + 클릭 시 연결 해제
 *   Tron 네트워크:
 *     1. TronLink 미감지(일반 브라우저): 딥링크 + 설치 안내 모달
 *     2. 미연결: "지갑 연결" 버튼
 *     3. 연결됨: T-주소 축약 표시 + 클릭 시 연결 해제
 */
import { useState, useEffect } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { useNetwork } from '../contexts/NetworkContext'
import { useToast } from '../contexts/ToastContext'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'

/**
 * 주소를 앞 6자리 + 뒤 4자리 형태로 축약한다.
 */
function shortAddr(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** 모바일 환경인지 감지 — 인앱 브라우저가 데스크톱 UA를 쓰는 경우도 커버 */
function isMobile() {
  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) return true
  // 일부 인앱 브라우저(Viber 등)가 데스크톱 UA를 사용하므로 터치+화면 크기로 보완
  return navigator.maxTouchPoints > 0 && window.innerWidth < 768
}

/** MetaMask 인앱 브라우저인지 감지 */
function isMetaMaskBrowser() {
  return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask
}

/** 인앱 브라우저(Viber, LINE, KakaoTalk 등) 감지 */
function isInAppBrowser() {
  const ua = navigator.userAgent || ''
  return /FBAN|FBAV|Instagram|Line\/|KAKAOTALK|Viber|Snapchat|Twitter/i.test(ua)
}

/** MetaMask 딥링크 생성 */
function getMetaMaskDeepLink() {
  const dappUrl = window.location.href.replace(/^https?:\/\//, '')
  return `https://metamask.app.link/dapp/${dappUrl}`
}

/** TronLink 딥링크 생성 — TronLink 앱에서 현재 dApp을 열기 */
function getTronLinkDeepLink() {
  const dappUrl = window.location.href
  const param = JSON.stringify({
    url: dappUrl,
    action: 'open',
    protocol: 'tronlink',
    version: '1.0',
  })
  return `tronlinkoutside://pull.activity?param=${encodeURIComponent(param)}`
}

// ── EVM 지갑 미설치 안내 모달 ──────────────────────────────────────────────
function EvmWalletModal({ onClose }) {
  const mobile = isMobile()
  const inApp = isInAppBrowser()

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="relative">
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>EVM 지갑이 필요합니다</DialogTitle>
          <DialogDescription>
            MiniSwap은 MetaMask, Trust Wallet 등 EVM 호환 지갑을 통해 블록체인에 연결합니다.
          </DialogDescription>
        </DialogHeader>

        {mobile ? (
          <>
            {inApp && (
              <Card className="mb-4 border-amber-200 bg-amber-50">
                <CardContent className="pt-4">
                  <div className="text-sm font-semibold text-amber-800 mb-2">
                    앱 내 브라우저에서는 지갑 연결이 제한됩니다
                  </div>
                  <div className="text-sm text-amber-700">
                    Safari 또는 Chrome에서 이 링크를 열어주세요.
                    아래 <strong>주소 복사</strong> 버튼을 눌러 브라우저에 붙여넣기 하세요.
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full border-amber-300 text-amber-800"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href)
                        .then(() => onClose())
                        .catch(() => {})
                    }}
                  >
                    주소 복사하기
                  </Button>
                </CardContent>
              </Card>
            )}
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="text-sm font-semibold text-slate-800 mb-3">모바일 설치 방법</div>
                <div className="flex flex-col gap-2">
                  {['앱스토어에서 MetaMask 또는 Trust Wallet 검색 후 설치',
                    '앱 실행 → 지갑 생성',
                    '앱 내 브라우저에서 이 사이트 접속'
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-800">{text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <a
              href={getMetaMaskDeepLink()}
              className={cn(buttonVariants({ variant: 'success' }), 'w-full')}
            >
              MetaMask 앱에서 열기
            </a>
          </>
        ) : (
          <>
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="text-sm font-semibold text-slate-800 mb-3">데스크톱 설치 방법</div>
                <div className="flex flex-col gap-2">
                  {['아래 버튼으로 Chrome 확장 설치',
                    '지갑에서 계정 생성 또는 복구',
                    '이 페이지 새로고침 후 지갑 연결 클릭'
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-800">{text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'success' }), 'w-full')}
            >
              MetaMask 설치 페이지 열기
            </a>
          </>
        )}
        <p className="text-xs text-slate-700 text-center mt-3">
          설치 후 이 페이지를 새로고침하면 자동으로 연결 버튼이 활성화됩니다.
        </p>
      </DialogContent>
    </Dialog>
  )
}

// ── Tron 지갑 안내 모달 (모바일: 딥링크+설치 / 데스크톱: 확장 설치) ──────
function TronWalletModal({ onClose }) {
  const mobile = isMobile()

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="relative">
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>TronLink 지갑이 필요합니다</DialogTitle>
          <DialogDescription>
            Tron 네트워크는 TronLink 지갑을 통해 연결합니다.
            MetaMask 등 EVM 지갑은 사용할 수 없습니다.
          </DialogDescription>
        </DialogHeader>

        {mobile ? (
          <>
            {/* 경로 A: TronLink이 이미 설치되어 있다면 */}
            <Card className="mb-3">
              <CardContent className="pt-4">
                <div className="text-sm font-semibold text-slate-800 mb-3">
                  TronLink이 이미 설치되어 있다면
                </div>
                <div className="flex flex-col gap-2">
                  {['아래 버튼을 눌러 TronLink 앱을 여세요',
                    'TronLink 앱 내 브라우저에서 이 사이트가 자동으로 열립니다',
                    'TronLink에서 "연결" 버튼을 눌러 지갑을 연결하세요'
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="flex-none w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-800">{text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <a
              href={getTronLinkDeepLink()}
              className={cn(buttonVariants({ variant: 'success' }), 'w-full mb-4')}
            >
              TronLink 앱에서 열기
            </a>

            {/* 경로 B: TronLink이 없다면 */}
            <Card className="mb-3">
              <CardContent className="pt-4">
                <div className="text-sm font-semibold text-slate-800 mb-3">
                  TronLink이 없다면
                </div>
                <div className="flex flex-col gap-2">
                  {['앱스토어에서 TronLink 검색 후 설치',
                    'TronLink 앱 실행 → 새 지갑 만들기',
                    '지갑 생성 후 위의 "TronLink 앱에서 열기" 버튼 클릭'
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="flex-none w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-800">{text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-slate-700 text-center mt-3">
              TronLink은 별도의 지갑 앱입니다. 반드시 TronLink 앱 내 브라우저에서
              이 사이트에 접속해야 지갑 연결이 가능합니다.
            </p>
          </>
        ) : (
          <>
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="text-sm font-semibold text-slate-800 mb-3">TronLink 설치 방법</div>
                <div className="flex flex-col gap-2">
                  {['Chrome 웹스토어에서 TronLink 확장 설치',
                    'TronLink에서 지갑 생성 또는 복구',
                    '이 페이지 새로고침 후 지갑 연결 클릭'
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="flex-none w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-800">{text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <a
              href="https://www.tronlink.org/"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'success' }), 'w-full')}
            >
              TronLink 설치 페이지 열기
            </a>
            <p className="text-xs text-slate-700 text-center mt-3">
              설치 후 이 페이지를 새로고침하면 자동으로 연결 버튼이 활성화됩니다.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── 메인 WalletButton ───────────────────────────────────────────────────────
export default function WalletButton() {
  const { address, isConnected, isConnecting, connect, disconnect, chain, isTronInstalled, connectError, resetError, hasWalletConnect } = useWallet()
  const { isEvm, isTron } = useNetwork()
  const { toast } = useToast()
  const [showModal, setShowModal] = useState(false)

  // 연결 에러 발생 시 — 에러 유형별 분기 처리
  useEffect(() => {
    if (!connectError) return
    const msg = connectError.message || ''
    const name = connectError.name || ''

    // 사용자가 직접 취소한 경우 → 무시
    if (name === 'UserRejectedRequestError' || msg.includes('User rejected')) return

    // 이미 연결 요청이 대기 중 → 안내 토스트 (에러가 아닌 정보 메시지)
    if (msg.includes('already pending')) {
      toast('지갑 앱에서 이미 연결 요청이 대기 중입니다. 지갑 앱을 확인해주세요.', 'info')
      return
    }

    // 지갑(provider)을 찾을 수 없음 → 설치 모달
    const msgLower = msg.toLowerCase()
    if (name === 'ConnectorNotFoundError' || msgLower.includes('provider not found') || msgLower.includes('connector not found')) {
      setShowModal(true)
      return
    }

    // 모바일에서 WalletConnect 실패 → 설치/딥링크 모달 표시
    if (isMobile() && !isMetaMaskBrowser() && isEvm) {
      setShowModal(true)
      return
    }

    // 기타 에러 → 토스트 (에러 상세 포함)
    const detail = msg.length > 80 ? msg.slice(0, 80) + '…' : msg
    toast(`지갑 연결에 실패했습니다. ${detail || '페이지를 새로고침 후 다시 시도해 주세요.'}`, 'error')
  }, [connectError, toast, isEvm])

  // ── 연결된 상태 ────────────────────────────────────────────────
  if (isConnected) {
    return (
      <div className="flex items-center gap-1 min-w-0 max-w-[160px]">
        {isTron && (
          <Badge variant="default" className="text-xs px-1.5 py-0.5 bg-red-600 shrink-0">
            Tron
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 min-w-0 truncate"
          onClick={() => disconnect()}
          title={address}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="truncate">{shortAddr(address)}</span>
        </Button>
      </div>
    )
  }

  // ── Tron 미연결 ────────────────────────────────────────────────
  if (isTron) {
    // 모바일 일반 브라우저: TronLink 딥링크 바로 실행
    if (isMobile() && !isTronInstalled) {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => { window.location.href = getTronLinkDeepLink() }}
        >
          지갑 연결
        </Button>
      )
    }
    // TronLink 인앱 브라우저 또는 데스크톱
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          disabled={isConnecting}
          onClick={() => {
            if (isTronInstalled) {
              connect()
            } else {
              setShowModal(true)
            }
          }}
        >
          {isConnecting ? '연결 중…' : '지갑 연결'}
        </Button>
        {showModal && <TronWalletModal onClose={() => setShowModal(false)} />}
      </>
    )
  }

  // ── EVM 미연결: 모바일 일반 브라우저 + (WalletConnect 미설정 또는 인앱 브라우저) → MetaMask 딥링크 폴백
  if (isMobile() && !isMetaMaskBrowser() && (!hasWalletConnect || isInAppBrowser())) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (isInAppBrowser()) {
              // 인앱 브라우저: WC 대신 모달로 안내
              setShowModal(true)
            } else {
              window.location.href = getMetaMaskDeepLink()
            }
          }}
        >
          지갑 연결
        </Button>
        {showModal && <EvmWalletModal onClose={() => setShowModal(false)} />}
      </>
    )
  }

  // ── EVM 미연결: 데스크톱 / 인앱 브라우저 / 모바일+WalletConnect ─
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={isConnecting}
        onClick={() => {
          resetError()
          connect()
        }}
      >
        {isConnecting ? '연결 중…' : '지갑 연결'}
      </Button>
      {showModal && <EvmWalletModal onClose={() => setShowModal(false)} />}
    </>
  )
}
