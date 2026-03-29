// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ShadowPool — Liquidity Pool for ShadowPerps
/// @notice LP providers deposit USDC and receive spUSDC tokens.
///         The pool acts as counterparty to all trades.
///         Trader profits are paid from the pool, losses go to the pool.
///         Trading fees are distributed to LP holders as yield.
contract ShadowPool is ERC20, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    /// @notice The ShadowPerps contract (can deposit/withdraw from pool)
    address public perpsContract;

    /// @notice Total USDC deposited by LPs (excludes trader collateral)
    uint256 public totalDeposited;

    /// @notice Accumulated fees earned by pool
    uint256 public totalFeesEarned;

    /// @notice Accumulated trader losses absorbed by pool
    uint256 public totalTraderLosses;

    /// @notice Accumulated trader profits paid by pool
    uint256 public totalTraderProfits;

    event Deposit(address indexed provider, uint256 usdcAmount, uint256 lpTokensMinted);
    event Withdraw(address indexed provider, uint256 usdcAmount, uint256 lpTokensBurned);
    event TraderPayout(uint256 amount);
    event TraderLoss(uint256 amount);
    event FeeCollected(uint256 amount);

    constructor(address _usdc) ERC20("ShadowPerps LP", "spUSDC") Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }

    function setPerpsContract(address _perps) external onlyOwner {
        perpsContract = _perps;
    }

    // ══════════════════════════════════════════════
    //  LP Deposit / Withdraw
    // ══════════════════════════════════════════════

    /// @notice Deposit USDC into the pool, receive spUSDC LP tokens
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Calculate LP tokens to mint
        // If pool is empty: 1 USDC = 1 spUSDC
        // Otherwise: proportional to pool value
        uint256 lpTokens;
        uint256 supply = totalSupply();
        uint256 poolValue = getPoolValue();

        if (supply == 0 || poolValue == 0) {
            lpTokens = amount;
        } else {
            lpTokens = (amount * supply) / poolValue;
        }

        totalDeposited += amount;
        _mint(msg.sender, lpTokens);

        emit Deposit(msg.sender, amount, lpTokens);
    }

    /// @notice Withdraw USDC from pool by burning spUSDC LP tokens
    function withdraw(uint256 lpTokens) external nonReentrant {
        require(lpTokens > 0, "Zero amount");
        require(balanceOf(msg.sender) >= lpTokens, "Insufficient LP tokens");

        uint256 supply = totalSupply();
        uint256 poolValue = getPoolValue();

        // Calculate USDC to return proportional to share
        uint256 usdcAmount = (lpTokens * poolValue) / supply;

        // Cap to available balance
        uint256 available = usdc.balanceOf(address(this));
        if (usdcAmount > available) {
            usdcAmount = available;
        }

        _burn(msg.sender, lpTokens);
        if (usdcAmount > 0) {
            totalDeposited = totalDeposited > usdcAmount ? totalDeposited - usdcAmount : 0;
            usdc.safeTransfer(msg.sender, usdcAmount);
        }

        emit Withdraw(msg.sender, usdcAmount, lpTokens);
    }

    // ══════════════════════════════════════════════
    //  Perps Contract Interface (only callable by ShadowPerps)
    // ══════════════════════════════════════════════

    modifier onlyPerps() {
        require(msg.sender == perpsContract, "Only perps contract");
        _;
    }

    /// @notice Pay trader profit from pool (called by ShadowPerps on close)
    function payTrader(address trader, uint256 amount) external onlyPerps {
        require(amount > 0, "Zero amount");
        uint256 available = usdc.balanceOf(address(this));
        uint256 payout = amount > available ? available : amount;

        totalTraderProfits += payout;
        usdc.safeTransfer(trader, payout);

        emit TraderPayout(payout);
    }

    /// @notice Receive trader loss into pool (called by ShadowPerps on close/liquidation)
    function receiveTraderLoss(uint256 amount) external onlyPerps {
        totalTraderLosses += amount;
        emit TraderLoss(amount);
    }

    /// @notice Receive trading fee into pool
    function receiveFee(uint256 amount) external onlyPerps {
        totalFeesEarned += amount;
        emit FeeCollected(amount);
    }

    // ══════════════════════════════════════════════
    //  Views
    // ══════════════════════════════════════════════

    /// @notice Total USDC value of the pool
    function getPoolValue() public view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /// @notice Price of 1 spUSDC in USDC (6 decimals)
    function getLpTokenPrice() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 1e6; // 1:1
        return (getPoolValue() * 1e6) / supply;
    }

    /// @notice Pool utilization ratio (0-100, in percentage)
    function getUtilization() external view returns (uint256) {
        uint256 poolVal = getPoolValue();
        if (poolVal == 0) return 0;
        // Utilization = trader profits exposure / pool value
        // Simplified: use deposited vs current value
        if (totalDeposited == 0) return 0;
        uint256 used = totalDeposited > poolVal ? totalDeposited - poolVal : 0;
        return (used * 100) / totalDeposited;
    }

    /// @notice Pool stats for frontend
    function getPoolStats() external view returns (
        uint256 tvl,
        uint256 lpSupply,
        uint256 lpPrice,
        uint256 feesEarned,
        uint256 traderProfits,
        uint256 traderLosses
    ) {
        uint256 supply = totalSupply();
        uint256 price = supply == 0 ? 1e6 : (getPoolValue() * 1e6) / supply;
        return (
            getPoolValue(),
            supply,
            price,
            totalFeesEarned,
            totalTraderProfits,
            totalTraderLosses
        );
    }
}
