/**
 * @file    MiniSwapEscrow.test.js
 * @notice  MiniSwapEscrow 스마트 컨트랙트 전체 테스트 스위트
 * @dev     Hardhat + ethers.js v6 + @nomicfoundation/hardhat-network-helpers
 *
 * ── 테스트 섹션 구성 ─────────────────────────────────────────────
 *  1.  Deployment             — 배포 및 초기값 검증
 *  2.  deposit()              — 에스크로 락 (해피 케이스 + 에러)
 *  3.  release()              — 정상 완료 (해피 케이스 + 접근 제어)
 *  4.  refund()               — 7일 타임락 환불
 *  5.  dispute()              — 분쟁 신청
 *  6.  adminResolve()         — 2-of-2 운영자 중재
 *      ├── 해피 케이스 (판매자 승리 / 구매자 승리)
 *      ├── VoteMismatch 시나리오 + 재투표 복구
 *      ├── AlreadyVoted 방지
 *      └── DisputeWindowExpired 경계값
 *  7.  forceRefundExpiredDispute() — 분쟁 방치 안전장치
 *  8.  changeAdmin()          — 어드민 교체
 *  9.  상태 전환 무결성       — 불법 상태 전환 방지
 *  10. 보안 엣지 케이스       — TransferFailed, Overflow, ETH 거부 등
 *  11. E2E 통합 테스트        — 전체 거래 플로우
 * ─────────────────────────────────────────────────────────────────
 *
 * 실행:
 *   npx hardhat test
 *   npx hardhat test --grep "HappyPath"   ← 해피 케이스만
 *   npx hardhat test --grep "보안"        ← 보안 테스트만
 */

const { expect }      = require("chai");
const { ethers }      = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

// ══════════════════════════════════════════════════════════════════
//  전역 상수
// ══════════════════════════════════════════════════════════════════

const USDT_DECIMALS       = 6n;
const ONE_USDT            = 10n ** USDT_DECIMALS;           // 1_000_000
const AMOUNT_100          = 100n  * ONE_USDT;               // 100 USDT
const AMOUNT_500          = 500n  * ONE_USDT;               // 500 USDT
const SELLER_INIT_BALANCE = 1_000n * ONE_USDT;              // 1,000 USDT

const FEE_RATE_BPS        = 200n;
const BPS_DENOM           = 10_000n;

const SEVEN_DAYS          = 7  * 24 * 60 * 60;             // 604_800 초
const THIRTY_DAYS         = 30 * 24 * 60 * 60;             // 2_592_000 초
const THIRTYSEVEN_DAYS    = SEVEN_DAYS + THIRTY_DAYS;       // 37일

// 컨트랙트 상태 Enum (uint8)
const TradeStatus = Object.freeze({
    LOCKED   : 0n,
    RELEASED : 1n,
    DISPUTED : 2n,
    REFUNDED : 3n,
});

// ── 순수 헬퍼 ───────────────────────────────────────────────────
const calcFee   = (amount) => (amount * FEE_RATE_BPS) / BPS_DENOM;
const calcTotal = (amount) => amount + calcFee(amount);

/**
 * @dev receipt.logs 에서 특정 이벤트를 파싱해 반환
 */
function parseEvent(receipt, contract, eventName) {
    for (const log of receipt.logs) {
        try {
            const parsed = contract.interface.parseLog(log);
            if (parsed && parsed.name === eventName) return parsed;
        } catch (_) { /* 다른 컨트랙트의 로그 무시 */ }
    }
    throw new Error(`Event "${eventName}" not found in receipt`);
}

/**
 * @dev deposit 트랜잭션을 실행하고 tradeId 를 반환
 */
async function depositAndGetTradeId(escrow, usdt, seller, buyer, amount) {
    const total = calcTotal(amount);
    await usdt.connect(seller).approve(escrow.target, total);
    const tx      = await escrow.connect(seller).deposit(buyer.address, amount);
    const receipt = await tx.wait();
    return parseEvent(receipt, escrow, "TradeDeposited").args.tradeId;
}

// ══════════════════════════════════════════════════════════════════
//  Fixtures (loadFixture 로 스냅샷 재사용 → 테스트 속도 향상)
// ══════════════════════════════════════════════════════════════════

async function deployFixture() {
    const [owner, seller, buyer, admin1, admin2, feeRecipient, attacker, stranger] =
        await ethers.getSigners();

    // MockERC20 (USDT 대역)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdt = await MockERC20.deploy("Tether USD", "USDT", 6);

    // MiniSwapEscrow
    const Escrow = await ethers.getContractFactory("MiniSwapEscrow");
    const escrow = await Escrow.deploy(
        usdt.target,
        feeRecipient.address,
        admin1.address,
        admin2.address
    );

    // 판매자에게 USDT 발행
    await usdt.mint(seller.address, SELLER_INIT_BALANCE);

    return {
        escrow, usdt,
        owner, seller, buyer,
        admin1, admin2, feeRecipient,
        attacker, stranger,
    };
}

async function depositedFixture() {
    const base    = await deployFixture();
    const { escrow, usdt, seller, buyer } = base;

    const amount  = AMOUNT_100;
    const fee     = calcFee(amount);
    const total   = amount + fee;

    const tradeId = await depositAndGetTradeId(escrow, usdt, seller, buyer, amount);

    return { ...base, tradeId, amount, fee, total };
}

async function disputedFixture() {
    const base = await depositedFixture();
    const { escrow, seller, tradeId } = base;
    await escrow.connect(seller).dispute(tradeId);
    return base;
}

// ══════════════════════════════════════════════════════════════════
//  ──────────────── 테스트 시작 ──────────────────────────────────
// ══════════════════════════════════════════════════════════════════

