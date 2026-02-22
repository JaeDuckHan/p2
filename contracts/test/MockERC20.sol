// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title  MockERC20
 * @notice MiniSwapEscrow 테스트용 ERC-20 목(Mock) 토큰
 * @dev    - mint(): 임의 주소에 토큰 발행 (테스트용)
 *         - setFailTransfer() / setFailTransferFrom(): 실패 시나리오 시뮬레이션
 *           → TransferFailed 커스텀 에러 경로 테스트에 사용
 */
contract MockERC20 {

    // ── 메타데이터 ───────────────────────────────────────────────
    string  public name;
    string  public symbol;
    uint8   public decimals;
    uint256 public totalSupply;

    // ── 잔액 / 허용량 ────────────────────────────────────────────
    mapping(address => uint256)                     public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // ── 실패 플래그 (테스트 전용) ────────────────────────────────
    bool public failTransfer;        // transfer()     강제 실패 플래그
    bool public failTransferFrom;    // transferFrom() 강제 실패 플래그

    // ── 이벤트 ───────────────────────────────────────────────────
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ════════════════════════════════════════════════════════════
    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name     = _name;
        symbol   = _symbol;
        decimals = _decimals;
    }

    // ── 토큰 발행 (테스트 전용) ──────────────────────────────────
    function mint(address to, uint256 amount) external {
        totalSupply      += amount;
        balanceOf[to]    += amount;
        emit Transfer(address(0), to, amount);
    }

    // ── 실패 플래그 설정 (테스트 전용) ──────────────────────────
    function setFailTransfer(bool _fail)     external { failTransfer     = _fail; }
    function setFailTransferFrom(bool _fail) external { failTransferFrom = _fail; }

    // ── ERC-20 핵심 함수 ─────────────────────────────────────────
    function transfer(address to, uint256 amount) external returns (bool) {
        if (failTransfer) return false;                      // 강제 실패 시뮬레이션
        require(balanceOf[msg.sender] >= amount, "ERC20: insufficient balance");
        unchecked {
            balanceOf[msg.sender] -= amount;
            balanceOf[to]         += amount;
        }
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (failTransferFrom) return false;                  // 강제 실패 시뮬레이션
        require(balanceOf[from]              >= amount, "ERC20: insufficient balance");
        require(allowance[from][msg.sender]  >= amount, "ERC20: insufficient allowance");
        unchecked {
            allowance[from][msg.sender] -= amount;
            balanceOf[from]             -= amount;
            balanceOf[to]               += amount;
        }
        emit Transfer(from, to, amount);
        return true;
    }
}
