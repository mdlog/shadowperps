# RFC: Full-Private Pool Architecture for ShadowPerps

Status: Proposed

Date: 2026-03-30

Owner: ShadowPerps core team

Related:

- [SHADOWPOOL_PRIVACY_READY.md](./SHADOWPOOL_PRIVACY_READY.md)
- [RFC_TOP3_PRIVACY_ROADMAP.md](./RFC_TOP3_PRIVACY_ROADMAP.md)

## Summary

This RFC defines the concrete end-state architecture required to move the repo from:

- public LP pool in `contracts/src/ShadowPool.sol`
- confidential perps in `contracts/src/ShadowPerps.sol`
- privacy-ready LP scaffolding in `contracts/src/ShadowPoolV2.sol` and `contracts/src/ConfidentialAssetVault.sol`

to a full-private pool stack where:

- LP balances are encrypted
- LP deposit and withdrawal amounts are encrypted inside the protocol domain
- pool accounting is encrypted
- perps settlement updates the pool through encrypted deltas
- no exact LP share issuance or redemption amounts are emitted in plaintext events

This RFC is intentionally stricter than the current privacy-ready pool scaffold. It describes the target architecture, not the transitional bridge.

## Definition of "full-private" in this repo

For this RFC, "full-private" means:

- the pool does not rely on public ERC-20 LP balances
- per-user LP shares, principal, pending withdrawals, and pool deltas are stored as ciphertext handles
- trader-to-pool settlement is performed through confidential accounting, not direct public pool transfers
- request/finalize flows do not reveal exact minted shares or exact redeemed assets in logs

Important limit:

- if the source asset is plain public USDC and the user deposits directly from a normal wallet, the wallet-to-system transfer amount remains public

Therefore the repo has two possible ingress models:

1. **True full-private ingress**
   - the settlement asset inside the system is already confidential before the pool interaction
2. **Transitional private accounting**
   - public USDC is deposited at the edge, then all balances after the edge are confidential

This RFC targets option 1 as the final architecture.

## Why the current stack is not enough

Today:

- `contracts/src/ShadowPool.sol` is a public ERC-20 LP vault with public `balanceOf`, `totalSupply`, `getPoolStats`, and public USDC settlement
- `contracts/src/ShadowPerps.sol` still transfers public USDC to the pool and to traders on settlement
- `contracts/src/ConfidentialAssetVault.sol` still uses `depositPublic(uint256 amount)` as the bridge edge
- `contracts/src/ShadowPoolV2.sol` is a scaffold and explicitly says it should not replace the live pool as-is
- `src/app/pool/page.tsx` assumes a public LP token model with public balances and public stats

Those parts are enough for hybrid privacy, but not for full-private pool custody.

## Target architecture

The full-private stack should have five layers.

### 1. Confidential settlement asset layer

Use a confidential settlement balance as the source of truth for pool and perps custody.

Preferred form:

- a confidential USDC-like asset, or
- a shielded balance domain that users enter before interacting with the pool or perps

This is the hard boundary that makes full-private value flow possible. Without it, the first deposit amount remains public forever.

### 2. `ConfidentialSettlementVault`

This contract should replace the current role of `ConfidentialAssetVault`.

Responsibilities:

- hold the underlying settlement asset
- maintain encrypted balances for users, the pool treasury, and trader subaccounts
- support confidential internal transfers between named protocol actors
- support shield and unshield flows
- support request/finalize withdrawals back to public assets when the user chooses to exit privacy

The vault should be the only contract that actually owns the settlement asset.

### 3. `ShadowPoolPrivate`

This contract should be the real successor to `ShadowPoolV2`.

Responsibilities:

- maintain encrypted LP share balances
- maintain encrypted LP principal
- maintain encrypted total shares and encrypted total assets
- compute encrypted share issuance and redemption quotes
- accept encrypted fee deltas and trader PnL deltas from perps
- expose ciphertext handles for wallet-local decrypt
- avoid plaintext events that reveal `sharesOut` or `assetsOut`

The pool should never own public ERC-20 balances directly.

### 4. `ShadowPerpsV2`

This contract should replace the settlement role of the current `ShadowPerps`.

Responsibilities:

- keep encrypted position size and direction
- keep trader collateral in the confidential vault domain
- settle close and liquidation through encrypted deltas against `ShadowPoolPrivate`
- transfer confidential balances inside the vault instead of sending public USDC to the pool or trader
- only unshield assets when the user explicitly exits to the public token domain

### 5. Private UI and wallet-local decryption layer

The frontend should:

