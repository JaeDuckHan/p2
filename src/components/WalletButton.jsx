/**
 * WalletButton.jsx
 *
 * 지갑 연결/해제 버튼 컴포넌트.
 * wagmi의 useConnect / useDisconnect 훅을 활용하여 MetaMask 지갑과 연결한다.
 *
 * 동작 시나리오:
 *   1. 미연결 + 데스크톱: "지갑 연결" 버튼 → injected connector(MetaMask) 연결
 *   2. 미연결 + 모바일(일반 브라우저): MetaMask 딥링크 또는 설치 안내 모달 표시
 *   3. 연결됨: 주소 축약 표시 + 클릭 시 즉시 연결 해제
 *
 * 의존 컴포넌트: MetaMaskModal (파일 내 정의)
 */
import { useState } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'

/**
 * 이더리움 주소를 앞 6자리 + 뒤 4자리 형태로 축약한다.
 * 예: "0x1234567890abcdef" → "0x1234…cdef"
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

/**
 * MetaMask 딥링크 생성
 * MetaMask 앱의 인앱 브라우저에서 현재 dApp을 열어줌
 */
function getMetaMaskDeepLink() {
  const dappUrl = window.location.href.replace(/^https?:\/\//, '')
  return `https://metamask.app.link/dapp/${dappUrl}`
}

/**
 * MetaMaskModal
 *
 * MetaMask가 설치되지 않은 경우 사용자에게 설치 방법을 안내하는 모달.
 * 모바일과 데스크톱 환경을 구분하여 각각 다른 안내 흐름을 제공한다.
 *
 * @param {function} onClose - 모달 닫기 콜백
 */
function MetaMaskModal({ onClose }) {
  // 모바일 여부에 따라 안내 내용을 분기
  const mobile = isMobile()

  return (
    <Dialog open onClose={onClose}>
      <DialogContent className="relative">
        <DialogClose onClick={onClose} />

        <DialogHeader>
          <div className="text-4xl mb-2">🦊</div>
          <DialogTitle>MetaMask 지갑이 필요합니다</DialogTitle>
          <DialogDescription>
            MiniSwap은 MetaMask 지갑을 통해 블록체인에 연결합니다.<br />
            아래 안내를 따라 설치해 주세요.
          </DialogDescription>
        </DialogHeader>

        {mobile ? (
          /* 모바일: 앱 설치 → 앱 내 브라우저에서 접속하도록 안내 */
          <>
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="text-sm font-semibold text-slate-700 mb-3">모바일 설치 방법</div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                      1
                    </span>
                    <span className="text-sm text-slate-700">앱스토어에서 <strong>MetaMask</strong> 검색 후 설치</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                      2
                    </span>
                    <span className="text-sm text-slate-700">MetaMask 앱 실행 → 지갑 생성</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                      3
                    </span>
                    <span className="text-sm text-slate-700">앱 내 <strong>브라우저</strong>에서 이 사이트 접속</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* MetaMask 앱으로 딥링크 이동 버튼 */}
            <a
              href={getMetaMaskDeepLink()}
              className={cn(buttonVariants({ variant: 'success' }), 'w-full')}
            >
              MetaMask 앱에서 열기
            </a>
          </>
        ) : (
          /* 데스크톱: Chrome 확장 설치 안내 */
          <>
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="text-sm font-semibold text-slate-700 mb-3">데스크톱 설치 방법</div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                      1
                    </span>
                    <span className="text-sm text-slate-700">아래 버튼으로 Chrome 확장 설치</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                      2
                    </span>
                    <span className="text-sm text-slate-700">MetaMask에서 지갑 생성 또는 복구</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                      3
                    </span>
                    <span className="text-sm text-slate-700">이 페이지 새로고침 후 <strong>지갑 연결</strong> 클릭</span>
                  </div>
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

/**
 * WalletButton (기본 내보내기)
 *
 * 헤더에 표시되는 지갑 연결/해제 버튼.
 * 연결 상태에 따라 세 가지 UI를 렌더링한다.
 *
 *   - 연결됨: 체인 배지 + 축약 주소 버튼 (클릭 → disconnect)
 *   - 미연결 모바일: MetaMask 앱으로 유도하는 버튼 + 안내 모달
 *   - 미연결 데스크톱: "지갑 연결" 버튼 (MetaMask 미설치 시 모달 표시)
 */
export default function WalletButton() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  // MetaMask 미설치 안내 모달 표시 여부
  const [showModal, setShowModal] = useState(false)

  /* 지갑이 연결된 경우: 체인 이름 배지 + 주소 축약 버튼 */
  if (isConnected) {
    return (
      <div className="flex items-center gap-1.5">
        {/* 현재 연결된 체인 이름 배지 */}
        {chain && (
          <Badge variant="default" className="text-[9px] px-1.5 py-0.5">
            {chain.name}
          </Badge>
        )}
        {/* 주소 표시 버튼: 클릭 시 즉시 연결 해제 */}
        <Button
          variant="outline"
          size="sm"
          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400"
          onClick={() => disconnect()}
          title={address}
        >
          {/* 연결 상태 표시 도트 (녹색 펄스 애니메이션) */}
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {shortAddr(address)}
        </Button>
      </div>
    )
  }

  // 모바일인데 MetaMask 인앱 브라우저가 아닌 경우 (Safari, Chrome 등)
  // → MetaMask 앱으로 딥링크
  if (isMobile() && !isMetaMaskBrowser()) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowModal(true)}
        >
          🦊 MetaMask에서 열기
        </Button>
        {showModal && <MetaMaskModal onClose={() => setShowModal(false)} />}
      </>
    )
  }

  // 데스크톱 또는 MetaMask 인앱 브라우저 → injected connector 사용
  const injector = connectors.find(c => c.id === 'injected')

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => {
          if (injector && window.ethereum) {
            // MetaMask가 설치된 경우 injected connector로 연결 시도
            connect({ connector: injector })
          } else {
            // MetaMask 미설치 → 모달 표시
            setShowModal(true)
          }
        }}
      >
        {isPending ? '연결 중…' : '🦊 지갑 연결'}
      </Button>
      {showModal && <MetaMaskModal onClose={() => setShowModal(false)} />}
    </>
  )
}
