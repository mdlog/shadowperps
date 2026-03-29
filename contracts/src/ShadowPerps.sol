// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IPriceOracle {
    function getPrice(string calldata symbol) external view returns (uint256 price, uint256 updatedAt);
}

interface IShadowPool {
    function payTrader(address trader, uint256 amount) external;
    function receiveTraderLoss(uint256 amount) external;
    function receiveFee(uint256 amount) external;
}

/// @title ShadowPerps — Confidential perpetuals with CoFHE request/finalize flows
/// @notice Direction + size are verified as encrypted inputs and kept private while positions remain open.
contract ShadowPerps is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum PositionStatus { Open, Closed, Liquidated }

    struct Position {
        address trader;
        bytes32 marketId;
        ebool encryptedDirection;     // true = long, false = short
        euint128 encryptedSize;       // private notional size
        uint256 collateral;           // public USDC collateral after fee
        uint256 entryPrice;           // public oracle price (8 decimals)
        uint256 openedAt;
        PositionStatus status;
    }

    struct PendingOpenRequest {
        address trader;
        bytes32 marketId;
        ebool encryptedDirection;
        euint128 encryptedSize;
        ebool encryptedCanOpen;
        uint256 collateral;
    }

    IPriceOracle public oracle;
    IERC20 public immutable usdc;
    IShadowPool public pool;

    uint256 public positionCount;
    uint256 public openRequestCount;
    uint256 public maxLeverage = 50;
    uint256 public tradingFeeRate = 10;
    uint256 public constant FEE_DENOMINATOR = 10000;

    mapping(uint256 => Position) private positions;
    mapping(uint256 => PendingOpenRequest) private pendingOpenRequests;
    mapping(uint256 => euint128) private pendingClosePayouts;
    mapping(uint256 => ebool) private pendingLiquidationChecks;
    mapping(address => uint256[]) public traderPositions;

    mapping(bytes32 => bool) public supportedMarkets;
    mapping(bytes32 => string) public marketSymbols;

    event OpenValidationRequested(
        uint256 indexed requestId,
        address indexed trader,
        bytes32 indexed marketId,
        bytes32 validationCtHash
    );
    event PositionOpened(uint256 indexed positionId, address indexed trader, bytes32 indexed marketId, uint256 collateral);
    event CloseRequested(uint256 indexed positionId, bytes32 payoutCtHash, uint256 exitPrice);
    event PositionClosed(uint256 indexed positionId, address indexed trader, uint256 payout, int256 pnl);
    event LiquidationCheckRequested(uint256 indexed positionId, bytes32 canLiquidateCtHash, uint256 price);
    event PositionLiquidated(uint256 indexed positionId, address indexed trader, uint256 collateralLost);
    event MarketAdded(bytes32 indexed marketId, string symbol);

    constructor(address _oracle, address _usdc, address _pool) Ownable(msg.sender) {
        oracle = IPriceOracle(_oracle);
        usdc = IERC20(_usdc);
        pool = IShadowPool(_pool);
    }

    function setOracle(address _oracle) external onlyOwner { oracle = IPriceOracle(_oracle); }
    function setPool(address _pool) external onlyOwner { pool = IShadowPool(_pool); }

    function addMarket(string calldata symbol) external onlyOwner {
        bytes32 marketId = keccak256(abi.encodePacked(symbol));
        require(!supportedMarkets[marketId], "Exists");
        supportedMarkets[marketId] = true;
        marketSymbols[marketId] = symbol;
        emit MarketAdded(marketId, symbol);
    }

    /// @notice First step of opening a position.
    /// @dev Stores encrypted inputs and creates an encrypted validation result proving the hidden notional
    ///      fits within the public collateral * maxLeverage limit.
    function requestOpenPosition(
        string calldata symbol,
        uint256 collateralUsdc,
        InEbool calldata directionInput,
        InEuint128 calldata sizeInput
    ) external nonReentrant returns (uint256 requestId) {
        bytes32 marketId = keccak256(abi.encodePacked(symbol));
        require(supportedMarkets[marketId], "Not supported");
        require(collateralUsdc > 0, "Zero");

        ebool encDirection = FHE.asEbool(directionInput);
        euint128 encSize = FHE.asEuint128(sizeInput);

        FHE.allowThis(encDirection);
        FHE.allowSender(encDirection);
        FHE.allowThis(encSize);
        FHE.allowSender(encSize);

        ebool encPositive = FHE.gt(encSize, _publicUint128(0));
        ebool encWithinMax = FHE.lte(encSize, _publicUint128(collateralUsdc * maxLeverage));
        ebool encCanOpen = FHE.and(encPositive, encWithinMax);

        FHE.allowThis(encCanOpen);
        FHE.allowSender(encCanOpen);

        requestId = openRequestCount++;
        PendingOpenRequest storage req = pendingOpenRequests[requestId];
        req.trader = msg.sender;
        req.marketId = marketId;
        req.encryptedDirection = encDirection;
        req.encryptedSize = encSize;
        req.encryptedCanOpen = encCanOpen;
        req.collateral = collateralUsdc;

        emit OpenValidationRequested(requestId, msg.sender, marketId, ebool.unwrap(encCanOpen));
    }

    /// @notice Finalize an open request after decrypting the validation boolean client-side.
    /// @dev Fee is charged on collateral rather than notional so hidden size stays private at open.
    function finalizeOpenPosition(
        uint256 requestId,
        bool canOpen,
        bytes calldata signature
    ) external nonReentrant returns (uint256 positionId_) {
        PendingOpenRequest storage req = pendingOpenRequests[requestId];
        require(req.trader == msg.sender, "Not owner");
        require(req.collateral > 0, "Bad request");
        require(FHE.verifyDecryptResult(req.encryptedCanOpen, canOpen, signature), "Bad decrypt proof");
        require(canOpen, "Open validation failed");

        usdc.safeTransferFrom(msg.sender, address(this), req.collateral);

        uint256 fee = (req.collateral * tradingFeeRate) / FEE_DENOMINATOR;
        uint256 collAfterFee = req.collateral - fee;
        if (fee > 0) {
            usdc.safeTransfer(address(pool), fee);
            pool.receiveFee(fee);
        }

        string memory symbol = marketSymbols[req.marketId];
        (uint256 price, ) = oracle.getPrice(symbol);

        positionId_ = positionCount++;
        Position storage pos = positions[positionId_];
        pos.trader = msg.sender;
        pos.marketId = req.marketId;
        pos.encryptedDirection = req.encryptedDirection;
        pos.encryptedSize = req.encryptedSize;
        pos.collateral = collAfterFee;
        pos.entryPrice = price;
        pos.openedAt = block.timestamp;
        pos.status = PositionStatus.Open;

        traderPositions[msg.sender].push(positionId_);
        delete pendingOpenRequests[requestId];

        emit PositionOpened(positionId_, msg.sender, pos.marketId, collAfterFee);
    }

    /// @notice Compute an encrypted payout ciphertext for an open position.
    function requestClosePosition(uint256 positionId) external nonReentrant {
        Position storage pos = positions[positionId];
        require(pos.trader == msg.sender, "Not owner");
        require(pos.status == PositionStatus.Open, "Not open");

        string memory symbol = marketSymbols[pos.marketId];
        (uint256 exitPrice, ) = oracle.getPrice(symbol);

        euint128 encPayout = _buildClosePayout(pos, exitPrice);
        FHE.allowThis(encPayout);
        FHE.allowSender(encPayout);
        pendingClosePayouts[positionId] = encPayout;

        emit CloseRequested(positionId, euint128.unwrap(encPayout), exitPrice);
    }

    /// @notice Finalize close after decrypting the payout ciphertext off-chain.
    function finalizeClosePosition(
        uint256 positionId,
        uint256 payout,
        bytes calldata signature
    ) external nonReentrant {
        Position storage pos = positions[positionId];
        require(pos.trader == msg.sender, "Not owner");
        require(pos.status == PositionStatus.Open, "Not open");
        require(payout <= type(uint128).max, "Payout overflow");

        euint128 encPayout = pendingClosePayouts[positionId];
        require(euint128.unwrap(encPayout) != bytes32(0), "Close not requested");
        require(FHE.verifyDecryptResult(encPayout, uint128(payout), signature), "Bad decrypt proof");

        pendingClosePayouts[positionId] = euint128.wrap(bytes32(0));
        pos.status = PositionStatus.Closed;

        _settle(pos.trader, pos.collateral, payout);
        emit PositionClosed(positionId, pos.trader, payout, _toSignedPnl(pos.collateral, payout));
    }

    /// @notice Create a globally decryptable liquidation check without exposing hidden size.
    function requestLiquidationCheck(uint256 positionId) external nonReentrant {
        Position storage pos = positions[positionId];
        require(pos.status == PositionStatus.Open, "Not open");

        string memory symbol = marketSymbols[pos.marketId];
        (uint256 price, ) = oracle.getPrice(symbol);

        ebool encCanLiquidate = _buildLiquidationCheck(pos, price);
        FHE.allowThis(encCanLiquidate);
        FHE.allowGlobal(encCanLiquidate);
        pendingLiquidationChecks[positionId] = encCanLiquidate;

        emit LiquidationCheckRequested(positionId, ebool.unwrap(encCanLiquidate), price);
    }

    /// @notice Finalize a liquidation after verifying the decrypt proof for the liquidation check.
    function finalizeLiquidation(
        uint256 positionId,
        bool liquidatable,
        bytes calldata signature
    ) external nonReentrant {
        Position storage pos = positions[positionId];
        require(pos.status == PositionStatus.Open, "Not open");

        ebool encCanLiquidate = pendingLiquidationChecks[positionId];
        require(ebool.unwrap(encCanLiquidate) != bytes32(0), "Check not requested");
        require(FHE.verifyDecryptResult(encCanLiquidate, liquidatable, signature), "Bad decrypt proof");
        require(liquidatable, "Not liquidatable");

        pendingLiquidationChecks[positionId] = ebool.wrap(bytes32(0));
        pos.status = PositionStatus.Liquidated;
        usdc.safeTransfer(address(pool), pos.collateral);
        pool.receiveTraderLoss(pos.collateral);
        emit PositionLiquidated(positionId, pos.trader, pos.collateral);
    }

    function _buildClosePayout(Position storage pos, uint256 exitPrice) internal returns (euint128) {
        euint128 encColl = _publicUint128(pos.collateral);
        if (exitPrice == pos.entryPrice) {
            return encColl;
        }

        euint128 encAbsPnl = _calculateAbsPnl(pos.encryptedSize, pos.entryPrice, exitPrice);
        euint128 favorableLongPayout;
        euint128 favorableShortPayout;
        if (exitPrice > pos.entryPrice) {
            favorableLongPayout = FHE.add(encColl, encAbsPnl);
            favorableShortPayout = _lossAdjustedPayout(encColl, encAbsPnl);
        } else {
            favorableLongPayout = _lossAdjustedPayout(encColl, encAbsPnl);
            favorableShortPayout = FHE.add(encColl, encAbsPnl);
        }

        return FHE.select(pos.encryptedDirection, favorableLongPayout, favorableShortPayout);
    }

    function _buildLiquidationCheck(Position storage pos, uint256 price) internal returns (ebool) {
        if (price == pos.entryPrice) {
            return FHE.asEbool(false);
        }

        euint128 encAbsPnl = _calculateAbsPnl(pos.encryptedSize, pos.entryPrice, price);
        euint128 encThreshold = _publicUint128((pos.collateral * 80) / 100);

        ebool longLiquidatable;
        ebool shortLiquidatable;
        if (price > pos.entryPrice) {
            longLiquidatable = FHE.asEbool(false);
            shortLiquidatable = FHE.gte(encAbsPnl, encThreshold);
        } else {
            longLiquidatable = FHE.gte(encAbsPnl, encThreshold);
            shortLiquidatable = FHE.asEbool(false);
        }

        return FHE.select(pos.encryptedDirection, longLiquidatable, shortLiquidatable);
    }

    function _calculateAbsPnl(
        euint128 encSize,
        uint256 entryPrice,
        uint256 exitPrice
    ) internal returns (euint128) {
        uint256 delta = exitPrice > entryPrice ? exitPrice - entryPrice : entryPrice - exitPrice;
        if (delta == 0) {
            return _publicUint128(0);
        }

        return FHE.div(FHE.mul(encSize, _publicUint128(delta)), _publicUint128(entryPrice));
    }

    function _lossAdjustedPayout(euint128 encColl, euint128 encLoss) internal returns (euint128) {
        return FHE.sub(encColl, FHE.min(encLoss, encColl));
    }

    function _publicUint128(uint256 value) internal returns (euint128) {
        require(value <= type(uint128).max, "Value overflow");
        return FHE.asEuint128(value);
    }

    function _settle(address trader, uint256 coll, uint256 payout) internal {
        if (payout > coll) {
            usdc.safeTransfer(trader, coll);
            pool.payTrader(trader, payout - coll);
        } else if (payout < coll) {
            uint256 loss = coll - payout;
            if (loss > 0) {
                usdc.safeTransfer(address(pool), loss);
                pool.receiveTraderLoss(loss);
            }
            if (payout > 0) {
                usdc.safeTransfer(trader, payout);
            }
        } else {
            usdc.safeTransfer(trader, coll);
        }
    }

    function _toSignedPnl(uint256 coll, uint256 payout) internal pure returns (int256) {
        return payout >= coll ? int256(payout - coll) : -int256(coll - payout);
    }

    // ── Views ──

    function getPositionMeta(uint256 positionId) external view returns (
        address trader,
        bytes32 marketId,
        uint256 collateral,
        uint256 entryPrice,
        uint256 openedAt,
        PositionStatus status
    ) {
        Position storage pos = positions[positionId];
        return (pos.trader, pos.marketId, pos.collateral, pos.entryPrice, pos.openedAt, pos.status);
    }

    function getPositionCiphertexts(uint256 positionId) external view returns (
        bytes32 directionCtHash,
        bytes32 sizeCtHash,
        bytes32 closePayoutCtHash,
        bytes32 liquidationCheckCtHash
    ) {
        Position storage pos = positions[positionId];
        return (
            ebool.unwrap(pos.encryptedDirection),
            euint128.unwrap(pos.encryptedSize),
            euint128.unwrap(pendingClosePayouts[positionId]),
            ebool.unwrap(pendingLiquidationChecks[positionId])
        );
    }

    function getOpenRequestMeta(uint256 requestId) external view returns (
        address trader,
        bytes32 marketId,
        uint256 collateral
    ) {
        PendingOpenRequest storage req = pendingOpenRequests[requestId];
        return (req.trader, req.marketId, req.collateral);
    }

    function getOpenRequestValidationCiphertext(uint256 requestId) external view returns (bytes32) {
        return ebool.unwrap(pendingOpenRequests[requestId].encryptedCanOpen);
    }

    function getTraderPositionIds(address trader) external view returns (uint256[] memory) {
        return traderPositions[trader];
    }

    function getTraderPositionCount(address trader) external view returns (uint256) {
        return traderPositions[trader].length;
    }

    function totalCollateral() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }
}
