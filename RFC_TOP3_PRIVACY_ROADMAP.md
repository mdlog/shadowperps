# RFC: CoFHE React Migration, ACL/Security Zones, and `ShadowPerps -> ShadowPoolV2`

Status: Draft

Date: 2026-03-29

Owner: ShadowPerps core team

## Summary

This RFC defines the next 3 implementation priorities for the app:

1. migrate frontend CoFHE state management from the custom singleton in `src/lib/fhenix.ts` to `@cofhe/react`
2. tighten CoFHE ACL usage and make security zones explicit in contracts
3. wire perps settlement to `ShadowPoolV2` so pool accounting can move toward confidential LP balances

These three items are intentionally ordered. Item 1 reduces frontend fragility. Item 2 narrows privacy leakage and removes overly broad access patterns. Item 3 begins the architectural migration from the public LP pool to the privacy-ready pool scaffold.

## Current State

The codebase already has a working encrypted order flow for perps:

- open flow encrypts `direction` and `size`, then runs `requestOpenPosition -> decryptForTx -> finalizeOpenPosition` in `src/hooks/useOnChainTrading.ts`
- close flow runs `requestClosePosition -> decryptForTx -> finalizeClosePosition` in `src/hooks/useOnChainTrading.ts`
- portfolio reads ciphertext handles from the contract and decrypts them locally in `src/hooks/useOnChainPortfolio.ts`

The current weak points are:

- frontend CoFHE lifecycle is managed manually in `src/lib/fhenix.ts`
- liquidation checks still use broad permissions via `FHE.allowGlobal(...)` in `contracts/src/ShadowPerps.sol`
- pool and LP flows are still public in the live path
- the privacy-ready pool scaffold exists in `contracts/src/ShadowPoolV2.sol` and `contracts/src/ConfidentialAssetVault.sol`, but live perps are not wired to it yet

## Goals

- make CoFHE client initialization, reconnects, and permit handling more reliable in React
- reduce unnecessary ciphertext exposure and make ACL policy explicit
- prepare the system for confidential LP accounting without breaking the live perps product in one step

## Non-Goals

- full private collateral in this RFC
- replacing public USDC edge deposits immediately
- shipping a finished LP UI in the same change set
- splitting every market into different security zones right away

## RFC-1: Migrate Frontend CoFHE State to `@cofhe/react`

### Problem

`src/lib/fhenix.ts` currently handles:

- dynamic SDK loading
- client caching
- proxy endpoint injection
- permit refresh
- retry logic for `HTTP 428`
- decrypt helpers

This works, but it makes wallet lifecycle, React state, and CoFHE client state live in a single custom utility module. That is the main reason we have been patching edge cases like stale connection keys, storage hub failures, and decrypt retries by hand.

### Decision

Adopt `@cofhe/react` as the app-level integration layer and keep a thin local adapter for app-specific behavior.

The app should still keep:

- the local `/api/cofhe/*` proxy
- custom normalization for verifier/network errors
- `HTTP 428` retry logic for `decryptForTx`
- `fheKeyStorage: null` until iframe-backed storage is proven stable enough for this app

### Proposed Design

Create a dedicated provider layer:

- `src/components/providers/CofheProvider.tsx`
- mount it inside [Web3Provider.tsx](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/src/components/providers/Web3Provider.tsx)
- configure it with the same proxied Arbitrum Sepolia endpoints now injected in [fhenix.ts](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/src/lib/fhenix.ts)

Keep a small local adapter:

- `src/lib/cofhe-client.ts`
- expose app-facing helpers such as `encryptInputs`, `decryptForView`, and `decryptForTx`
- internally read client state from `@cofhe/react` hooks instead of building a singleton

Add app-visible CoFHE state:

- `isCofheReady`
- `isPermitReady`
- `cofheError`
- optional step/status for `encrypting`, `permit`, `decrypting`

### Repo Changes

Frontend:

- add `@cofhe/react` to [package.json](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/package.json)
- introduce a `CofheProvider` mounted inside [Web3Provider.tsx](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/src/components/providers/Web3Provider.tsx)
- refactor [fhenix.ts](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/src/lib/fhenix.ts) into a thin compatibility layer or replace it entirely with a provider-backed adapter
- update [useOnChainTrading.ts](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/src/hooks/useOnChainTrading.ts) and [useOnChainPortfolio.ts](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/src/hooks/useOnChainPortfolio.ts) to use hook-backed CoFHE state

### Acceptance Criteria

