# Vercel Frontend Deployment

This repo can deploy the **frontend** to Vercel cleanly, as long as the Rust engine is reachable on a **public URL**.

## Recommended Topology

- Frontend: Vercel
- Engine: Railway, VPS, or a temporary public tunnel
- Contracts: existing Arbitrum Sepolia deployments

The browser calls the engine directly through `NEXT_PUBLIC_ENGINE_URL`, so `localhost` will not work for a real Vercel deployment.

## Required Frontend Environment Variables

Set these in the Vercel project before triggering a production build:

```bash
NEXT_PUBLIC_ENGINE_URL=https://<public-engine-domain>
NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_CHART_IMPL=lightweight
NEXT_PUBLIC_SHADOWPERPS_CONTRACT=0xeBdCcDaC7B0b28A2bfF1EEb5Ab16B288487f67D6
NEXT_PUBLIC_ORACLE_CONTRACT=0x9cf7B692CfD764009388884f7bF256523739365C
NEXT_PUBLIC_POOL_CONTRACT=0x6ed20c5B4DBA82D213aeDFc8010eAE3cE5203798
NEXT_PUBLIC_USDC_CONTRACT=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
COFHE_PUBLIC_KEY_URL=https://testnet-cofhe.fhenix.zone
COFHE_VERIFIER_URL=https://testnet-cofhe-vrf.fhenix.zone
COFHE_THRESHOLD_URL=https://testnet-cofhe-tn.fhenix.zone
```

Notes:

- `NEXT_PUBLIC_*` values are baked into the frontend at build time.
- `NEXT_PUBLIC_ENGINE_URL` must be a public URL reachable by users' browsers.
- The app includes `/api/cofhe/*` proxy routes, so those CoFHE upstream URLs are resolved server-side by Vercel.

## Deploy Steps

1. Push this repo to GitHub, GitLab, or Bitbucket.
2. Import the repo into Vercel as a **Next.js** project.
3. Keep the root directory pointed at the repo root.
4. Add the environment variables above in the Vercel dashboard.
5. Deploy.

Because `vercel.json` is included in the repo, Vercel will use:

- `npm ci --legacy-peer-deps` for install
- `npx next build --webpack` for the build step

We intentionally force **webpack** for Vercel production builds because this repo's Web3/FHE client stack has been more reliable there than the default Turbopack production path.

## Engine Options

### Stable

Use Railway or another always-on public host for the Rust engine.

### Demo-only

Run the engine on your laptop and expose it with a public tunnel such as Cloudflare Tunnel or ngrok, then use that public HTTPS URL as `NEXT_PUBLIC_ENGINE_URL`.

This is useful for short demos, but it is not reliable enough for a permanent deployment.

## Troubleshooting

### Build fails because `NEXT_PUBLIC_ENGINE_URL` is missing

That is intentional. In production builds, the app now refuses to silently fall back to `localhost`.

### Frontend deploy succeeds but charts or markets do not load

Check that:

- the engine URL is public and online
- the engine serves HTTPS
- the engine CORS settings still allow browser access from the Vercel domain

### Wallet connects but private flows fail

Verify the Vercel deployment can still reach the CoFHE upstream endpoints configured by:

- `COFHE_PUBLIC_KEY_URL`
- `COFHE_VERIFIER_URL`
- `COFHE_THRESHOLD_URL`
