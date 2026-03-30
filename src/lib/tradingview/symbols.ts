import type { Market } from "@/lib/engine-api";

export interface TradingViewResolvedSymbol {
  name: string;
  ticker: string;
  full_name: string;
  description: string;
  exchange: string;
  listed_exchange: string;
  type: string;
  session: string;
  timezone: string;
  minmov: number;
  pricescale: number;
  has_intraday: boolean;
  has_daily: boolean;
  has_weekly_and_monthly: boolean;
  visible_plots_set: string;
  data_status: string;
  supported_resolutions: string[];
  volume_precision: number;
}

export interface TradingViewSearchSymbol {
  symbol: string;
  full_name: string;
  description: string;
  exchange: string;
  ticker: string;
  type: string;
}

const DEFAULT_SYMBOLS = [
  { symbol: "BTC-PERP", name: "Bitcoin Perpetual" },
  { symbol: "ETH-PERP", name: "Ethereum Perpetual" },
  { symbol: "SOL-PERP", name: "Solana Perpetual" },
] as const;

export const SUPPORTED_TRADINGVIEW_RESOLUTIONS = ["1", "5", "15", "60", "240", "1D"] as const;

function normalizePerpSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function buildTradingViewSearchSymbol(symbol: string, name?: string): TradingViewSearchSymbol {
  const normalized = normalizePerpSymbol(symbol);
  const description = name || normalized.replace("-PERP", " Perpetual");

  return {
    symbol: normalized,
    ticker: normalized,
    full_name: `ShadowPerps:${normalized}`,
    description,
    exchange: "ShadowPerps",
    type: "crypto",
  };
}

export function buildTradingViewResolvedSymbol(symbol: string, name?: string): TradingViewResolvedSymbol {
  const base = buildTradingViewSearchSymbol(symbol, name);

  return {
    name: base.symbol,
    ticker: base.ticker,
    full_name: base.full_name,
    description: base.description,
    exchange: base.exchange,
    listed_exchange: base.exchange,
    type: base.type,
    session: "24x7",
    timezone: "Etc/UTC",
    minmov: 1,
    pricescale: 100,
    has_intraday: true,
    has_daily: true,
    has_weekly_and_monthly: true,
    visible_plots_set: "ohlcv",
    data_status: "streaming",
    supported_resolutions: [...SUPPORTED_TRADINGVIEW_RESOLUTIONS],
    volume_precision: 2,
  };
}

export function stripTradingViewPrefix(symbol: string): string {
  const normalized = symbol.trim();
  if (normalized.includes(":")) {
    return normalizePerpSymbol(normalized.split(":").pop() || normalized);
  }
  return normalizePerpSymbol(normalized);
}

export function getFallbackTradingViewSymbols(): TradingViewSearchSymbol[] {
  return DEFAULT_SYMBOLS.map(({ symbol, name }) => buildTradingViewSearchSymbol(symbol, name));
}

export function buildTradingViewSymbolsFromMarkets(markets: Market[]): TradingViewSearchSymbol[] {
  if (!markets.length) {
    return getFallbackTradingViewSymbols();
  }

  return markets.map((market) => buildTradingViewSearchSymbol(market.symbol, market.name));
}
