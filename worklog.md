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

## 11. 남은 작업

- [ ] Arbitrum One 메인넷 스마트 컨트랙트 배포 (Hardhat deploy 스크립트 실행 — 수동 작업)
- [ ] Vercel 환경변수 업데이트 (CONTRACT_ADDRESS 등)
- [ ] 실 기기 테스트 (모바일 Safari, Chrome)
- [ ] 성능 최적화 (코드 스플리팅, 번들 크기 축소)
