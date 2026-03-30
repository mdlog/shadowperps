# RFC: TradingView Chart Migration for ShadowPerps

Status: Draft

Date: 2026-03-30

Owner: ShadowPerps frontend + engine team

## Summary

This RFC proposes migrating the current `lightweight-charts` trade chart to TradingView Advanced Charts.

The goal is to give the trade terminal a full analysis surface:

- built-in indicators
- drawing tools
- richer symbol and timeframe controls
- chart marks and private overlays for entries, liquidation levels, and executions

The migration must fit the current app architecture:

- market and candle data still come from the Rust engine
- order flow and portfolio privacy still depend on local wallet-side CoFHE decrypts
- on-chain oracle remains the source of truth for mark and entry values used by the trading product

## Current State

The current chart lives in `src/components/trading/Chart.tsx` and uses `lightweight-charts`.

Today it already supports:

- switching between `BTC-PERP`, `ETH-PERP`, and `SOL-PERP`
- multiple timeframes
- engine-backed historical candles from `engineApi.getCandles(...)`
- a live headline price from `useMarket(symbol)`

Current limitations:

- no built-in indicators
- no drawing toolbar
- no saved layouts or chart templates
- no symbol search UI
- no chart-native execution markers
- no first-class study API for custom strategy overlays

## Goals

- replace the current chart with TradingView Advanced Charts
- preserve existing market data ownership by keeping the Rust engine as the history and realtime source
- support indicators and drawing tools without sending private position data to third parties
- keep the current encrypted trading flow untouched while the chart migrates
- preserve a safe fallback path to the existing chart during rollout

## Non-Goals

- implementing TradingView broker integration
- replacing the engine with a third-party market data provider
- persisting private overlays to any external service
- Pine Script support inside the app
- shipping multi-chart layouts in the first release

## Decision

Adopt TradingView Advanced Charts as a self-hosted, client-only integration behind a feature flag.

Do not use the basic hosted widget for the main trade experience.

Why:

- the hosted widget is easy to embed, but it is not a good fit for custom perp symbols, private overlays, or app-specific execution markers
- Advanced Charts supports built-in indicators, drawing tools, custom datafeeds, marks, and programmatic drawings
- the datafeed API maps cleanly to the engine we already have

Do not start with Trading Platform.

Why:

- Advanced Charts already gives the analysis capability users are asking for
- Trading Platform adds broker and layout features we are not ready to support
- the app does not yet have orderbook, DOM, or broker adapter infrastructure

## Product Fit

TradingView is a good fit for ShadowPerps if we keep a strict separation:

- public market data and candles flow through the engine datafeed
- private position overlays are created locally after wallet-side decrypt
- on-chain values remain the source of truth for entry, mark-sensitive calculations, and position overlays

This keeps the chart more powerful without weakening the privacy model already implemented in the perps flow.

## Architecture

```text
TradingView Advanced Charts (client-only)
  - indicators
  - drawings
  - marks
  - custom symbol search
  - private local overlays

            |
            | IDatafeedChartApi adapter
            v

ShadowPerps TradingView Adapter
  - resolveSymbol
  - getBars
  - subscribeBars
  - getMarks
  - getServerTime

            |
            | REST now, websocket later
            v

Rust Engine
  - /api/markets
  - /api/candles/{symbol}
  - health / server time
  - future realtime feed

            ^
            |
            | local decrypt + on-chain reads
            |

Frontend private overlays
  - open entry line
  - liquidation line
  - open/close execution markers
  - user-only annotations derived from encrypted positions
```

## Why Not Keep `lightweight-charts`

`lightweight-charts` is still excellent for a compact custom chart, but to reach parity with what users expect from "TradingView lengkap", we would otherwise need to build a large amount of functionality ourselves:

- indicator framework
- drawing system
- shape editing
- layout persistence
- marks and study management
- symbol search and richer chart toolbar behavior

That effort is not worth it for this product stage.

## Privacy Model

The most important rule in this RFC:

Private overlays must stay local to the browser session unless the user explicitly opts into saving them.

That means:

- decrypted `direction`, `size`, liquidation levels, and user-specific position markers must not be sent to TradingView-hosted endpoints
- layout persistence that could serialize private overlays must be disabled or replaced with a sanitized local-only persistence strategy
- execution markers derived from public transactions are safe to render broadly
- overlays derived from decrypted private state should be recreated in memory after decrypt, not loaded from remote storage

Recommended first-release policy:

- disable cloud save / external chart storage
- allow local browser layout persistence only for non-private chart preferences
- recreate private drawings on every mount from current on-chain + decrypted state

## Licensing and Distribution Constraints

TradingView Advanced Charts is not treated like a normal public npm package.

The library is accessed through TradingView's private repository and its static assets must be copied into a served directory. That means this migration includes a distribution and repo hygiene decision:

- keep the library out of the public source tree history
- copy runtime assets into `public/charting_library/` during install or setup
- gate the feature behind a local environment flag until access and deployment are stable

## Proposed Rollout

### Phase 0: Access and Feature Flag