describe("MiniSwapEscrow", function () {

    // ════════════════════════════════════════════════════════════
    //  1. Deployment
    // ════════════════════════════════════════════════════════════
    describe("1. Deployment", function () {

        it("immutable 변수가 올바르게 설정된다", async function () {
            const { escrow, usdt, feeRecipient, admin1, admin2 } =
                await loadFixture(deployFixture);

            expect(await escrow.usdt()).to.equal(usdt.target);
            expect(await escrow.feeRecipient()).to.equal(feeRecipient.address);
            expect(await escrow.admin1()).to.equal(admin1.address);
            expect(await escrow.admin2()).to.equal(admin2.address);
        });

        it("상수 값이 설계 명세와 일치한다 (7일, 2%, 30일)", async function () {
            const { escrow } = await loadFixture(deployFixture);

            expect(await escrow.TRADE_EXPIRY()).to.equal(BigInt(SEVEN_DAYS));
            expect(await escrow.FEE_RATE_BPS()).to.equal(200n);
            expect(await escrow.DISPUTE_WINDOW()).to.equal(BigInt(THIRTY_DAYS));
        });

        it("usdt 가 address(0) 이면 ZeroAddress revert", async function () {
            const [, , , admin1, admin2, feeRecipient] = await ethers.getSigners();
            const Escrow = await ethers.getContractFactory("MiniSwapEscrow");
            await expect(
                Escrow.deploy(
                    ethers.ZeroAddress, feeRecipient.address,
                    admin1.address, admin2.address
                )
            ).to.be.revertedWithCustomError(Escrow, "ZeroAddress");
        });

        it("feeRecipient 가 address(0) 이면 ZeroAddress revert", async function () {
            const [, , , admin1, admin2] = await ethers.getSigners();
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const u = await MockERC20.deploy("T", "T", 6);
            const Escrow = await ethers.getContractFactory("MiniSwapEscrow");
            await expect(
                Escrow.deploy(u.target, ethers.ZeroAddress, admin1.address, admin2.address)
            ).to.be.revertedWithCustomError(Escrow, "ZeroAddress");
        });

        it("admin1 이 address(0) 이면 ZeroAddress revert", async function () {
            const [, , , , admin2, feeRecipient] = await ethers.getSigners();
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const u = await MockERC20.deploy("T", "T", 6);
            const Escrow = await ethers.getContractFactory("MiniSwapEscrow");
            await expect(
                Escrow.deploy(
                    u.target, feeRecipient.address,
                    ethers.ZeroAddress, admin2.address
                )
            ).to.be.revertedWithCustomError(Escrow, "ZeroAddress");
        });

        it("admin2 가 address(0) 이면 ZeroAddress revert", async function () {
            const [, , , admin1, , feeRecipient] = await ethers.getSigners();
            const MockERC20 = await ethers.getContractFactory("MockERC20");
            const u = await MockERC20.deploy("T", "T", 6);
            const Escrow = await ethers.getContractFactory("MiniSwapEscrow");
            await expect(
                Escrow.deploy(
                    u.target, feeRecipient.address,
                    admin1.address, ethers.ZeroAddress
                )
            ).to.be.revertedWithCustomError(Escrow, "ZeroAddress");
        });

        it("ETH 직접 전송 시 revert (USDT 전용 컨트랙트)", async function () {
            const { escrow, seller } = await loadFixture(deployFixture);
            await expect(
                seller.sendTransaction({ to: escrow.target, value: ethers.parseEther("1") })
            ).to.be.reverted;
        });

        it("fallback 호출 시 revert", async function () {
            const { escrow, seller } = await loadFixture(deployFixture);
            await expect(
                seller.sendTransaction({
                    to   : escrow.target,
                    value: 0n,
                    data : "0xdeadbeef",
                })
            ).to.be.reverted;
        });
    });

    // ════════════════════════════════════════════════════════════
    //  2. deposit()
    // ════════════════════════════════════════════════════════════
    describe("2. deposit()", function () {

        it("[HappyPath] 잔액이 올바르게 이동한다 (seller → escrow)", async function () {
            const { escrow, usdt, seller, buyer } = await loadFixture(deployFixture);
            const amount = AMOUNT_100;
            const total  = calcTotal(amount);

            const sellerBefore = await usdt.balanceOf(seller.address);
            const escrowBefore = await usdt.balanceOf(escrow.target);

            await usdt.connect(seller).approve(escrow.target, total);
            await escrow.connect(seller).deposit(buyer.address, amount);

            expect(await usdt.balanceOf(seller.address)).to.equal(sellerBefore - total);
            expect(await usdt.balanceOf(escrow.target)).to.equal(escrowBefore + total);
        });

        it("[HappyPath] Trade 구조체가 올바르게 저장된다", async function () {
            const { escrow, usdt, seller, buyer } = await loadFixture(deployFixture);
            const amount  = AMOUNT_100;
            const fee     = calcFee(amount);
            const tradeId = await depositAndGetTradeId(escrow, usdt, seller, buyer, amount);

            const trade = await escrow.getTrade(tradeId);
            expect(trade.seller).to.equal(seller.address);
            expect(trade.buyer).to.equal(buyer.address);
            expect(trade.amount).to.equal(amount);
            expect(trade.feeAmount).to.equal(fee);
            expect(trade.status).to.equal(TradeStatus.LOCKED);
            expect(trade.expiresAt).to.be.greaterThan(0n);

            // expiresAt ≈ now + 7일 (±5초 허용)
            const now = BigInt(await time.latest());
            expect(trade.expiresAt).to.be.closeTo(now + BigInt(SEVEN_DAYS), 5n);
        });

        it("[HappyPath] TradeDeposited 이벤트가 올바르게 발행된다", async function () {
            const { escrow, usdt, seller, buyer } = await loadFixture(deployFixture);
            const amount = AMOUNT_100;
            const fee    = calcFee(amount);
            const total  = amount + fee;

            await usdt.connect(seller).approve(escrow.target, total);
            const tx = escrow.connect(seller).deposit(buyer.address, amount);

            await expect(tx)
                .to.emit(escrow, "TradeDeposited")
                .withArgs(
                    (v) => typeof v === "string" && v.startsWith("0x"), // tradeId
                    seller.address,
                    buyer.address,
                    amount,
                    fee,
                    (v) => v > 0n                                        // expiresAt
                );
        });

        it("[HappyPath] 동일 파라미터로 연속 deposit 시 서로 다른 tradeId 생성", async function () {
            const { escrow, usdt, seller, buyer } = await loadFixture(deployFixture);
            const amount = AMOUNT_100;
            const total  = calcTotal(amount);

            // 추가 잔액 발행
            await usdt.mint(seller.address, total * 3n);
            await usdt.connect(seller).approve(escrow.target, total * 3n);

            const ids = [];
            for (let i = 0; i < 3; i++) {
                const tx      = await escrow.connect(seller).deposit(buyer.address, amount);
                const receipt = await tx.wait();
                ids.push(parseEvent(receipt, escrow, "TradeDeposited").args.tradeId);
            }

            // 모두 서로 다른 tradeId 여야 한다
            expect(new Set(ids).size).to.equal(3);
        });

        it("[HappyPath] 수수료 2% 계산 검증 (100 USDT → fee 2 USDT)", async function () {
            const { escrow, usdt, seller, buyer } = await loadFixture(deployFixture);
            const [total, fee] = await escrow.calcTotal(AMOUNT_100);

            expect(fee).to.equal(calcFee(AMOUNT_100));     // 2_000_000
            expect(total).to.equal(calcTotal(AMOUNT_100));  // 102_000_000
        });

        // ── 에러 케이스 ──────────────────────────────────────────
        it("amount = 0 이면 ZeroAmount revert", async function () {
            const { escrow, seller, buyer } = await loadFixture(deployFixture);
            await expect(
                escrow.connect(seller).deposit(buyer.address, 0n)
            ).to.be.revertedWithCustomError(escrow, "ZeroAmount");
        });

        it("buyer = address(0) 이면 ZeroAddress revert", async function () {
            const { escrow, seller } = await loadFixture(deployFixture);
            await expect(
                escrow.connect(seller).deposit(ethers.ZeroAddress, AMOUNT_100)
            ).to.be.revertedWithCustomError(escrow, "ZeroAddress");
        });

        it("buyer == seller 이면 SelfTrade revert", async function () {
            const { escrow, seller } = await loadFixture(deployFixture);
            await expect(
                escrow.connect(seller).deposit(seller.address, AMOUNT_100)
            ).to.be.revertedWithCustomError(escrow, "SelfTrade");
        });

        it("amount > uint128.max 이면 AmountOverflow revert", async function () {
            const { escrow, seller, buyer } = await loadFixture(deployFixture);
            await expect(
                escrow.connect(seller).deposit(buyer.address, 2n ** 128n)
            ).to.be.revertedWithCustomError(escrow, "AmountOverflow");
        });

        it("approve 없이 deposit 시 transferFrom 실패로 revert", async function () {
            const { escrow, seller, buyer } = await loadFixture(deployFixture);
            await expect(
                escrow.connect(seller).deposit(buyer.address, AMOUNT_100)
            ).to.be.reverted;
        });

        it("approve 금액 부족 시 revert", async function () {
            const { escrow, usdt, seller, buyer } = await loadFixture(deployFixture);
            // 수수료 미포함 금액만 approve → transferFrom 실패
            await usdt.connect(seller).approve(escrow.target, AMOUNT_100);
            await expect(
                escrow.connect(seller).deposit(buyer.address, AMOUNT_100)
            ).to.be.reverted;
        });
    });

    // ════════════════════════════════════════════════════════════
    //  3. release() — 해피 케이스
    // ════════════════════════════════════════════════════════════
    describe("3. release() — 정상 완료", function () {

        it("[HappyPath] 구매자에게 amount, feeRecipient에게 fee가 전송된다", async function () {
            const { escrow, usdt, seller, buyer, feeRecipient, tradeId, amount, fee } =
                await loadFixture(depositedFixture);

            const buyerBefore = await usdt.balanceOf(buyer.address);
            const feeBefore   = await usdt.balanceOf(feeRecipient.address);
            const escrowTotal = await usdt.balanceOf(escrow.target);

            await escrow.connect(seller).release(tradeId);

            expect(await usdt.balanceOf(buyer.address)).to.equal(buyerBefore + amount);
            expect(await usdt.balanceOf(feeRecipient.address)).to.equal(feeBefore + fee);
            expect(await usdt.balanceOf(escrow.target)).to.equal(escrowTotal - amount - fee);
        });

        it("[HappyPath] 상태가 RELEASED 로 변경된다", async function () {
            const { escrow, seller, tradeId } = await loadFixture(depositedFixture);
            await escrow.connect(seller).release(tradeId);
            const trade = await escrow.getTrade(tradeId);
            expect(trade.status).to.equal(TradeStatus.RELEASED);
        });

        it("[HappyPath] TradeReleased 이벤트가 발행된다", async function () {
            const { escrow, seller, buyer, tradeId, amount } =
                await loadFixture(depositedFixture);
            await expect(escrow.connect(seller).release(tradeId))
                .to.emit(escrow, "TradeReleased")
                .withArgs(tradeId, buyer.address, amount);
        });

        // ── 접근 제어 ───────────────────────────────────────────
        it("구매자가 release 시도 시 Unauthorized revert (핵심 보안)", async function () {
            const { escrow, buyer, tradeId } = await loadFixture(depositedFixture);
            await expect(
                escrow.connect(buyer).release(tradeId)
            ).to.be.revertedWithCustomError(escrow, "Unauthorized");
        });

        it("제3자가 release 시도 시 Unauthorized revert", async function () {
            const { escrow, attacker, tradeId } = await loadFixture(depositedFixture);
            await expect(
                escrow.connect(attacker).release(tradeId)
            ).to.be.revertedWithCustomError(escrow, "Unauthorized");
        });

        it("RELEASED 거래에 재호출 시 NotLocked revert (이중 릴리즈 방지)", async function () {
            const { escrow, seller, tradeId } = await loadFixture(depositedFixture);
            await escrow.connect(seller).release(tradeId);
            await expect(
                escrow.connect(seller).release(tradeId)
            ).to.be.revertedWithCustomError(escrow, "NotLocked");
        });

        it("DISPUTED 상태에서 release 시도 시 NotLocked revert", async function () {
            const { escrow, seller, tradeId } = await loadFixture(disputedFixture);
            await expect(
                escrow.connect(seller).release(tradeId)
            ).to.be.revertedWithCustomError(escrow, "NotLocked");
        });

        it("존재하지 않는 tradeId 로 release 시 TradeNotFound revert", async function () {
            const { escrow, seller } = await loadFixture(deployFixture);
            const fakeId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
            await expect(
                escrow.connect(seller).release(fakeId)
            ).to.be.revertedWithCustomError(escrow, "TradeNotFound");
        });
    });

    // ════════════════════════════════════════════════════════════
    //  4. refund() — 7일 타임락 환불
    // ════════════════════════════════════════════════════════════
    describe("4. refund() — 7일 타임락", function () {

        it("[HappyPath] 7일 경과 후 판매자가 전액 환불받는다", async function () {
            const { escrow, usdt, seller, tradeId, total } =
                await loadFixture(depositedFixture);

            await time.increase(SEVEN_DAYS + 1);

            const before = await usdt.balanceOf(seller.address);
            await escrow.connect(seller).refund(tradeId);
            const after  = await usdt.balanceOf(seller.address);

            expect(after - before).to.equal(total);  // amount + fee 전액
        });

        it("[HappyPath] 구매자도 7일 후 refund 트리거 가능 (판매자가 받음)", async function () {
            const { escrow, usdt, seller, buyer, tradeId, total } =
                await loadFixture(depositedFixture);

            await time.increase(SEVEN_DAYS + 1);

            const sellerBefore = await usdt.balanceOf(seller.address);
            await expect(escrow.connect(buyer).refund(tradeId))
                .to.emit(escrow, "TradeRefunded")
                .withArgs(tradeId, seller.address, total);

            expect(await usdt.balanceOf(seller.address)).to.equal(sellerBefore + total);
        });

        it("[HappyPath] 환불 후 상태가 REFUNDED 로 변경된다", async function () {
            const { escrow, seller, tradeId } = await loadFixture(depositedFixture);
            await time.increase(SEVEN_DAYS + 1);
            await escrow.connect(seller).refund(tradeId);
            expect((await escrow.getTrade(tradeId)).status).to.equal(TradeStatus.REFUNDED);
        });

        it("[HappyPath] 환불 금액에는 수수료가 포함된다 (amount + feeAmount)", async function () {
            const { escrow, usdt, seller, tradeId, amount, fee } =
                await loadFixture(depositedFixture);

            await time.increase(SEVEN_DAYS + 1);
            const before = await usdt.balanceOf(seller.address);
            await escrow.connect(seller).refund(tradeId);

            expect((await usdt.balanceOf(seller.address)) - before).to.equal(amount + fee);
        });

        // ── 시간 경계값 테스트 ──────────────────────────────────
        it("7일 미경과 (6일)에는 NotExpiredYet revert", async function () {
            const { escrow, seller, tradeId } = await loadFixture(depositedFixture);
            await time.increase(6 * 24 * 60 * 60);
            await expect(
                escrow.connect(seller).refund(tradeId)
            ).to.be.revertedWithCustomError(escrow, "NotExpiredYet");
        });

        it("7일 만료 1초 직전에도 NotExpiredYet revert", async function () {
            const { escrow, seller, tradeId } = await loadFixture(depositedFixture);
            // time.increase 는 블록을 채굴하므로 다음 tx 가 +1초 더 받음
            // setNextBlockTimestamp 로 refund tx 실행 블록을 expiresAt-1 로 정확히 타겟팅
            const { expiresAt } = await escrow.getTrade(tradeId);
            await time.setNextBlockTimestamp(Number(expiresAt) - 1);
            await expect(
                escrow.connect(seller).refund(tradeId)
            ).to.be.revertedWithCustomError(escrow, "NotExpiredYet");
        });

        it("정확히 7일 경과 시점(+0초)에는 refund 성공", async function () {
            const { escrow, seller, tradeId } = await loadFixture(depositedFixture);
            await time.increase(SEVEN_DAYS);
            // expiresAt = createdAt + 7days, block.timestamp >= expiresAt → 성공
            await expect(escrow.connect(seller).refund(tradeId))
                .to.emit(escrow, "TradeRefunded");
        });

        // ── 접근 제어 ───────────────────────────────────────────
        it("제3자가 refund 호출 시 Unauthorized revert", async function () {
            const { escrow, attacker, tradeId } = await loadFixture(depositedFixture);
            await time.increase(SEVEN_DAYS + 1);
            await expect(
                escrow.connect(attacker).refund(tradeId)
            ).to.be.revertedWithCustomError(escrow, "Unauthorized");
        });

        it("이미 RELEASED 거래에 refund 시도 시 NotLocked revert", async function () {
            const { escrow, seller, tradeId } = await loadFixture(depositedFixture);
            await escrow.connect(seller).release(tradeId);
            await time.increase(SEVEN_DAYS + 1);
            await expect(
                escrow.connect(seller).refund(tradeId)
            ).to.be.revertedWithCustomError(escrow, "NotLocked");
        });

        it("이중 환불 시도 시 NotLocked revert", async function () {
            const { escrow, seller, tradeId } = await loadFixture(depositedFixture);
            await time.increase(SEVEN_DAYS + 1);
            await escrow.connect(seller).refund(tradeId);
            await expect(
                escrow.connect(seller).refund(tradeId)
            ).to.be.revertedWithCustomError(escrow, "NotLocked");
        });
    });

    // ════════════════════════════════════════════════════════════
    //  5. dispute()
    // ════════════════════════════════════════════════════════════
    describe("5. dispute()", function () {

        it("[HappyPath] 판매자가 분쟁 신청 → DISPUTED 상태", async function () {
            const { escrow, seller, tradeId } = await loadFixture(depositedFixture);
            await expect(escrow.connect(seller).dispute(tradeId))
                .to.emit(escrow, "TradeDisputed")
                .withArgs(tradeId, seller.address);
            expect((await escrow.getTrade(tradeId)).status).to.equal(TradeStatus.DISPUTED);
        });

        it("[HappyPath] 구매자가 분쟁 신청 → DISPUTED 상태", async function () {
            const { escrow, buyer, tradeId } = await loadFixture(depositedFixture);
            await expect(escrow.connect(buyer).dispute(tradeId))
                .to.emit(escrow, "TradeDisputed")
                .withArgs(tradeId, buyer.address);
            expect((await escrow.getTrade(tradeId)).status).to.equal(TradeStatus.DISPUTED);
        });

        it("제3자가 dispute 호출 시 Unauthorized revert", async function () {
            const { escrow, attacker, tradeId } = await loadFixture(depositedFixture);
            await expect(
                escrow.connect(attacker).dispute(tradeId)
            ).to.be.revertedWithCustomError(escrow, "Unauthorized");
        });

        it("RELEASED 후 dispute 시도 시 NotLocked revert", async function () {
            const { escrow, seller, buyer, tradeId } = await loadFixture(depositedFixture);
            await escrow.connect(seller).release(tradeId);
            await expect(
                escrow.connect(buyer).dispute(tradeId)
            ).to.be.revertedWithCustomError(escrow, "NotLocked");
        });

        it("이미 DISPUTED 상태에서 재신청 시 NotLocked revert", async function () {
            const { escrow, seller, buyer, tradeId } = await loadFixture(depositedFixture);
            await escrow.connect(seller).dispute(tradeId);
            await expect(
                escrow.connect(buyer).dispute(tradeId)
            ).to.be.revertedWithCustomError(escrow, "NotLocked");
        });
    });

    // ════════════════════════════════════════════════════════════
    //  6. adminResolve() — 2-of-2 운영자 중재
    // ════════════════════════════════════════════════════════════
    describe("6. adminResolve() — 2-of-2 중재", function () {

        // ── 해피 케이스 ─────────────────────────────────────────
        it("[HappyPath] admin1 첫 투표 → DisputeVoted 이벤트만, DISPUTED 유지", async function () {
            const { escrow, admin1, tradeId } = await loadFixture(disputedFixture);

            await expect(escrow.connect(admin1).adminResolve(tradeId, true))
                .to.emit(escrow, "DisputeVoted")
                .withArgs(tradeId, admin1.address, true);

            // 아직 실행 전
            expect((await escrow.getTrade(tradeId)).status).to.equal(TradeStatus.DISPUTED);
            const p = await escrow.getProposal(tradeId);
            expect(p.admin1Voted).to.equal(true);
            expect(p.admin2Voted).to.equal(false);
        });

        it("[HappyPath] admin1+admin2 동일 결론 → 판매자 승리 (USDT 반환)", async function () {
            const { escrow, usdt, seller, feeRecipient, admin1, admin2, tradeId, amount, fee } =
                await loadFixture(disputedFixture);

            const sellerBefore = await usdt.balanceOf(seller.address);
            const feeBefore    = await usdt.balanceOf(feeRecipient.address);

            await escrow.connect(admin1).adminResolve(tradeId, true);
            await expect(escrow.connect(admin2).adminResolve(tradeId, true))
                .to.emit(escrow, "TradeResolved")
                .withArgs(tradeId, seller.address, amount);

            expect(await usdt.balanceOf(seller.address)).to.equal(sellerBefore + amount);
            expect(await usdt.balanceOf(feeRecipient.address)).to.equal(feeBefore + fee);
            expect((await escrow.getTrade(tradeId)).status).to.equal(TradeStatus.RELEASED);
        });

        it("[HappyPath] admin1+admin2 동일 결론 → 구매자 승리 (USDT 전달)", async function () {
            const { escrow, usdt, buyer, feeRecipient, admin1, admin2, tradeId, amount, fee } =
                await loadFixture(disputedFixture);

            const buyerBefore = await usdt.balanceOf(buyer.address);
            const feeBefore   = await usdt.balanceOf(feeRecipient.address);

            await escrow.connect(admin1).adminResolve(tradeId, false);
            await expect(escrow.connect(admin2).adminResolve(tradeId, false))
                .to.emit(escrow, "TradeResolved")
                .withArgs(tradeId, buyer.address, amount);

            expect(await usdt.balanceOf(buyer.address)).to.equal(buyerBefore + amount);
            expect(await usdt.balanceOf(feeRecipient.address)).to.equal(feeBefore + fee);
        });

        it("[HappyPath] admin2가 먼저, admin1이 두 번째 투표해도 정상 실행", async function () {
            const { escrow, usdt, seller, admin1, admin2, tradeId, amount } =
                await loadFixture(disputedFixture);

            // admin2 먼저 제안
            await expect(escrow.connect(admin2).adminResolve(tradeId, true))
                .to.emit(escrow, "DisputeVoted");

            // admin1 동의 → 실행
            const sellerBefore = await usdt.balanceOf(seller.address);
            await expect(escrow.connect(admin1).adminResolve(tradeId, true))
                .to.emit(escrow, "TradeResolved");

            expect(await usdt.balanceOf(seller.address)).to.equal(sellerBefore + amount);
        });

        // ── VoteMismatch 시나리오 ────────────────────────────────
        it("[VoteMismatch] admin 의견 불일치 → VoteMismatch revert", async function () {
            const { escrow, admin1, admin2, tradeId } = await loadFixture(disputedFixture);

            await escrow.connect(admin1).adminResolve(tradeId, true);   // 판매자 승리 제안
            await expect(
                escrow.connect(admin2).adminResolve(tradeId, false)     // 구매자 승리 → 불일치
            ).to.be.revertedWithCustomError(escrow, "VoteMismatch");
        });

        it("[VoteMismatch] Revert 시 admin2 의 투표가 롤백된다 (재투표 가능)", async function () {
            const { escrow, usdt, seller, admin1, admin2, tradeId, amount } =
                await loadFixture(disputedFixture);

            await escrow.connect(admin1).adminResolve(tradeId, true);

            // ① 불일치 투표 → revert (admin2Vote 롤백됨)
            await expect(
                escrow.connect(admin2).adminResolve(tradeId, false)
            ).to.be.revertedWithCustomError(escrow, "VoteMismatch");

            // ② admin2 의견 변경, 재투표 → 성공
            const sellerBefore = await usdt.balanceOf(seller.address);
            await expect(
                escrow.connect(admin2).adminResolve(tradeId, true)
            ).to.emit(escrow, "TradeResolved")
             .withArgs(tradeId, seller.address, amount);

            expect(await usdt.balanceOf(seller.address)).to.equal(sellerBefore + amount);
        });

        it("[VoteMismatch] admin1 먼저 제안, admin2 불일치 revert → proposal 상태 확인", async function () {
            const { escrow, admin1, admin2, tradeId } = await loadFixture(disputedFixture);

            await escrow.connect(admin1).adminResolve(tradeId, true);

            // VoteMismatch revert 시 admin2Voted 가 false 로 롤백되어야 함
            await expect(
                escrow.connect(admin2).adminResolve(tradeId, false)
            ).to.be.revertedWithCustomError(escrow, "VoteMismatch");

            const p = await escrow.getProposal(tradeId);
            expect(p.admin1Voted).to.equal(true);
            expect(p.admin2Voted).to.equal(false);  // 롤백 확인
        });

        // ── AlreadyVoted ────────────────────────────────────────
        it("[AlreadyVoted] admin1 중복 투표 시 AlreadyVoted revert", async function () {
            const { escrow, admin1, tradeId } = await loadFixture(disputedFixture);

            await escrow.connect(admin1).adminResolve(tradeId, true);
            await expect(
                escrow.connect(admin1).adminResolve(tradeId, true)
            ).to.be.revertedWithCustomError(escrow, "AlreadyVoted");
        });

        it("[AlreadyVoted] admin2 중복 투표 시 AlreadyVoted revert", async function () {
            const { escrow, admin2, tradeId } = await loadFixture(disputedFixture);

            await escrow.connect(admin2).adminResolve(tradeId, true);
            await expect(
                escrow.connect(admin2).adminResolve(tradeId, true)
            ).to.be.revertedWithCustomError(escrow, "AlreadyVoted");
        });

        // ── 접근 제어 ───────────────────────────────────────────
        it("어드민이 아닌 계정 호출 시 Unauthorized revert", async function () {
            const { escrow, attacker, tradeId } = await loadFixture(disputedFixture);
            await expect(
                escrow.connect(attacker).adminResolve(tradeId, true)
            ).to.be.revertedWithCustomError(escrow, "Unauthorized");
        });

        it("판매자가 직접 adminResolve 시도 시 Unauthorized revert", async function () {
            const { escrow, seller, tradeId } = await loadFixture(disputedFixture);
            await expect(
                escrow.connect(seller).adminResolve(tradeId, true)
            ).to.be.revertedWithCustomError(escrow, "Unauthorized");
        });

        // ── 상태 조건 ───────────────────────────────────────────
        it("LOCKED 상태에서 adminResolve 호출 시 NotDisputed revert", async function () {
            const { escrow, admin1, tradeId } = await loadFixture(depositedFixture);
            await expect(
                escrow.connect(admin1).adminResolve(tradeId, true)
            ).to.be.revertedWithCustomError(escrow, "NotDisputed");
        });

        // ── 시간 경계값 ─────────────────────────────────────────
        it("DisputeWindow 경과 후 (37일 + 1초) adminResolve 시 DisputeWindowExpired revert", async function () {
            const { escrow, admin1, tradeId } = await loadFixture(disputedFixture);
            await time.increase(THIRTYSEVEN_DAYS + 1);
            await expect(
                escrow.connect(admin1).adminResolve(tradeId, true)
            ).to.be.revertedWithCustomError(escrow, "DisputeWindowExpired");
        });

        it("DisputeWindow 내 (37일 - 1초) adminResolve 는 성공", async function () {
            const { escrow, admin1, admin2, tradeId } = await loadFixture(disputedFixture);
            const { expiresAt } = await escrow.getTrade(tradeId);
            const deadline = Number(expiresAt) + THIRTY_DAYS;
            // admin1 → deadline-1, admin2 → deadline (두 호출 모두 윈도우 내)
            await time.setNextBlockTimestamp(deadline - 1);
            await escrow.connect(admin1).adminResolve(tradeId, true);
            await time.setNextBlockTimestamp(deadline);
            await expect(
                escrow.connect(admin2).adminResolve(tradeId, true)
            ).to.emit(escrow, "TradeResolved");
        });
    });

    // ════════════════════════════════════════════════════════════
    //  7. forceRefundExpiredDispute() — 분쟁 방치 안전장치
    // ════════════════════════════════════════════════════════════
    describe("7. forceRefundExpiredDispute()", function () {

        it("[HappyPath] 37일 경과 후 누구나 판매자 강제 환불 가능", async function () {
            const { escrow, usdt, seller, attacker, tradeId, total } =
                await loadFixture(disputedFixture);

            await time.increase(THIRTYSEVEN_DAYS + 1);

            const sellerBefore = await usdt.balanceOf(seller.address);
            // attacker 가 트리거 → 돈은 판매자에게
            await expect(escrow.connect(attacker).forceRefundExpiredDispute(tradeId))
                .to.emit(escrow, "TradeRefunded")
                .withArgs(tradeId, seller.address, total);

            expect(await usdt.balanceOf(seller.address)).to.equal(sellerBefore + total);
        });

        it("[HappyPath] 강제 환불 후 상태가 REFUNDED 로 변경된다", async function () {
            const { escrow, seller, tradeId } = await loadFixture(disputedFixture);
            await time.increase(THIRTYSEVEN_DAYS + 1);
            await escrow.connect(seller).forceRefundExpiredDispute(tradeId);
            expect((await escrow.getTrade(tradeId)).status).to.equal(TradeStatus.REFUNDED);
        });

        it("[HappyPath] 강제 환불 금액 = amount + feeAmount (수수료 면제)", async function () {
            const { escrow, usdt, seller, tradeId, amount, fee } =
                await loadFixture(disputedFixture);

            await time.increase(THIRTYSEVEN_DAYS + 1);
            const before = await usdt.balanceOf(seller.address);
            await escrow.connect(seller).forceRefundExpiredDispute(tradeId);
            expect((await usdt.balanceOf(seller.address)) - before).to.equal(amount + fee);
        });

        it("분쟁 윈도우 내 (37일 미경과) 호출 시 NotExpiredYet revert", async function () {
            const { escrow, attacker, tradeId } = await loadFixture(disputedFixture);
            const { expiresAt } = await escrow.getTrade(tradeId);
            const deadline = Number(expiresAt) + THIRTY_DAYS;
            // deadline 정확히 = expiresAt+30d : <=  조건으로 여전히 revert
            await time.setNextBlockTimestamp(deadline);
            await expect(
                escrow.connect(attacker).forceRefundExpiredDispute(tradeId)
            ).to.be.revertedWithCustomError(escrow, "NotExpiredYet");
        });

        it("LOCKED 상태에서 호출 시 NotDisputed revert", async function () {
            const { escrow, attacker, tradeId } = await loadFixture(depositedFixture);
            await time.increase(THIRTYSEVEN_DAYS + 1);
            await expect(
                escrow.connect(attacker).forceRefundExpiredDispute(tradeId)
            ).to.be.revertedWithCustomError(escrow, "NotDisputed");
        });

        it("admin 이 부분 투표한 상태에서도 강제 환불 가능", async function () {
            const { escrow, usdt, seller, admin1, attacker, tradeId, total } =
                await loadFixture(disputedFixture);

            // admin1만 투표한 상태 (합의 미완료)
            await escrow.connect(admin1).adminResolve(tradeId, true);

            await time.increase(THIRTYSEVEN_DAYS + 1);

            const sellerBefore = await usdt.balanceOf(seller.address);
            await expect(
                escrow.connect(attacker).forceRefundExpiredDispute(tradeId)
            ).to.emit(escrow, "TradeRefunded");

            expect(await usdt.balanceOf(seller.address)).to.equal(sellerBefore + total);
        });
    });

    // ════════════════════════════════════════════════════════════
    //  8. changeAdmin()
    // ════════════════════════════════════════════════════════════
    describe("8. changeAdmin()", function () {

        it("[HappyPath] admin1이 admin2를 교체한다", async function () {
            const { escrow, admin1, admin2, stranger } = await loadFixture(deployFixture);
            await expect(escrow.connect(admin1).changeAdmin(2, stranger.address))
                .to.emit(escrow, "AdminChanged")
                .withArgs(2, admin2.address, stranger.address);
            expect(await escrow.admin2()).to.equal(stranger.address);
        });

        it("[HappyPath] admin2가 admin1을 교체한다", async function () {
            const { escrow, admin1, admin2, stranger } = await loadFixture(deployFixture);
            await expect(escrow.connect(admin2).changeAdmin(1, stranger.address))
                .to.emit(escrow, "AdminChanged")
                .withArgs(1, admin1.address, stranger.address);
            expect(await escrow.admin1()).to.equal(stranger.address);
        });

        it("[HappyPath] 자기 자신의 슬롯도 교체 가능 (키 로테이션)", async function () {
            const { escrow, admin1, stranger } = await loadFixture(deployFixture);
            await escrow.connect(admin1).changeAdmin(1, stranger.address);
            expect(await escrow.admin1()).to.equal(stranger.address);
        });

        it("비어드민 호출 시 Unauthorized revert", async function () {
            const { escrow, attacker, stranger } = await loadFixture(deployFixture);
            await expect(
                escrow.connect(attacker).changeAdmin(1, stranger.address)
            ).to.be.revertedWithCustomError(escrow, "Unauthorized");
        });

        it("newAdmin = address(0) 이면 ZeroAddress revert", async function () {
            const { escrow, admin1 } = await loadFixture(deployFixture);
            await expect(
                escrow.connect(admin1).changeAdmin(1, ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(escrow, "ZeroAddress");
        });

        it("slot = 0 이면 InvalidSlot revert", async function () {
            const { escrow, admin1, stranger } = await loadFixture(deployFixture);
            await expect(
                escrow.connect(admin1).changeAdmin(0, stranger.address)
            ).to.be.revertedWithCustomError(escrow, "InvalidSlot");
        });

        it("slot = 3 이면 InvalidSlot revert", async function () {
            const { escrow, admin1, stranger } = await loadFixture(deployFixture);
            await expect(
                escrow.connect(admin1).changeAdmin(3, stranger.address)
            ).to.be.revertedWithCustomError(escrow, "InvalidSlot");
        });

        it("admin 교체 후 이전 admin 은 권한을 상실한다", async function () {
            const { escrow, admin1, admin2, stranger, tradeId } =
                await loadFixture(disputedFixture);

            // admin2를 stranger로 교체
            await escrow.connect(admin1).changeAdmin(2, stranger.address);

            // 이전 admin2: 권한 없음
            await expect(
                escrow.connect(admin2).adminResolve(tradeId, true)
            ).to.be.revertedWithCustomError(escrow, "Unauthorized");

            // 새 admin(stranger): 투표 가능
            await expect(
                escrow.connect(stranger).adminResolve(tradeId, true)
            ).to.emit(escrow, "DisputeVoted");
        });
    });

    // ════════════════════════════════════════════════════════════
    //  9. 상태 전환 무결성 (불법 전환 완전 차단)
    // ════════════════════════════════════════════════════════════
    describe("9. 상태 전환 무결성", function () {

        it("RELEASED → refund 불가 (NotLocked)", async function () {
            const { escrow, seller, tradeId } = await loadFixture(depositedFixture);
            await escrow.connect(seller).release(tradeId);
            await time.increase(SEVEN_DAYS + 1);
            await expect(
                escrow.connect(seller).refund(tradeId)
            ).to.be.revertedWithCustomError(escrow, "NotLocked");
        });

        it("RELEASED → dispute 불가 (NotLocked)", async function () {
            const { escrow, seller, buyer, tradeId } = await loadFixture(depositedFixture);
            await escrow.connect(seller).release(tradeId);
            await expect(
                escrow.connect(buyer).dispute(tradeId)
            ).to.be.revertedWithCustomError(escrow, "NotLocked");
        });

        it("RELEASED → adminResolve 불가 (NotDisputed)", async function () {
            const { escrow, seller, admin1, tradeId } = await loadFixture(depositedFixture);
            await escrow.connect(seller).release(tradeId);
            await expect(
                escrow.connect(admin1).adminResolve(tradeId, true)
            ).to.be.revertedWithCustomError(escrow, "NotDisputed");
        });

        it("REFUNDED → release 불가 (NotLocked)", async function () {
            const { escrow, seller, tradeId } = await loadFixture(depositedFixture);
            await time.increase(SEVEN_DAYS + 1);
            await escrow.connect(seller).refund(tradeId);
            await expect(
                escrow.connect(seller).release(tradeId)
            ).to.be.revertedWithCustomError(escrow, "NotLocked");
        });

        it("REFUNDED → dispute 불가 (NotLocked)", async function () {
            const { escrow, seller, buyer, tradeId } = await loadFixture(depositedFixture);
            await time.increase(SEVEN_DAYS + 1);
            await escrow.connect(seller).refund(tradeId);
            await expect(
                escrow.connect(buyer).dispute(tradeId)
            ).to.be.revertedWithCustomError(escrow, "NotLocked");
        });

        it("DISPUTED → refund 불가 (NotLocked) — 분쟁 중 환불 우회 차단", async function () {
            const { escrow, seller, tradeId } = await loadFixture(disputedFixture);
            await time.increase(SEVEN_DAYS + 1);
            await expect(
                escrow.connect(seller).refund(tradeId)
            ).to.be.revertedWithCustomError(escrow, "NotLocked");
        });

        it("DISPUTED → release 불가 (NotLocked)", async function () {
            const { escrow, seller, tradeId } = await loadFixture(disputedFixture);
            await expect(
                escrow.connect(seller).release(tradeId)
            ).to.be.revertedWithCustomError(escrow, "NotLocked");
        });

        it("DISPUTED → dispute 재신청 불가 (NotLocked)", async function () {
            const { escrow, buyer, tradeId } = await loadFixture(disputedFixture);
            await expect(
                escrow.connect(buyer).dispute(tradeId)
            ).to.be.revertedWithCustomError(escrow, "NotLocked");
        });
    });

    // ════════════════════════════════════════════════════════════
    //  10. 보안 엣지 케이스
    // ════════════════════════════════════════════════════════════
    describe("10. 보안 엣지 케이스", function () {

        it("[보안] 존재하지 않는 tradeId 로 모든 쓰기 함수 호출 시 TradeNotFound revert", async function () {
            const { escrow, seller, admin1 } = await loadFixture(deployFixture);
            const fakeId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent_trade"));

            for (const call of [
                () => escrow.connect(seller).release(fakeId),
                () => escrow.connect(seller).refund(fakeId),
                () => escrow.connect(seller).dispute(fakeId),
                () => escrow.connect(admin1).adminResolve(fakeId, true),
                () => escrow.connect(seller).forceRefundExpiredDispute(fakeId),
            ]) {
                await expect(call())
                    .to.be.revertedWithCustomError(escrow, "TradeNotFound");
            }
        });

        it("[보안] TransferFailed — deposit 시 transferFrom 이 false 반환", async function () {
            const { escrow, usdt, seller, buyer } = await loadFixture(deployFixture);
            const total = calcTotal(AMOUNT_100);
            await usdt.connect(seller).approve(escrow.target, total);

            await usdt.setFailTransferFrom(true);
            await expect(
                escrow.connect(seller).deposit(buyer.address, AMOUNT_100)
            ).to.be.revertedWithCustomError(escrow, "TransferFailed");
        });

        it("[보안] TransferFailed — release 시 transfer 가 false 반환, 상태 롤백 확인", async function () {
            const { escrow, usdt, seller, tradeId } = await loadFixture(depositedFixture);

            await usdt.setFailTransfer(true);
            await expect(
                escrow.connect(seller).release(tradeId)
            ).to.be.revertedWithCustomError(escrow, "TransferFailed");

            // 전체 revert → status 도 LOCKED 으로 롤백
            expect((await escrow.getTrade(tradeId)).status).to.equal(TradeStatus.LOCKED);
        });

        it("[보안] TransferFailed — refund 시 transfer 가 false 반환", async function () {
            const { escrow, usdt, seller, tradeId } = await loadFixture(depositedFixture);
            await time.increase(SEVEN_DAYS + 1);

            await usdt.setFailTransfer(true);
            await expect(
                escrow.connect(seller).refund(tradeId)
            ).to.be.revertedWithCustomError(escrow, "TransferFailed");

            // 롤백 → LOCKED 상태 유지
            expect((await escrow.getTrade(tradeId)).status).to.equal(TradeStatus.LOCKED);
        });

        it("[보안] AmountOverflow — uint128 최대값 + 1 입력", async function () {
            const { escrow, seller, buyer } = await loadFixture(deployFixture);
            await expect(
                escrow.connect(seller).deposit(buyer.address, 2n ** 128n)
            ).to.be.revertedWithCustomError(escrow, "AmountOverflow");
        });

        it("[보안] uint128 최대값 자체는 overflow 아님 (잔액 부족으로 ERC20 revert)", async function () {
            const { escrow, usdt, seller, buyer } = await loadFixture(deployFixture);
            const maxU128 = 2n ** 128n - 1n;
            await usdt.connect(seller).approve(escrow.target, maxU128);
            // AmountOverflow 는 아니지만 잔액 부족으로 ERC20 에서 revert
            await expect(
                escrow.connect(seller).deposit(buyer.address, maxU128)
            ).to.be.reverted;
        });

        it("[보안] 동시 다수 거래 — 각 tradeId 는 독립적, 서로 간섭 없음", async function () {
            const { escrow, usdt, seller, buyer } = await loadFixture(deployFixture);
            const amount = AMOUNT_100;
            const total  = calcTotal(amount);
            const N      = 3;

            await usdt.mint(seller.address, total * BigInt(N));
            await usdt.connect(seller).approve(escrow.target, total * BigInt(N));

            const ids = [];
            for (let i = 0; i < N; i++) {
                ids.push(await depositAndGetTradeId(escrow, usdt, seller, buyer, amount));
            }

            // 모두 유니크
            expect(new Set(ids).size).to.equal(N);
            // 첫 거래만 release → 나머지는 여전히 LOCKED
            await escrow.connect(seller).release(ids[0]);
            expect((await escrow.getTrade(ids[0])).status).to.equal(TradeStatus.RELEASED);
            expect((await escrow.getTrade(ids[1])).status).to.equal(TradeStatus.LOCKED);
            expect((await escrow.getTrade(ids[2])).status).to.equal(TradeStatus.LOCKED);
        });

        it("[보안] admin1==admin2 설정 시 2-of-2 우회 불가 (AlreadyVoted)", async function () {
            const { escrow, admin1, admin2, stranger, tradeId } =
                await loadFixture(disputedFixture);

            // admin2 를 admin1 주소로 교체 → admin1 == admin2
            await escrow.connect(admin1).changeAdmin(2, admin1.address);

            // admin1 첫 투표
            await escrow.connect(admin1).adminResolve(tradeId, true);

            // 동일 주소(admin1=admin2)로 재호출 → admin1 경로 → AlreadyVoted
            await expect(
                escrow.connect(admin1).adminResolve(tradeId, true)
            ).to.be.revertedWithCustomError(escrow, "AlreadyVoted");
        });

        it("[보안] ETH 전송 거부 (receive)", async function () {
            const { escrow, seller } = await loadFixture(deployFixture);
            await expect(
                seller.sendTransaction({ to: escrow.target, value: 1n })
            ).to.be.reverted;
        });

        it("[보안] ETH 전송 거부 (fallback — data 포함)", async function () {
            const { escrow, seller } = await loadFixture(deployFixture);
            await expect(
                seller.sendTransaction({
                    to   : escrow.target,
                    value: 1n,
                    data : "0xcafebabe",
                })
            ).to.be.reverted;
        });
    });

    // ════════════════════════════════════════════════════════════
    //  11. 뷰 함수 단위 테스트
    // ════════════════════════════════════════════════════════════
    describe("11. 뷰 함수", function () {

        it("getTrade() — 존재하지 않는 tradeId 는 빈 구조체 반환 (seller = address(0))", async function () {
            const { escrow } = await loadFixture(deployFixture);
            const fakeId = ethers.keccak256(ethers.toUtf8Bytes("none"));
            const trade  = await escrow.getTrade(fakeId);
            expect(trade.seller).to.equal(ethers.ZeroAddress);
        });

        it("isRefundable() — 만료 전: false, 만료 후: true", async function () {
            const { escrow, tradeId } = await loadFixture(depositedFixture);
            expect(await escrow.isRefundable(tradeId)).to.equal(false);
            await time.increase(SEVEN_DAYS);
            expect(await escrow.isRefundable(tradeId)).to.equal(true);
        });

        it("isRefundable() — RELEASED 후에는 false", async function () {
            const { escrow, seller, tradeId } = await loadFixture(depositedFixture);
            await escrow.connect(seller).release(tradeId);
            await time.increase(SEVEN_DAYS + 1);
            expect(await escrow.isRefundable(tradeId)).to.equal(false);
        });

        it("totalLocked() — 예치 후 증가, 릴리즈 후 0", async function () {
            const { escrow, usdt, seller, buyer } = await loadFixture(deployFixture);
            const amount = AMOUNT_100;
            const total  = calcTotal(amount);

            expect(await escrow.totalLocked()).to.equal(0n);

            const tradeId = await depositAndGetTradeId(escrow, usdt, seller, buyer, amount);
            expect(await escrow.totalLocked()).to.equal(total);

            await escrow.connect(seller).release(tradeId);
            expect(await escrow.totalLocked()).to.equal(0n);
        });

        it("totalLocked() — 다수 거래의 합산을 정확히 반영한다", async function () {
            const { escrow, usdt, seller, buyer } = await loadFixture(deployFixture);
            const amount = AMOUNT_100;
            const total  = calcTotal(amount);
            const N      = 3n;

            await usdt.mint(seller.address, total * N);
            await usdt.connect(seller).approve(escrow.target, total * N);

            for (let i = 0n; i < N; i++) {
                await escrow.connect(seller).deposit(buyer.address, amount);
            }

            expect(await escrow.totalLocked()).to.equal(total * N);
        });

        it("calcTotal() — 100 USDT 의 total 과 fee 가 정확하다", async function () {
            const { escrow } = await loadFixture(deployFixture);
            const [total, fee] = await escrow.calcTotal(AMOUNT_100);
            expect(fee).to.equal(2n * ONE_USDT);         // 2 USDT
            expect(total).to.equal(102n * ONE_USDT);     // 102 USDT
        });

        it("getProposal() — 투표 전 초기값은 모두 false", async function () {
            const { escrow, tradeId } = await loadFixture(disputedFixture);
            const p = await escrow.getProposal(tradeId);
            expect(p.admin1Voted).to.equal(false);
            expect(p.admin2Voted).to.equal(false);
            expect(p.toSeller).to.equal(false);
        });

        it("getProposal() — 첫 투표 후 상태 정확히 반영", async function () {
            const { escrow, admin2, tradeId } = await loadFixture(disputedFixture);
            await escrow.connect(admin2).adminResolve(tradeId, false);
            const p = await escrow.getProposal(tradeId);
            expect(p.admin1Voted).to.equal(false);
            expect(p.admin2Voted).to.equal(true);
            expect(p.toSeller).to.equal(false);
        });
    });

    // ════════════════════════════════════════════════════════════
    //  12. E2E 통합 테스트
    // ════════════════════════════════════════════════════════════
    describe("12. E2E 통합 테스트", function () {

        it("[E2E-A] 플로우 A 정상 완료: deposit → release (KRW 확인 후 USDT 전달)", async function () {
            const { escrow, usdt, seller, buyer, feeRecipient } =
                await loadFixture(deployFixture);

            const amount = AMOUNT_500;
            const fee    = calcFee(amount);
            const total  = amount + fee;

            // ── ① 판매자 USDT approve + 에스크로 락
            const tradeId = await depositAndGetTradeId(escrow, usdt, seller, buyer, amount);
            expect(await usdt.balanceOf(escrow.target)).to.equal(total);

            // ── ② (오프체인) 구매자 KRW 송금 시뮬레이션

            // ── ③ 판매자 KRW 입금 확인 → release
            await escrow.connect(seller).release(tradeId);

            // ── ④ 최종 잔액 검증
            expect(await usdt.balanceOf(buyer.address)).to.equal(amount);
            expect(await usdt.balanceOf(feeRecipient.address)).to.equal(fee);
            expect(await usdt.balanceOf(escrow.target)).to.equal(0n);
            expect((await escrow.getTrade(tradeId)).status).to.equal(TradeStatus.RELEASED);
        });

        it("[E2E-B] 타임아웃 시나리오: deposit → 7일 경과 → refund", async function () {
            const { escrow, usdt, seller, buyer } = await loadFixture(deployFixture);

            const amount = AMOUNT_100;
            const total  = calcTotal(amount);
            const tradeId = await depositAndGetTradeId(escrow, usdt, seller, buyer, amount);

            // ── 7일 경과 (구매자 KRW 미송금)
            await time.increase(SEVEN_DAYS + 1);

            const sellerBefore = await usdt.balanceOf(seller.address);
            await escrow.connect(seller).refund(tradeId);

            expect(await usdt.balanceOf(seller.address)).to.equal(sellerBefore + total);
            expect(await usdt.balanceOf(escrow.target)).to.equal(0n);
        });

        it("[E2E-C] 분쟁 시나리오 — 판매자 승리: deposit → dispute → 2-of-2 → seller wins", async function () {
            const { escrow, usdt, seller, buyer, feeRecipient, admin1, admin2 } =
                await loadFixture(deployFixture);

            const amount = AMOUNT_100;
            const fee    = calcFee(amount);
            const total  = calcTotal(amount);

            const tradeId = await depositAndGetTradeId(escrow, usdt, seller, buyer, amount);

            // ── 구매자가 분쟁 신청
            await escrow.connect(buyer).dispute(tradeId);

            // ── 운영자 2명 판매자 승리 판정
            await escrow.connect(admin1).adminResolve(tradeId, true);
            await escrow.connect(admin2).adminResolve(tradeId, true);

            // ── 검증: 판매자 amount 수령, feeRecipient fee 수령
            expect(await usdt.balanceOf(seller.address)).to.equal(
                SELLER_INIT_BALANCE - total + amount  // 초기 - 예치 + 환급
            );
            expect(await usdt.balanceOf(feeRecipient.address)).to.equal(fee);
            expect(await usdt.balanceOf(buyer.address)).to.equal(0n);
        });

        it("[E2E-D] 분쟁 시나리오 — 구매자 승리: deposit → dispute → 2-of-2 → buyer wins", async function () {
            const { escrow, usdt, seller, buyer, feeRecipient, admin1, admin2 } =
                await loadFixture(deployFixture);

            const amount = AMOUNT_100;
            const fee    = calcFee(amount);
            const total  = calcTotal(amount);

            const tradeId = await depositAndGetTradeId(escrow, usdt, seller, buyer, amount);

            await escrow.connect(seller).dispute(tradeId);
            await escrow.connect(admin1).adminResolve(tradeId, false);  // 구매자 승리
            await escrow.connect(admin2).adminResolve(tradeId, false);

            expect(await usdt.balanceOf(buyer.address)).to.equal(amount);
            expect(await usdt.balanceOf(feeRecipient.address)).to.equal(fee);
            // 판매자는 fee 만 손해
            expect(await usdt.balanceOf(seller.address)).to.equal(SELLER_INIT_BALANCE - total);
        });

        it("[E2E-E] 분쟁 VoteMismatch 후 재합의: deposit → dispute → mismatch → retry → resolved", async function () {
            const { escrow, usdt, buyer, feeRecipient, admin1, admin2 } =
                await loadFixture(deployFixture);

            const amount  = AMOUNT_100;
            const fee     = calcFee(amount);
            const { seller } = await loadFixture(deployFixture);

            // 새 픽스처에서 직접 처리
            const { escrow: esc2, usdt: usdt2, seller: s2, buyer: b2,
                    feeRecipient: fp2, admin1: a1, admin2: a2 } =
                await loadFixture(deployFixture);

            const tradeId = await depositAndGetTradeId(esc2, usdt2, s2, b2, amount);
            await esc2.connect(b2).dispute(tradeId);

            // admin1: 판매자 승리 제안
            await esc2.connect(a1).adminResolve(tradeId, true);

            // admin2: 구매자 승리 → VoteMismatch revert
            await expect(
                esc2.connect(a2).adminResolve(tradeId, false)
            ).to.be.revertedWithCustomError(esc2, "VoteMismatch");

            // admin2 의견 변경 → 재합의 → 판매자 승리 실행
            const sellerBefore = await usdt2.balanceOf(s2.address);
            await esc2.connect(a2).adminResolve(tradeId, true);

            expect(await usdt2.balanceOf(s2.address)).to.equal(sellerBefore + amount);
            expect(await usdt2.balanceOf(fp2.address)).to.equal(calcFee(amount));
        });

        it("[E2E-F] 분쟁 방치 시나리오: deposit → dispute → 37일 → 누구나 강제 환불", async function () {
            const { escrow, usdt, seller, buyer, attacker } =
                await loadFixture(deployFixture);

            const amount  = AMOUNT_100;
            const total   = calcTotal(amount);
            const tradeId = await depositAndGetTradeId(escrow, usdt, seller, buyer, amount);

            await escrow.connect(seller).dispute(tradeId);
            await time.increase(THIRTYSEVEN_DAYS + 1);

            const sellerBefore = await usdt.balanceOf(seller.address);
            await escrow.connect(attacker).forceRefundExpiredDispute(tradeId);

            expect(await usdt.balanceOf(seller.address)).to.equal(sellerBefore + total);
            expect(await usdt.balanceOf(escrow.target)).to.equal(0n);
        });
    });

}); // end describe("MiniSwapEscrow")
