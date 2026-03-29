// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/ICofhe.sol";

interface IConfidentialAssetVault {
    enum WithdrawRequestStatus {
        None,
        Pending,
        Finalized,
        Cancelled
    }

    function setController(address controller, bool allowed) external;

    function depositPublic(uint256 amount) external;

    function requestPublicWithdraw(InEuint128 calldata amountInput) external returns (uint256 requestId);

    function finalizePublicWithdraw(
        uint256 requestId,
        uint128 amount,
        bool canWithdraw,
        bytes calldata amountSignature,
        bytes calldata canWithdrawSignature
    ) external;

    function controllerTransfer(bytes32 amountCtHash, address from, address to) external;

    function getBalanceCiphertext(address account) external view returns (bytes32);

    function getWithdrawRequestMeta(uint256 requestId) external view returns (
        address owner,
        uint64 createdAt,
        WithdrawRequestStatus status
    );

    function getWithdrawRequestCiphertexts(uint256 requestId) external view returns (
        bytes32 amountCtHash,
        bytes32 canWithdrawCtHash
    );
}
