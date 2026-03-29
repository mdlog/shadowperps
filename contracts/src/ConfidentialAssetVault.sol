// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IConfidentialAssetVault.sol";

/// @title ConfidentialAssetVault
/// @notice Transitional confidential balance vault for privacy-ready LP accounting.
/// @dev This scaffold supports a public ERC-20 bridge edge and encrypted internal balances.
contract ConfidentialAssetVault is Ownable, ReentrancyGuard, IConfidentialAssetVault {
    using SafeERC20 for IERC20;

    struct PendingWithdrawRequest {
        address owner;
        euint128 encryptedAmount;
        ebool encryptedCanWithdraw;
        uint64 createdAt;
        WithdrawRequestStatus status;
    }

    IERC20 public immutable asset;
    mapping(address => bool) public controllers;
    mapping(address => euint128) private encryptedBalances;
    mapping(uint256 => PendingWithdrawRequest) private pendingWithdrawRequests;
    uint256 public withdrawRequestCount;

    event ControllerUpdated(address indexed controller, bool allowed);
    event PublicDeposit(address indexed account, uint256 amount);
    event PublicWithdrawRequested(uint256 indexed requestId, address indexed account, bytes32 amountCtHash, bytes32 canWithdrawCtHash);
    event PublicWithdrawFinalized(uint256 indexed requestId, address indexed account, uint256 amount);
    event ControllerTransferApplied(address indexed from, address indexed to, bytes32 amountCtHash);

    modifier onlyController() {
        require(controllers[msg.sender], "Not controller");
        _;
    }

    constructor(address _asset) Ownable(msg.sender) {
        asset = IERC20(_asset);
    }

    function setController(address controller, bool allowed) external onlyOwner {
        controllers[controller] = allowed;
        emit ControllerUpdated(controller, allowed);
    }

    function depositPublic(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        asset.safeTransferFrom(msg.sender, address(this), amount);

        euint128 encryptedAmount = _publicUint128(amount);
        euint128 updatedBalance = _addOrAssign(encryptedBalances[msg.sender], encryptedAmount);
        _storeBalance(msg.sender, updatedBalance);

        emit PublicDeposit(msg.sender, amount);
    }

    function requestPublicWithdraw(InEuint128 calldata amountInput) external nonReentrant returns (uint256 requestId) {
        euint128 encryptedAmount = FHE.asEuint128(amountInput);
        euint128 currentBalance = encryptedBalances[msg.sender];

        FHE.allowThis(encryptedAmount);
        FHE.allow(encryptedAmount, msg.sender);

        ebool encryptedCanWithdraw = FHE.isInitialized(currentBalance)
            ? FHE.gte(currentBalance, encryptedAmount)
            : FHE.asEbool(false);

        FHE.allowThis(encryptedCanWithdraw);
        FHE.allow(encryptedCanWithdraw, msg.sender);

        requestId = withdrawRequestCount++;
        pendingWithdrawRequests[requestId] = PendingWithdrawRequest({
            owner: msg.sender,
            encryptedAmount: encryptedAmount,
            encryptedCanWithdraw: encryptedCanWithdraw,
            createdAt: uint64(block.timestamp),
            status: WithdrawRequestStatus.Pending
        });

        emit PublicWithdrawRequested(
            requestId,
            msg.sender,
            euint128.unwrap(encryptedAmount),
            ebool.unwrap(encryptedCanWithdraw)
        );
    }

    function finalizePublicWithdraw(
        uint256 requestId,
        uint128 amount,
        bool canWithdraw,
        bytes calldata amountSignature,
        bytes calldata canWithdrawSignature
    ) external nonReentrant {
        PendingWithdrawRequest storage request = pendingWithdrawRequests[requestId];
        require(request.owner == msg.sender, "Not owner");
        require(request.status == WithdrawRequestStatus.Pending, "Bad status");

        require(
            FHE.verifyDecryptResult(request.encryptedAmount, amount, amountSignature),
            "Bad amount proof"
        );
        require(
            FHE.verifyDecryptResult(request.encryptedCanWithdraw, canWithdraw, canWithdrawSignature),
            "Bad withdraw proof"
        );
        require(canWithdraw, "Insufficient encrypted balance");

        euint128 encryptedAmount = _publicUint128(amount);
        euint128 updatedBalance = FHE.sub(encryptedBalances[msg.sender], encryptedAmount);
        _storeBalance(msg.sender, updatedBalance);

        request.status = WithdrawRequestStatus.Finalized;
        asset.safeTransfer(msg.sender, amount);

        emit PublicWithdrawFinalized(requestId, msg.sender, amount);
    }

    function controllerTransfer(bytes32 amountCtHash, address from, address to) external onlyController {
        require(from != address(0) && to != address(0), "Zero address");
        euint128 encryptedAmount = FHE.wrapEuint128(amountCtHash);

        euint128 fromBalance = encryptedBalances[from];
        require(FHE.isInitialized(fromBalance), "From balance missing");

        euint128 updatedFrom = FHE.sub(fromBalance, encryptedAmount);
        euint128 updatedTo = _addOrAssign(encryptedBalances[to], encryptedAmount);

        _storeBalance(from, updatedFrom);
        _storeBalance(to, updatedTo);

        emit ControllerTransferApplied(from, to, amountCtHash);
    }

    function getBalanceCiphertext(address account) external view returns (bytes32) {
        return euint128.unwrap(encryptedBalances[account]);
    }

    function getWithdrawRequestMeta(uint256 requestId) external view returns (
        address owner,
        uint64 createdAt,
        WithdrawRequestStatus status
    ) {
        PendingWithdrawRequest storage request = pendingWithdrawRequests[requestId];
        return (request.owner, request.createdAt, request.status);
    }

    function getWithdrawRequestCiphertexts(uint256 requestId) external view returns (
        bytes32 amountCtHash,
        bytes32 canWithdrawCtHash
    ) {
        PendingWithdrawRequest storage request = pendingWithdrawRequests[requestId];
        return (
            euint128.unwrap(request.encryptedAmount),
            ebool.unwrap(request.encryptedCanWithdraw)
        );
    }

    function _storeBalance(address account, euint128 value) internal {
        encryptedBalances[account] = value;
        FHE.allowThis(value);
        FHE.allow(value, account);
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