Deliverables:

- secure access to TradingView Charting Library
- add an environment flag such as `NEXT_PUBLIC_CHART_IMPL=tradingview`
- keep `lightweight-charts` as the default fallback until the new chart is stable

Why this phase matters:

- the integration cannot proceed safely until the team has legal and technical access to the library
- keeping a runtime fallback lowers product risk

### Phase 1: Client-Only Wrapper

Deliverables:

- add a new client-only wrapper component for TradingView
- load it with `next/dynamic(..., { ssr: false })`
- initialize the widget only in the browser

Notes:

- TradingView libraries are browser-oriented and should not be evaluated on the server
- this phase mirrors the pattern already used for `@cofhe/react`

### Phase 2: Engine Datafeed Adapter

Deliverables:

- implement a local `IDatafeedChartApi` adapter
- map engine markets and candles to TradingView symbols and bars
- support:
  - `searchSymbols`
  - `resolveSymbol`
  - `getBars`
  - `getServerTime`
  - `subscribeBars`
  - `unsubscribeBars`

Initial implementation choice:

- implement `subscribeBars` with polling first
- upgrade to websocket or SSE later when engine realtime infrastructure is ready

Why polling first:

- it keeps scope manageable
- the engine already has working REST data
- the product already tolerates periodic candle refresh

### Phase 3: TradingView UI Configuration

Deliverables:

- enable indicators and drawing toolbar
- restrict visible symbols to supported perp markets
- set branded theme and chart defaults consistent with the app visual system
- disable features we do not want yet, such as unsupported layout sharing paths

Recommended defaults:

- show drawing toolbar
- enable favorites for drawing tools
- enable common indicators
- hide unsupported trading or broker actions
- keep a narrow symbol universe: `BTC-PERP`, `ETH-PERP`, `SOL-PERP`

### Phase 4: Private Overlay Layer

Deliverables:

- create a local overlay controller that reads wallet-decrypted positions and on-chain metadata
- draw private lines and markers on the chart after widget ready
- refresh overlays when:
  - selected market changes
  - wallet account changes
  - on-chain positions refresh
  - decrypt state changes

Overlays to support first:

- entry line
- liquidation line
- current mark reference
- open execution marker
- close execution marker for recently closed positions when available locally

Important constraint:

- private overlays should be tagged internally so they can be removed and recreated without touching user-created drawings

### Phase 5: Public Marks and Timescale Events

Deliverables:

- use `getMarks` or `getTimescaleMarks` for public events
- show public on-chain execution history or liquidations as chart marks where appropriate

Good candidates:

- user's own public transaction timestamps
- oracle update freshness indicators
- liquidation events once the event pipeline is stable

### Phase 6: Realtime Upgrade

Deliverables:

- add websocket or SSE feed from the engine
- replace polling-based `subscribeBars`
- optionally stream mark price or last-trade updates with lower latency

This phase is explicitly deferred because it depends on engine work and is not necessary to unlock indicators and drawing tools.

## Implementation Plan

### New Files

- `src/components/trading/TradingViewChart.tsx`
- `src/components/trading/TradingViewChartClient.tsx`
- `src/lib/tradingview/datafeed.ts`
- `src/lib/tradingview/symbols.ts`
- `src/lib/tradingview/widget-options.ts`
- `src/lib/tradingview/private-overlays.ts`
- `src/lib/tradingview/public-marks.ts`

### Updated Files

- `src/components/trading/Chart.tsx`
- `src/app/trade/page.tsx`
- `src/lib/engine-api.ts`
- optionally `README.md`

### Optional API Additions

These are optional but recommended to clean up adapter code:

- `GET /api/markets` already exists and can power symbol search
- `GET /api/candles/{symbol}` already exists and can power `getBars`
- add a simple server time endpoint if needed for `getServerTime`
- later add websocket or SSE endpoint for realtime bars

## Detailed Design

### 1. Wrapper Strategy

`src/components/trading/Chart.tsx` should become a small switch:

- render `TradingViewChart` when `NEXT_PUBLIC_CHART_IMPL=tradingview`
- otherwise render the current `lightweight-charts` implementation

This preserves a rollback path with minimal routing impact.

### 2. Symbol Model

TradingView expects symbol search and resolution metadata.

We should define a small symbol registry layer:

- internal symbol: `BTC-PERP`
- display name: `BTC Perpetual`
- type: `crypto`
- exchange: `ShadowPerps`
- session: `24x7`
- pricescale: derived from market decimals

The registry should be sourced from engine market data where possible, with a local fallback for the supported perp set.

### 3. Resolution Mapping

Map app intervals to TradingView resolutions:

- `1m -> 1`
- `5m -> 5`
- `15m -> 15`
- `1h -> 60`
- `4h -> 240`
- `1d -> 1D`

The adapter should also normalize reverse mapping for `getBars`.

### 4. Bar Model

Map engine candles to TradingView bar objects:

- `time`: milliseconds since epoch
- `open`
- `high`
- `low`
- `close`
- `volume`

The current engine candle type already contains the necessary OHLCV fields.

