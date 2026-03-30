"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatUnits, parseAbiItem } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import LightweightChart from "@/components/trading/LightweightChart";
import MarketSelector from "@/components/trading/MarketSelector";
import { useMarket } from "@/hooks/useEngine";
import { useOnChainPortfolio } from "@/hooks/useOnChainPortfolio";
import { cn, formatCurrency } from "@/lib/constants";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import { createShadowPerpsDatafeed } from "@/lib/tradingview/datafeed";
import { stripTradingViewPrefix } from "@/lib/tradingview/symbols";
import {
  clearExecutionMarkers,
  drawExecutionMarkers,
  type TradingViewExecutionMarker,
} from "@/lib/tradingview/execution-markers";
import {
  clearPrivatePositionOverlays,
  drawPrivatePositionOverlays,
  type TradingViewEntityId,
  type TradingViewOverlayChartApi,
} from "@/lib/tradingview/private-overlays";
import type { ChartProps } from "./chart-types";

type TradingViewSymbolInfo = {
  name?: string;
  ticker?: string;
  full_name?: string;
};

type TradingViewChartSubscription<TCallback> = {
  subscribe: (context: unknown, callback: TCallback) => void;
  unsubscribe: (context: unknown, callback: TCallback) => void;
};

type TradingViewChartApi = TradingViewOverlayChartApi & {
  onSymbolChanged: () => TradingViewChartSubscription<(symbol: TradingViewSymbolInfo) => void>;
  onIntervalChanged: () => TradingViewChartSubscription<(interval: string, timeframe?: { timeframe?: unknown }) => void>;
  resolution: () => string;
};

type TradingViewWidget = {
  remove: () => void;
  onChartReady: (callback: () => void) => void;
  activeChart: () => TradingViewChartApi;
  setSymbol: (symbol: string, interval: string, callback: () => void) => void;
  symbolInterval?: () => { symbol: string; interval: string };
};

type TradingViewGlobal = {
  widget: new (options: Record<string, unknown>) => TradingViewWidget;
};

declare global {
  interface Window {
    TradingView?: TradingViewGlobal;
  }
}

const CHARTING_LIBRARY_PATH = "/charting_library/";
const CHARTING_LIBRARY_SCRIPT = `${CHARTING_LIBRARY_PATH}charting_library.js`;
const ORACLE_DECIMALS = 8;
const USDC_DECIMALS = 6;

let tradingViewScriptPromise: Promise<void> | null = null;

function loadTradingViewLibrary(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("TradingView can only load in the browser"));
  }

  if (window.TradingView?.widget) {
    return Promise.resolve();
  }

  if (tradingViewScriptPromise) {
    return tradingViewScriptPromise;
  }

  tradingViewScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-tradingview-charting-library='true']");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load TradingView library script")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = CHARTING_LIBRARY_SCRIPT;
    script.async = true;
    script.dataset.tradingviewChartingLibrary = "true";
    script.onload = () => {
      if (window.TradingView?.widget) {
        resolve();
        return;
      }

      reject(new Error("TradingView library loaded but widget constructor is unavailable"));
    };
    script.onerror = () => reject(new Error("Failed to load TradingView library script"));
    document.head.appendChild(script);
  });

  return tradingViewScriptPromise;
}

function ChartStatus({ tone, children }: { tone: "ok" | "warn" | "error"; children: string }) {
  const toneClasses = tone === "error"
    ? "bg-short/10 text-short/80"
    : tone === "warn"
      ? "bg-warning/10 text-warning/80"
      : "bg-info/10 text-info/80";

  return (
    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-mono", toneClasses)}>
      {children}
    </span>
  );
}

function absBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function formatSignedUsdc(value: bigint): string {
  const prefix = value > 0n ? "+" : value < 0n ? "-" : "";
  return `${prefix}${formatCurrency(Number.parseFloat(formatUnits(absBigInt(value), USDC_DECIMALS)))}`;
}

