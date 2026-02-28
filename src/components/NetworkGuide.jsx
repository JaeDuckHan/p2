/**
 * NetworkGuide.jsx
 *
 * 지원하지 않는 체인(네트워크)에 연결된 상태일 때 표시되는 안내 페이지.
 * 현재 선택된 네트워크로 전환하도록 유도한다.
 *
 * EVM 네트워크:
 *   1. MetaMask API를 통한 자동 네트워크 전환
 *   2. 실패 시 수동 추가 방법 안내 (ChainList / 공식 브릿지)
 * Tron 네트워크:
 *   - TronLink 설치 안내 (EVM 네트워크 전환 불필요)
 */
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { useNetworkSwitch } from '../hooks/useNetworkSwitch'
import { useNetwork } from '../contexts/NetworkContext'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function NetworkGuide() {
  const { chain } = useAccount()
  const { switchNetwork, switching, error } = useNetworkSwitch()
  const { network, isEvm, isTron } = useNetwork()
  const [showManual, setShowManual] = useState(false)

  // Tron 네트워크 선택 시: TronLink 설치 안내
  if (isTron) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-6 max-w-md mx-auto w-full">
        <div className="text-4xl">&#x26A0;&#xFE0F;</div>
        <h2 className="text-xl font-bold text-slate-900 text-center">
          TronLink 지갑 연결이 필요합니다
        </h2>
        <p className="text-sm text-slate-500 text-center">
          Tron 네트워크는 <strong className="text-slate-700">TronLink</strong> 지갑으로 연결합니다.
        </p>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm font-semibold text-slate-800 mb-3">TronLink 설치</div>
            <div className="flex flex-col gap-2">
              {['Chrome 웹스토어에서 TronLink 확장 설치',
                'TronLink에서 지갑 생성',
                '이 페이지 새로고침 후 지갑 연결'
              ].map((text, i) => (
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
      </div>
    )
  }

  // EVM 네트워크: 기존 안내 (동적 네트워크 이름 사용)
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-6 max-w-md mx-auto w-full">
      <div className="text-4xl">&#x26A0;&#xFE0F;</div>
      <h2 className="text-xl font-bold text-slate-900 text-center">
        {network.name} 네트워크 연결이 필요합니다
      </h2>
      <p className="text-sm text-slate-500 text-center">
        MiniSwap은 <strong className="text-slate-700">{network.name}</strong> 네트워크에서 작동합니다.
      </p>

      <div className="w-full flex flex-col gap-2">
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
          <span className="text-xs text-slate-500">현재 네트워크</span>
          <span className="text-xs font-semibold text-red-600">{chain?.name || '알 수 없음'}</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
          <span className="text-xs text-slate-500">필요한 네트워크</span>
          <span className="text-xs font-semibold text-emerald-700">{network.name}</span>
        </div>
      </div>

      <Button
        variant="info"
        size="lg"
        className="w-full"
        onClick={switchNetwork}
        disabled={switching}
      >
        {switching ? '전환 중...' : `${network.name}으로 전환하기`}
      </Button>

      {error && (
        <Alert variant="destructive" className="w-full">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <button
        className="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2 cursor-pointer transition-colors"
        onClick={() => setShowManual(v => !v)}
      >
        {showManual ? '▲' : '▼'} 자동 전환이 안 되나요? (수동 추가 방법)
      </button>

      {showManual && (
        <div className="w-full flex flex-col gap-3">
          {/* ChainList 안내 */}
          {network.chainlistSearch && (
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  방법 1 — ChainList
                  <Badge variant="success">추천</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    <span>
                      <a href="https://chainlist.org" target="_blank" rel="noopener noreferrer"
                         className="text-primary-600 underline underline-offset-2 hover:text-primary-800">
                        chainlist.org
                      </a> 접속
                    </span>,
                    <span>검색창에 <strong>"{network.chainlistSearch}"</strong> 입력</span>,
                    <span><strong>"Add to Wallet"</strong> 클릭 후 승인</span>
                  ].map((content, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-700">{content}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 공식 브릿지 안내 */}
          {network.bridgeUrl && (
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm font-semibold text-slate-800 mb-3">
                  방법 2 — {network.name} 공식 브릿지
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    <span>
                      <a href={network.bridgeUrl} target="_blank" rel="noopener noreferrer"
                         className="text-primary-600 underline underline-offset-2 hover:text-primary-800">
                        {new URL(network.bridgeUrl).hostname}
                      </a> 접속
                    </span>,
                    <span>우측 상단 <strong>"Connect Wallet"</strong> 클릭</span>,
                    <span><strong>"Switch Network"</strong> → <strong>"Add Network"</strong> → 승인</span>
                  ].map((content, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="flex-none w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-700">{content}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 모바일 안내 */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">&#x1F4F1;</div>
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-semibold text-blue-800">아이폰 / 모바일 사용자</div>
                  <div className="text-xs text-blue-700 leading-relaxed">
                    일반 Safari/Chrome에서는 지갑에 직접 연결할 수 없습니다.<br/>
                    <strong>지갑 앱</strong>을 설치한 후, 앱 내 브라우저에서 이 사이트를 열어주세요.
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {['지갑 앱 열기', '메뉴', '브라우저', '이 사이트 주소 입력'].map((step, i, arr) => (
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
