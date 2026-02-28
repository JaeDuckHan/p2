/**
 * NetworkGuide.jsx
 *
 * 지원하지 않는 체인(네트워크)에 연결된 상태일 때 표시되는 안내 페이지.
 * 사용자를 Arbitrum One 네트워크로 전환하도록 유도한다.
 *
 * 주요 기능:
 *   1. MetaMask API를 통한 자동 네트워크 전환 (wallet_switchEthereumChain)
 *   2. Arbitrum이 지갑에 등록되지 않은 경우 자동 추가 (wallet_addEthereumChain)
 *   3. 자동 전환 실패 시 수동 추가 방법 안내 (ChainList / Arbitrum 브릿지)
 *
 * 표시 조건: 상위 컴포넌트에서 지원하지 않는 chainId가 감지될 때 렌더링
 */
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useNetworkSwitch } from '../hooks/useNetworkSwitch'
import { CHAIN_NAME, CHAINLIST_SEARCH, BRIDGE_URL, BRIDGE_DOMAIN } from '../constants/network'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

/**
 * NetworkGuide (기본 내보내기)
 *
 * 현재 연결된 네트워크 정보를 보여주고, Arbitrum One으로의 전환을 안내한다.
 * 자동 전환 버튼과 수동 추가 방법(토글 표시)을 함께 제공한다.
 */
export default function NetworkGuide() {
  const { chain } = useAccount()
  const { switchNetwork, switching, error } = useNetworkSwitch()
  // 수동 추가 방법 안내 섹션 토글 여부
  const [showManual, setShowManual] = useState(false)

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-6 max-w-md mx-auto w-full">
      <div className="text-4xl">&#x26A0;&#xFE0F;</div>
      <h2 className="text-xl font-bold text-slate-900 text-center">
        {CHAIN_NAME} 네트워크 연결이 필요합니다
      </h2>
      <p className="text-sm text-slate-500 text-center">
        MiniSwap은 <strong className="text-slate-700">{CHAIN_NAME}</strong> 네트워크에서 작동합니다.
      </p>

      {/* 현재 네트워크 vs 필요한 네트워크 비교 표시 */}
      <div className="w-full flex flex-col gap-2">
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
          <span className="text-xs text-slate-500">현재 네트워크</span>
          {/* 잘못된 네트워크이므로 빨간색으로 강조 */}
          <span className="text-xs font-semibold text-red-600">{chain?.name || '알 수 없음'}</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
          <span className="text-xs text-slate-500">필요한 네트워크</span>
          <span className="text-xs font-semibold text-emerald-700">{CHAIN_NAME}</span>
        </div>
      </div>

      {/* 자동 전환 버튼: 클릭 시 MetaMask 팝업으로 전환 요청 */}
      <Button
        variant="info"
        size="lg"
        className="w-full"
        onClick={switchNetwork}
        disabled={switching}
      >
        {switching ? '전환 중...' : `${CHAIN_NAME}으로 전환하기`}
      </Button>

      {/* 전환 오류 발생 시 사용자에게 메시지 표시 */}
      {error && (
        <Alert variant="destructive" className="w-full">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 수동 추가 방법 토글 버튼 */}
      <button
        className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2 cursor-pointer transition-colors"
        onClick={() => setShowManual(v => !v)}
      >
        {showManual ? '▲' : '▼'} 자동 전환이 안 되나요? (수동 추가 방법)
      </button>

      {/* 수동 추가 안내 섹션: showManual이 true일 때만 렌더링 */}
      {showManual && (
        <div className="w-full flex flex-col gap-3">
          {/* 방법 1: ChainList를 통한 원클릭 추가 */}
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                방법 1 — ChainList
                <Badge variant="success">추천</Badge>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2.5">
                  <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    1
                  </span>
                  <span className="text-sm text-slate-700">
                    <a
                      href="https://chainlist.org"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 underline underline-offset-2 hover:text-primary-800"
                    >
                      chainlist.org
                    </a>
                    {' '}접속
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    2
                  </span>
                  <span className="text-sm text-slate-700">검색창에 <strong>"{CHAINLIST_SEARCH}"</strong> 입력</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    3
                  </span>
                  <span className="text-sm text-slate-700"><strong>"Add to MetaMask"</strong> 클릭 후 승인</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 방법 2: Arbitrum 공식 브릿지를 통한 네트워크 추가 */}
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm font-semibold text-slate-800 mb-3">
                방법 2 — {CHAIN_NAME} 공식 브릿지
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2.5">
                  <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    1
                  </span>
                  <span className="text-sm text-slate-700">
                    <a
                      href={BRIDGE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 underline underline-offset-2 hover:text-primary-800"
                    >
                      {BRIDGE_DOMAIN}
                    </a>
                    {' '}접속
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    2
                  </span>
                  <span className="text-sm text-slate-700">우측 상단 <strong>"Connect Wallet"</strong> 클릭</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                    3
                  </span>
                  <span className="text-sm text-slate-700"><strong>"Switch Network"</strong> → <strong>"Add Network"</strong> → 승인</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 모바일 사용자 특이사항 안내 */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">&#x1F4F1;</div>
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-semibold text-blue-800">아이폰 / 모바일 사용자</div>
                  <div className="text-xs text-blue-700 leading-relaxed">
                    일반 Safari/Chrome에서는 MetaMask에 직접 연결할 수 없습니다.<br/>
                    <strong>MetaMask 앱</strong>을 설치한 후, 앱 내 브라우저에서 이 사이트를 열어주세요.
                  </div>
                  {/* 모바일에서의 접속 순서 시각화 */}
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {['MetaMask 앱 열기', '좌측 상단 메뉴', '브라우저', '이 사이트 주소 입력'].map((step, i, arr) => (
                      <span key={step} className="flex items-center gap-1">
                        <span className="text-xs text-blue-800">{step}</span>
                        {i < arr.length - 1 && (
                          <span className="text-blue-400 text-xs">→</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
