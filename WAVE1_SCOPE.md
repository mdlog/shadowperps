# Wave 1 Scope — ShadowPerps

Status: Active planning doc

Date: 2026-03-30

Related:

- [README.md](./README.md)
- [SUBMISSION.md](./SUBMISSION.md)
- [RFC_TOP3_PRIVACY_ROADMAP.md](./RFC_TOP3_PRIVACY_ROADMAP.md)
- [RFC_FULL_PRIVATE_POOL_ARCHITECTURE.md](./RFC_FULL_PRIVATE_POOL_ARCHITECTURE.md)

## Wave 1 goal

Wave 1 is not about shipping the final privacy architecture.

Wave 1 is about shipping a **credible, stable, demo-ready confidential perps product** built on Fhenix CoFHE, with a clear privacy story and a working end-to-end user flow.

The product story for this wave is:

- ShadowPerps already proves private on-chain trading
- position direction and size are encrypted
- users can trade, decrypt their own portfolio locally, and close positions on-chain
- the pool can remain public or hybrid for now
- full-private pool remains the next-wave roadmap, not the current blocker

## Product thesis for this wave

If we have to choose, prioritize:

1. a smooth confidential trading demo
2. a clear explanation of what is already private today
3. a stable UI and transaction flow
4. a realistic roadmap for private LP next

Do not prioritize:

1. full-private LP architecture implementation
2. perfect protocol completeness
3. speculative infrastructure that does not improve the demo this wave

## Must-have scope

These items define success for Wave 1.

### 1. Core confidential trading flow must work end-to-end

Required user path:

1. connect wallet
2. choose market
3. open position with encrypted inputs
4. see position in portfolio after wallet-side decrypt
5. close position on-chain
6. see result and history update correctly

Repo areas:

- `src/hooks/useOnChainTrading.ts`
- `src/hooks/useOnChainPortfolio.ts`
- `src/app/trade/page.tsx`
- `src/app/portfolio/page.tsx`
- `contracts/src/ShadowPerps.sol`

Definition of done:

- `requestOpenPosition -> finalizeOpenPosition` works
- `requestClosePosition -> finalizeClosePosition` works
- portfolio decrypt works for open positions
- closed positions show correct realized PnL in history

### 2. Privacy claim must be accurate and visible in the UI

For Wave 1, the app must clearly communicate what is private and what is not.

Must be true and consistent:

- direction and size are private
- portfolio values are decrypted locally in the wallet
- collateral and LP pool actions are not yet fully private

Repo areas:

- `src/app/trade/page.tsx`
- `src/app/portfolio/page.tsx`
- `src/app/pool/page.tsx`
- `README.md`
- `SUBMISSION.md`

Definition of done:

- no misleading “fully private everything” wording in the main user flow
- pool page is framed as public or privacy-ready, not falsely full-private
- submission copy matches actual implementation

### 3. Trade and portfolio UI must feel stable enough for judging

The app should feel deliberate and reliable during a live demo.

Must be stable:

- chart loads
- market prices refresh
- order panel states are understandable
- portfolio tabs work
- history shows correct values
- layout feels clean on desktop

Repo areas:

- `src/components/trading/*`
- `src/components/portfolio/*`
- `src/hooks/useOnChainMarket.ts`
- `engine/src/*`

Definition of done:

- no obvious broken states in trade or portfolio
- no blocking UI parse/runtime errors in normal flow
- empty states and loading states are understandable

### 4. Pool page must not undermine the overall product

The pool does not need to be private in Wave 1, but it does need to be coherent.

Must be true:

- pool page loads cleanly
- deposits and withdrawals work if the live pool is enabled
- wording is aligned with current reality
- LP value math is not obviously broken

Repo areas:

- `src/app/pool/page.tsx`
- `contracts/src/ShadowPool.sol`

Definition of done:

- pool can be shown safely in demo, or
- pool is explicitly framed as a secondary/public module if we do not want to feature it prominently

### 5. Demo and submission path must be polished

Judges need a fast path to understand the value.

Required assets:

- crisp project positioning
- one reliable demo flow
- working deployment addresses
- concise explanation of privacy boundaries
- clear “what’s next” story for private LP

Repo areas:

- `README.md`
- `SUBMISSION.md`
- `.env.local`

Definition of done:

- a teammate can run the demo from the repo and explain it consistently
- the privacy story sounds strong without overclaiming

## Nice-to-have scope

These are valuable if time allows, but should not block Wave 1.

### 1. Better transaction UX

