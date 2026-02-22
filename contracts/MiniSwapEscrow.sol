// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  MiniSwapEscrow
 * @author MiniSwap Team
 * @notice P2P USDT ↔ KRW 직거래 에스크로 컨트랙트 (Arbitrum One 최적화)
 * @dev    외부 라이브러리 의존성 없이 자체 구현 (바이트코드 크기 최소화)
 *         - Reentrancy Guard  : 인라인 구현
 *         - SafeERC20 패턴   : return value 검증으로 직접 처리
 *         - Custom Errors     : revert string 대비 ~50% Gas 절감
 *         - Struct Packing    : 3 storage slots (Gas 최적화)
 *
 * ── 에스크로 상태 흐름 ──────────────────────────────────────────
 *
 *  deposit()
 *      │
 *      ▼
 *   LOCKED ──── release() ──────────────────► RELEASED  (정상 완료)
 *      │
 *      ├──── dispute() ─────────────────────► DISPUTED
 *      │                                           │
 *      │                         adminResolve() [2-of-2 합의]
 *      │                                           │
 *      │                              ┌────────────┴────────────┐
 *      │                              ▼                         ▼
 *      │                       toSeller=true             toSeller=false
 *      │                      RELEASED(판매자)           RELEASED(구매자)
 *      │
 *      ├──── refund() ──────────────────────► REFUNDED  (7일 타임아웃)
 *      │
 *      └──── forceRefundExpiredDispute() ───► REFUNDED  (분쟁 30일 초과)
 *
 * ── 수수료 정책 ─────────────────────────────────────────────────
 *  - 정상 완료  (release)         : 구매자 amount,    feeRecipient fee
 *  - 타임아웃   (refund)          : 판매자 amount+fee (수수료 전액 환불)
 *  - 분쟁 해결  (adminResolve)    : 승자 amount,      feeRecipient fee
 *  - 분쟁 방치  (forceRefund...)  : 판매자 amount+fee (수수료 전액 환불)
 * ────────────────────────────────────────────────────────────────
 */
