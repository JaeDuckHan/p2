/**
 * HeroSection.jsx
 *
 * 지갑 미연결 상태에서 표시되는 랜딩 페이지.
 * MiniSwap 소개, 특징 카드 3개, 지갑 연결 CTA, 이용 방법 단계를 렌더링한다.
 * 현재 선택된 네트워크에 맞는 동적 레이블을 표시한다.
 */
import { Shield, Zap, Coins } from 'lucide-react'
import WalletButton from './WalletButton'
import { Card } from '@/components/ui/card'
import { useNetwork } from '../contexts/NetworkContext'

export default function HeroSection() {
  const { network } = useNetwork()

  return (
    <div className="flex flex-col items-center px-6 py-12 animate-fade-in">

      {/* 타이틀 */}
      <h1 className="text-4xl font-extrabold tracking-tight mb-2">
        <span className="text-gray-900">Mini</span>
        <span className="bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">Swap</span>
      </h1>
      <p className="text-lg font-medium text-gray-700 tracking-tight mb-1">
        P2P USDT ↔ KRW 직거래 플랫폼
      </p>
      <p className="text-base font-medium text-gray-800 text-center mb-7 leading-relaxed">
        서버 없는 탈중앙 에스크로 거래<br/>
        스마트 컨트랙트가 당신의 자산을 보호합니다
      </p>

      {/* 특징 카드 3개 */}
      <div className="grid grid-cols-3 gap-3 w-full mb-10">
        <Card className="p-4 flex flex-col items-center text-center gap-2 hover:shadow-xl transition-shadow duration-200">
          <Shield className="w-6 h-6 text-indigo-600" />
          <div className="text-sm font-semibold text-gray-900">에스크로 보호</div>
          <div className="text-xs text-gray-700 leading-snug">
            USDT가 컨트랙트에 잠기고 양쪽 확인 후 전송됩니다
          </div>
        </Card>
        <Card className="p-4 flex flex-col items-center text-center gap-2 hover:shadow-xl transition-shadow duration-200">
          <Zap className="w-6 h-6 text-amber-600" />
          <div className="text-sm font-semibold text-gray-900">{network.layerLabel}</div>
          <div className="text-xs text-gray-700 leading-snug">
            {network.layerDescription}
          </div>
        </Card>
        <Card className="p-4 flex flex-col items-center text-center gap-2 hover:shadow-xl transition-shadow duration-200">
          <Coins className="w-6 h-6 text-emerald-600" />
          <div className="text-sm font-semibold text-gray-900">수수료 2%</div>
          <div className="text-xs text-gray-700 leading-snug">
            숨겨진 비용 없이 투명한 수수료, 자동 계산
          </div>
        </Card>
      </div>

      {/* 지갑 연결 CTA */}
      <div className="flex flex-col items-center gap-4 mb-12 w-full">
        <WalletButton />
        <p className="text-sm text-gray-600">
          {network.chainType === 'tron'
            ? 'TronLink 지갑이 필요합니다'
            : 'MetaMask 또는 호환 지갑이 필요합니다'}
        </p>
      </div>

      {/* 이용 방법 단계 안내 */}
      <div className="w-full">
        <div className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-5 text-center">
          이용 방법
        </div>
        <div className="flex items-start justify-center gap-1">
          {[
            { num: '1', title: '지갑 연결', desc: '지갑으로 로그인' },
            { num: '2', title: 'USDT 예치', desc: '에스크로에 안전 보관' },
            { num: '3', title: 'KRW 송금', desc: 'P2P 채팅으로 확인' },
            { num: '4', title: 'USDT 수령', desc: '자동 전송 완료' },
          ].map((step, i, arr) => (
            <div key={step.num} className="flex items-start">
              <div className="flex flex-col items-center gap-1.5 w-18">
                <div className="w-11 h-11 rounded-full bg-primary-800 text-white text-base font-extrabold flex items-center justify-center shrink-0 shadow-md">
                  {step.num}
                </div>
                <div className="text-center">
                  <div className="text-xs font-semibold text-gray-800">{step.title}</div>
                  <div className="text-xs text-gray-600 leading-tight">{step.desc}</div>
                </div>
              </div>
              {i < arr.length - 1 && (
                <div className="text-gray-400 text-base mt-2 mx-0.5">→</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
