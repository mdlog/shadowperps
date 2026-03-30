# ShadowPerps — Wave 1 Submission

> Confidential perpetual trading on Arbitrum Sepolia using Fhenix CoFHE.

## What it does

ShadowPerps is a Confidential DeFi app for on-chain perpetual trading. Traders can open and close leveraged BTC, ETH, and SOL positions while keeping position direction and size encrypted with Fhenix CoFHE.

The current Wave 1 flow is:

1. connect wallet
2. open a confidential position
3. decrypt your own portfolio locally
4. close the position on-chain
5. review realized PnL in history

The product has three layers:

- a Next.js trading terminal with live charts and wallet UX
- Solidity contracts that store sensitive position data as ciphertext handles
- a Rust engine for market data, candles, and oracle sync support

For this wave, confidential perps is the core feature. The LP pool is still public or hybrid and is positioned as the next privacy step, not the current claim.

## The problem it solves

Most on-chain perps are fully transparent. Traders reveal direction, size, leverage, and liquidation risk to anyone watching the chain. That creates MEV risk, whale tracking, strategy leakage, and weak execution quality for serious traders.

ShadowPerps uses Fhenix CoFHE to hide the most strategy-sensitive parts of a trade while still keeping the system on-chain. Instead of broadcasting position details in plaintext, the app encrypts them client-side and lets the contract operate on encrypted values.

## Challenges I ran into

The biggest challenge was adapting the product to the current CoFHE model while keeping the UX demo-ready. The app had to be rebuilt around request/finalize flows, decrypt proofs, and updated access-control patterns.

Frontend integration was also tricky. The CoFHE SDK depends on cryptographic WASM modules, which required careful client-only loading and wallet lifecycle handling in Next.js 16.

A third challenge was product clarity. The perps flow is already meaningfully private, but collateral transfers and the current LP pool are not yet fully confidential. The UX and submission copy had to reflect that honestly.

## Technologies I used

| Layer | Technologies |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Wallet + chain | wagmi, viem, Arbitrum Sepolia |
| FHE client | `@cofhe/sdk`, `@cofhe/react` |
| Smart contracts | Solidity 0.8.25, Hardhat, `@fhenixprotocol/cofhe-contracts` |
| Backend engine | Rust, Axum, Tokio |
| Market data | CryptoCompare |
| Charts | TradingView Lightweight Charts |

## How we built it

We started with the contract layer. `ShadowPerps.sol` uses the CoFHE request/finalize pattern so the contract can validate and settle positions while keeping direction and size encrypted. The open flow encrypts inputs before submission, and the close flow computes encrypted payout data that only the owner can decrypt.

On the frontend, we built a trading terminal in Next.js with wallet connection, charting, transaction states, and a portfolio page that reads ciphertext handles from the contract and decrypts them locally for the connected user.

To make the app feel like a real product instead of a contract demo, we paired it with a Rust engine that serves candles, market data, and oracle sync support.

## What we learned

We learned that FHE is already strong enough to improve DeFi UX today. Protecting position direction and size already changes the quality of on-chain trading in a meaningful way.

We also learned that privacy products need disciplined messaging. It is not enough to encrypt data; you also need to explain clearly what is private now, what is still public, and what comes next.

Finally, we learned that hybrid architecture works well for this stage. A fast frontend, a Rust market-data layer, and Fhenix-powered contracts can deliver a convincing confidential trading experience today while leaving room for deeper privacy in later waves.

## What's next for ShadowPerps

The next step is extending privacy beyond trade execution into pool custody and settlement. That means moving from a public or hybrid LP pool toward encrypted LP balances, private pool accounting, and confidential settlement flows.

After that, we want to push further into Confidential DeFi with:

- private LP and pool accounting
- stronger confidential liquidation flows
- better margin and risk tooling
- eventually, encrypted order book and dark-pool style execution

Wave 1 proves the core thesis: Fhenix can power a real confidential trading experience. The next wave is about expanding that privacy boundary across the rest of the protocol.