async function loadExecutionMarkers(params: {
  address: `0x${string}`;
  contractAddress: `0x${string}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  publicClient: any;
  positions: ReturnType<typeof useOnChainPortfolio>["data"]["positions"];
}): Promise<TradingViewExecutionMarker[]> {
  const { address, contractAddress, publicClient, positions } = params;
  if (!positions.length) {
    return [];
  }

  const positionById = new Map(positions.map((position) => [BigInt(position.id), position] as const));

  const [openedLogs, closeRequestedLogs, closedLogs, liquidatedLogs] = await Promise.all([
    publicClient.getLogs({
      address: contractAddress,
      event: parseAbiItem(
        "event PositionOpened(uint256 indexed positionId, address indexed trader, bytes32 indexed marketId, uint256 collateral)",
      ),
      args: { trader: address },
      fromBlock: 0n,
    }),
    publicClient.getLogs({
      address: contractAddress,
      event: parseAbiItem(
        "event CloseRequested(uint256 indexed positionId, bytes32 payoutCtHash, uint256 exitPrice)",
      ),
      fromBlock: 0n,
    }),
    publicClient.getLogs({
      address: contractAddress,
      event: parseAbiItem(
        "event PositionClosed(uint256 indexed positionId, address indexed trader, uint256 payout, int256 pnl)",
      ),
      args: { trader: address },
      fromBlock: 0n,
    }),
    publicClient.getLogs({
      address: contractAddress,
      event: parseAbiItem(
        "event PositionLiquidated(uint256 indexed positionId, address indexed trader, uint256 collateralLost)",
      ),
      args: { trader: address },
      fromBlock: 0n,
    }),
  ]);

  const relevantCloseRequests = closeRequestedLogs.filter(
    (log: { args?: { positionId?: bigint; exitPrice?: bigint } }) =>
      log.args?.positionId !== undefined && positionById.has(log.args.positionId),
  );

  const uniqueBlockNumbers = [
    ...new Set(
      [...openedLogs, ...closedLogs, ...liquidatedLogs]
        .map((log: { blockNumber?: bigint }) => log.blockNumber)
        .filter((blockNumber: bigint | undefined): blockNumber is bigint => blockNumber !== undefined),
    ),
  ];

  const blocks = await Promise.all(uniqueBlockNumbers.map((blockNumber) => publicClient.getBlock({ blockNumber })));
  const timestampByBlock = new Map(
    blocks.map((block: { number: bigint; timestamp: bigint }) => [block.number, Number(block.timestamp)]),
  );

  const exitPriceByPositionId = new Map(
    relevantCloseRequests.map((log: { args?: { positionId?: bigint; exitPrice?: bigint } }) => [
      log.args?.positionId?.toString() || "",
      Number.parseFloat(formatUnits(log.args?.exitPrice || 0n, ORACLE_DECIMALS)),
    ]),
  );

  const markers: TradingViewExecutionMarker[] = [];

  for (const log of openedLogs) {
    const positionId = log.args.positionId;
    const position = positionById.get(positionId);
    if (!position) {
      continue;
    }

    markers.push({
      key: `open:${position.id}:${log.blockNumber}`,
      market: position.market,
      time: timestampByBlock.get(log.blockNumber) || Math.floor(Date.parse(position.opened_at) / 1000),
      price: position.entry_price,
      text: `OPEN ${position.direction === "long" ? "LONG" : "SHORT"} #${position.id}`,
      color: position.direction === "long" ? "#3ecf8e" : "#f3b64c",
    });
  }

  for (const log of closedLogs) {
    const positionId = log.args.positionId;
    const position = positionById.get(positionId);
    if (!position) {
      continue;
    }
    const exitPrice = exitPriceByPositionId.get(positionId.toString());
    const markerPrice = typeof exitPrice === "number" ? exitPrice : position.mark_price || position.entry_price;

    markers.push({
      key: `close:${position.id}:${log.blockNumber}`,
      market: position.market,
      time: timestampByBlock.get(log.blockNumber) || Math.floor(Date.parse(position.opened_at) / 1000),
      price: markerPrice,
      text: `CLOSE ${formatSignedUsdc(log.args.pnl)}`,
      color: log.args.pnl >= 0n ? "#3ecf8e" : "#ef6b6b",
    });
  }

  for (const log of liquidatedLogs) {
    const positionId = log.args.positionId;
    const position = positionById.get(positionId);
    if (!position) {
      continue;
    }

    markers.push({
      key: `liq:${position.id}:${log.blockNumber}`,
      market: position.market,
      time: timestampByBlock.get(log.blockNumber) || Math.floor(Date.parse(position.opened_at) / 1000),
      price: position.liquidation_price || position.mark_price || position.entry_price,
      text: `LIQUIDATED #${position.id}`,
      color: "#ef6b6b",
    });
  }

  return markers.sort((left, right) => left.time - right.time);
}

