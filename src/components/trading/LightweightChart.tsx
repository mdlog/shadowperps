"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  type IChartApi,
  type CandlestickData,
  type Time,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
} from "lightweight-charts";
import { useQuery } from "@tanstack/react-query";
import { engineApi, type Candle } from "@/lib/engine-api";
import { useMarket } from "@/hooks/useEngine";
import { cn, formatCurrency } from "@/lib/constants";
import MarketSelector from "@/components/trading/MarketSelector";
import type { ChartProps } from "./chart-types";

const TIMEFRAMES = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
] as const;

export default function LightweightChart({
  className,
  symbol = "BTC-PERP",
  onSymbolChange,
  onIntervalChange,
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candleSeriesRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volumeSeriesRef = useRef<any>(null);
  const [timeframe, setTimeframe] = useState("1h");

  const { data: marketData } = useMarket(symbol);
  const livePrice = marketData ? Number.parseFloat(marketData.price) : null;

  const { data: candles, isFetching: isFetchingCandles, isError: candlesError } = useQuery<Candle[]>({
    queryKey: ["candles", symbol, timeframe],
    queryFn: () => engineApi.getCandles(symbol, timeframe, 200),
    enabled: !!symbol,
    staleTime: 0,
    refetchInterval: 30_000,
    retry: 2,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0a0a10" },
        textColor: "#55556e",
        fontFamily: "var(--font-mono), JetBrains Mono, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1a1a28" },
        horzLines: { color: "#1a1a28" },
      },
      crosshair: {
        vertLine: { color: "#3ecf8e33", labelBackgroundColor: "#16161f" },
        horzLine: { color: "#3ecf8e33", labelBackgroundColor: "#16161f" },
      },
      rightPriceScale: {
        borderColor: "#1a1a28",
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: "#1a1a28",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#3ecf8e",
      downColor: "#ef6b6b",
      borderDownColor: "#ef6b6b",
      borderUpColor: "#3ecf8e",
      wickDownColor: "#ef6b6b88",
      wickUpColor: "#3ecf8e88",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    candleSeriesRef.current.setData([]);
    volumeSeriesRef.current.setData([]);
  }, [symbol, timeframe]);

  useEffect(() => {
    onIntervalChange?.(timeframe);
  }, [onIntervalChange, timeframe]);

  useEffect(() => {
    if (!candles || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    const candleData: CandlestickData<Time>[] = candles.map((c) => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData = candles.map((c) => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? "#3ecf8e20" : "#ef6b6b20",
    }));

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [candles, livePrice]);

  const priceChange = useMemo(() => {
    if (!candles || candles.length === 0) {
      return 0;
    }

    const first = candles[0];
    if (!first.open) {
      return 0;
    }

    const price = livePrice || candles[candles.length - 1].close;
    return ((price - first.open) / first.open) * 100;
  }, [candles, livePrice]);

  return (
    <div className={cn("rounded-[var(--radius-card)] border border-border-subtle bg-surface overflow-hidden", className)}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-4">
          {onSymbolChange ? (
            <MarketSelector
              selectedMarket={symbol}
              onSelectMarket={onSymbolChange}
              variant="inline"
            />
          ) : (
            <span className="text-sm font-semibold text-text-primary">{symbol}</span>
          )}
          {livePrice && (
            <>
              <span className="font-mono text-lg font-medium text-text-primary tabular-nums">
                {formatCurrency(livePrice)}
              </span>
              <span
                className={cn(
                  "font-mono text-sm tabular-nums",
                  priceChange >= 0 ? "text-long" : "text-short",
                )}
              >
                {priceChange >= 0 ? "+" : ""}
                {priceChange.toFixed(2)}%
              </span>
            </>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent/70 font-mono">
            LIVE
          </span>
          {isFetchingCandles && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-info/10 text-info/80 font-mono">
              SYNCING
            </span>
          )}
          {candlesError && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-short/10 text-short/80 font-mono">
              CANDLES ERROR
            </span>
          )}
        </div>

        <div className="hidden lg:flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-mono rounded transition-colors",
                timeframe === tf.value
                  ? "bg-surface text-text-primary border border-border-default"
                  : "text-text-tertiary hover:text-text-secondary",
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="h-[500px] w-full" />
    </div>
  );
}