- wallet reconnect no longer depends on a module-level singleton reset
- encrypt/decrypt flows survive account switching and chain reconnects more reliably
- current proxy-based verifier/threshold routing still works
- open, close, and portfolio decrypt flows behave the same externally

### Risks

- `@cofhe/react` versioning may not match the exact API used in public examples
- moving too much logic into hooks at once can make debugging harder

### Mitigation

Keep the first iteration as an adapter migration, not a full rewrite. The external helper shape should stay stable while the implementation moves behind the provider.

## RFC-2: Tighten ACL Usage and Make Security Zones Explicit

### Problem

The live contract has good encrypted input handling, but its permission policy is still partly implicit:

- `requestLiquidationCheck` currently uses `FHE.allowGlobal(...)` in [ShadowPerps.sol](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/contracts/src/ShadowPerps.sol)
- security zones are not modeled explicitly, so every encrypted value effectively lives in the default lane
- ACL intent is spread across the code instead of encoded as named policy helpers

That makes privacy review harder and will become a real problem once pool accounting is also encrypted.

### Decision

Introduce explicit ACL helpers and explicit security-zone constants, but start with a single shared trading zone for all perps and pool accounting.

This is important: do not split perps positions and pool accounting into separate zones yet. CoFHE arithmetic only works on ciphertexts in the same zone. Since `ShadowPerps` needs to hand encrypted deltas to `ShadowPoolV2`, both sides must remain zone-compatible in the first rollout.

### Proposed ACL Policy

For trader-owned ciphertexts:

- always grant `allowThis`
- grant `allow(trader)` for local decrypt/view paths
- do not grant global access to position data or liquidation booleans

For close and open request outputs:

- `encryptedCanOpen`: contract + trader
- `encryptedPayout`: contract + trader

For liquidation checks:

- replace `allowGlobal` with request-scoped access
- the contract stores `liquidationRequester`
- `requestLiquidationCheck` grants access to the requester and the contract
- `finalizeLiquidation` must be called by the same requester or by an approved keeper role

For pool aggregates:

- `allowThis` only by default
- optional `allow(owner)` or `allow(address viewer)` can be added later for treasury dashboards

### Proposed Zone Policy

Phase 1:

- `ZONE_TRADING = 1`
- all encrypted position values and pool accounting use `ZONE_TRADING`

Phase 2:

- make the zone an explicit constructor/config value
- keep a single active zone for each deployed product instance

Deferred:

- per-market zones
- per-user zones

Those are deferred because they would break direct arithmetic between perps deltas and pooled accounting unless we also redesign the pool into per-zone books.

### Repo Changes

Contracts:

- add named helpers in [ShadowPerps.sol](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/contracts/src/ShadowPerps.sol), for example `_allowTraderCiphertext`, `_allowPoolCiphertext`, `_allowLiquidationRequester`
- replace direct `allowGlobal` usage in [ShadowPerps.sol](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/contracts/src/ShadowPerps.sol:228)
- add explicit zone constants and route all public-to-encrypted conversions through zone-aware helpers
- mirror the same zone helpers in [ShadowPoolV2.sol](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/contracts/src/ShadowPoolV2.sol) and [ConfidentialAssetVault.sol](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/contracts/src/ConfidentialAssetVault.sol)

### Acceptance Criteria

- no user-sensitive ciphertext in the perps flow relies on `allowGlobal`
- the active encryption zone is explicit in code, not implicit
- perps and pool accounting remain arithmetic-compatible
- liquidation still works, but access is narrowed to the caller or keeper path

### Risks

- changing ACL behavior can break decrypt flows in subtle ways
- zone-aware refactors can look harmless while introducing incompatibility between contracts

### Mitigation

Ship ACL tightening before zone diversification. In the first implementation, only make zones explicit while keeping one shared trading zone.

## RFC-3: Wire `ShadowPerps` to `ShadowPoolV2`

### Problem

The live perps contract still settles against the public pool path:

- open fees go to the legacy pool
- close profit/loss settlement moves public USDC against the legacy pool
- liquidation sends public collateral to the legacy pool

Meanwhile, the privacy-ready pool stack already exists:

- [ShadowPoolV2.sol](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/contracts/src/ShadowPoolV2.sol)
- [ConfidentialAssetVault.sol](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/contracts/src/ConfidentialAssetVault.sol)
- [IShadowPoolSettlementV2.sol](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/contracts/src/interfaces/IShadowPoolSettlementV2.sol)

Until perps are wired to that stack, LP privacy stays largely theoretical.

