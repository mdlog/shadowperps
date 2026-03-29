"use client";

import { useMarket } from "@/hooks/useEngine";
import { formatCurrency, formatCompact } from "@/lib/constants";

interface MarketStatsProps {
  symbol: string;
}

export default function MarketStats({ symbol }: MarketStatsProps) {
  const { data: market } = useMarket(symbol);

  const price = market ? parseFloat(market.price) : 0;
  const volume = market ? parseFloat(market.volume_24h) : 0;
  const fundingRate = market ? parseFloat(market.funding_rate) : 0;
  const openInterest = market ? parseFloat(market.open_interest) : 0;

  const stats = [
    { label: "24h Volume", value: formatCompact(volume) },
    { label: "Open Interest", value: formatCompact(openInterest) },
    { label: "Funding Rate", value: `${fundingRate > 0 ? "+" : ""}${(fundingRate * 100).toFixed(4)}%` },
    { label: "Mark Price", value: formatCurrency(price) },
    { label: "Index Price", value: formatCurrency(price * 0.9998) },
  ];

  return (
    <div className="rounded-[var(--radius-card)] border border-border-subtle bg-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
        <span className="text-xs font-medium tracking-widest uppercase text-text-secondary">
          Market Data
        </span>
        {market && (
          <span className="text-[10px] text-accent/50 font-mono">
            LIVE
          </span>
        )}
      </div>
      <div className="p-4 space-y-0">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`flex items-center justify-between py-2.5 ${i < stats.length - 1 ? "border-b border-border-subtle/50" : ""}`}
          >
            <span className="text-xs text-text-tertiary">{stat.label}</span>
            <span className="text-xs font-mono text-text-secondary tabular-nums">{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
