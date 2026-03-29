# ShadowPerps — Confidential Perpetual Trading Engine

> Hidden positions. Encrypted collateral. MEV-resistant execution.

---

## What it does

ShadowPerps is a confidential perpetual trading platform where every position is encrypted using Fully Homomorphic Encryption (FHE). Traders can open long/short positions on BTC, ETH, and SOL with up to 50x leverage — without exposing their position size, collateral, entry price, or liquidation threshold to anyone on-chain.

The platform consists of three layers working together:

- **Trading Terminal** — a real-time interface with live candlestick charts, market data from CryptoCompare, and a one-click order panel that encrypts parameters before submission
- **Rust Engine** — a high-performance backend that provides live price feeds, PnL calculation, position management, and a liquidation engine running as background tasks
- **FHE Smart Contracts** — Solidity contracts on Arbitrum Sepolia using Fhenix CoFHE, where all position data is stored as encrypted ciphertexts that only the position owner can decrypt

When a trader opens a position, the CoFHE SDK encrypts the size, collateral, and leverage client-side. The encrypted ciphertext is submitted on-chain, where the contract performs arithmetic (fee calculation, PnL, liquidation checks) entirely in the encrypted domain. No validator, MEV bot, or competing trader can see what you are doing.

---

## The problem it solves

DeFi perpetual trading today has a fundamental flaw: **everything is public**.

- **Position visibility** — anyone can see your size, leverage, and liquidation price on a block explorer
- **MEV and front-running** — bots read the mempool, copy your trades, and execute sandwich attacks before your transaction lands
- **Whale tracking** — large positions get spotted instantly, allowing adversaries to manipulate the market against you or target your liquidation price
- **Strategy leakage** — professional traders cannot operate on-chain without revealing their alpha to everyone

Existing solutions like dYdX and Hyperliquid run off-chain order books, which introduces centralization and trust assumptions. ShadowPerps keeps everything on-chain but makes the data confidential through FHE — you get the transparency guarantees of blockchain with the privacy of a dark pool.

---

## Challenges I ran into

**FHE SDK evolution** — Fhenix transitioned from a standalone L2 (Helium/Nitrogen testnets with `fhenixjs`) to the CoFHE coprocessor model (`@cofhe/sdk`) during development. This required a complete rewrite of the encryption layer, chain configuration, and contract access control patterns (from `Permissioned` + `sealoutput` to `FHE.allowThis()` + `FHE.allowSender()`).

**WASM bundling with Next.js 16** — The CoFHE SDK uses WASM modules (TFHE library) that conflict with Turbopack's bundler. Solved by lazy-loading the entire `@cofhe/sdk/web` module via dynamic imports with `webpackIgnore` directives, deferring WASM initialization until the first encryption call at runtime.

**Live price data reliability** — CoinGecko's free API rate-limits aggressively (403 errors). Switched the Rust engine to CryptoCompare's `pricemultifull` endpoint which provides price, 24h change, and volume in a single reliable call. Candle (OHLCV) data also comes from CryptoCompare's `histohour`/`histominute`/`histoday` endpoints.

**Encrypted arithmetic constraints** — FHE operations like division and comparison are expensive and have precision limitations with `euint64`. PnL calculation required careful ordering of multiply-before-divide operations and using `FHE.select()` for conditional logic (profit vs loss path) instead of branching, since encrypted values cannot be used in `if` statements.

**Hybrid architecture** — The app needs to work both with and without deployed contracts (engine-only mode for development, full on-chain mode for testnet). Built a dual-path system in `useOnChainTrading` that automatically detects whether contract addresses are configured and routes accordingly.

---

## Technologies I used

| Layer | Technology | Role |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript | Trading terminal UI |
| Styling | Tailwind CSS 4 | Design system |
| Charts | TradingView Lightweight Charts v5 | Real-time candlestick charts |
| Wallet | wagmi, viem | Wallet connection + chain management |
| FHE Client | @cofhe/sdk, @cofhe/sdk/web | Client-side FHE encryption |
| Data Fetching | @tanstack/react-query | Caching, polling, mutations |
| Engine | Rust, Axum, Tokio | High-performance trading engine |
| Price Feed | CryptoCompare API | Live OHLCV + market data |
| HTTP Client | reqwest (Rust) | Price feed + API proxy |
| Smart Contracts | Solidity 0.8.25, Hardhat | On-chain logic |
| FHE Contracts | @fhenixprotocol/cofhe-contracts | Encrypted types + operations |
| Chain | Arbitrum Sepolia (421614) | Testnet deployment |
| Persistence | File-based JSON (engine) | Position survival across restarts |