export default function TradingViewChart({
  className,
  symbol = "BTC-PERP",
  onSymbolChange,
  onIntervalChange,
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TradingViewWidget | null>(null);
  const overlayIdsRef = useRef<TradingViewEntityId[]>([]);
  const markerIdsRef = useRef<TradingViewEntityId[]>([]);
  const desiredSymbolRef = useRef(symbol);
  const onSymbolChangeRef = useRef<ChartProps["onSymbolChange"]>(undefined);
  const onIntervalChangeRef = useRef<ChartProps["onIntervalChange"]>(undefined);
  const [libraryState, setLibraryState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [activeSymbol, setActiveSymbol] = useState(symbol);
  const [activeInterval, setActiveInterval] = useState("60");
  const [overlayCount, setOverlayCount] = useState(0);
  const [markerCount, setMarkerCount] = useState(0);
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const contractAddress = CONTRACT_ADDRESSES.shadowPerps;
  const displaySymbol = libraryState === "ready" ? activeSymbol : symbol;
  const { data: marketData } = useMarket(displaySymbol);
  const { data: portfolio, isFetching: isPortfolioFetching, isOnChainReady } = useOnChainPortfolio();
  const livePrice = marketData ? Number.parseFloat(marketData.price) : null;
  const datafeed = useMemo(() => createShadowPerpsDatafeed(), []);
  const positionSignature = useMemo(
    () => (portfolio?.positions || [])
      .map((position) => `${position.id}:${position.status}:${position.market}`)
      .join("|"),
    [portfolio?.positions],
  );

  const executionMarkersQuery = useQuery<TradingViewExecutionMarker[]>({
    queryKey: ["tv-execution-markers", address, contractAddress, positionSignature],
    enabled: Boolean(address && publicClient && contractAddress && (portfolio?.positions.length ?? 0) > 0),
    staleTime: 10_000,
    refetchInterval: 15_000,
    queryFn: () => loadExecutionMarkers({
      address: address!,
      contractAddress,
      publicClient,
      positions: portfolio?.positions || [],
    }),
  });

  useEffect(() => {
    desiredSymbolRef.current = symbol;
  }, [symbol]);

  useEffect(() => {
    onSymbolChangeRef.current = onSymbolChange;
    onIntervalChangeRef.current = onIntervalChange;
  }, [onIntervalChange, onSymbolChange]);

  useEffect(() => {
    onIntervalChangeRef.current?.(activeInterval);
  }, [activeInterval]);

  useEffect(() => {
    let cancelled = false;
    let symbolChangedCallback: ((symbolInfo: TradingViewSymbolInfo) => void) | null = null;
    let intervalChangedCallback: ((interval: string, timeframe?: { timeframe?: unknown }) => void) | null = null;

    const initWidget = async () => {
      if (!containerRef.current) return;

      setLibraryState("loading");
      setLibraryError(null);

      try {
        await loadTradingViewLibrary();
        if (cancelled || !containerRef.current || !window.TradingView?.widget) {
          return;
        }

        widgetRef.current?.remove?.();
        containerRef.current.innerHTML = "";

        const widget = new window.TradingView.widget({
          autosize: true,
          container: containerRef.current,
          datafeed,
          symbol: desiredSymbolRef.current,
          interval: "60",
          locale: "en",
          timezone: "Etc/UTC",
          theme: "Dark",
          library_path: CHARTING_LIBRARY_PATH,
          fullscreen: false,
          hide_top_toolbar: false,
          hide_legend: false,
          allow_symbol_change: true,
          studies_access: {
            type: "black",
            tools: [],
          },
          disabled_features: [
            "header_compare",
            "use_localstorage_for_settings",
          ],
          enabled_features: [
            "study_templates",
            "header_symbol_search",
            "symbol_search_hot_key",
            "side_toolbar_in_fullscreen_mode",
          ],
          custom_css_url: "/tradingview-shadowperps.css",
          loading_screen: {
            backgroundColor: "#0a0a10",
            foregroundColor: "#3ecf8e",
          },
        });

        widgetRef.current = widget;
        widget.onChartReady(() => {
          if (cancelled) {
            return;
          }

          const chart = widget.activeChart();
          const symbolInterval = widget.symbolInterval?.();

          setLibraryState("ready");
          setActiveSymbol(stripTradingViewPrefix(symbolInterval?.symbol || desiredSymbolRef.current));
          setActiveInterval(symbolInterval?.interval || chart.resolution?.() || "60");

          symbolChangedCallback = (symbolInfo: TradingViewSymbolInfo) => {
            const nextSymbol = stripTradingViewPrefix(
              symbolInfo.ticker || symbolInfo.name || symbolInfo.full_name || desiredSymbolRef.current,
            );
            setActiveSymbol(nextSymbol);
            onSymbolChangeRef.current?.(nextSymbol);
          };

          intervalChangedCallback = (interval: string) => {
            setActiveInterval(interval);
            onIntervalChangeRef.current?.(interval);
          };

          chart.onSymbolChanged().subscribe(null, symbolChangedCallback);
          chart.onIntervalChanged().subscribe(null, intervalChangedCallback);
        });
      } catch (error) {
        if (!cancelled) {
          setLibraryState("error");
          setLibraryError(error instanceof Error ? error.message : "TradingView failed to initialize");
        }
      }
    };

    initWidget();

    return () => {
      cancelled = true;
      const chart = widgetRef.current?.activeChart?.();
      if (chart && symbolChangedCallback) {
        chart.onSymbolChanged().unsubscribe(null, symbolChangedCallback);
      }
      if (chart && intervalChangedCallback) {
        chart.onIntervalChanged().unsubscribe(null, intervalChangedCallback);
      }
      clearPrivatePositionOverlays(chart ?? null, overlayIdsRef.current);
      clearExecutionMarkers(chart ?? null, markerIdsRef.current);
      overlayIdsRef.current = [];
      markerIdsRef.current = [];
      setOverlayCount(0);
      setMarkerCount(0);
      widgetRef.current?.remove?.();
      widgetRef.current = null;
    };
  }, [datafeed]);

  useEffect(() => {
    if (libraryState !== "ready" || !widgetRef.current) {
      return;
    }

    const normalizedPropSymbol = stripTradingViewPrefix(symbol);
    const normalizedActiveSymbol = stripTradingViewPrefix(activeSymbol);
    if (normalizedPropSymbol === normalizedActiveSymbol) {
      return;
    }

    widgetRef.current.setSymbol(symbol, activeInterval || "60", () => {
      setActiveSymbol(normalizedPropSymbol);
    });
  }, [activeInterval, activeSymbol, libraryState, symbol]);

  useEffect(() => {
    if (libraryState !== "ready") {
      return;
    }

    const chart = widgetRef.current?.activeChart?.();
    if (!chart) {
      return;
    }

    const redraw = async () => {
      const market = stripTradingViewPrefix(activeSymbol || symbol);
      const positions = (portfolio?.positions || []).filter(
        (position) => position.status === "open" && stripTradingViewPrefix(position.market) === market,
      );

      clearPrivatePositionOverlays(chart, overlayIdsRef.current);
      overlayIdsRef.current = [];

      if (!positions.length) {
        setOverlayCount(0);
        return;
      }

      const overlayIds = await drawPrivatePositionOverlays(chart, positions);
      overlayIdsRef.current = overlayIds;
      setOverlayCount(overlayIds.length);
    };

    redraw().catch(() => {
      setOverlayCount(0);
    });
  }, [activeSymbol, libraryState, portfolio?.positions, symbol]);

  useEffect(() => {
    if (libraryState !== "ready") {
      return;
    }

    const chart = widgetRef.current?.activeChart?.();
    if (!chart) {
      return;
    }

    const redrawMarkers = async () => {
      const market = stripTradingViewPrefix(activeSymbol || symbol);
      const markers = (executionMarkersQuery.data || []).filter(
        (marker) => stripTradingViewPrefix(marker.market) === market,
      );

      clearExecutionMarkers(chart, markerIdsRef.current);
      markerIdsRef.current = [];

      if (!markers.length) {
        setMarkerCount(0);
        return;
      }

      const markerIds = await drawExecutionMarkers(chart, markers);
      markerIdsRef.current = markerIds;
      setMarkerCount(markerIds.length);
    };

    redrawMarkers().catch(() => {
      setMarkerCount(0);
    });
  }, [activeSymbol, executionMarkersQuery.data, libraryState, symbol]);

  if (libraryState === "error") {
    return (
      <div className="space-y-3">
        <div className="rounded-[var(--radius-card)] border border-warning/20 bg-warning/5 px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-text-primary">TradingView belum siap di environment ini</p>
              <p className="mt-1 text-xs text-text-secondary">
                {libraryError || "Aset Charting Library belum tersedia di public/charting_library."}
              </p>
            </div>
            <ChartStatus tone="warn">FALLBACK ACTIVE</ChartStatus>
          </div>
        </div>
        <LightweightChart
          className={className}
          symbol={symbol}
          onSymbolChange={onSymbolChange}
          onIntervalChange={onIntervalChange}
        />
      </div>
    );
  }

  return (
    <div className={cn("rounded-[var(--radius-card)] border border-border-subtle bg-surface overflow-hidden", className)}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          {onSymbolChange ? (
            <MarketSelector
              selectedMarket={displaySymbol}
              onSelectMarket={onSymbolChange}
              variant="inline"
            />
          ) : (
            <span className="text-sm font-semibold text-text-primary">{displaySymbol}</span>
          )}
          <ChartStatus tone={libraryState === "ready" ? "ok" : "warn"}>
            {libraryState === "ready" ? "TV BETA" : "LOADING TV"}
          </ChartStatus>
          <ChartStatus tone="ok">{activeInterval}</ChartStatus>
          {livePrice && (
            <span className="font-mono text-lg font-medium text-text-primary tabular-nums">
              {formatCurrency(livePrice)}
            </span>
          )}
        </div>

        <div className="hidden lg:flex items-center gap-2">
          <ChartStatus tone="ok">ENGINE DATAFEED</ChartStatus>
          <ChartStatus tone="warn">INDICATORS ENABLED</ChartStatus>
          {isOnChainReady && (
            <ChartStatus tone={overlayCount > 0 ? "ok" : "warn"}>
              {isPortfolioFetching ? "DECRYPTING OVERLAYS" : `PRIVATE OVERLAYS ${overlayCount}`}
            </ChartStatus>
          )}
          <ChartStatus tone={markerCount > 0 ? "ok" : "warn"}>
            {executionMarkersQuery.isFetching ? "SYNCING MARKERS" : `EXEC MARKERS ${markerCount}`}
          </ChartStatus>
        </div>
      </div>

      <div className="px-5 py-2 border-b border-border-subtle/70 bg-base/40">
        <p className="text-[11px] text-text-tertiary">
          TradingView is using ShadowPerps market data through the local engine adapter. Entry and liquidation overlays are now redrawn locally from wallet-decrypted on-chain positions.
        </p>
      </div>

      <div ref={containerRef} className="h-[500px] w-full" />
    </div>
  );
}
