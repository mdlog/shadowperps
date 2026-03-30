import { getEngineUrl, engineApi, type Candle, type PriceStreamUpdate } from "@/lib/engine-api";
import {
  buildTradingViewResolvedSymbol,
  buildTradingViewSymbolsFromMarkets,
  getFallbackTradingViewSymbols,
  stripTradingViewPrefix,
  type TradingViewResolvedSymbol,
  type TradingViewSearchSymbol,
} from "@/lib/tradingview/symbols";

type TradingViewResolution = string;
type HistoryMetadata = { noData?: boolean };
type TradingViewBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};
type TradingViewPeriodParams = {
  from: number;
  to: number;
  countBack?: number;
  firstDataRequest?: boolean;
};
type TradingViewLibraryConfig = {
  exchanges: Array<{ value: string; name: string; desc: string }>;
  symbols_types: Array<{ name: string; value: string }>;
  supported_resolutions: string[];
  supports_marks: boolean;
  supports_search: boolean;
  supports_timescale_marks: boolean;
  supports_time: boolean;
};
type SearchSymbolsCallback = (symbols: TradingViewSearchSymbol[]) => void;
type ResolveSymbolCallback = (symbol: TradingViewResolvedSymbol) => void;
type ErrorCallback = (reason: string) => void;
type HistoryCallback = (bars: TradingViewBar[], meta: HistoryMetadata) => void;
type SubscribeBarsCallback = (bar: TradingViewBar) => void;
type ResetCacheCallback = () => void;

interface RealtimeSubscriptionState {
  timer: number | null;
  lastBar: TradingViewBar | null;
  eventSource: EventSource | null;
  listener: ((event: MessageEvent<string>) => void) | null;
  usingFallbackPolling: boolean;
}

export interface ShadowPerpsTradingViewDatafeed {
  onReady: (callback: (config: TradingViewLibraryConfig) => void) => void;
  searchSymbols: (
    userInput: string,
    exchange: string,
    symbolType: string,
    onResultReadyCallback: SearchSymbolsCallback,
  ) => void;
  resolveSymbol: (
    symbolName: string,
    onSymbolResolvedCallback: ResolveSymbolCallback,
    onResolveErrorCallback: ErrorCallback,
  ) => void;
  getBars: (
    symbolInfo: TradingViewResolvedSymbol,
    resolution: TradingViewResolution,
    periodParams: TradingViewPeriodParams,
    onHistoryCallback: HistoryCallback,
    onErrorCallback: ErrorCallback,
  ) => void;
  subscribeBars: (
    symbolInfo: TradingViewResolvedSymbol,
    resolution: TradingViewResolution,
    onRealtimeCallback: SubscribeBarsCallback,
    subscriberUID: string,
    onResetCacheNeededCallback: ResetCacheCallback,
  ) => void;
  unsubscribeBars: (subscriberUID: string) => void;
  getServerTime: (callback: (timestamp: number) => void) => void;
}

const POLL_MS = 5_000;
const subscriptionStates = new Map<string, RealtimeSubscriptionState>();

function mapResolutionToEngineInterval(resolution: TradingViewResolution): string {
  switch (resolution) {
    case "1":
      return "1m";
    case "5":
      return "5m";
    case "15":
      return "15m";
    case "60":
      return "1h";
    case "240":
      return "4h";
    case "1D":
    case "D":
      return "1d";
    default:
      return "1h";
  }
}

function resolutionToMs(resolution: TradingViewResolution): number {
  switch (resolution) {
    case "1":
      return 60_000;
    case "5":
      return 5 * 60_000;
    case "15":
      return 15 * 60_000;
    case "60":
      return 60 * 60_000;
    case "240":
      return 4 * 60 * 60_000;
    case "1D":
    case "D":
      return 24 * 60 * 60_000;
    default:
      return 60 * 60_000;
  }
}

function alignBarTime(timestampMs: number, resolution: TradingViewResolution): number {
  const bucketMs = resolutionToMs(resolution);
  return Math.floor(timestampMs / bucketMs) * bucketMs;
}

function candleToBar(candle: Candle): TradingViewBar {
  return {
    time: candle.time * 1000,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };
}

function hasBarChanged(previousBar: TradingViewBar | null, nextBar: TradingViewBar): boolean {
  if (!previousBar) {
    return true;
  }

  return previousBar.time !== nextBar.time
    || previousBar.open !== nextBar.open
    || previousBar.high !== nextBar.high
    || previousBar.low !== nextBar.low
    || previousBar.close !== nextBar.close
    || previousBar.volume !== nextBar.volume;
}