### Decision

Implement wiring in two stages:

1. accounting integration first
2. custody integration second

That means the first deliverable is not "fully private LP". The first deliverable is "perps emits and records encrypted pool deltas into `ShadowPoolV2` without breaking existing user flows."

### Stage 1: Accounting Integration

Add a new settlement path in `ShadowPerps`:

- replace direct dependency on the live public pool contract with a settlement interface compatible with [IShadowPoolSettlementV2.sol](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/contracts/src/interfaces/IShadowPoolSettlementV2.sol)
- when charging fees in `finalizeOpenPosition`, create an encrypted fee amount and call `recordTradingFee(bytes32 feeCtHash)`
- when closing or liquidating, compute the encrypted delta between collateral and payout and call `recordTraderDelta(bytes32 deltaCtHash, bool traderWins)`

Important constraint:

- deltas sent to `ShadowPoolV2` must live in the same trading zone as the pool aggregates

Public ERC-20 transfers can remain temporarily public in Stage 1 if needed for backwards-compatible custody. The important change is that the private accounting book becomes real and starts receiving the same economics as live trading.

### Stage 2: Custody Integration

Move settlement asset balances behind [ConfidentialAssetVault.sol](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/contracts/src/ConfidentialAssetVault.sol):

- LP deposits enter through the vault
- `ShadowPoolV2` becomes the main confidential accounting layer
- `ShadowPerps` stops treating the public pool as the source of truth

At that point, legacy `ShadowPool` can be left for migration and withdrawals only.

### Proposed Contract Changes

`ShadowPerpsV2` or refactored `ShadowPerps`:

- replace current `pool` type with a settlement-aware interface
- add `poolV2` and optionally `assetVault` references
- add internal helpers such as `_recordEncryptedFee` and `_recordEncryptedTraderDelta`
- keep `_settle(...)` public-asset compatible initially, but ensure the same economics are mirrored into `ShadowPoolV2`

`ShadowPoolV2`:

- become the official accounting target for perps fees and PnL deltas
- keep current `recordTraderDelta` and `recordTradingFee` interface
- later add viewer policy for treasury/admin dashboards if needed

`ConfidentialAssetVault`:

- remain transitional in the first milestone
- become primary LP custody after frontend LP flow migrates

### Repo Changes

Contracts:

- update [ShadowPerps.sol](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/contracts/src/ShadowPerps.sol) to depend on [IShadowPoolSettlementV2.sol](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/contracts/src/interfaces/IShadowPoolSettlementV2.sol)
- route fee and trader delta accounting into [ShadowPoolV2.sol](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/contracts/src/ShadowPoolV2.sol)
- keep or temporarily dual-run public custody logic until the vault-backed LP flow is migrated

Frontend:

- no immediate LP UI migration is required for Stage 1
- update env/config to distinguish live public pool from privacy-ready pool

### Acceptance Criteria

- every open fee is recorded in `ShadowPoolV2`
- every close/liquidation PnL delta is recorded in `ShadowPoolV2`
- pool accounting matches live trading economics
- the live perps UX still works during the migration

### Risks

- dual-running public custody and encrypted accounting can drift if one path updates and the other does not
- this stage adds accounting complexity before the LP UI catches up

### Mitigation

Treat Stage 1 as a mirrored-book rollout with invariant checks:

- fee sum recorded in `ShadowPoolV2` must match open-fee events
- trader delta sum recorded in `ShadowPoolV2` must match realized trader PnL

## Recommended Rollout Order

1. land `@cofhe/react` migration behind a thin adapter
2. tighten ACLs and remove `allowGlobal` from live perps paths
3. make the trading zone explicit while still using one shared zone
4. wire `ShadowPerps` fee and delta accounting to `ShadowPoolV2`
5. migrate LP deposit/withdraw UI and custody to the vault-backed path

## Success Metrics

- fewer frontend CoFHE lifecycle bugs during account switching and reconnect
- no remaining broad public ACL on sensitive perps ciphertexts
- encrypted pool books start reflecting live trading economics
- future LP privacy work can build on the same settlement and zone model instead of replacing it again

## References

- Fhenix docs: `https://docs.fhenix.io`
- FHE library and ACL model: `https://cofhe-docs.fhenix.zone/docs/devdocs/solidity-api/FHE`
- CoFHE best practices: `https://cofhe-docs.fhenix.zone/fhe-library/introduction/best-practices`
- Fhenix scaffold example: `https://github.com/FhenixProtocol/cofhe-scaffold-eth`