- encrypt pool and perps inputs locally
- read ciphertext handles from pool, vault, and perps
- decrypt user-visible values locally with the wallet
- avoid depending on public `balanceOf`, public `totalSupply`, or public LP token events

## Recommended contract map

### Contracts to retire from the live path

- `contracts/src/ShadowPool.sol`
  - keep only for legacy withdrawals or migration
  - remove from new deploy path
- `contracts/src/ShadowPerps.sol`
  - keep only for existing open positions until migration is complete

### Contracts to replace or heavily refactor

- `contracts/src/ConfidentialAssetVault.sol`
  - evolve into `ConfidentialSettlementVault.sol`
  - remove `depositPublic` as the primary path for full-private mode
  - add protocol account roles for `pool`, `perps`, and optional `treasury`
- `contracts/src/ShadowPoolV2.sol`
  - promote into `ShadowPoolPrivate.sol` or harden in place
  - remove plaintext finalization events
  - support confidential fee and PnL settlement as the only accounting path
- `contracts/src/ShadowPerps.sol`
  - replace with `ShadowPerpsV2.sol`
  - stop all direct public USDC settlement to pool and trader

### New contracts to add

- `contracts/src/ShieldedIngressRouter.sol`
  - optional fallback if the network does not offer a native confidential settlement asset
  - accepts public asset deposits into a shielded domain
  - should be treated as the privacy edge, not the pool itself
  - by itself this does not hide the original public deposit amount from the shielding transaction
  - to approximate stronger privacy it must be paired with note-style shielding, delayed use, and ideally relayers or fresh accounts
- `contracts/src/PublicExitRouter.sol`
  - request/finalize path for unshielding confidential balances back to public assets
- `contracts/src/PoolMigration.sol`
  - one-time migration helper from `ShadowPool` balances into the private stack
- `contracts/src/interfaces/IConfidentialSettlementVault.sol`
  - new canonical vault interface
- `contracts/src/interfaces/IShadowPoolPrivate.sol`
  - new canonical pool interface

## Recommended balance model

The system should maintain encrypted balances for these actors:

- user confidential wallet balance inside the vault
- pool treasury balance inside the vault
- perps collateral holding balance inside the vault
- fee treasury balance inside the vault

The pool itself should not be modeled as a public ERC-20 token contract. Instead:

- LP shares are encrypted ledger entries
- LP value is derived from encrypted `totalAssets / totalShares`
- user share balance is only decryptable by the user and authorized internal contracts

## Data classification

### Always private

- user shielded balance
- LP deposit amount
- LP share balance
- LP principal
- pending LP withdrawal amount
- perps collateral balance inside the vault
- pool total assets
- pool total shares
- exact fee inflow per settlement step
- exact trader PnL delta per settlement step
- close payout amount before user exit

### Public

- contract addresses
- request IDs
- request ownership
- request status
- market registration metadata
- admin config such as fees, pause flags, minimum thresholds
- coarse solvency flags if desired

### Optional and dangerous if public

- exact live TVL
- exact live LP price
- exact live fee totals

Making those public does not reveal user balances directly, but it makes timing-based inference much easier. In a strict full-private rollout, they should not be exact real-time on-chain views.

If the product needs public stats, publish:

- delayed snapshots
- rounded buckets
- or attested off-chain summaries

## End-state flows

### A. Shield funds

1. User acquires the settlement asset in confidential form, or uses `ShieldedIngressRouter` as a fallback entry path
2. Router credits the user's encrypted balance in `ConfidentialSettlementVault`
3. No pool interaction has happened yet

For strict privacy, the pool page should only accept already-shielded balances.

### B. LP deposit

1. Frontend reads the user's confidential vault balance handle
2. Frontend encrypts:
   - asset amount
   - minimum shares out
3. Frontend calls `requestDeposit(...)` on `ShadowPoolPrivate`
4. Contract computes encrypted `quotedSharesOut` and encrypted `canFinalize`
5. Wallet decrypts those outputs locally
6. Frontend calls `finalizeDeposit(...)`
7. Pool updates:
   - provider encrypted shares
   - provider encrypted principal
   - encrypted total shares
   - encrypted total assets
8. Pool instructs vault to move confidential balance from user to pool treasury

No plaintext `sharesOut` should be emitted in events.

### C. LP withdraw

1. Frontend encrypts:
   - share amount in
   - minimum assets out
2. Frontend calls `requestWithdraw(...)`
3. Contract computes encrypted `quotedAssetsOut` and encrypted `canFinalize`
4. Wallet decrypts locally
5. Frontend calls `finalizeWithdraw(...)`
6. Pool burns encrypted shares and reduces encrypted principal
7. Vault moves confidential balance from pool treasury to user confidential balance
8. User may keep funds private or later use `PublicExitRouter`

