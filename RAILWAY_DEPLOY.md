# Railway Deploy Guide

This repo can be deployed on Railway with **two services in one Railway project**:

- `shadowperps-web` for the Next.js frontend
- `shadowperps-engine` for the Rust backend engine

This is the simplest way to make the app accessible from anywhere without relying on `localhost`.

## Recommended topology

Use one Railway project with two services from the same repo:

1. **Frontend service**
   - root directory: `/`
   - runtime: Next.js app
   - public domain: enabled

2. **Engine service**
   - root directory: `/engine`
   - runtime: Rust / Axum app
   - public domain: enabled

The browser must be able to reach the engine directly, because the frontend calls it from client-side code via `NEXT_PUBLIC_ENGINE_URL`.

## Important repo note

The engine now supports Railway's injected `PORT` automatically.

That support is implemented in:

- [config.rs](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/engine/src/types/config.rs#L18)

So if Railway injects `PORT`, the engine will bind correctly even if `ENGINE_PORT` is not set manually.

## Service 1: Frontend on Railway

Create a Railway service from this repo for the frontend with:

- **Root Directory**: `/`
- **Build Command**: leave default, or `npm install && npm run build`
- **Start Command**: `npm start`

Required frontend environment variables:

```env
NEXT_PUBLIC_ENGINE_URL=https://<your-engine-domain>.up.railway.app
NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_SHADOWPERPS_CONTRACT=0xeBdCcDaC7B0b28A2bfF1EEb5Ab16B288487f67D6
NEXT_PUBLIC_ORACLE_CONTRACT=0x9cf7B692CfD764009388884f7bF256523739365C
NEXT_PUBLIC_POOL_CONTRACT=0x6ed20c5B4DBA82D213aeDFc8010eAE3cE5203798
NEXT_PUBLIC_USDC_CONTRACT=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
```

Optional:

```env
NEXT_PUBLIC_CHART_IMPL=lightweight
```

## Service 2: Rust engine on Railway

Create a second Railway service from the same repo for the engine with:

- **Root Directory**: `/engine`
- **Build Command**: leave default, or `cargo build --release`
- **Start Command**: leave default, or `cargo run --release`

Required engine environment variables:

```env
ENGINE_HOST=0.0.0.0
FHENIX_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
FHENIX_CHAIN_ID=421614
SHADOWPERPS_CONTRACT=0xeBdCcDaC7B0b28A2bfF1EEb5Ab16B288487f67D6
ORACLE_CONTRACT=0x9cf7B692CfD764009388884f7bF256523739365C
ENGINE_PRIVATE_KEY=0x...
PRICE_UPDATE_INTERVAL=30
LIQUIDATION_CHECK_INTERVAL=10
```

Optional:

```env
ENGINE_PORT=3010
RUST_LOG=shadowperps_engine=info,tower_http=info
```

Notes:

- `ENGINE_PRIVATE_KEY` must hold enough Arbitrum Sepolia ETH because the engine syncs oracle prices on-chain.
- `ENGINE_HOST=0.0.0.0` is important for container networking.
- You can omit `ENGINE_PORT` because Railway injects `PORT` automatically and the engine now supports it.

## Deploy order

Deploy in this order:

1. Deploy the **engine** service first
2. Wait until Railway gives it a public URL
3. Put that engine URL into the frontend as `NEXT_PUBLIC_ENGINE_URL`
4. Redeploy the frontend

Example:

```env
NEXT_PUBLIC_ENGINE_URL=https://shadowperps-engine-production.up.railway.app
```

## Health checks

After deploy:

1. Open the engine health endpoint:

```text
https://<engine-domain>.up.railway.app/health
```

2. Open the frontend:

```text
https://<frontend-domain>.up.railway.app
```

3. Verify:

- landing page loads
- `Launch App` opens trade page
- charts load
- wallet can connect
- portfolio page loads
- engine health badge is not offline

## Known production caveats

- CORS is currently wide open in the engine:
  - [routes.rs](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/engine/src/api/routes.rs#L20)
- The LP pool is still public/hybrid:
  - [README.md](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/README.md#L43)
- The frontend uses client-side calls to the engine:
  - [engine-api.ts](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/src/lib/engine-api.ts#L5)
- The CoFHE proxy stays on the frontend domain through Next.js API routes:
  - [CofheReactProvider.tsx](/media/mdlog/mdlog/Project-MDlabs/fhenix/shadowperps-ui/src/components/providers/CofheReactProvider.tsx#L23)

## Railway docs worth checking

Official Railway docs I used as guidance:

- Start command overrides:
  - https://docs.railway.com/guides/start-command
- Private networking / internal DNS:
  - https://docs.railway.com/private-networking

For this app, use the **public engine URL** in `NEXT_PUBLIC_ENGINE_URL`, because the browser needs to call the engine directly.