---

## How we built it

**Phase 1 — Smart Contracts.** Designed `ShadowPerps.sol` with FHE-encrypted position structs (`euint64` for size, collateral, entry price, leverage). The contract uses `FHE.asEuint64()` to convert encrypted inputs, performs validation with `FHE.req()`, calculates fees with encrypted arithmetic, and grants decryption access via `FHE.allowSender()`. A `MockPriceOracle.sol` provides price feeds for testnet, with a deployment script that initializes BTC, ETH, and SOL markets.

**Phase 2 — Rust Engine.** Built a high-performance trading engine in Rust using Axum for the HTTP server and Tokio for async runtime. The engine has three background services: a price feed that polls CryptoCompare every 30 seconds, a position manager with file-based persistence, and a liquidation engine that checks margin ratios every 10 seconds. The REST API exposes endpoints for markets, candles, positions, portfolio, and liquidation events.

**Phase 3 — Frontend Integration.** Connected the Next.js UI to real data sources. wagmi handles wallet connection to Arbitrum Sepolia. React Query polls the Rust engine for live prices and position updates. TradingView Lightweight Charts renders real OHLCV candles. The `useOnChainTrading` hook implements a hybrid flow: when contracts are deployed, it encrypts order parameters via CoFHE SDK and submits on-chain transactions; otherwise, it falls back to the engine REST API.

**Phase 4 — CoFHE Migration.** Migrated from the deprecated Fhenix L2 model to CoFHE coprocessor on Arbitrum Sepolia. Updated contracts to use `@fhenixprotocol/cofhe-contracts` with the new access control pattern (`FHE.allowThis`, `FHE.allowSender`). Replaced `fhenixjs` with `@cofhe/sdk/web` using lazy dynamic imports to handle WASM compatibility. Updated chain configuration from custom Fhenix networks to standard Arbitrum Sepolia.

---

## What we learned

- **FHE is production-viable for DeFi** — encrypted arithmetic on `euint64` is sufficient for perpetual trading math (PnL, fees, margin). The CoFHE coprocessor model makes it deployable on any EVM chain without waiting for a specialized L2.

- **Hybrid architecture is essential** — building a system that works both off-chain (engine mode) and on-chain (FHE mode) made development and testing far more productive. The engine provides instant feedback during development, while the contract path ensures real confidentiality in production.

- **Rust is the right choice for trading engines** — the Axum + Tokio stack handles concurrent price feeds, liquidation checks, and API requests with minimal resource usage. Rust's type system caught dozens of decimal precision bugs at compile time that would have been runtime errors in other languages.

- **CoFHE's permit system is powerful** — the ability to grant per-address decryption access (`FHE.allowSender`) means we can build a UI where only the connected wallet can see their own position data, while the contract can still perform computation on that data. This is a fundamental improvement over simple encryption.

- **Dynamic SDK loading solves bundler conflicts** — modern frontend bundlers (Turbopack, webpack) struggle with WASM modules from cryptographic libraries. Lazy-loading via `import()` with `webpackIgnore` is a clean pattern that defers initialization without sacrificing type safety.

---

## What's next for ShadowPerps

- **Mainnet deployment** — migrate from Arbitrum Sepolia to Arbitrum One once CoFHE is production-ready on mainnet, with real USDC collateral and Chainlink/Pyth oracle integration

- **Encrypted order book** — implement a fully private limit order book where even pending orders are FHE-encrypted, eliminating front-running entirely

- **Cross-margin system** — allow traders to share collateral across multiple positions with encrypted margin calculations

- **Dark pool execution** — large orders can be matched privately between counterparties without market impact, using FHE to verify matching conditions without revealing order details

- **Institutional API** — REST and WebSocket APIs for programmatic trading with FHE key management, enabling hedge funds and market makers to operate confidentially on-chain

- **Multi-chain expansion** — deploy CoFHE contracts on Base, Ethereum mainnet, and other supported chains, with the Rust engine managing positions across all chains from a single interface

- **On-chain liquidation with privacy** — currently the liquidation engine runs off-chain; the next step is implementing fully encrypted on-chain liquidation where even the liquidation threshold is hidden from liquidators until the condition is met
