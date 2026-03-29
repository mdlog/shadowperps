# ShadowPool Privacy-Ready Refactor

## Goal

Build a `ShadowPoolV2` that keeps LP balances, LP share issuance, pool PnL attribution, and trader-to-pool settlement inside CoFHE-backed encrypted accounting instead of the current public ERC-20 pool model.

This document is a concrete blueprint for implementation, not a generic wishlist.

## Current blockers

The current pool cannot be made private with small patches because:

- LP deposits and withdrawals are plain `uint256` in `ShadowPool.deposit(uint256)` and `withdraw(uint256)`.
- Pool shares are public ERC-20 balances (`spUSDC`).
- Trader profit/loss settlement moves public USDC between `ShadowPerps`, `ShadowPool`, and traders.
- Events and views expose all LP amounts and pool PnL in plaintext.

## Recommended target architecture

Use a 3-layer architecture:

1. `ConfidentialAssetVault`
- Holds the underlying settlement asset.
- Preferred target: confidential asset or shielded vault balance.
- Transitional mode: still accepts public USDC deposits, but only the bridge edge is public.

2. `ShadowPoolV2`
- Tracks LP ownership and pool accounting in encrypted storage.
- Mints encrypted LP shares instead of public ERC-20 `spUSDC`.
- Receives encrypted trader PnL deltas from `ShadowPerpsV2`.

3. `ShadowPerpsV2`
- Stops transferring public USDC to and from the pool on close/liquidation.
- Settles against pool balances through confidential vault accounting.

## Privacy model

### Private state

These should be stored as CoFHE ciphertext handles:

- LP share balance per provider
- LP contributed principal per provider
- LP pending withdrawal amount per provider
- Pool total shares
- Pool total managed assets
- Pool cumulative trader PnL
- Pool cumulative fee income
- Pool pending deposit amount per request
- Pool pending withdraw share amount per request
- Per-request slippage guard values

Recommended encrypted types:

- `euint128` for balances, shares, assets, fees, pnl
- `ebool` for validation flags

### Public state

These can stay public without breaking the privacy model:

- contract addresses
- request IDs and nonces
- request ownership
- request status enum
- market registration metadata
- admin config such as fee rates, pause flags, min deposit thresholds
- coarse solvency flags if needed for public safety

### Unavoidably public metadata

Even with CoFHE, these still leak on chain:

- caller address
- transaction timing
- gas usage
- number of requests a user sends

If the system still uses plain USDC at the vault edge, these also remain public:

- raw deposit amount into the vault
- raw withdrawal amount out of the vault
- ERC-20 approve amount

## Recommended contract split

### `ConfidentialAssetVault`

Responsibilities:

- hold underlying asset
- maintain internal confidential balances per user and per pool
- support confidential internal transfers
- optionally support public-to-confidential deposit bridge
- optionally support confidential-to-public withdrawal bridge

Key idea:

- `ShadowPoolV2` and `ShadowPerpsV2` should stop calling `IERC20.transfer(...)` directly for settlement.
- They should mutate vault balances instead.

### `ShadowPoolV2`

Responsibilities:

- accept LP deposit and withdraw requests
- compute encrypted shares out / assets out
- track pool NAV confidentially
- accept encrypted trader loss and fee inflows
- pay encrypted trader profit outflows
- expose ciphertext handles for wallet-local decrypt

### `ShadowPerpsV2`

Responsibilities:

- keep trader position size and direction private
- compute encrypted payout
- submit encrypted net delta against pool
- never transfer public USDC directly to pool except in transitional mode

## Recommended ABI

Below is the recommended Solidity-facing ABI shape.

It follows the same request/finalize pattern already used successfully in `ShadowPerps`.

The compile-ready scaffold uses a slightly stricter finalize shape than the original sketch:

- finalize verifies the decrypted quoted output
- finalize also verifies a decrypted `canFinalize` boolean

That extra boolean proof lets the contract enforce an encrypted slippage guard without exposing `minOut` in plaintext.

```solidity
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
```

For the transitional bridge layer, the scaffold also exposes a vault interface:

