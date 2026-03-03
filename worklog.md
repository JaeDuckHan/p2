# MiniSwap UI/UX 대규모 마이그레이션 작업 일지

> 작업 기간: 2026-02-27
> 작업 범위: Part A (기능 개선) + Part B (디자인 리디자인) + Part C (메인넷 전환)

---

## 1. 프로젝트 개요

MiniSwap은 P2P USDT ↔ KRW 거래 플랫폼이다.
스마트 컨트랙트 기반 에스크로, XMTP P2P 채팅, 가스비 대납(EIP-712 메타트랜잭션)을 사용한다.

이번 작업의 목표:
- **Part A**: 기능 개선 (네비게이션 개편, 거래내역, 토스트, 수락 대기 UX, 에스크로 플로우, 완료 화면, 통합 단계 표시기)
- **Part B**: Tailwind CSS v4 + Shadcn/ui 패턴으로 전체 UI 리디자인
- **Part C**: Hardhat 로컬넷 제거, Arbitrum One + Sepolia 메인넷 전환

---

## 2. 인프라 구축 (Step 1)

### 2.1 Tailwind CSS v4 설치
- `@tailwindcss/postcss` 사용 (`@tailwindcss/vite`는 ESM 오류 발생하여 제외)
- `postcss.config.js` 생성
- `vite.config.js`에 path alias (`@/ → src/`) 추가
- `jsconfig.json` 생성 (IDE 경로 인식용)