### 5. `subscribeBars` First Iteration

The first iteration can use polling inside the adapter:

- poll the latest candle and market price every 3 to 5 seconds for active symbol + resolution
- merge updates into the latest bar
- call `onTick` with the updated or newly closed bar

This is not the final architecture, but it gets the TradingView migration moving without blocking on engine websocket work.

### 6. Private Overlay Controller

`private-overlays.ts` should:

- accept the widget chart API
- accept the selected symbol
- accept the locally available on-chain positions for the wallet
- draw only the overlays relevant to the currently selected market

Suggested overlay IDs:

- `shadowperps:entry:{positionId}`
- `shadowperps:liq:{positionId}`
- `shadowperps:open:{positionId}`
- `shadowperps:close:{positionId}`

Suggested behavior:

- remove all app-managed private overlays before redraw
- never call "remove all shapes" globally, because that would delete user drawings
- apply app-specific styling so user tools remain visually distinct

### 7. Persistence Policy

We should treat persistence as two separate channels:

- chart preferences and public drawings
- private overlays derived from decrypted state

Policy:

- do not persist private overlays remotely
- if local persistence is enabled, store only sanitized chart preferences
- avoid pushing position-derived drawings into any shared save/load path

### 8. Error and Loading UX

The TradingView wrapper should surface a small but explicit state model:

- `loading chart library`
- `resolving symbol`
- `syncing bars`
- `realtime delayed`
- `private overlays unavailable`

This matters because the app already has asynchronous CoFHE and on-chain steps. The chart should not feel broken while datafeed or overlay state is catching up.

## Engine Requirements

The migration does not require a full engine rewrite.

Minimum required from the engine:

- stable `GET /api/markets`
- stable `GET /api/candles/{symbol}`
- consistent market symbol naming

Recommended next engine upgrades:

- websocket or SSE realtime bar feed
- canonical market metadata endpoint including price precision and display labels
- optional execution marks feed

## Security and Privacy Review Points

Before production rollout, review these points explicitly:

- no decrypted private position values are sent to external TradingView services
- no private drawings are included in remote layout save/load
- the fallback chart remains available if the TradingView library fails to initialize
- symbol search cannot escape the supported instrument universe
- public and private marks are clearly separated in the codebase

## Risks

### Access and licensing risk

The team may not yet have stable access to the private TradingView library distribution path.

Mitigation:

- keep the migration behind a feature flag
- preserve the existing chart until access and deployment are proven

### React and Next.js integration risk

The TradingView library is browser-first and can fail if it is evaluated during SSR.

Mitigation:

- force client-only loading with dynamic import
- isolate TradingView code in dedicated client components

### Privacy regression risk

It is easy to accidentally persist or transmit private overlays if save/load features are enabled blindly.

Mitigation:

- disable remote persistence in the first rollout
- rebuild private overlays from current decrypt state only

### Realtime quality risk

Polling-based `subscribeBars` is good enough for an MVP, but not ideal for a terminal experience.

Mitigation:

- ship polling first
- schedule websocket/SSE as the next engine-backed improvement

### Symbol consistency risk

The app currently mixes engine symbols, oracle-backed market state, and on-chain market IDs.

Mitigation:

- centralize symbol mapping in one TradingView adapter module
- use that same module for chart symbol metadata and marks

## Acceptance Criteria

- the trade page can render a TradingView chart for supported perp symbols
- users can use built-in indicators and drawing tools
- candle history still comes from the Rust engine
- chart symbol switching works for current perp markets
- private position overlays are drawn locally and are not sent to external services
- the app can fall back to the current `lightweight-charts` chart

## Recommended Delivery Order

1. Secure TradingView library access and add feature flag.
2. Build client-only wrapper and basic widget options.
3. Implement engine-backed datafeed with history + polling subscribe.
4. Enable drawing tools and indicators.
5. Add private overlay controller.
6. Add public marks.
7. Upgrade realtime transport.

## Proposed First Patch After This RFC

The first implementation patch should be intentionally narrow:

- add the TradingView feature flag
- create a client-only `TradingViewChart` wrapper
- implement `searchSymbols`, `resolveSymbol`, and `getBars`
- keep realtime and overlays out of the first patch

That first patch is enough to prove the integration path without tangling it with privacy-sensitive drawing logic.

## References

- TradingView Advanced Charts key features: https://www.tradingview.com/charting-library-docs/latest/getting_started/Key-Features
- TradingView widget constructor: https://www.tradingview.com/charting-library-docs/latest/core_concepts/Widget-Constructor
- TradingView datafeed API: https://www.tradingview.com/charting-library-docs/latest/api/interfaces/Datafeed.IDatafeedChartApi/
- TradingView drawings API: https://www.tradingview.com/charting-library-docs/latest/ui_elements/drawings/drawings-api
- TradingView drawings overview: https://www.tradingview.com/charting-library-docs/latest/ui_elements/drawings/
- TradingView npm / private repo setup notes: https://www.tradingview.com/charting-library-docs/latest/getting_started/NPM