### D. Open position

1. User already has confidential balance in the vault
2. Frontend encrypts direction and size
3. `ShadowPerpsV2.requestOpenPosition(...)` computes encrypted validation
4. Wallet decrypts validation
5. `finalizeOpenPosition(...)` moves confidential collateral from user vault balance to perps collateral balance
6. Trading fee is recorded as an encrypted transfer from perps collateral domain to pool treasury or fee treasury

No public USDC transfer should occur in the open flow.

### E. Close position

1. `requestClosePosition(...)` computes encrypted payout
2. Wallet decrypts payout locally
3. `finalizeClosePosition(...)` verifies proof
4. Contract computes encrypted delta against original confidential collateral
5. Vault and pool update balances internally:
   - trader win: pool treasury -> user confidential balance
   - trader loss: perps collateral domain -> pool treasury
6. User may keep proceeds private or later unshield

### F. Liquidation

1. `requestLiquidationCheck(...)` computes encrypted liquidation result
2. Authorized liquidator or keeper finalizes with proof
3. Remaining confidential collateral is swept according to the liquidation policy inside the vault domain
4. Pool accounting is updated through encrypted delta, not public token transfer

## Contract-level design changes

### `ConfidentialSettlementVault`

Required functions:

- `shield(...)`
- `requestUnshield(...)`
- `finalizeUnshield(...)`
- `protocolTransfer(bytes32 amountCtHash, address from, address to, bytes32 reason)`
- `getBalanceCiphertext(address account)`
- `getAccountRole(address account)`

Required changes relative to `ConfidentialAssetVault.sol`:

- stop treating public deposit as the normal source of truth
- add protocol role controls instead of a generic controller-only model
- support separate internal accounts for user, pool, perps collateral, and fee treasury
- emit reason-coded events without plaintext amounts

### `ShadowPoolPrivate`

Required functions:

- `requestDeposit(...)`
- `finalizeDeposit(...)`
- `requestWithdraw(...)`
- `finalizeWithdraw(...)`
- `recordTradingFee(bytes32 feeCtHash)`
- `recordTraderDelta(bytes32 deltaCtHash, bool traderWins)`
- `getProviderCiphertexts(address provider)`
- `getPoolCiphertexts()`

Required changes relative to `ShadowPoolV2.sol`:

- remove plaintext `sharesOut` and `assetsOut` values from events
- replace public owner-only aggregate visibility assumptions with explicit viewer policy
- keep all accounting values in one explicit security zone shared with perps
- support pausing and request expiry
- add migration hooks for seeding encrypted LP balances if legacy migration is used

### `ShadowPerpsV2`

Required functions:

- same request/finalize structure as current open, close, and liquidation flows
- confidential collateral reservation and release
- encrypted fee recording to pool
- encrypted trader delta recording to pool

Required changes relative to `ShadowPerps.sol`:

- replace `IERC20 usdc` settlement assumptions with vault-native settlement
- remove direct calls to public pool methods:
  - `payTrader`
  - `receiveTraderLoss`
  - `receiveFee`
- keep open positions compatible with wallet-local decrypt for portfolio views
- store enough request metadata to prove and finalize vault movements safely

## Frontend impact

### Files that must change

- `src/lib/contracts.ts`
  - add ABIs and addresses for the private vault, private pool, and new perps
- `src/app/pool/page.tsx`
  - stop using `balanceOf`, `getPoolStats`, and direct `deposit/withdraw`
  - rewrite around request/finalize flows and local decrypt
- `src/hooks/useOnChainTrading.ts`
  - migrate from public collateral transfer assumptions to vault-based collateral movement
- `src/hooks/useOnChainPortfolio.ts`
  - extend to read pool ciphertexts and confidential collateral metadata when needed

### New hooks to add

- `src/hooks/useOnChainVault.ts`
- `src/hooks/useOnChainPoolPrivate.ts`
- optional `src/hooks/usePoolMetrics.ts` for delayed public snapshots if the product wants them

### UI changes

The `/pool` page should show:

- available private balance
- encrypted LP balance
- encrypted principal
- encrypted pending withdrawal
- request/finalize transaction status

The page should not assume:

- public `spUSDC` token balance
- public `pool share`
- exact public TVL

If public stats remain desirable, label them clearly as:

- delayed
- rounded
- or operator-published

## Deployment impact

### Replace the current split deploy model

Today the repo has:

- `contracts/scripts/deploy.ts` for the live public-pool stack
- `contracts/scripts/deploy-privacy-ready.ts` for the scaffold stack