// ══════════════════════════════════════════════════════════════
//  Minimal ERC-20 인터페이스 (USDT on Arbitrum One)
// ══════════════════════════════════════════════════════════════

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract MiniSwapEscrow {

    // ══════════════════════════════════════════════════════════════
    //  상수
    // ══════════════════════════════════════════════════════════════

    /// @notice 거래 만료 기한 (에스크로 락 후 7일)
    uint256 public constant TRADE_EXPIRY     = 7 days;

    /// @notice 수수료율 — 2% (basis points 표현)
    uint256 public constant FEE_RATE_BPS     = 200;
    uint256 public constant BPS_DENOMINATOR  = 10_000;

    /// @notice 분쟁 중재 최대 기한 (거래 만료 시점 기준 +30일)
    uint256 public constant DISPUTE_WINDOW   = 30 days;

    // ══════════════════════════════════════════════════════════════
    //  Immutable 변수 (배포 후 불변 — SLOAD 없이 bytecode에서 직접 읽음)
    // ══════════════════════════════════════════════════════════════

    /// @notice Arbitrum One USDT 컨트랙트 주소
    IERC20  public immutable usdt;

    /// @notice 수수료 수신 주소 (운영 지갑)
    address public immutable feeRecipient;

    // ══════════════════════════════════════════════════════════════
    //  상태 변수
    // ══════════════════════════════════════════════════════════════

    /// @notice 2-of-2 분쟁 중재 운영자
    address public admin1;
    address public admin2;

    /// @notice tradeId 생성용 nonce (재생 공격 방지)
    uint256 private _nonce;

    /// @notice Reentrancy Guard 잠금 (1 = 해제, 2 = 잠금)
    uint256 private _locked = 1;

    // ══════════════════════════════════════════════════════════════
    //  타입 정의
    // ══════════════════════════════════════════════════════════════

    /// @notice 거래 상태 Enum
    enum TradeStatus { LOCKED, RELEASED, DISPUTED, REFUNDED }

    /**
     * @notice 거래 데이터 구조체
     *
     * @dev Storage Packing 최적화 — 3 slots (96 bytes)
     *
     *  Slot 0 │ seller(20B) │ status(1B) │ createdAt(8B) │ [pad 3B] │
     *  Slot 1 │ buyer(20B)  │ expiresAt(8B)              │ [pad 4B] │
     *  Slot 2 │ amount(16B) │ feeAmount(16B)                         │
     *
     *  일반 struct 대비 1 SLOAD/SSTORE 절감 → ~2,000 Gas 절약
     */
    struct Trade {
        address     seller;     // Slot 0 [bytes  0-19]
        TradeStatus status;     // Slot 0 [byte   20  ] ← packed
        uint64      createdAt;  // Slot 0 [bytes 21-28] ← packed
        address     buyer;      // Slot 1 [bytes  0-19]
        uint64      expiresAt;  // Slot 1 [bytes 20-27] ← packed
        uint128     amount;     // Slot 2 [bytes  0-15]
        uint128     feeAmount;  // Slot 2 [bytes 16-31] ← packed (perfect fit)
    }

    /**
     * @notice 2-of-2 분쟁 투표 제안 구조체
     *
     * @dev 1 storage slot (3 bytes 사용)
     *  Slot 0 │ admin1Voted(1B) │ admin2Voted(1B) │ toSeller(1B) │ [pad 29B] │
     */
    struct DisputeProposal {
        bool admin1Voted;   // admin1 투표 완료 여부
        bool admin2Voted;   // admin2 투표 완료 여부
        bool toSeller;      // 최초 제안된 결과 (두 번째 투표와 일치해야 실행)
    }

    mapping(bytes32 => Trade)           public  trades;
    mapping(bytes32 => DisputeProposal) private _proposals;

    // ══════════════════════════════════════════════════════════════
    //  이벤트
    // ══════════════════════════════════════════════════════════════

    event TradeDeposited(
        bytes32 indexed tradeId,
        address indexed seller,
        address indexed buyer,
        uint128 amount,
        uint128 feeAmount,
        uint64  expiresAt
    );

    event TradeReleased(
        bytes32 indexed tradeId,
        address indexed recipient,
        uint128 amount
    );

    event TradeRefunded(
        bytes32 indexed tradeId,
        address indexed recipient,
        uint128 refundTotal
    );

    event TradeDisputed(
        bytes32 indexed tradeId,
        address indexed disputedBy
    );

    event DisputeVoted(
        bytes32 indexed tradeId,
        address indexed admin,
        bool    toSeller
    );

    event TradeResolved(
        bytes32 indexed tradeId,
        address indexed winner,
        uint128 amount
    );

    event AdminChanged(
        uint8   indexed slot,
        address indexed oldAdmin,
        address indexed newAdmin
    );

    // ══════════════════════════════════════════════════════════════
    //  커스텀 에러 (revert string 대비 ~50% Gas 절감)
    // ══════════════════════════════════════════════════════════════

    error ZeroAddress();           // 주소가 address(0)
    error ZeroAmount();            // amount가 0
    error SelfTrade();             // seller == buyer
    error AmountOverflow();        // amount가 uint128 초과
    error TradeNotFound();         // 존재하지 않는 tradeId
    error Unauthorized();          // 호출자 권한 없음
    error NotLocked();             // status가 LOCKED가 아님
    error NotDisputed();           // status가 DISPUTED가 아님
    error NotExpiredYet();         // 아직 만료 시간이 지나지 않음
    error DisputeWindowExpired();  // 분쟁 중재 기한 초과 (37일)
    error AlreadyVoted();          // 동일 어드민 중복 투표
    error VoteMismatch();          // 두 어드민의 판정이 불일치
    error InvalidSlot();           // slot이 1 또는 2가 아님
    error TransferFailed();        // ERC-20 transfer 실패

    // ══════════════════════════════════════════════════════════════
    //  Modifier
    // ══════════════════════════════════════════════════════════════

    /**
     * @dev Reentrancy Guard (OpenZeppelin 없이 인라인 구현)
     *      _locked: 1 = 해제, 2 = 잠금
     */
    modifier nonReentrant() {
        require(_locked == 1, "Reentrant call");
        _locked = 2;
        _;
        _locked = 1;
    }

    // ══════════════════════════════════════════════════════════════
    //  생성자
    // ══════════════════════════════════════════════════════════════

    /**
     * @param _usdt          Arbitrum One USDT 컨트랙트 주소
     *                       (0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9)
     * @param _feeRecipient  수수료 수신 주소
     * @param _admin1        운영자 1 주소 (2-of-2 분쟁 중재)
     * @param _admin2        운영자 2 주소 (2-of-2 분쟁 중재)
     */
    constructor(
        address _usdt,
        address _feeRecipient,
        address _admin1,
        address _admin2
    ) {
        if (_usdt         == address(0)) revert ZeroAddress();
        if (_feeRecipient == address(0)) revert ZeroAddress();
        if (_admin1       == address(0)) revert ZeroAddress();
        if (_admin2       == address(0)) revert ZeroAddress();

        usdt         = IERC20(_usdt);
        feeRecipient = _feeRecipient;
        admin1       = _admin1;
        admin2       = _admin2;
    }

    // ══════════════════════════════════════════════════════════════
    //  ① deposit() — 에스크로 락
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice [판매자 호출] USDT를 에스크로에 락(Lock)하고 거래를 개시합니다.
     *
     * @dev 사전 조건:
     *      - usdt.approve(address(this), amount + fee) 선행 필요
     *        (fee = amount × 2%)
     *      - buyer ≠ address(0), buyer ≠ msg.sender
     *      - 0 < amount ≤ type(uint128).max
     *
     *      tradeId 생성 방식:
     *        keccak256(seller ‖ buyer ‖ amount ‖ nonce++ ‖ timestamp)
     *        → nonce + timestamp 조합으로 동일 파라미터 재사용 시에도 유일성 보장
     *
     *      Gas 흐름 (Arbitrum One 기준):
     *        ERC-20 approve (프론트에서 별도) + deposit 호출 시 ~$0.10~0.15
     *
     * @param buyer   구매자 지갑 주소 (KRW 송금 후 USDT 수령자)
     * @param amount  USDT 순 거래 금액 (수수료 미포함, decimals 포함)
     *                예) 100 USDT → 100_000_000 (6 decimals)
     * @return tradeId 생성된 거래 식별자 (bytes32)
     */
    function deposit(address buyer, uint256 amount)
        external
        nonReentrant
        returns (bytes32 tradeId)
    {
        if (buyer  == address(0))      revert ZeroAddress();
        if (buyer  == msg.sender)      revert SelfTrade();
        if (amount == 0)               revert ZeroAmount();
        if (amount >  type(uint128).max) revert AmountOverflow();

        // 수수료 계산 (2%)
        uint256 fee   = (amount * FEE_RATE_BPS) / BPS_DENOMINATOR;
        uint256 total = amount + fee;

        // tradeId 생성 (nonce 증가는 unchecked — 2^256 오버플로 무시)
        unchecked {
            tradeId = keccak256(abi.encodePacked(
                msg.sender,
                buyer,
                amount,
                _nonce++,
                block.timestamp
            ));
        }

        // Storage Write (3 slots)
        // CEI 패턴: 상태 변경을 외부 호출(transferFrom) 전에 완료
        trades[tradeId] = Trade({
            seller    : msg.sender,
            status    : TradeStatus.LOCKED,
            createdAt : uint64(block.timestamp),
            buyer     : buyer,
            expiresAt : uint64(block.timestamp + TRADE_EXPIRY),
            amount    : uint128(amount),
            feeAmount : uint128(fee)
        });

        // USDT 이체: 판매자 → 컨트랙트 (amount + fee)
        _transferFrom(msg.sender, address(this), total);

        emit TradeDeposited(
            tradeId,
            msg.sender,
            buyer,
            uint128(amount),
            uint128(fee),
            uint64(block.timestamp + TRADE_EXPIRY)
        );
    }

    // ══════════════════════════════════════════════════════════════
    //  ② release() — USDT 릴리즈
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice [판매자 호출] KRW 입금 확인 후 구매자에게 USDT를 릴리즈합니다.
     *
     * @dev - seller 만 호출 가능 (구매자 강제 릴리즈 불가 — 핵심 보안)
     *      - TradeStatus == LOCKED 일 때만 유효
     *      - 수수료(feeAmount)는 feeRecipient로 자동 전송
     *      - CEI 패턴: status → RELEASED 변경 후 토큰 이체
     *
     * @param tradeId deposit()에서 반환된 거래 식별자
     */
    function release(bytes32 tradeId) external nonReentrant {
        Trade storage t = _requireTrade(tradeId);

        if (msg.sender != t.seller)         revert Unauthorized();
        if (t.status != TradeStatus.LOCKED) revert NotLocked();

        // 로컬 변수로 미리 읽기 (가스 절감: 이후 SLOAD 방지)
        uint128 amt    = t.amount;
        uint128 fee    = t.feeAmount;
        address buyer_ = t.buyer;

        // CEI: 상태 먼저 변경
        t.status = TradeStatus.RELEASED;

        // 토큰 이체: 구매자에게 순 금액, 운영 지갑에 수수료
        _transfer(buyer_,       amt);
        _transfer(feeRecipient, fee);

        emit TradeReleased(tradeId, buyer_, amt);
    }

    // ══════════════════════════════════════════════════════════════
    //  ③ refund() — 7일 타임아웃 환불
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice [판매자 또는 구매자 호출] 7일 만료 후 USDT를 판매자에게 환불합니다.
     *
     * @dev - TradeStatus == LOCKED & block.timestamp ≥ expiresAt 조건 필요
     *      - 환불 대상: 판매자 (USDT를 예치한 주체)
     *      - 환불 금액: amount + feeAmount 전액 (거래 미완료 = 수수료 면제)
     *      - 구매자도 호출 가능: KRW를 이미 송금했는데 판매자가 응답 없을 때 환불 트리거
     *
     * @param tradeId 거래 식별자
     */
    function refund(bytes32 tradeId) external nonReentrant {
        Trade storage t = _requireTrade(tradeId);

        if (msg.sender != t.seller && msg.sender != t.buyer) revert Unauthorized();
        if (t.status   != TradeStatus.LOCKED)                revert NotLocked();
        if (block.timestamp < t.expiresAt)                   revert NotExpiredYet();

        // amount + feeAmount 전액 환불 (uint256으로 캐스팅 후 덧셈 — overflow 방지)
        uint128 total  = uint128(uint256(t.amount) + uint256(t.feeAmount));
        address seller = t.seller;

        // CEI: 상태 먼저 변경
        t.status = TradeStatus.REFUNDED;

        _transfer(seller, total);

        emit TradeRefunded(tradeId, seller, total);
    }

    // ══════════════════════════════════════════════════════════════
    //  ④ dispute() — 분쟁 신청
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice [판매자 또는 구매자 호출] 거래를 DISPUTED 상태로 전환합니다.
     *
     * @dev - TradeStatus == LOCKED 일 때만 신청 가능
     *      - 분쟁 신청 후 운영자 2명이 오프체인 증거 검토 후 adminResolve() 호출
     *      - 증거 수집 (오더 서명, P2P 채팅, TX 해시 등)은 프론트엔드에서 처리
     *      - nonReentrant 불필요 (토큰 이체 없음, 상태 변경만)
     *
     * @param tradeId 거래 식별자
     */
    function dispute(bytes32 tradeId) external {
        Trade storage t = _requireTrade(tradeId);

        if (msg.sender != t.seller && msg.sender != t.buyer) revert Unauthorized();
        if (t.status   != TradeStatus.LOCKED)                revert NotLocked();

        t.status = TradeStatus.DISPUTED;

        emit TradeDisputed(tradeId, msg.sender);
    }

    // ══════════════════════════════════════════════════════════════
    //  ⑤ adminResolve() — 2-of-2 운영자 분쟁 중재
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice [운영자 전용] 2-of-2 합의로 분쟁을 해결합니다.
     *
     * @dev 투표 메커니즘:
     *      1. admin1 (또는 admin2) 가 먼저 호출 → DisputeProposal 저장
     *         (실행되지 않고 DisputeVoted 이벤트만 발생)
     *      2. 나머지 어드민이 동일한 toSeller 값으로 호출 → 즉시 실행
     *         (두 어드민의 결론이 다르면 VoteMismatch로 revert — 재투표 가능)
     *
     *      보안:
     *        - 동일 어드민 중복 투표 시 AlreadyVoted revert
     *        - VoteMismatch revert 시 두 번째 투표자의 상태 변경이 롤백됨
     *          → 두 번째 투표자는 다시 투표 가능 (합의 도달 시도)
     *        - DISPUTE_WINDOW(30일) 초과 시 DisputeWindowExpired revert
     *
     * @param tradeId  거래 식별자
     * @param toSeller true → 판매자 승리, false → 구매자 승리
     */
    function adminResolve(bytes32 tradeId, bool toSeller)
        external
        nonReentrant
    {
        if (msg.sender != admin1 && msg.sender != admin2) revert Unauthorized();

        Trade storage t = _requireTrade(tradeId);
        if (t.status != TradeStatus.DISPUTED)                revert NotDisputed();
        if (block.timestamp > t.expiresAt + DISPUTE_WINDOW)  revert DisputeWindowExpired();

        DisputeProposal storage p = _proposals[tradeId];
        bool isAdmin1 = (msg.sender == admin1);

        if (isAdmin1) {
            if (p.admin1Voted) revert AlreadyVoted();
            p.admin1Voted = true;

            if (!p.admin2Voted) {
                // ── 첫 번째 투표: 제안 저장 후 대기
                p.toSeller = toSeller;
                emit DisputeVoted(tradeId, msg.sender, toSeller);
                return;
            }
            // ── admin2가 이미 투표한 상태: 결론 일치 확인
            if (p.toSeller != toSeller) revert VoteMismatch();

        } else {
            // isAdmin2
            if (p.admin2Voted) revert AlreadyVoted();
            p.admin2Voted = true;

            if (!p.admin1Voted) {
                // ── 첫 번째 투표: 제안 저장 후 대기
                p.toSeller = toSeller;
                emit DisputeVoted(tradeId, msg.sender, toSeller);
                return;
            }
            // ── admin1이 이미 투표한 상태: 결론 일치 확인
            if (p.toSeller != toSeller) revert VoteMismatch();
        }

        // ── 두 어드민 합의 → 판정 실행
        _executeResolve(tradeId, t, toSeller);
    }

    // ══════════════════════════════════════════════════════════════
    //  ⑥ forceRefundExpiredDispute() — 분쟁 방치 안전장치
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice [누구나 호출] DISPUTE_WINDOW(30일) 초과 시 판매자에게 강제 환불합니다.
     *
     * @dev 운영자가 거래 만료 후 30일 내 중재하지 못한 극단적 케이스 보호용.
     *      - 판매자에게 amount + feeAmount 전액 환불 (수수료 면제)
     *      - 누구나 호출 가능 (운영자 개입 없이 자동 처리 유도)
     *
     * @param tradeId 거래 식별자
     */
    function forceRefundExpiredDispute(bytes32 tradeId) external nonReentrant {
        Trade storage t = _requireTrade(tradeId);

        if (t.status != TradeStatus.DISPUTED)                   revert NotDisputed();
        if (block.timestamp <= t.expiresAt + DISPUTE_WINDOW)    revert NotExpiredYet();

        uint128 total  = uint128(uint256(t.amount) + uint256(t.feeAmount));
        address seller = t.seller;

        t.status = TradeStatus.REFUNDED;

        _transfer(seller, total);

        emit TradeRefunded(tradeId, seller, total);
    }

    // ══════════════════════════════════════════════════════════════
    //  관리자 함수
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice 어드민 지갑 교체
     *
     * @dev - 어드민 1명이라도 호출 가능 (1-of-2)
     *      - 자기 자신의 슬롯도 교체 가능 (키 로테이션 지원)
     *
     * @param slot     교체 슬롯 (1 또는 2)
     * @param newAdmin 새 어드민 주소
     */
    function changeAdmin(uint8 slot, address newAdmin) external {
        if (msg.sender != admin1 && msg.sender != admin2) revert Unauthorized();
        if (newAdmin   == address(0))                     revert ZeroAddress();
        if (slot != 1 && slot != 2)                       revert InvalidSlot();

        if (slot == 1) {
            emit AdminChanged(1, admin1, newAdmin);
            admin1 = newAdmin;
        } else {
            emit AdminChanged(2, admin2, newAdmin);
            admin2 = newAdmin;
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  뷰 / Pure 함수
    // ══════════════════════════════════════════════════════════════

    /**
     * @notice 거래 전체 데이터 조회
     * @param tradeId 거래 식별자
     */
    function getTrade(bytes32 tradeId)
        external view
        returns (Trade memory)
    {
        return trades[tradeId];
    }

    /**
     * @notice 2-of-2 분쟁 투표 현황 조회
     * @param tradeId 거래 식별자
     */
    function getProposal(bytes32 tradeId)
        external view
        returns (DisputeProposal memory)
    {
        return _proposals[tradeId];
    }

    /**
     * @notice 컨트랙트 내 총 USDT 잔액 (전체 활성 거래 합산)
     */
    function totalLocked() external view returns (uint256) {
        return usdt.balanceOf(address(this));
    }

    /**
     * @notice deposit() 전 수수료 포함 총 필요 금액 미리 계산
     * @param  amount USDT 순 금액
     * @return total  컨트랙트에 approve 해야 할 총 금액 (amount + fee)
     * @return fee    수수료 금액 (amount × 2%)
     */
    function calcTotal(uint256 amount)
        external pure
        returns (uint256 total, uint256 fee)
    {
        fee   = (amount * FEE_RATE_BPS) / BPS_DENOMINATOR;
        total = amount + fee;
    }

    /**
     * @notice 특정 거래가 환불 가능한 상태인지 확인
     * @param  tradeId 거래 식별자
     * @return true = 지금 당장 refund() 호출 가능
     */
    function isRefundable(bytes32 tradeId) external view returns (bool) {
        Trade storage t = trades[tradeId];
        return (
            t.seller != address(0) &&
            t.status == TradeStatus.LOCKED &&
            block.timestamp >= t.expiresAt
        );
    }

    // ══════════════════════════════════════════════════════════════
    //  ETH 수신 거부 (USDT 전용 컨트랙트)
    // ══════════════════════════════════════════════════════════════

    receive()  external payable { revert(); }
    fallback() external payable { revert(); }

    // ══════════════════════════════════════════════════════════════
    //  내부 헬퍼 함수
    // ══════════════════════════════════════════════════════════════

    /**
     * @dev 거래 존재 여부 검증 후 Storage 포인터 반환
     *      seller == address(0) 이면 미존재 거래
     */
    function _requireTrade(bytes32 tradeId)
        private
        returns (Trade storage t)
    {
        t = trades[tradeId];
        if (t.seller == address(0)) revert TradeNotFound();
    }

    /**
     * @dev 분쟁 중재 판정 실행 (adminResolve 내부 공통 로직)
     *      CEI 패턴: status 변경 → 토큰 이체
     */
    function _executeResolve(
        bytes32       tradeId,
        Trade storage t,
        bool          toSeller
    ) private {
        uint128 amt    = t.amount;
        uint128 fee    = t.feeAmount;
        address winner = toSeller ? t.seller : t.buyer;

        t.status = TradeStatus.RELEASED;

        _transfer(winner,       amt);
        _transfer(feeRecipient, fee);

        emit TradeResolved(tradeId, winner, amt);
    }

    /**
     * @dev 안전한 ERC-20 transferFrom — return value 검증
     *      Arbitrum USDT는 표준 ERC-20이므로 bool 반환 보장
     */
    function _transferFrom(address from, address to, uint256 amount) private {
        bool ok = usdt.transferFrom(from, to, amount);
        if (!ok) revert TransferFailed();
    }

    /**
     * @dev 안전한 ERC-20 transfer — return value 검증
     *      CEI 패턴 준수: 반드시 모든 상태 변경 완료 후 호출할 것
     */
    function _transfer(address to, uint256 amount) private {
        bool ok = usdt.transfer(to, amount);
        if (!ok) revert TransferFailed();
    }
}