```solidity
interface IConfidentialAssetVault {
    enum WithdrawRequestStatus {
        None,
        Pending,
        Finalized,
        Cancelled
    }

    function setController(address controller, bool allowed) external;

    function depositPublic(uint256 amount) external;

    function requestPublicWithdraw(
        InEuint128 calldata amountInput
    ) external returns (uint256 requestId);

    function finalizePublicWithdraw(
        uint256 requestId,
        uint128 amount,
        bool canWithdraw,
        bytes calldata amountSignature,
        bytes calldata canWithdrawSignature
    ) external;

    function controllerTransfer(
        bytes32 amountCtHash,
        address from,
        address to
    ) external;
}
```

## Storage design

Suggested storage layout:

```solidity
enum RequestStatus {
    None,
    Pending,
    Finalized,
    Cancelled
}

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

contract ShadowPoolV2 {
    mapping(address => ProviderPosition) private providers;
    mapping(uint256 => PendingDepositRequest) private pendingDeposits;
    mapping(uint256 => PendingWithdrawRequest) private pendingWithdraws;

    euint128 private encryptedTotalShares;
    euint128 private encryptedTotalAssets;
    euint128 private encryptedCumulativeFees;
    euint128 private encryptedCumulativeTraderPnl;

    uint256 public depositRequestCount;
    uint256 public withdrawRequestCount;
}
```

## Core encrypted math

### Deposit

Target math:

- `sharesOut = totalShares == 0 ? assetsIn : assetsIn * totalShares / totalAssets`
- `accept = sharesOut >= minSharesOut`

Encrypted path:

- `assetsIn` from `InEuint128`
- `minSharesOut` from `InEuint128`
- if pool not initialized, use public `0` check plus trivial branch
- otherwise compute `mul/div` on encrypted values
- produce encrypted `sharesOut`
- produce encrypted acceptance flag

Access control:

- `FHE.allowThis(encryptedQuotedSharesOut)`
- `FHE.allowSender(encryptedQuotedSharesOut)`
- `FHE.allowThis(encryptedCanFinalize)`
- `FHE.allowSender(encryptedCanFinalize)`

Finalize path:

- provider decrypts `quotedSharesOut`
- provider decrypts `canFinalize`
- contract verifies `verifyDecryptResult`
- contract verifies the `canFinalize` proof and requires it to be `true`
- contract mutates:
  - provider share balance
  - provider principal
  - pool total shares
  - pool total assets

### Withdraw

Target math:

- `assetsOut = sharesIn * totalAssets / totalShares`
- `accept = assetsOut >= minAssetsOut`

Additional check:

- `providerShares >= sharesIn`

Encrypted path:

- compare provider encrypted shares vs requested encrypted shares
- compute encrypted assets out
- compute encrypted acceptance flag
- expose ciphertexts to provider for decrypt proof

Finalize path:

- verify decrypted `assetsOut`
- verify decrypted `canFinalize`
- require `canFinalize == true`
- burn encrypted provider shares
- decrement encrypted total shares and assets
- move confidential asset balance from pool to provider in vault

## Settlement design with perps

Current settlement is public because `ShadowPerps` transfers USDC directly.

Replace it with confidential vault settlement:

### Trader wins

- `ShadowPerpsV2` computes encrypted trader profit delta
- pool encrypted assets decrease by delta
- trader confidential vault balance increases by delta

### Trader loses

- encrypted loss delta is moved from trader side to pool side
- pool encrypted assets increase by delta

### Fees

- fees are credited as encrypted inflow into pool assets
- cumulative encrypted fee counter is incremented

Recommended entrypoint on pool side:

```solidity
function recordTraderDelta(bytes32 deltaCtHash, bool traderWins) external;
function recordTradingFee(bytes32 feeCtHash) external;
```

In the scaffold this is implemented as direct ciphertext-hash intake from `ShadowPerpsV2`, with the expectation that the perps contract already owns the right ciphertext handles and access grants.

## Read model for frontend

### What frontend should read

- provider ciphertext handles
- pool aggregate ciphertext handles
- public request metadata

### What frontend should not read anymore

- `balanceOf` ERC-20 LP token
- `totalSupply` ERC-20 LP token
- `getPoolStats()` returning plaintext TVL and fee figures

### Recommended replacement hooks

- `usePrivateLpPosition()`:
  - reads `getProviderCiphertexts(address)`
  - decrypts shares, principal, pending withdraw
  - optionally decrypts total assets and total shares for local share-of-pool calculation

