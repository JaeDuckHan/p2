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
 *     1. TronLink 미설치: 설치 안내 모달
 *     2. 미연결: "지갑 연결" 버튼
 *     3. 연결됨: T-주소 축약 표시 + 클릭 시 연결 해제
 */
import { useState } from 'react'
import { useWallet } from '../contexts/WalletContext'
import { useNetwork } from '../contexts/NetworkContext'
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

/** 모바일 환경인지 감지 */
function isMobile() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

/** MetaMask 인앱 브라우저인지 감지 */
function isMetaMaskBrowser() {
  return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask
}

/** MetaMask 딥링크 생성 */
function getMetaMaskDeepLink() {
  const dappUrl = window.location.href.replace(/^https?:\/\//, '')
  return `https://metamask.app.link/dapp/${dappUrl}`
}

// ── EVM 지갑 미설치 안내 모달 ──────────────────────────────────────────────
function EvmWalletModal({ onClose }) {
  const mobile = isMobile()

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
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="text-sm font-semibold text-slate-700 mb-3">모바일 설치 방법</div>
                <div className="flex flex-col gap-2">
                  {['앱스토어에서 MetaMask 또는 Trust Wallet 검색 후 설치',
                    '앱 실행 → 지갑 생성',
                    '앱 내 브라우저에서 이 사이트 접속'
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-700">{text}</span>
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
                <div className="text-sm font-semibold text-slate-700 mb-3">데스크톱 설치 방법</div>
                <div className="flex flex-col gap-2">
                  {['아래 버튼으로 Chrome 확장 설치',
                    '지갑에서 계정 생성 또는 복구',
                    '이 페이지 새로고침 후 지갑 연결 클릭'
                  ].map((text, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-700">{text}</span>
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
        <p className="text-xs text-slate-400 text-center mt-3">
          설치 후 이 페이지를 새로고침하면 자동으로 연결 버튼이 활성화됩니다.
        </p>
      </DialogContent>
    </Dialog>
  )
}

// ── Tron 지갑 미설치 안내 모달 ──────────────────────────────────────────────
function TronWalletModal({ onClose }) {
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

        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">TronLink 설치 방법</div>
            <div className="flex flex-col gap-2">
              {(isMobile()
                ? ['앱스토어에서 TronLink 검색 후 설치',
                   'TronLink 앱 실행 → 지갑 생성',
                   '앱 내 브라우저에서 이 사이트 접속']
                : ['Chrome 웹스토어에서 TronLink 확장 설치',
                   'TronLink에서 지갑 생성 또는 복구',
                   '이 페이지 새로고침 후 지갑 연결 클릭']
              ).map((text, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="flex-none w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-700">{text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {!isMobile() && (
          <a
            href="https://www.tronlink.org/"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'success' }), 'w-full')}
          >
            TronLink 설치 페이지 열기
          </a>
        )}

        <p className="text-xs text-slate-400 text-center mt-3">
          설치 후 이 페이지를 새로고침하면 자동으로 연결 버튼이 활성화됩니다.
        </p>
      </DialogContent>
    </Dialog>
  )
}

// ── 메인 WalletButton ───────────────────────────────────────────────────────
export default function WalletButton() {
  const { address, isConnected, isConnecting, connect, disconnect, chain, isTronInstalled } = useWallet()
  const { isEvm, isTron } = useNetwork()
  const [showModal, setShowModal] = useState(false)

  // ── 연결된 상태 ────────────────────────────────────────────────
  if (isConnected) {
    return (
      <div className="flex items-center gap-1.5">
        {isEvm && chain && (
          <Badge variant="default" className="text-[9px] px-1.5 py-0.5">
            {chain.name}
          </Badge>
        )}
        {isTron && (
          <Badge variant="default" className="text-[9px] px-1.5 py-0.5 bg-red-600">
            Tron
          </Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400"
          onClick={() => disconnect()}
          title={address}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {shortAddr(address)}
        </Button>
      </div>
    )
  }

  // ── Tron 미연결 ────────────────────────────────────────────────
  if (isTron) {
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

  // ── EVM 미연결: 모바일 일반 브라우저 ───────────────────────────
  if (isMobile() && !isMetaMaskBrowser()) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowModal(true)}
        >
          지갑에서 열기
        </Button>
        {showModal && <EvmWalletModal onClose={() => setShowModal(false)} />}
      </>
    )
  }

  // ── EVM 미연결: 데스크톱 또는 인앱 브라우저 ────────────────────
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={isConnecting}
        onClick={() => {
          if (window.ethereum) {
            connect()
          } else {
            setShowModal(true)
          }
        }}
      >
        {isConnecting ? '연결 중…' : '지갑 연결'}
      </Button>
      {showModal && <EvmWalletModal onClose={() => setShowModal(false)} />}
    </>
  )
}