- more helpful status messaging for encrypting, decrypting, approving, pending
- friendlier errors for CoFHE/network failures
- better chain mismatch handling

### 2. Better portfolio intelligence

- more accurate risk module
- clearer realized vs unrealized PnL labels
- better formatting for leverage, margin health, and liquidation states

### 3. Stronger pool presentation

- keep the pool page visually aligned with trade and portfolio
- add small educational copy about why pool is public/hybrid in this wave
- optionally show `ShadowPoolV2` as “privacy-ready next step”

### 4. Liquidation demo improvements

- cleaner liquidation state handling
- clearer UI labels around liquidation checks
- optional demo seed data or guided scenario

### 5. Technical cleanup that improves confidence

- more contract tests for current live perps path
- more frontend guards against undefined contract addresses
- lighter code cleanup in docs and env wiring

## Park for next wave

These items are explicitly out of Wave 1 unless something changes.

### 1. Full-private pool implementation

Do not attempt in this wave:

- private LP balances end-to-end in production path
- private LP deposit ingress from public wallet
- private LP withdrawals through shield/unshield flow
- replacing the public pool with the full-private pool stack

Related roadmap:

- [RFC_FULL_PRIVATE_POOL_ARCHITECTURE.md](./RFC_FULL_PRIVATE_POOL_ARCHITECTURE.md)

### 2. `ShadowPerpsV2` private settlement rewrite

Do not attempt in this wave:

- moving all collateral custody into a confidential vault
- replacing live settlement with vault-native private settlement
- productionizing `ShadowPoolV2` as the main pool

### 3. Private LP migration tooling

Do not attempt in this wave:

- public pool to private pool migration contract
- shielded LP migration UX
- legacy balance conversion flows

### 4. Broad protocol expansion

Do not attempt in this wave:

- encrypted order book
- dark pool matching
- cross-margin redesign
- institutional API
- multi-chain expansion

## Recommended Wave 1 headline

Use this positioning consistently:

**Confidential perpetual trading on Arbitrum Sepolia using Fhenix CoFHE.**

Support statement:

- live encrypted order flow for perps
- wallet-local portfolio decryption
- privacy-ready LP roadmap

Avoid this headline for Wave 1:

- fully private trading and LP protocol

That claim is too broad for the current implementation.

## Recommended demo script

This is the main flow we should optimize for.

1. Open the trade page and show live chart + market data
2. Connect wallet
3. Explain that order direction and size are encrypted before submission
4. Open a position on-chain
5. Show that the portfolio view is decrypted locally in the wallet
6. Close the position
7. Show history with realized PnL
8. Mention the pool as public/hybrid for now and point to private LP as the next wave

If time is limited during judging, this flow should still work in under a few minutes.

## Recommended engineering priority order

### Priority 1

- stabilize `trade`
- stabilize `portfolio`
- verify realized PnL and decrypt flows

### Priority 2

- clean up copy and privacy messaging
- ensure pool page is coherent, even if secondary
- tighten demo flow

### Priority 3

- small UX improvements
- extra tests
- additional polish on edge states

### Priority 4

- privacy-ready pool scaffolding presentation
- roadmap docs

## Definition of Wave 1 success

Wave 1 is successful if:

- the judges can see a real Fhenix-powered encrypted trading flow
- the core demo does not break
- the privacy boundary is honest and compelling
- the project looks intentionally built, not like a partial prototype
- the next-wave private LP story is ready without blocking the current build

## Definition of Wave 1 failure

Wave 1 is at risk if:

- the team spends most time on full-private pool work that never reaches demo quality
- the trading flow is unstable during judging
- the privacy claims overstate what the code currently does
- too much UI surface area exists, but the core path is unreliable

## Concrete task triage

### Must finish before evaluation

- verify open/close demo flow on deployed contracts
- verify portfolio decrypt and history correctness
- verify market/oracle/chart path is working
- verify trade, portfolio, and pool pages have no obvious UI regressions
- align README/submission copy with actual privacy scope

### Do if time remains

- polish transaction status UX
- improve portfolio risk and formatting
- tighten error handling for CoFHE/network states
- improve pool page explanatory copy

### Do not start unless Must finish is done

- private pool production implementation
- `ShadowPerpsV2`
- shielded ingress architecture
- migration tooling for LP privacy

## Next-wave bridge

At the end of Wave 1, the team should be able to say:

- Wave 1 proved confidential perps on Fhenix
- Wave 2 can extend that privacy model into LP custody and settlement

That is a strong and believable progression for this repo.