- `usePrivatePoolSnapshot()`:
  - for connected LP wallet only
  - decrypts aggregate stats locally
  - optionally use globally allowed coarse health flags for public pages

## Events

Replace amount-bearing events with metadata-only events:

```solidity
event DepositRequested(
    uint256 indexed requestId,
    address indexed provider,
    bytes32 quotedSharesOutCtHash,
    bytes32 canFinalizeCtHash
);
event DepositFinalized(uint256 indexed requestId, address indexed provider);
event WithdrawRequested(
    uint256 indexed requestId,
    address indexed provider,
    bytes32 quotedAssetsOutCtHash,
    bytes32 canFinalizeCtHash
);
event WithdrawFinalized(uint256 indexed requestId, address indexed provider);
event TraderDeltaRecorded(bytes32 indexed deltaCtHash, bool traderWins);
event TradingFeeRecorded(bytes32 indexed feeCtHash);
```

Do not emit plaintext amounts. Emitting ciphertext hashes is acceptable in the privacy model because they are opaque handles, not decrypted values.

## What can remain public safely

Recommended public outputs:

- request count
- request ownership
- request lifecycle status
- pause status
- pool operational mode
- global solvency boolean or coarse risk bucket

Recommended to keep private:

- LP deposit amount
- LP withdraw amount
- LP shares per address
- LP principal per address
- pool total assets
- pool total shares
- pool NAV per share
- fee income and trader pnl counters

## Transitional mode vs full privacy mode

### Transitional mode

Use when confidential asset does not exist yet.

What improves:

- LP balances and accounting become private inside pool
- share ownership becomes private
- pool pnl attribution becomes private

What still leaks:

- public USDC bridge deposits and withdrawals
- public ERC-20 approval amounts

### Full privacy mode

Use when confidential settlement asset exists.

What improves:

- deposit amount no longer visible at the asset layer
- withdraw amount no longer visible at the asset layer
- perps settlement to pool no longer visible

## Migration plan

### Phase 1

- create `ShadowPoolV2` with encrypted accounting
- remove public `spUSDC` ERC-20 inheritance
- keep a temporary public bridge for deposit and withdrawal
- make UI consume ciphertext handles for LP position

### Phase 2

- update `ShadowPerps` settlement to use confidential pool accounting
- remove direct `IERC20` transfers between perps and pool

### Phase 3

- introduce confidential vault or confidential underlying asset
- move LP edge deposit and withdraw to shielded asset flow

## Implementation checklist

- `contracts/src/interfaces/IConfidentialAssetVault.sol`
- `contracts/src/interfaces/IShadowPoolV2.sol`
- `contracts/src/interfaces/IShadowPoolSettlementV2.sol`
- `contracts/src/ShadowPoolV2.sol`
- `contracts/src/ConfidentialAssetVault.sol`
- update `contracts/src/ShadowPerps.sol` settlement interface
- regenerate frontend ABI in `src/lib/contracts.ts`
- replace `/pool` page flow with `encryptInputs()`, request/finalize, and wallet-local decrypt
- remove plaintext stats cards or gate them behind wallet-local decrypt

## Current scaffold status

As of this refactor pass, the following are already added and compile successfully:

- `contracts/src/ConfidentialAssetVault.sol`
- `contracts/src/ShadowPoolV2.sol`
- `contracts/src/interfaces/IConfidentialAssetVault.sol`
- `contracts/src/interfaces/IShadowPoolV2.sol`
- `contracts/src/interfaces/IShadowPoolSettlementV2.sol`

What is still intentionally not done:

- live `ShadowPerps.sol` is not yet rewired to settle against `ShadowPoolV2`
- frontend `/pool` is not yet migrated to the new request/finalize LP flow
- deploy scripts and ABI exports are not yet updated for the new contracts
- the vault is still transitional because public ERC-20 edge deposits remain visible

## Recommendation

The best concrete next step is not to patch the current `ShadowPool`, but to introduce:

- `ConfidentialAssetVault`
- `ShadowPoolV2`
- a settlement refactor in `ShadowPerps`

Trying to retrofit privacy onto the current ERC-20 `spUSDC` model will keep leaking too much information to be worth the complexity.