function parseStreamPrice(value: string | number): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseStreamTimestamp(timestamp: string): number {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function applyPriceUpdateToBar(
  subscription: RealtimeSubscriptionState,
  resolution: TradingViewResolution,
  price: number,
  timestampMs: number,
): TradingViewBar {
  const nextBarTime = alignBarTime(timestampMs, resolution);

  if (!subscription.lastBar) {
    const seededBar = {
      time: nextBarTime,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 0,
    } satisfies TradingViewBar;

    subscription.lastBar = seededBar;
    return seededBar;
  }

  const currentBucketTime = alignBarTime(subscription.lastBar.time, resolution);
  if (nextBarTime > currentBucketTime) {
    const rolledBar = {
      time: nextBarTime,
      open: subscription.lastBar.close,
      high: Math.max(subscription.lastBar.close, price),
      low: Math.min(subscription.lastBar.close, price),
      close: price,
      volume: subscription.lastBar.volume,
    } satisfies TradingViewBar;

    subscription.lastBar = rolledBar;
    return rolledBar;
  }

  const mergedBar = {
    ...subscription.lastBar,
    high: Math.max(subscription.lastBar.high, price),
    low: Math.min(subscription.lastBar.low, price),
    close: price,
  } satisfies TradingViewBar;

  subscription.lastBar = mergedBar;
  return mergedBar;
}

function stopRealtimeResources(subscription: RealtimeSubscriptionState): void {
  if (subscription.timer) {
    window.clearInterval(subscription.timer);
    subscription.timer = null;
  }

  if (subscription.eventSource && subscription.listener) {
    subscription.eventSource.removeEventListener("prices", subscription.listener as EventListener);
  }

  subscription.eventSource?.close();
  subscription.eventSource = null;
  subscription.listener = null;
  subscription.usingFallbackPolling = false;
}

function getPriceStreamUrl(): string {
  return `${getEngineUrl()}/api/stream/prices`;
}

function startPollingFallback(
  subscription: RealtimeSubscriptionState,
  symbolInfo: TradingViewResolvedSymbol,
  resolution: TradingViewResolution,
  onRealtimeCallback: SubscribeBarsCallback,
  onResetCacheNeededCallback: ResetCacheCallback,
): void {
  if (subscription.usingFallbackPolling) {
    return;
  }

  subscription.usingFallbackPolling = true;
  const interval = mapResolutionToEngineInterval(resolution);

  const poll = async () => {
    try {
      const candles = await engineApi.getCandles(symbolInfo.ticker, interval, 2);
      const latest = candles[candles.length - 1];
      if (!latest) {
        return;
      }

      const nextBar = candleToBar(latest);

      if (subscription.lastBar && nextBar.time < subscription.lastBar.time) {
        subscription.lastBar = null;
        onResetCacheNeededCallback();
        return;
      }

      if (hasBarChanged(subscription.lastBar, nextBar)) {
        subscription.lastBar = nextBar;
        onRealtimeCallback(nextBar);
      }
    } catch {
      // Ignore intermittent polling failures.
    }
  };

  poll();
  subscription.timer = window.setInterval(poll, POLL_MS);
}

function filterBarsByPeriod(bars: TradingViewBar[], periodParams: TradingViewPeriodParams): TradingViewBar[] {
  const fromMs = periodParams.from * 1000;
  const toMs = periodParams.to * 1000;

  const filtered = bars.filter((bar) => bar.time >= fromMs && bar.time < toMs);
  if (filtered.length > 0) {
    return filtered;
  }

  return bars;
}

async function fetchResolvedSymbol(symbolName: string): Promise<TradingViewResolvedSymbol> {
  const symbol = stripTradingViewPrefix(symbolName);

  try {
    const market = await engineApi.getMarket(symbol);
    return buildTradingViewResolvedSymbol(market.symbol, market.name);
  } catch {
    return buildTradingViewResolvedSymbol(symbol);
  }
}

async function fetchBars(
  symbolInfo: TradingViewResolvedSymbol,
  resolution: TradingViewResolution,
  periodParams: TradingViewPeriodParams,
): Promise<TradingViewBar[]> {
  const interval = mapResolutionToEngineInterval(resolution);
  const limit = Math.max(200, Math.min(periodParams.countBack || 300, 1000));
  const candles = await engineApi.getCandles(symbolInfo.ticker, interval, limit);
  const bars = candles.map(candleToBar);
  return filterBarsByPeriod(bars, periodParams);
}

export function createShadowPerpsDatafeed(): ShadowPerpsTradingViewDatafeed {
  return {
    onReady(callback) {
      window.setTimeout(() => {
        callback({
          exchanges: [{ value: "ShadowPerps", name: "ShadowPerps", desc: "ShadowPerps" }],
          symbols_types: [{ name: "Crypto", value: "crypto" }],
          supported_resolutions: ["1", "5", "15", "60", "240", "1D"],
          supports_marks: false,
          supports_search: true,
          supports_timescale_marks: false,
          supports_time: true,
        });
      }, 0);
    },

    async searchSymbols(userInput, _exchange, _symbolType, onResultReadyCallback) {
      try {
        const markets = await engineApi.getMarkets();
        const normalizedInput = userInput.trim().toUpperCase();
        const symbols = buildTradingViewSymbolsFromMarkets(markets).filter((symbol) => {
          if (!normalizedInput) {
            return true;
          }

          return symbol.symbol.includes(normalizedInput)
            || symbol.description.toUpperCase().includes(normalizedInput);
        });

        onResultReadyCallback(symbols);
      } catch {
        onResultReadyCallback(
          getFallbackTradingViewSymbols().filter((symbol) => {
            if (!userInput.trim()) {
              return true;
            }

            const normalizedInput = userInput.trim().toUpperCase();
            return symbol.symbol.includes(normalizedInput)
              || symbol.description.toUpperCase().includes(normalizedInput);
          }),
        );
      }
    },

    async resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
      try {
        onSymbolResolvedCallback(await fetchResolvedSymbol(symbolName));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to resolve symbol";
        onResolveErrorCallback(message);
      }
    },

    async getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
      try {
        const bars = await fetchBars(symbolInfo, resolution, periodParams);
        onHistoryCallback(bars, { noData: bars.length === 0 });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to fetch candle history";
        onErrorCallback(message);
      }
    },

    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {
      this.unsubscribeBars(subscriberUID);
      const interval = mapResolutionToEngineInterval(resolution);
      const state: RealtimeSubscriptionState = {
        timer: null,
        lastBar: null,
        eventSource: null,
        listener: null,
        usingFallbackPolling: false,
      };
      const normalizedSymbol = stripTradingViewPrefix(symbolInfo.ticker);

      const seedLastBar = async () => {
        try {
          const candles = await engineApi.getCandles(symbolInfo.ticker, interval, 2);
          const latest = candles[candles.length - 1];
          if (!latest) {
            return;
          }

          state.lastBar = candleToBar(latest);
        } catch {
          startPollingFallback(state, symbolInfo, resolution, onRealtimeCallback, onResetCacheNeededCallback);
        }
      };

      subscriptionStates.set(subscriberUID, state);
      seedLastBar();

      if (typeof window === "undefined" || typeof EventSource === "undefined") {
        startPollingFallback(state, symbolInfo, resolution, onRealtimeCallback, onResetCacheNeededCallback);
        return;
      }

      try {
        const eventSource = new EventSource(getPriceStreamUrl());
        const listener = (event: MessageEvent<string>) => {
          let updates: PriceStreamUpdate[];

          try {
            updates = JSON.parse(event.data) as PriceStreamUpdate[];
          } catch {
            return;
          }

          const update = updates.find((candidate) => stripTradingViewPrefix(candidate.symbol) === normalizedSymbol);
          if (!update) {
            return;
          }

          const price = parseStreamPrice(update.price);
          if (price === null) {
            return;
          }

          const previousBar = state.lastBar;
          const nextBar = applyPriceUpdateToBar(
            state,
            resolution,
            price,
            parseStreamTimestamp(update.timestamp),
          );

          if (hasBarChanged(previousBar, nextBar)) {
            state.lastBar = nextBar;
            onRealtimeCallback(nextBar);
          }
        };

        eventSource.addEventListener("prices", listener as EventListener);
        eventSource.onerror = () => {
          eventSource.close();
          state.eventSource = null;
          state.listener = null;
          startPollingFallback(state, symbolInfo, resolution, onRealtimeCallback, onResetCacheNeededCallback);
        };

        state.eventSource = eventSource;
        state.listener = listener;
      } catch {
        startPollingFallback(state, symbolInfo, resolution, onRealtimeCallback, onResetCacheNeededCallback);
      }
    },

    unsubscribeBars(subscriberUID) {
      const state = subscriptionStates.get(subscriberUID);
      if (state) {
        stopRealtimeResources(state);
        subscriptionStates.delete(subscriberUID);
      }
    },

    getServerTime(callback) {
      callback(Math.floor(Date.now() / 1000));
    },
  };
}
