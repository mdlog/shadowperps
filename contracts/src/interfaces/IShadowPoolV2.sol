// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/ICofhe.sol";

interface IShadowPoolV2 {
    enum RequestStatus {
        None,
        Pending,
        Finalized,
        Cancelled
    }

    function requestDeposit(
        InEuint128 calldata assetAmountInput,
        InEuint128 calldata minSharesOutInput
    ) external returns (uint256 requestId);

    function finalizeDeposit(
        uint256 requestId,
        uint128 sharesOut,
        bool canFinalize,
        bytes calldata sharesOutSignature,
        bytes calldata canFinalizeSignature
    ) external;

    function requestWithdraw(
        InEuint128 calldata shareAmountInput,
        InEuint128 calldata minAssetsOutInput
    ) external returns (uint256 requestId);

    function finalizeWithdraw(
        uint256 requestId,
        uint128 assetsOut,
        bool canFinalize,
        bytes calldata assetsOutSignature,
        bytes calldata canFinalizeSignature
    ) external;

    function getProviderCiphertexts(address provider) external view returns (
        bytes32 shareBalanceCtHash,
        bytes32 principalCtHash,
        bytes32 pendingWithdrawCtHash
    );

    function getPoolCiphertexts() external view returns (
        bytes32 totalSharesCtHash,
        bytes32 totalAssetsCtHash,
        bytes32 cumulativeFeesCtHash,
        bytes32 cumulativeTraderPnlCtHash
    );

    function getDepositRequestMeta(uint256 requestId) external view returns (
        address provider,
        uint64 createdAt,
        RequestStatus status
    );

    function getDepositRequestCiphertexts(uint256 requestId) external view returns (
        bytes32 assetAmountCtHash,
        bytes32 minSharesOutCtHash,
        bytes32 quotedSharesOutCtHash,
        bytes32 canFinalizeCtHash
    );

    function getWithdrawRequestMeta(uint256 requestId) external view returns (
        address provider,
        uint64 createdAt,
        RequestStatus status
    );

    function getWithdrawRequestCiphertexts(uint256 requestId) external view returns (
        bytes32 shareAmountCtHash,
        bytes32 minAssetsOutCtHash,
        bytes32 quotedAssetsOutCtHash,
        bytes32 canFinalizeCtHash
    );
}