The target should instead be:

- `contracts/scripts/deploy-full-private.ts`
  - deploy confidential settlement vault
  - deploy private pool
  - deploy `ShadowPerpsV2`
  - wire vault roles
  - wire pool and perps settlement permissions
  - print frontend env values

### New env values

- `NEXT_PUBLIC_PRIVATE_VAULT_CONTRACT`
- `NEXT_PUBLIC_PRIVATE_POOL_CONTRACT`
- `NEXT_PUBLIC_SHADOWPERPS_V2_CONTRACT`
- `PRIVATE_VAULT_CONTRACT`
- `PRIVATE_POOL_CONTRACT`
- `SHADOWPERPS_V2_CONTRACT`

### Legacy env values to phase out from new UI paths

- `NEXT_PUBLIC_POOL_CONTRACT`

That key currently points to the public v1 pool and should remain only for migration screens.

## Migration strategy

### Recommended migration shape

1. Freeze new LP deposits into `ShadowPool`
2. Leave withdrawals from `ShadowPool` open
3. Deploy the full-private stack
4. Launch a migration screen that lets users:
   - withdraw from public pool
   - shield funds
   - deposit into private pool
5. Once legacy balances are near zero, retire `ShadowPool` from the main UI

### What not to do

- do not try to map public ERC-20 `spUSDC` balances directly into private balances without an explicit migration action
- do not mix public and private pool accounting in the same source-of-truth contract
- do not make exact real-time aggregate values public if the goal is strict privacy

## Security and privacy requirements

### ACL and zone policy

- all pool, vault, and perps arithmetic must use the same explicit security zone in the first rollout
- no user-sensitive ciphertext should rely on `allowGlobal`
- trader-owned values should be readable by:
  - the contract that needs them
  - the user wallet
- pool-owned aggregates should default to:
  - contract-only
  - optional explicit viewer role if a dashboard needs privileged access

### Event policy

Allowed:

- request created
- request finalized
- request cancelled
- actor addresses
- status codes

Avoid:

- `sharesOut`
- `assetsOut`
- exact fee amount
- exact trader delta
- exact LP principal updates

### Failure handling

Every request/finalize flow should support:

- expiry
- cancel
- replay protection
- stale quote rejection
- pause controls

## Implementation order

### Phase 0: Lock the target

- approve this RFC
- decide whether the project can access a confidential settlement asset or needs a shield router fallback
- decide whether exact public pool metrics are acceptable

### Phase 1: Vault foundation

- replace `ConfidentialAssetVault.sol` with the full settlement vault design
- add protocol roles and reason-coded confidential transfers
- add shield and unshield flows
- add tests for user, pool, and perps internal balances

### Phase 2: Private pool hardening

- replace or harden `ShadowPoolV2.sol`
- remove plaintext event leakage
- add expiry, cancel, pause, and migration hooks
- add tests for deposit, withdraw, fee accrual, and trader PnL application

### Phase 3: Perps settlement rewrite

- build `ShadowPerpsV2.sol`
- move collateral accounting into the vault
- remove direct public pool settlement
- add tests for open, close, win, loss, and liquidation against the private pool

### Phase 4: Frontend integration

- add new ABIs and env wiring
- add vault and private-pool hooks
- rewrite `/pool`
- update trade and portfolio pages for vault-native collateral and private LP views

### Phase 5: Deployment and migration

- add `deploy-full-private.ts`
- add migration UI
- freeze public pool deposits
- move main navigation to the private pool once confidence is high

## Acceptance criteria

- the main product path no longer depends on `contracts/src/ShadowPool.sol`
- no exact LP mint or burn amount is emitted publicly
- no exact trader-to-pool settlement amount is emitted publicly
- pool and perps custody both live inside the confidential vault domain
- users can hold, deposit, trade, close, and withdraw without exposing value movements inside the private domain
- public exit is explicit and opt-in

## Open questions

- does the target deployment environment provide a confidential settlement asset, or do we need a shield router first?
- should exact LP price ever be public, or should the UI use delayed snapshots only?
- do we want wallet unlinkability beyond value privacy, which would require relayers or stealth accounts?
- should the first production rollout keep public exit available immediately, or delay it until the private core is proven stable?

## Recommended next implementation ticket

The highest-leverage next task is:

1. replace `ConfidentialAssetVault.sol` with a vault design that can act as the only settlement custody layer
2. harden `ShadowPoolV2.sol` so it becomes compatible with that vault
3. only after that, rewrite `ShadowPerps` settlement

That ordering keeps the private custody boundary stable before perps starts depending on it.
