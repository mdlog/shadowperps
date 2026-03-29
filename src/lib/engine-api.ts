// ══════════════════════════════════════════════
//  Rust Engine REST API Client
// ══════════════════════════════════════════════

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || "http://localhost:3010";

// Types matching the Rust engine
export interface Candle {
  time: number;  // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Market {
  symbol: string;
  name: string;
  price: string; // Decimal serialized as string
  change_24h: string;
  volume_24h: string;
  funding_rate: string;
  open_interest: string;
  last_updated: string;
}

export interface Position {
  id: number;
  trader: string;
  market: string;
  direction: "long" | "short";
  size: string;
  collateral: string;
  entry_price: string;
  mark_price: string;
  leverage: number;
  unrealized_pnl: string;
  pnl_percent: string;
  margin_ratio: string;
  liquidation_price: string;
  status: "open" | "closed" | "liquidated";
  opened_at: string;
  on_chain_id: number | null;
  encrypted: boolean;
}

export interface PortfolioSummary {
  total_value: string;
  total_pnl: string;
  total_pnl_percent: string;
  total_collateral: string;
  margin_used: string;
  position_count: number;
}

export interface EngineHealth {
  status: string;
  version: string;
  uptime_secs: number;
  markets_count: number;
  last_price_update: string | null;
  chain_id: number;
  rpc_connected: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

async function fetchEngine<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${ENGINE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Engine API error: ${res.status} ${res.statusText}`);
  }

  const json: ApiResponse<T> = await res.json();
  if (!json.success || !json.data) {
    throw new Error(json.error || "Unknown engine error");
  }

  return json.data;
}

// ── API Methods ──

export const engineApi = {
  health: () =>
    fetch(`${ENGINE_URL}/health`).then((r) => r.json()) as Promise<EngineHealth>,

  getMarkets: () =>
    fetchEngine<Market[]>("/api/markets"),

  getMarket: (symbol: string) =>
    fetchEngine<Market>(`/api/markets/${encodeURIComponent(symbol)}`),

  getPositions: (trader: string) =>
    fetchEngine<Position[]>(`/api/positions?trader=${encodeURIComponent(trader)}`),

  getPosition: (id: number) =>
    fetchEngine<Position>(`/api/positions/${id}`),

  openPosition: (params: {
    market: string;
    direction: "long" | "short";
    size: number;
    collateral: number;
    leverage: number;
    trader: string;
    on_chain_id?: number;
  }) =>
    fetchEngine<Position>("/api/positions/open", {
      method: "POST",
      body: JSON.stringify({
        market: params.market,
        direction: params.direction,
        size: params.size.toString(),
        collateral: params.collateral.toString(),
        leverage: params.leverage,
        trader: params.trader,
        on_chain_id: params.on_chain_id ?? null,
      }),
    }),

  closePosition: (positionId: number, trader: string) =>
    fetchEngine<Position>("/api/positions/close", {
      method: "POST",
      body: JSON.stringify({ position_id: positionId, trader }),
    }),

  getPortfolio: (trader: string) =>
    fetchEngine<PortfolioSummary>(`/api/portfolio?trader=${encodeURIComponent(trader)}`),

  getCandles: (symbol: string, interval = "1h", limit = 200) =>
    fetchEngine<Candle[]>(
      `/api/candles/${encodeURIComponent(symbol)}?interval=${interval}&limit=${limit}`,
    ),
};
