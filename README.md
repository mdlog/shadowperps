# ShadowPerps

Confidential perpetual trading prototype on Arbitrum Sepolia using Fhenix CoFHE.

This repository now contains:

- a live perps flow where `direction` and `size` are encrypted with CoFHE
- a Next.js 16 frontend that opens, closes, and decrypts positions locally in the connected wallet
- a Rust engine for market data, candles, and oracle sync
- a public LP pool v1 that is still non-private
- a privacy-ready LP scaffold (`ConfidentialAssetVault` + `ShadowPoolV2`) that is deployed but not yet wired into the live app

## What Is Live Today

### Perps

- `requestOpenPosition -> finalizeOpenPosition` is live
- `requestClosePosition -> finalizeClosePosition` is live
- position `direction` and `size` are submitted as encrypted CoFHE inputs
- portfolio reads ciphertext handles from `ShadowPerps`, then decrypts locally in the wallet
- trade and portfolio use the on-chain oracle as the shared source of truth for entry and mark prices

### Market Data

- chart, candles, and market list come from the Rust engine
- the engine fetches live prices from CryptoCompare
- the engine also syncs those prices to the on-chain mock oracle on an interval

### LP

- `/pool` is still backed by the legacy public `ShadowPool`
- LP deposit, withdraw, LP balances, and pool stats are still plaintext on-chain
- privacy-ready LP contracts exist in `contracts/src/ConfidentialAssetVault.sol` and `contracts/src/ShadowPoolV2.sol`, but they are not integrated into the frontend or live perps settlement yet

## Privacy Scope

What is private today:

- position direction
- position notional size
- close payout ciphertext before wallet-side decrypt
- liquidation check ciphertext before decrypt

What is still public today:

- wallet address
- transaction timing and gas usage
- market symbol
- USDC collateral deposit amount
- opening fee amount
- LP deposits and withdrawals
- pool TVL and LP balances in the current `/pool` flow

Important: this app does **not** provide fully private collateral or fully private LP accounting in the live deployment yet.

## Current Architecture

```text
Frontend (Next.js 16, React 19)
  - wagmi + viem
  - @cofhe/sdk
  - local wallet-side decrypt
  - /api/cofhe/* proxy routes for CoFHE services

        |
        | encrypted request/finalize flow
        v

Smart Contracts (Solidity 0.8.25)
  - ShadowPerps.sol        live confidential perps flow
  - MockPriceOracle.sol    live on-chain oracle
  - ShadowPool.sol         live public LP pool
  - ShadowPoolV2.sol       privacy-ready LP scaffold
  - ConfidentialAssetVault.sol privacy-ready vault scaffold

        ^
        |
        | price sync txs
        |

Engine (Rust / Axum)
  - live market prices
  - candles endpoint
  - legacy position endpoints
  - periodic oracle sync
```

## Current Deployments

Current Arbitrum Sepolia addresses from `.env.local`:

### Live app deployment

- `ShadowPerps`: `0xeBdCcDaC7B0b28A2bfF1EEb5Ab16B288487f67D6`
- `MockPriceOracle`: `0x9cf7B692CfD764009388884f7bF256523739365C`
- `ShadowPool`: `0x6ed20c5B4DBA82D213aeDFc8010eAE3cE5203798`
- `USDC`: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`

### Privacy-ready LP scaffold deployment

- `ConfidentialAssetVault`: `0xf7fb1473A321E30C44Cc445069De4464e00CAb9E`
- `ShadowPoolV2`: `0xdf86Ba46B021973885CCD78B67032F067EF3a53B`

These LP privacy-ready contracts are deployed for groundwork only. The frontend still uses `ShadowPool` v1.

## Main Flows

### Open Position

1. User enters market, collateral, direction, and leverage in the UI.
2. Frontend converts collateral to public USDC amount and size to encrypted CoFHE input.
3. Frontend calls `requestOpenPosition(...)`.
4. Wallet decrypts the validation boolean.
5. Frontend calls `finalizeOpenPosition(...)`.
6. Contract transfers public USDC collateral, charges the public fee, and stores encrypted position fields on-chain.

### Close Position

1. Frontend calls `requestClosePosition(...)`.
2. Contract computes encrypted payout and stores a payout ciphertext handle.
3. Wallet decrypts payout through CoFHE.
4. Frontend calls `finalizeClosePosition(...)` with the decrypt proof.

### Portfolio

1. Frontend reads `getTraderPositionIds`, `getPositionMeta`, and `getPositionCiphertexts`.
2. Wallet decrypts `direction` and `size` locally.
3. UI computes PnL, leverage, margin ratio, and liquidation price client-side from on-chain data plus oracle price.

## Repository Layout

```text
shadowperps-ui/
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── trade/page.tsx
│   │   ├── portfolio/page.tsx
│   │   ├── pool/page.tsx
│   │   └── api/cofhe/...
│   ├── components/
│   ├── hooks/
│   │   ├── useOnChainTrading.ts
│   │   ├── useOnChainPortfolio.ts
│   │   ├── useOnChainMarket.ts
│   │   └── useEngine.ts
│   └── lib/
│       ├── fhenix.ts
│       ├── contracts.ts
│       ├── wagmi.ts
│       └── engine-api.ts
├── contracts/
│   ├── src/
│   │   ├── ShadowPerps.sol
│   │   ├── ShadowPool.sol
│   │   ├── ShadowPoolV2.sol
│   │   ├── ConfidentialAssetVault.sol
│   │   └── MockPriceOracle.sol
│   └── scripts/
├── engine/
│   └── src/
├── SHADOWPOOL_PRIVACY_READY.md
└── .env.example
```

## Tech Stack

| Layer | Stack | Notes |
|---|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 | Trading UI |
| Wallet / Chain | wagmi, viem | Arbitrum Sepolia |
| FHE Client | `@cofhe/sdk` | Browser encrypt/decrypt |
| Contracts | Solidity 0.8.25, `@fhenixprotocol/cofhe-contracts` | CoFHE request/finalize |
| Engine | Rust, Axum, Tokio | Prices, candles, oracle sync |

## Prerequisites

- Node.js 20+
- npm
- Rust toolchain
- an injected wallet such as MetaMask
- Arbitrum Sepolia ETH for gas
- test USDC on the configured Arbitrum Sepolia token address

## Setup

### 1. Install dependencies

```bash
npm install
npm --prefix contracts install
cd engine && cargo build && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Set the variables you actually need for local development:

```env
NEXT_PUBLIC_ENGINE_URL=http://localhost:3010
NEXT_PUBLIC_CHAIN_ID=421614

NEXT_PUBLIC_SHADOWPERPS_CONTRACT=0x...
NEXT_PUBLIC_ORACLE_CONTRACT=0x...
NEXT_PUBLIC_POOL_CONTRACT=0x...
NEXT_PUBLIC_USDC_CONTRACT=0x...

FHENIX_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
ENGINE_PRIVATE_KEY=0x...
DEPLOYER_PRIVATE_KEY=0x...
```

Important:

- do not commit funded private keys
- the engine private key needs gas if oracle sync is enabled
- if `ENGINE_PRIVATE_KEY`, `FHENIX_RPC_URL`, or `ORACLE_CONTRACT` are missing, oracle sync is disabled automatically

### 3. Start the engine

```bash
cd engine
cargo run
```

The engine serves:

- `GET /health`
- `GET /api/markets`
- `GET /api/markets/{symbol}`
- `GET /api/candles/{symbol}`
- `GET /api/positions`
- `POST /api/positions/open`
- `POST /api/positions/close`
- `GET /api/portfolio`
- `GET /api/liquidations`

### 4. Start the frontend

```bash
npm run dev
```

Open `http://localhost:3000`.

## Smart Contract Commands

### Compile

```bash
npm --prefix contracts run compile
```

### Deploy live perps stack

This uses the existing live-stack deploy path.

```bash
npm --prefix contracts run deploy:arb-sepolia
```

### Deploy privacy-ready LP scaffold

This deploys `ConfidentialAssetVault` and `ShadowPoolV2` only.

```bash
npm --prefix contracts run deploy:privacy:arb-sepolia
```

This does **not** switch the frontend to private LP mode automatically.

## Frontend Notes

### CoFHE proxy routes

The frontend now proxies CoFHE upstream traffic through local Next.js route handlers:

- `/api/cofhe/cofhe/*`
- `/api/cofhe/verifier/*`
- `/api/cofhe/threshold/*`

This avoids direct browser calls to Fhenix domains and helps with CORS or browser network policy issues.

### Key storage

The app disables CoFHE's default iframe-backed persistent key store and uses non-persistent key fetching instead. This avoids `Failed to rehydrate keys store` errors caused by blocked iframe shared storage.

## Known Limitations

### Live limitations

- collateral is still public because settlement uses a normal ERC-20 USDC
- LP deposit/withdraw is still public
- pool stats and LP balances are still public in `/pool`
- perps settlement still uses the live public `ShadowPool`
- engine oracle sync sends real transactions, so it continuously spends gas while enabled

### Architecture limitations

- `MockPriceOracle` is still a project-controlled oracle, not a production oracle network
- the engine remains part of the price and UX path
- the privacy-ready LP contracts are deployed but not integrated into live trading or `/pool`

## Troubleshooting

### Open / close fails with CoFHE network errors

- restart `npm run dev`
- hard refresh the browser
- confirm the app can reach the local Next `/api/cofhe/*` routes
- confirm the upstream Fhenix testnet services are reachable from the server running Next

### `HTTP 428` during close

This usually means the Threshold Network has not finished processing the ciphertext yet. The frontend already retries with backoff, so wait and retry the close flow.

### Mark price looked the same as entry

That usually means the on-chain oracle had not been refreshed yet. The engine now syncs market prices to the oracle, so make sure the Rust engine is running and funded for gas.

## Verification Tips

If you want to verify that an order really used FHE:

- inspect `requestOpenPosition` calldata on Arbiscan
- confirm `directionInput` and `sizeInput` are encrypted tuples, not plaintext booleans or integers
- confirm the tx flow includes both request and finalize steps
- confirm portfolio data is coming from `getPositionCiphertexts(...)` and local decrypt, not only from the engine

## Related Docs

- [SHADOWPOOL_PRIVACY_READY.md](./SHADOWPOOL_PRIVACY_READY.md)

## License

MIT
