/**
 * ErrorBoundary — 전역 에러 경계 컴포넌트
 *
 * React 렌더링 중 발생한 미처리 에러를 캐치하여
 * 앱 전체가 죽는 것을 방지하고, 사용자에게 한국어 복구 UI를 표시한다.
 *
 * 가상화폐 앱 특성상 "지갑과 자산은 안전합니다" 안내를 포함하여
 * 사용자 불안을 해소한다.
 */
import { Component } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const isWalletError = this.state.error?.message?.toLowerCase().includes('wallet')
        || this.state.error?.message?.toLowerCase().includes('provider')
        || this.state.error?.message?.toLowerCase().includes('connector')
        || this.state.error?.message?.toLowerCase().includes('transactions')

      return (
        <div className="max-w-[520px] mx-auto min-h-screen bg-white flex items-center justify-center p-6">
          <div className="text-center w-full">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 mb-2">
              일시적인 문제가 발생했습니다
            </h2>

            <p className="text-sm text-slate-700 mb-4 leading-relaxed">
              걱정하지 마세요. 지갑과 자산은 안전합니다.<br />
              블록체인에 기록된 거래는 영향을 받지 않습니다.
            </p>

            {isWalletError && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-left">
                <p className="text-sm font-semibold text-blue-900 mb-2">
                  지갑 관련 오류일 수 있습니다
                </p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>1. 지갑 앱(MetaMask, TronLink)을 최신 버전으로 업데이트하세요</li>
                  <li>2. 지갑 앱을 완전히 종료 후 다시 실행하세요</li>
                  <li>3. 아래 "새로고침" 버튼을 눌러 다시 시도하세요</li>
                </ul>
              </div>
            )}

            {!isWalletError && (
              <p className="text-sm text-slate-700 mb-5">
                아래 버튼을 눌러 다시 시도하거나, 페이지를 새로고침해 주세요.
              </p>
            )}

            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={this.handleReset} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                다시 시도
              </Button>
              <Button variant="default" onClick={this.handleReload} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                새로고침
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