### 2.2 디자인 토큰 정의 (`src/index.css`)
- `@theme` 블록으로 커스텀 색상 변수 정의
  - Primary: Indigo (#4F46E5 계열)
  - Success: Emerald
  - Warning: Amber
  - Danger: Red
  - Info: Blue
- 유틸리티 클래스: `animate-fade-in`, `animate-slide-up`

### 2.3 유틸리티 라이브러리
- `src/lib/utils.js` — `cn()` 함수 (clsx + tailwind-merge)
- `src/lib/avatar.js` — 지갑 주소 기반 그라디언트 아바타 생성

### 2.4 의존성 추가
```
tailwindcss, @tailwindcss/postcss, postcss
class-variance-authority (CVA), clsx, tailwind-merge
lucide-react (아이콘)
```

---

## 3. UI 컴포넌트 라이브러리 구축 (Step 2)

`src/components/ui/` 디렉토리에 Shadcn/ui 패턴으로 12개 기본 컴포넌트를 생성했다:

| 컴포넌트 | 파일 | 설명 |
|---|---|---|
| Button | `button.jsx` | CVA 기반 6개 variant (default, success, warning, info, destructive, ghost, outline) + 3개 size |
| Card | `card.jsx` | CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| Badge | `badge.jsx` | 5개 variant (default, success, warning, destructive, info, secondary) |
| Alert | `alert.jsx` | Alert, AlertTitle, AlertDescription |
| Input | `input.jsx` | Input, InputWithUnit (단위 표시 지원) |
| Banner | `banner.jsx` | 알림 배너 (icon + title + children) |
| Tabs | `tabs.jsx` | Tabs, TabsList, TabsTrigger |
| Dialog | `dialog.jsx` | 모달 다이얼로그 |
| Avatar | `avatar.jsx` | 3개 size (sm, default, lg) |
| Separator | `separator.jsx` | 수평/수직 구분선 |
| Stepper | `stepper.jsx` | 단계 표시기 (HTML 라벨 지원) |
| Toast | `toast.jsx` | 토스트 알림 (자동 사라짐) |

### 3.1 토스트 시스템
- `src/contexts/ToastContext.jsx` — React Context 기반
- `toast(message, type, duration)` API
- 타입: success, error, warning, info
- 기본 자동 사라짐: 3초
- `main.jsx`에서 `<ToastProvider>` 래핑

---

## 4. 컴포넌트 마이그레이션 (Step 3~5)

### 4.1 Batch A — 단순 컴포넌트 (Step 3)
| 컴포넌트 | 변경 내용 |
|---|---|
| WalletButton | 연결/미연결 상태 UI, 주소 축약, 그라디언트 아바타 |
| NetworkGuide | 네트워크 전환 가이드 카드 |
| OnboardBanner | 첫 사용자 온보딩 배너 |
| SellOrderForm | 판매 오더 생성 폼 |
| BuyOrderForm | 구매 오더 생성 폼 |
| BuyerSelector | 구매자 선택 화면 |

### 4.2 Batch B — 복잡한 컴포넌트 (Step 4)
| 컴포넌트 | 변경 내용 |
|---|---|
| OrderDetail | Tailwind 마이그레이션 + **A.4 수락 대기 UI** (스피너, 경과시간, 5분 타임아웃) |
| CreateTrade | Tailwind 마이그레이션 + Stepper 통합 |
| JoinTrade | Tailwind 마이그레이션 |

### 4.3 Batch C — 핵심 컴포넌트 (Step 5)
| 컴포넌트 | 변경 내용 |
|---|---|
| OrderbookView | Tailwind 마이그레이션 + 인라인 구매자 선택 (**A.5**) |
| TradeRoom | Tailwind 마이그레이션 + **A.6 완료 화면** + **A.7 통합 단계 표시기** + IndexedDB 저장 + 토스트 |
| App.jsx | 3개 탭 네비게이션 (**A.1**) + 직접거래 제거 + TradeHistory 라우팅 + CreateTrade 라우팅 |

---

## 5. 기능 개선 상세 (Part A)

### A.1 네비게이션 개편
- **변경 전**: 4개 탭 (홈, 내 오더, 직접거래, 거래내역)
- **변경 후**: 3개 탭 (홈, 내 오더, 거래내역)
- 직접거래 탭 완전 제거
- lucide-react 아이콘 적용 (Home, ClipboardList, ScrollText)
- `safe-area-inset-bottom` 적용

### A.2 거래 내역 페이지 (신규)
- **파일**: `src/components/TradeHistory.jsx` (약 249줄)
- 필터 탭: 전체 / 진행중 / 완료 / 분쟁·환불
- 통계 요약: 총 거래 수, 완료 건수, 완료율
- `TradeHistoryItem` 하위 컴포넌트: 개별 `useGetTrade()` 훅으로 온체인 최신 상태 조회
- IndexedDB `getTradesByAddress(address)`로 데이터 로드
- 클릭 시 거래방 진입

### A.3 토스트/알림 시스템
- `ToastContext` + `toast.jsx` 기반
- 적용 위치:
  - TradeRoom: 릴리즈/환불/분쟁 완료, TX 오류, 거래ID 복사
  - OrderDetail: 수락 요청 전송 완료
  - OrderbookView: 새 수락 요청 도착 감지
  - CreateTrade: 에스크로 예치 완료

### A.4 수락 요청 대기 UI
- OrderDetail에 구현
- 펄스 애니메이션 스피너 + "판매자 응답 대기 중..."
- `formatElapsed()`: "방금 요청함" → "1분 전 요청함" → "N분 전 요청함"
- 5분 타임아웃 시 "아직 응답이 없습니다." + "오더북으로 돌아가기" 버튼

### A.5 판매자 에스크로 생성 플로우
- `handleStartTrade(null, 'seller', { orderId, buyerAddress })` 호출 시:
  - App.jsx의 `createTradeOptions` 상태로 CreateTrade 화면 렌더링
  - 에스크로 완료 후 자동으로 거래방 진입
- BuyerSelector에서 구매자 선택 → 에스크로 생성 → 거래방 (끊김 없는 플로우)
- OrderDetail 판매자 뷰에서도 동일 플로우 작동

### A.6 거래 완료 UX
- TradeRoom 내 RELEASED/REFUNDED 상태 분기
- 큰 체크마크 아이콘 (w-24 h-24)
- "거래 완료!" / "환불 완료!" 텍스트 (text-3xl font-black)
- 동적 금액 표시: "{amount} USDT가 지갑으로 전송되었습니다"
- Arbiscan 탐색기 링크 (체인별 자동 분기: Arbitrum One / Sepolia)
- 10초 자동 복귀 카운트다운
- "거래 내역 보기" 버튼 → 거래내역 페이지로 이동
- "오더북으로 돌아가기" 버튼

### A.7 통합 단계 표시기
- 4단계: 에스크로 락 → KRW 송금 대기 → 입금 확인 → 완료
- Stepper 컴포넌트 사용 (HTML 라벨, `dangerouslySetInnerHTML`)
- 역할별 안내 메시지 (`getStepGuidance()`):
  - 판매자 대기 중: "구매자가 KRW를 보내는 중입니다. 계좌를 확인하세요."
  - 구매자 송금: "판매자의 계좌로 KRW를 송금해주세요."
  - 시그널 후 판매자: "입금을 확인하고 USDT를 릴리즈하세요."
  - 시그널 후 구매자: "판매자가 입금을 확인 중입니다."

---

## 6. 메인넷 전환 (Part C — Step 7)

### 6.1 wagmi.js 재작성
- **제거**: Hardhat 로컬 체인 (chainId 31337)
- **유지**: Arbitrum One (42161), Arbitrum Sepolia (421614)
- `injected()` 커넥터, `shimDisconnect: true`

### 6.2 App.jsx SUPPORTED 배열
- **변경 전**: `[31337, 42161, 421614]`
- **변경 후**: `[42161, 421614]`

### 6.3 레거시 CSS 제거
- `src/App.css` 삭제 (58KB)
- `import './App.css'` 제거 확인

---

## 7. IndexedDB 거래 저장 (Step 6)

### 7.1 `getTradesByAddress()` 추가
- `src/lib/indexeddb.js`에 신규 함수
- seller 또는 buyer 주소로 필터링 (대소문자 무시)
- createdAt 기준 내림차순 정렬

### 7.2 TradeRoom에서 자동 저장
- `useEffect`로 trade 데이터 변경 시 `putTrade()` 호출
- 4초 간격 refetch 시마다 최신 상태 저장
- 저장 실패는 무시 (UI 영향 없음)

---

## 8. 한국어 주석 추가 (Step 6.5)

20개 이상의 파일에 포괄적인 한국어 주석을 추가했다:

- **컴포넌트 파일 (12개)**: button, card, badge, alert, input, banner, tabs, dialog, avatar, separator, stepper, toast
- **페이지 컴포넌트 (5개)**: OrderDetail, CreateTrade, JoinTrade, OrderbookView, TradeRoom
- **컨텍스트/라이브러리 (4개)**: ToastContext, utils.js, avatar.js, wagmi.js
- **진입점 (2개)**: main.jsx, index.css, App.jsx

주석 스타일:
- 파일 상단: 역할, Props, 주요 기능 설명
- JSDoc: `@param`, `@returns` 태그
- 인라인: 복잡한 로직에 한 줄 설명
- 섹션 구분: `// ── 섹션명 ──────` 형식

---

## 9. 수정 파일 목록

### 신규 생성
| 파일 | 설명 |
|---|---|
| `postcss.config.js` | Tailwind CSS v4 PostCSS 설정 |
| `jsconfig.json` | `@/` path alias IDE 지원 |
| `src/index.css` | Tailwind 진입점 + 디자인 토큰 |
| `src/lib/utils.js` | `cn()` 유틸리티 |
| `src/lib/avatar.js` | 그라디언트 아바타 생성기 |
| `src/contexts/ToastContext.jsx` | 토스트 알림 컨텍스트 |
| `src/components/TradeHistory.jsx` | 거래 내역 페이지 |
| `src/components/ui/button.jsx` | Button 컴포넌트 |
| `src/components/ui/card.jsx` | Card 컴포넌트 |
| `src/components/ui/badge.jsx` | Badge 컴포넌트 |
| `src/components/ui/alert.jsx` | Alert 컴포넌트 |
| `src/components/ui/input.jsx` | Input / InputWithUnit |
| `src/components/ui/banner.jsx` | Banner 컴포넌트 |
| `src/components/ui/tabs.jsx` | Tabs 컴포넌트 |
| `src/components/ui/dialog.jsx` | Dialog 컴포넌트 |
| `src/components/ui/avatar.jsx` | Avatar 컴포넌트 |
| `src/components/ui/separator.jsx` | Separator 컴포넌트 |
| `src/components/ui/stepper.jsx` | Stepper 컴포넌트 |
| `src/components/ui/toast.jsx` | Toast 컴포넌트 |

### 수정
| 파일 | 변경 요약 |
|---|---|
| `vite.config.js` | `@/` path alias 추가 |
| `package.json` | Tailwind, CVA, clsx, tailwind-merge, lucide-react 의존성 추가 |
| `src/main.jsx` | `ToastProvider` 래핑 + index.css import |
| `src/App.jsx` | 3탭 네비게이션, 직접거래 제거, TradeHistory/CreateTrade 라우팅, 메인넷 전환 |
| `src/lib/wagmi.js` | Hardhat 제거, Arbitrum One + Sepolia만 지원 |
| `src/lib/indexeddb.js` | `getTradesByAddress()` 추가 |
| `src/components/TradeRoom.jsx` | Tailwind + A.6 완료 화면 + A.7 단계 표시기 + 토스트 + IndexedDB 저장 + Arbiscan 링크 |
| `src/components/OrderbookView.jsx` | Tailwind + 인라인 구매자 선택 + 수락 요청 토스트 |
| `src/components/OrderDetail.jsx` | Tailwind + A.4 대기 UI + 수락 요청 토스트 |
| `src/components/CreateTrade.jsx` | Tailwind + Stepper + 에스크로 완료 토스트 |
| `src/components/JoinTrade.jsx` | Tailwind 마이그레이션 |
| `src/components/WalletButton.jsx` | Tailwind 마이그레이션 |
| `src/components/NetworkGuide.jsx` | Tailwind 마이그레이션 |
| `src/components/OnboardBanner.jsx` | Tailwind 마이그레이션 |
| `src/components/SellOrderForm.jsx` | Tailwind 마이그레이션 |
| `src/components/BuyOrderForm.jsx` | Tailwind 마이그레이션 |
| `src/components/BuyerSelector.jsx` | Tailwind 마이그레이션 |

### 삭제
| 파일 | 사유 |
|---|---|
| `src/App.css` | 58KB 레거시 CSS → Tailwind로 완전 대체 |

---

## 10. 빌드 검증

- `npx vite build` 성공 (6763 modules transformed)
- 콘솔 오류 없음
- dev 서버 정상 동작 (localhost:5173)

---

---

# 멀티체인 구조 개편 작업 로그

> 작업 기간: 2026-02-28 ~ 03-01
> 작업 범위: 빌드 타임 네트워크 선택 → 런타임 네트워크 선택 (Arbitrum / Polygon / Tron)

---

## Phase 1: 네트워크 레지스트리 + 컨텍스트 ✅

1. **`src/constants/network.js`** — 전면 재작성
   - 기존 상수(`ACTIVE_NETWORK`, `CHAIN_NAME`, `MAINNET_CHAIN_ID`, `SUPPORTED_CHAINS`, `CHAIN_ID_HEX`, `CHAIN_PARAMS`, `EXPLORER_NAME`, `LAYER_LABEL` 등) 전부 제거
   - `NETWORKS` 레지스트리 도입: Arbitrum One, Arbitrum Sepolia, Polygon, Polygon Amoy, Tron 5개 네트워크
   - 각 네트워크에 `chainType`, `chainParams`, `explorerTxTemplate`, `explorerAddressTemplate`, `bridgeUrl`, `description`, `features[]` 등 메타데이터 포함
   - 유틸 함수 export: `getNetwork()`, `getNetworkByChainId()`, `getExplorerUrl()`, `getSupportedChainIds()`

2. **`src/lib/amount.js`** — 신규 생성
   - BigInt 기반 USDT 금액 변환: `parseAmount(str, decimals)`, `formatAmount(raw, decimals)`
   - JS Number 정밀도 문제 방지

3. **`src/contexts/NetworkContext.jsx`** — 신규 생성
   - `useState(() => localStorage.getItem('miniswap:network'))` — 동기 초기화로 깜빡임 방지
   - export: `NetworkProvider`, `useNetwork()` → `{ networkKey, network, setNetwork, isEvm, isTron }`

4. **`src/lib/wagmi.js`** — 수정
   - 모든 EVM 체인(arbitrum, arbitrumSepolia, polygon, polygonAmoy) 한번에 등록
   - `ACTIVE_NETWORK` 의존성 제거

5. **`src/constants.js`** — 수정: Tron USDT 주소 추가
6. **`src/deployments.js`** — 수정: `"tron": { "escrow": null, "usdt": "TR7NHq..." }` 추가

---

## Phase 2: 어댑터 레이어 ✅

7. **`src/adapters/EvmAdapter.js`** — 신규 생성
   - wagmi `useAccount`, `useConnect`, `useDisconnect` 래핑
   - 통일된 인터페이스: `{ type, address, isConnected, connect, disconnect, connectorName, chainId }`

8. **`src/adapters/TronAdapter.js`** — 신규 생성
   - `window.tronWeb` / TronLink 래핑
   - 주입 지연 핸들링: 1초 간격 × 5회 재시도, focus/visibility 재감지
   - TronLink `setAccount`/`setNode` 메시지 이벤트 수신
   - 언마운트 시 정리 (cleanup)

9. **`src/contexts/WalletContext.jsx`** — 신규 생성
   - `useNetwork()`로 활성 어댑터 결정
   - 두 어댑터 모두 무조건 호출 (React hooks 규칙 준수)
   - 활성 어댑터 상태만 노출: `{ address, isConnected, connect, disconnect, walletType, evm, tron }`

---

## Phase 3: Tron 에스크로 훅 ✅

10. **`src/hooks/useTronEscrow.js`** — 신규 생성
    - `DEPLOYMENTS.tron.escrow === null` 일 때 모든 훅이 no-op 반환
    - `isTronEscrowAvailable()` 유틸 함수
    - 스텁 훅: `useTronUsdtBalance`, `useTronGetTrade`, `useTronApproveUsdt`, `useTronDeposit`, `useTronRelease`, `useTronRefund`, `useTronDispute`

---

## Phase 4: UI 컴포넌트 ✅

11. **`src/components/NetworkSelector.jsx`** — 신규 생성
    - 트리거 버튼: 현재 네트워크 아이콘 + 이름 + 쉐브론
    - 풀스크린 모달: 네트워크 카드 (설명, features, gasInfo, walletWarning, tokenStandard 배지)
    - EVM↔Tron 전환 시 확인 다이얼로그 (지갑 비호환 안내)

12. **`src/components/WalletButton.jsx`** — 전면 재작성
    - `useWallet()`, `useNetwork()` 사용
    - EVM 연결: 체인 이름 배지 + 축약 주소
    - Tron 연결: "Tron" 빨간 배지 + T-주소
    - "MetaMask" 하드코딩 제거 → "지갑 연결"

13. **`src/components/AppShell.jsx`** — 수정
    - 헤더에 `NetworkSelector` 추가 (로고와 WalletButton 사이)
    - `useNetwork()`로 동적 `network.name` 경고 배너

---

## Phase 5: 기존 컴포넌트 마이그레이션 ✅

14. **`src/main.jsx`** — 수정
    - Provider 순서: `NetworkProvider > WagmiProvider > QueryClientProvider > WalletProvider > XmtpProvider > ToastProvider`

15. **`src/App.jsx`** — 수정
    - `useWallet()`, `useNetwork()` 사용
    - `wrongNetwork` 판단에 `getSupportedChainIds(networkKey)` + EVM-only 조건 적용

16. **`src/hooks/useNetworkSwitch.js`** — 전면 재작성
    - `useNetwork()`로 동적 `chainIdHex`, `chainParams`
    - Tron 조기 리턴 (네트워크 전환 불필요)
    - 3단계 폴백: `switchEthereumChain` → `addEthereumChain` → 수동 가이드 토스트

17. **`src/components/HeroSection.jsx`** — 수정
    - `network.layerLabel`, `network.layerDescription` 동적 표시
    - Tron → "TronLink 지갑이 필요합니다" / EVM → "MetaMask 또는 호환 지갑이 필요합니다"

18. **`src/components/NetworkGuide.jsx`** — 전면 재작성
    - Tron: TronLink 설치 가이드 / EVM: 네트워크 전환 + ChainList + 브릿지 안내

19. **`src/components/CreateTrade.jsx`** — 수정
    - Tron 에스크로 미지원 시 "Tron 에스크로 준비 중" 블록 표시

20. **`src/components/JoinTrade.jsx`** — 수정
    - CreateTrade와 동일한 Tron 에스크로 비활성화 패턴

21. **`src/components/TradeRoom.jsx`** — 수정
    - `getExplorerUrl()` 템플릿 API 사용
    - `network.explorerName` 동적 탐색기 이름

---

## Phase 6: 오더북 격리 + XMTP + 서명 ✅

22. **`src/lib/trystero-orderbook.js`** — 수정
    - AppId: `miniswap-orderbook-v1-{networkKey}` — 네트워크별 P2P 룸 격리

23. **`src/hooks/useOrderbook.js`** — 수정
    - `useNetwork()`에서 `networkKey` 가져오기
    - `createOrderbookRoom({ networkKey })` 전달
    - 네트워크 변경 시 기존 오더/요청 상태 클리어
    - dependency array: `[enabled, networkKey]`

24. **`src/contexts/XmtpContext.jsx`** — 수정
    - Tron 네트워크 시 XMTP 초기화 스킵 (`isTron` 체크)
    - `isTronSkipped` 플래그 노출

25. **`src/types/order.js`** — 수정
    - `isValidAddress()` 추가: EVM(`/^0x[0-9a-fA-F]{40}$/`) + Tron(`TronWeb.isAddress` → regex fallback)
    - `validateOrder()`에서 `isValidAddress()` 사용

26. **`src/lib/signature.js`** — 전면 재작성
    - chainType 자동 감지 (`detectChainType()` — 주소 형식 기반)
    - EVM: ethers.js `solidityPackedKeccak256` + `personal_sign`
    - Tron: TronWeb `signMessageV2` / `verifyMessageV2`
    - Public API 하위 호환: `signOrder(signer, order, { chainType? })`, `verifyOrder(order)`

---

## Phase 7: 빌드 검증 ✅

27. `vite build` 성공 — 6778 modules, 1분 7초, 에러 0건
28. Dev 서버 정상 동작 확인 — 콘솔 에러 0, 모든 UI 렌더링 정상
29. 커밋 `8affc74` — 26 files changed, +1524/-407 lines
30. `git push origin main` 완료

---

## Phase 8: 배포 인프라 구축 ✅

31. **`hardhat.config.js`** — 수정: Polygon PoS (137) + Polygon Amoy (80002) 네트워크 추가, Polygonscan API key
32. **`scripts/deploy.js`** — 수정: `polygon`, `polygonAmoy` USDT 주소 분기 추가
33. **`scripts/deploy-tron.js`** — 신규 생성: TronWeb 기반 Tron 배포 스크립트 (Hardhat ABI/bytecode 재사용)
34. **`.env.example`** — 신규 생성: 배포 환경변수 템플릿
35. **`scripts/deploy-polygon-amoy.js`** — 신규 생성: Polygon Amoy 배포 래퍼
36. **`scripts/deploy-tron-nile.js`** — 신규 생성: Tron Nile 배포 래퍼

---

## 파일 변경 요약 (멀티체인 전체)

| 구분 | 파일 수 | 목록 |
|---|---|---|
| **신규** | 12 | NetworkContext, WalletContext, EvmAdapter, TronAdapter, useTronEscrow, NetworkSelector, amount.js, deploy-tron.js, deploy-polygon-amoy.js, deploy-tron-nile.js, .env.example, .env |
| **전면 재작성** | 4 | WalletButton, useNetworkSwitch, NetworkGuide, signature.js |
| **수정** | 18 | network.js, constants.js, deployments.js, wagmi.js, main.jsx, App.jsx, AppShell, HeroSection, CreateTrade, JoinTrade, TradeRoom, useOrderbook, trystero-orderbook, XmtpContext, order.js, hardhat.config.js, deploy.js, launch.json |

---

## 남은 작업 🔲

### 컨트랙트 배포 (테스트넷 토큰 충전 후 진행)

| 네트워크 | 체인ID | 상태 | 필요 사항 |
|---|---|---|---|
| Arbitrum Sepolia | 421614 | ✅ 배포 완료 | `0xac69c300...47a7D8` |
| Polygon Amoy | 80002 | 🔲 미배포 | 배포자(`0x6E7E4d...F1D7`)에 테스트 MATIC 필요 |
| Tron Nile | - | 🔲 미배포 | 배포자 Tron 주소에 테스트 TRX 필요 |
| Arbitrum One (메인넷) | 42161 | 🔲 선택 | 실제 ETH 필요 |
| Polygon PoS (메인넷) | 137 | 🔲 선택 | 실제 MATIC 필요 |
| Tron (메인넷) | - | 🔲 선택 | 실제 TRX 필요 |

### 테스트넷 토큰 Faucet

- **Polygon Amoy MATIC**: https://faucet.polygon.technology
- **Tron Nile TRX**: https://nileex.io/join/getJoinPage

### 배포 실행 명령

```bash
# Polygon Amoy
npx hardhat run scripts/deploy.js --network polygonAmoy

# Tron Nile
TRON_NETWORK=nile node scripts/deploy-tron.js
```

### 배포 후 작업

- [ ] `src/deployments.js`에 Polygon/Tron 컨트랙트 주소 자동 등록 (deploy 스크립트가 처리)
- [ ] 배포 결과 커밋 + 푸시
- [ ] 프론트엔드에서 Polygon/Tron 네트워크 전환 후 에스크로 동작 확인
- [ ] `tronweb` npm 패키지 설치 (Tron 배포 시)

### 향후 개선 (선택)

- [ ] Tron 에스크로 훅(`useTronEscrow.js`) 실제 구현 (현재 no-op placeholder)
- [ ] XMTP Tron 대안 메시징 (현재 Tron은 P2P 채팅 비활성)
- [ ] Polygon/Tron 메인넷 배포
- [ ] 컨트랙트 소스코드 검증 (Polygonscan, Tronscan)
- [ ] 실 기기 테스트 (모바일 Safari, Chrome)
- [ ] 성능 최적화 (코드 스플리팅, 번들 크기 축소)

---

---

# 수정 작업 제안서 작성 (2026-03-03)

> 기반 문서: `코드_UI_점검보고서_2026-03-02.md`
> 결과 문서: `수정_작업제안서_2026-03-03.md`

---

## 1. 작업 개요

코드/UI 점검보고서(2026-03-02)의 지적사항을 소스코드와 직접 대조하여 검증하고, 이슈별 수정 작업 제안서를 작성했다.

---

## 2. 검증 결과

| 이슈 | 보고서 내용 | 검증 결과 |
|------|------------|----------|
| P0-1 테스트 실패 | constructor 인자 불일치 (5개 vs 4개) | **확인됨** |
| P0-2 ESLint 실패 | 설정 파일 누락 | **확인됨** |
| P0-3 네트워크 에러 | error 상태 미표출 | **확인됨** |
| P1-1 번들 크기 | 코드 스플리팅 없음 | **확인됨** |
| P1-2 XSS 위험 | dangerouslySetInnerHTML | **확인됨** |
| P1-3 탐색기 링크 | address 링크 사용 (tx hash 미노출) | **확인됨** |

---

## 3. 수정 작업 제안 요약

### Phase 1 — P0 (릴리즈 차단)
- **P0-1**: 테스트 deployFixture에 relayer 인자 추가 + 관련 테스트 케이스 보강
- **P0-2**: ESLint 9 Flat Config 설정 + React 플러그인 설치 + lint 스크립트 업데이트
- **P0-3**: App.jsx에서 networkError 수신 → useEffect + toast 연동 (방안 C 채택)

### Phase 2 — P1 (다음 스프린트)
- **P1-1**: 라우트 기반 lazy import + vite manualChunks + Suspense fallback
- **P1-2**: stepper.jsx의 dangerouslySetInnerHTML → Fragment 기반 plain text 전환
- **P1-3**: useEscrow에서 release/refund txHash 수집 → TradeRoom에서 tx 링크 우선 표시

---

## 4. 기존 커밋 (2026-03-03)

| 커밋 | 설명 |
|------|------|
| `112b4e5` | fix: 네트워크 전환 버튼 작동 안 됨 — window.ethereum 직접 호출을 wagmi useSwitchChain으로 교체 |
| `e9f927d` | fix: @eslint/js 버전을 9.x로 다운그레이드 — Vercel npm install 충돌 해결 |
| `ca9f217` | fix: P0/P1 전체 수정 — 테스트 복구, ESLint 설정, 네트워크 에러 Toast, 코드 스플리팅, XSS 제거, tx 링크 |
| `f1be10c` | fix: Dialog을 Portal로 렌더링 — backdrop-filter containing block 문제 해결 |
| `265a4d8` | fix: 데스크톱 다이얼로그 중앙 정렬 + 지갑 연결 에러 근본 수정 |
| `7283c51` | fix: 페이지 전환 시 지갑 컨펌 반복 요청 — walletClient 참조를 useRef로 안정화 |

---

## 5. 버그 분석: 페이지 전환 시 지갑 컨펌 반복 요청

### 증상
지갑 한번 연결 후 다른 페이지로 이동할 때마다 지갑 서명 승인 팝업이 뜸. 송금 시에만 컨펌을 받아야 정상.

### 근본 원인
`src/contexts/XmtpContext.jsx:68` — useEffect 의존성 배열에 `walletClient` 포함

```
[walletClient, address, isConnected, isTron]
```

- wagmi `useWalletClient()`는 매 렌더링마다 새로운 객체 참조 반환 (내용은 동일)
- 페이지 전환 → 리렌더링 → walletClient 참조 변경 → useEffect 재실행
- `getOrCreateClient(walletClient)` → `Client.create()` → `signMessage()` 호출
- 지갑 컨펌 팝업 발생

### 수정 방안
의존성 배열에서 `walletClient` 제거:

```js
// 변경 전
}, [walletClient, address, isConnected, isTron])

// 변경 후
}, [address, isConnected, isTron])
```

`address`, `isConnected`만으로 실제 지갑 상태 변경 감지 가능. `getOrCreateClient()` 내부에서 address 기반 캐시 체크를 하므로 안전.

### 상태: ✅ 수정 완료

#### 수정 내용
- `walletClient`를 `useRef`로 추적하여 deps에서 제거
- `!isConnected`와 `!walletClient` 분리 — 연결 해제 시에만 `resetClient()` 호출
- walletClient 미준비 시 캐시 유지한 채 조기 리턴 (불필요한 초기화 방지)
- 의존성 배열: `[walletClient, address, isConnected, isTron]` → `[address, isConnected, isTron]`
- 빌드 검증 통과 (vite build 성공, 0 errors)
