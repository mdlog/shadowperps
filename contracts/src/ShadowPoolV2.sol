// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IConfidentialAssetVault.sol";
import "./interfaces/IShadowPoolSettlementV2.sol";
import "./interfaces/IShadowPoolV2.sol";

/// @title ShadowPoolV2
/// @notice Privacy-ready LP pool scaffold with encrypted provider accounting.
/// @dev This contract is a compile-ready skeleton for the future confidential LP design.
///      It is not wired into deployment or frontend yet and should not replace the live pool as-is.
contract ShadowPoolV2 is Ownable, ReentrancyGuard, IShadowPoolV2, IShadowPoolSettlementV2 {
    struct ProviderPosition {
        euint128 encryptedShares;
        euint128 encryptedPrincipal;
        euint128 encryptedPendingWithdraw;
        uint64 updatedAt;
    }

    struct PendingDepositRequest {
        address provider;
        euint128 encryptedAssets;
        euint128 encryptedMinSharesOut;
        euint128 encryptedQuotedSharesOut;
        ebool encryptedCanFinalize;
        uint64 createdAt;
        RequestStatus status;
    }

    struct PendingWithdrawRequest {
        address provider;
        euint128 encryptedSharesIn;
        euint128 encryptedMinAssetsOut;
        euint128 encryptedQuotedAssetsOut;
        ebool encryptedCanFinalize;
        uint64 createdAt;
        RequestStatus status;
    }

    IConfidentialAssetVault public assetVault;
    address public perpsContract;

    mapping(address => ProviderPosition) private providers;
    mapping(uint256 => PendingDepositRequest) private pendingDeposits;
    mapping(uint256 => PendingWithdrawRequest) private pendingWithdraws;

    euint128 private encryptedTotalShares;
    euint128 private encryptedTotalAssets;
    euint128 private encryptedCumulativeFees;
    euint128 private encryptedCumulativeTraderPnl;

    uint256 public depositRequestCount;
    uint256 public withdrawRequestCount;

    event AssetVaultUpdated(address indexed assetVault);
    event PerpsContractUpdated(address indexed perpsContract);
    event DepositRequested(uint256 indexed requestId, address indexed provider, bytes32 quotedSharesOutCtHash, bytes32 canFinalizeCtHash);
    event DepositFinalized(uint256 indexed requestId, address indexed provider, uint256 sharesOut);
    event WithdrawRequested(uint256 indexed requestId, address indexed provider, bytes32 quotedAssetsOutCtHash, bytes32 canFinalizeCtHash);
    event WithdrawFinalized(uint256 indexed requestId, address indexed provider, uint256 assetsOut);
    event TraderDeltaRecorded(bytes32 indexed deltaCtHash, bool traderWins);
    event TradingFeeRecorded(bytes32 indexed feeCtHash);

    modifier onlyPerps() {
        require(msg.sender == perpsContract, "Not perps");
        _;
    }

    constructor(address _assetVault) Ownable(msg.sender) {
        assetVault = IConfidentialAssetVault(_assetVault);
    }

    function setAssetVault(address _assetVault) external onlyOwner {
        assetVault = IConfidentialAssetVault(_assetVault);
        emit AssetVaultUpdated(_assetVault);
    }

    function setPerpsContract(address _perpsContract) external onlyOwner {
        perpsContract = _perpsContract;
        emit PerpsContractUpdated(_perpsContract);
    }

    function requestDeposit(
        InEuint128 calldata assetAmountInput,
        InEuint128 calldata minSharesOutInput
    ) external nonReentrant returns (uint256 requestId) {
        euint128 encryptedAssets = FHE.asEuint128(assetAmountInput);
        euint128 encryptedMinSharesOut = FHE.asEuint128(minSharesOutInput);
        euint128 encryptedQuotedSharesOut = _quoteSharesOut(encryptedAssets);
        ebool encryptedCanFinalize = FHE.gte(encryptedQuotedSharesOut, encryptedMinSharesOut);

        _allowRequestCiphertext(encryptedAssets, msg.sender, true);
        _allowRequestCiphertext(encryptedMinSharesOut, msg.sender, false);
        _allowRequestCiphertext(encryptedQuotedSharesOut, msg.sender, false);
        _allowRequestBool(encryptedCanFinalize, msg.sender);

        requestId = depositRequestCount++;
        pendingDeposits[requestId] = PendingDepositRequest({
            provider: msg.sender,
            encryptedAssets: encryptedAssets,
            encryptedMinSharesOut: encryptedMinSharesOut,
            encryptedQuotedSharesOut: encryptedQuotedSharesOut,
            encryptedCanFinalize: encryptedCanFinalize,
            createdAt: uint64(block.timestamp),
            status: RequestStatus.Pending
        });

        emit DepositRequested(
            requestId,
            msg.sender,
            euint128.unwrap(encryptedQuotedSharesOut),
            ebool.unwrap(encryptedCanFinalize)
        );
    }

    function finalizeDeposit(
        uint256 requestId,
        uint128 sharesOut,
        bool canFinalize,
        bytes calldata sharesOutSignature,
        bytes calldata canFinalizeSignature
    ) external nonReentrant {
        PendingDepositRequest storage request = pendingDeposits[requestId];
        require(request.provider == msg.sender, "Not owner");
        require(request.status == RequestStatus.Pending, "Bad status");

        require(
            FHE.verifyDecryptResult(request.encryptedQuotedSharesOut, sharesOut, sharesOutSignature),
            "Bad shares proof"
        );
        require(
            FHE.verifyDecryptResult(request.encryptedCanFinalize, canFinalize, canFinalizeSignature),
            "Bad finalize proof"
        );
        require(canFinalize, "Deposit rejected");

        ProviderPosition storage provider = providers[msg.sender];
        euint128 encryptedSharesOut = _publicUint128(sharesOut);

        provider.encryptedShares = _addOrAssign(provider.encryptedShares, encryptedSharesOut);
        provider.encryptedPrincipal = _addOrAssign(provider.encryptedPrincipal, request.encryptedAssets);
        provider.updatedAt = uint64(block.timestamp);
        _allowProviderPosition(msg.sender, provider);

        encryptedTotalShares = _addOrAssign(encryptedTotalShares, encryptedSharesOut);
        encryptedTotalAssets = _addOrAssign(encryptedTotalAssets, request.encryptedAssets);
        _allowPoolAggregates();

        if (address(assetVault) != address(0)) {
            assetVault.controllerTransfer(euint128.unwrap(request.encryptedAssets), msg.sender, address(this));
        }

        request.status = RequestStatus.Finalized;
        emit DepositFinalized(requestId, msg.sender, sharesOut);
    }

    function requestWithdraw(
        InEuint128 calldata shareAmountInput,
        InEuint128 calldata minAssetsOutInput
    ) external nonReentrant returns (uint256 requestId) {
        ProviderPosition storage provider = providers[msg.sender];

        euint128 encryptedSharesIn = FHE.asEuint128(shareAmountInput);
        euint128 encryptedMinAssetsOut = FHE.asEuint128(minAssetsOutInput);
        euint128 encryptedQuotedAssetsOut = _quoteAssetsOut(encryptedSharesIn);
        ebool encryptedHasShares = FHE.isInitialized(provider.encryptedShares)
            ? FHE.gte(provider.encryptedShares, encryptedSharesIn)
            : FHE.asEbool(false);
        ebool encryptedMeetsMin = FHE.gte(encryptedQuotedAssetsOut, encryptedMinAssetsOut);
        ebool encryptedCanFinalize = FHE.and(encryptedHasShares, encryptedMeetsMin);

        _allowRequestCiphertext(encryptedSharesIn, msg.sender, false);
        _allowRequestCiphertext(encryptedMinAssetsOut, msg.sender, false);
        _allowRequestCiphertext(encryptedQuotedAssetsOut, msg.sender, true);
        _allowRequestBool(encryptedCanFinalize, msg.sender);

        requestId = withdrawRequestCount++;
        pendingWithdraws[requestId] = PendingWithdrawRequest({
            provider: msg.sender,
            encryptedSharesIn: encryptedSharesIn,
            encryptedMinAssetsOut: encryptedMinAssetsOut,
            encryptedQuotedAssetsOut: encryptedQuotedAssetsOut,
            encryptedCanFinalize: encryptedCanFinalize,
            createdAt: uint64(block.timestamp),
            status: RequestStatus.Pending
        });

        provider.encryptedPendingWithdraw = encryptedQuotedAssetsOut;
        provider.updatedAt = uint64(block.timestamp);
        _allowProviderPosition(msg.sender, provider);

        emit WithdrawRequested(
            requestId,
            msg.sender,
            euint128.unwrap(encryptedQuotedAssetsOut),
            ebool.unwrap(encryptedCanFinalize)
        );
    }

    function finalizeWithdraw(
        uint256 requestId,
        uint128 assetsOut,
        bool canFinalize,
        bytes calldata assetsOutSignature,
        bytes calldata canFinalizeSignature
    ) external nonReentrant {
        PendingWithdrawRequest storage request = pendingWithdraws[requestId];
        require(request.provider == msg.sender, "Not owner");
        require(request.status == RequestStatus.Pending, "Bad status");

        require(
            FHE.verifyDecryptResult(request.encryptedQuotedAssetsOut, assetsOut, assetsOutSignature),
            "Bad assets proof"
        );
        require(
            FHE.verifyDecryptResult(request.encryptedCanFinalize, canFinalize, canFinalizeSignature),
            "Bad finalize proof"
        );
        require(canFinalize, "Withdraw rejected");

        ProviderPosition storage provider = providers[msg.sender];
        require(FHE.isInitialized(provider.encryptedShares), "No shares");

        euint128 currentShares = provider.encryptedShares;
        euint128 principalBurn = FHE.div(
            FHE.mul(provider.encryptedPrincipal, request.encryptedSharesIn),
            currentShares
        );

        provider.encryptedShares = FHE.sub(currentShares, request.encryptedSharesIn);
        provider.encryptedPrincipal = FHE.sub(provider.encryptedPrincipal, principalBurn);
        provider.encryptedPendingWithdraw = _publicUint128(0);
        provider.updatedAt = uint64(block.timestamp);
        _allowProviderPosition(msg.sender, provider);

        encryptedTotalShares = FHE.sub(encryptedTotalShares, request.encryptedSharesIn);
        encryptedTotalAssets = FHE.sub(encryptedTotalAssets, request.encryptedQuotedAssetsOut);
        _allowPoolAggregates();

        if (address(assetVault) != address(0)) {
            assetVault.controllerTransfer(euint128.unwrap(request.encryptedQuotedAssetsOut), address(this), msg.sender);
        }

        request.status = RequestStatus.Finalized;
        emit WithdrawFinalized(requestId, msg.sender, assetsOut);
    }

    function recordTraderDelta(bytes32 deltaCtHash, bool traderWins) external onlyPerps {
        euint128 encryptedDelta = FHE.wrapEuint128(deltaCtHash);
        FHE.allowThis(encryptedDelta);

        encryptedTotalAssets = traderWins
            ? FHE.sub(encryptedTotalAssets, encryptedDelta)
            : _addOrAssign(encryptedTotalAssets, encryptedDelta);
        encryptedCumulativeTraderPnl = traderWins
            ? _addOrAssign(encryptedCumulativeTraderPnl, encryptedDelta)
            : FHE.sub(encryptedCumulativeTraderPnl, encryptedDelta);
        _allowPoolAggregates();

        emit TraderDeltaRecorded(deltaCtHash, traderWins);
    }

    function recordTradingFee(bytes32 feeCtHash) external onlyPerps {
        euint128 encryptedFee = FHE.wrapEuint128(feeCtHash);
        FHE.allowThis(encryptedFee);

        encryptedTotalAssets = _addOrAssign(encryptedTotalAssets, encryptedFee);
        encryptedCumulativeFees = _addOrAssign(encryptedCumulativeFees, encryptedFee);
        _allowPoolAggregates();

        emit TradingFeeRecorded(feeCtHash);
    }

    function getProviderCiphertexts(address provider) external view returns (
        bytes32 shareBalanceCtHash,
        bytes32 principalCtHash,
        bytes32 pendingWithdrawCtHash
    ) {
        ProviderPosition storage position = providers[provider];
        return (
            euint128.unwrap(position.encryptedShares),
            euint128.unwrap(position.encryptedPrincipal),
            euint128.unwrap(position.encryptedPendingWithdraw)
        );
    }

    function getPoolCiphertexts() external view returns (
        bytes32 totalSharesCtHash,
        bytes32 totalAssetsCtHash,
        bytes32 cumulativeFeesCtHash,
        bytes32 cumulativeTraderPnlCtHash
    ) {
        return (
            euint128.unwrap(encryptedTotalShares),
            euint128.unwrap(encryptedTotalAssets),
            euint128.unwrap(encryptedCumulativeFees),
            euint128.unwrap(encryptedCumulativeTraderPnl)
        );
    }

    function getDepositRequestMeta(uint256 requestId) external view returns (
        address provider,
        uint64 createdAt,
        RequestStatus status
    ) {
        PendingDepositRequest storage request = pendingDeposits[requestId];
        return (request.provider, request.createdAt, request.status);
    }

    function getDepositRequestCiphertexts(uint256 requestId) external view returns (
        bytes32 assetAmountCtHash,
        bytes32 minSharesOutCtHash,
        bytes32 quotedSharesOutCtHash,
        bytes32 canFinalizeCtHash
    ) {
        PendingDepositRequest storage request = pendingDeposits[requestId];
        return (
            euint128.unwrap(request.encryptedAssets),
            euint128.unwrap(request.encryptedMinSharesOut),
            euint128.unwrap(request.encryptedQuotedSharesOut),
            ebool.unwrap(request.encryptedCanFinalize)
        );
    }

    function getWithdrawRequestMeta(uint256 requestId) external view returns (
        address provider,
        uint64 createdAt,
        RequestStatus status
    ) {
        PendingWithdrawRequest storage request = pendingWithdraws[requestId];
        return (request.provider, request.createdAt, request.status);
    }

    function getWithdrawRequestCiphertexts(uint256 requestId) external view returns (
        bytes32 shareAmountCtHash,
        bytes32 minAssetsOutCtHash,
        bytes32 quotedAssetsOutCtHash,
        bytes32 canFinalizeCtHash
    ) {
        PendingWithdrawRequest storage request = pendingWithdraws[requestId];
        return (
            euint128.unwrap(request.encryptedSharesIn),
            euint128.unwrap(request.encryptedMinAssetsOut),
            euint128.unwrap(request.encryptedQuotedAssetsOut),
            ebool.unwrap(request.encryptedCanFinalize)
        );
    }

    function _quoteSharesOut(euint128 encryptedAssets) internal returns (euint128) {
        if (!FHE.isInitialized(encryptedTotalShares) || !FHE.isInitialized(encryptedTotalAssets)) {
            return encryptedAssets;
        }

        return FHE.div(FHE.mul(encryptedAssets, encryptedTotalShares), encryptedTotalAssets);
    }

    function _quoteAssetsOut(euint128 encryptedSharesIn) internal returns (euint128) {
        if (!FHE.isInitialized(encryptedTotalShares) || !FHE.isInitialized(encryptedTotalAssets)) {
            return _publicUint128(0);
        }

        return FHE.div(FHE.mul(encryptedSharesIn, encryptedTotalAssets), encryptedTotalShares);
    }

    function _allowRequestCiphertext(euint128 value, address provider, bool allowVault) internal {
        FHE.allowThis(value);
        FHE.allow(value, provider);
        if (allowVault && address(assetVault) != address(0)) {
            FHE.allow(value, address(assetVault));
        }
    }

    function _allowRequestBool(ebool value, address provider) internal {
        FHE.allowThis(value);
        FHE.allow(value, provider);
    }

    function _allowProviderPosition(address provider, ProviderPosition storage position) internal {
        if (FHE.isInitialized(position.encryptedShares)) {
            FHE.allowThis(position.encryptedShares);
            FHE.allow(position.encryptedShares, provider);
        }
        if (FHE.isInitialized(position.encryptedPrincipal)) {
            FHE.allowThis(position.encryptedPrincipal);
            FHE.allow(position.encryptedPrincipal, provider);
        }
        if (FHE.isInitialized(position.encryptedPendingWithdraw)) {
            FHE.allowThis(position.encryptedPendingWithdraw);
            FHE.allow(position.encryptedPendingWithdraw, provider);
        }
    }

    function _allowPoolAggregates() internal {
        if (FHE.isInitialized(encryptedTotalShares)) {
            FHE.allowThis(encryptedTotalShares);
        }
        if (FHE.isInitialized(encryptedTotalAssets)) {
            FHE.allowThis(encryptedTotalAssets);
        }
        if (FHE.isInitialized(encryptedCumulativeFees)) {
            FHE.allowThis(encryptedCumulativeFees);
        }
        if (FHE.isInitialized(encryptedCumulativeTraderPnl)) {
            FHE.allowThis(encryptedCumulativeTraderPnl);
        }
    }

    function _addOrAssign(euint128 currentValue, euint128 delta) internal returns (euint128) {
        if (!FHE.isInitialized(currentValue)) {
            return delta;
        }

        return FHE.add(currentValue, delta);
    }

    function _publicUint128(uint256 value) internal returns (euint128) {
        require(value <= type(uint128).max, "Value overflow");
        return FHE.asEuint128(value);
    }
}
