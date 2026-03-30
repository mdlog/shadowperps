"use client";

import dynamic from "next/dynamic";
import LightweightChart from "@/components/trading/LightweightChart";
import type { ChartProps } from "@/components/trading/chart-types";

const TradingViewChart = dynamic(() => import("@/components/trading/TradingViewChart"), {
  ssr: false,
  loading: () => (
    <div className="rounded-[var(--radius-card)] border border-border-subtle bg-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle">
        <p className="text-sm font-medium text-text-primary">Loading TradingView...</p>
      </div>
      <div className="h-[500px] w-full animate-pulse bg-base/40" />
    </div>
  ),
});

const chartImpl = (process.env.NEXT_PUBLIC_CHART_IMPL || "lightweight").trim().toLowerCase();

export default function Chart({ className, symbol = "BTC-PERP", onSymbolChange, onIntervalChange }: ChartProps) {
  if (chartImpl === "tradingview") {
    return (
      <TradingViewChart
        className={className}
        symbol={symbol}
        onSymbolChange={onSymbolChange}
        onIntervalChange={onIntervalChange}
      />
    );
  }

  return (
    <LightweightChart
      className={className}
      symbol={symbol}
      onSymbolChange={onSymbolChange}
      onIntervalChange={onIntervalChange}
    />
  );
}
