"use client";

import { useState, useRef, useEffect } from "react";
import { useMarkets } from "@/hooks/useEngine";
import { formatCurrency, cn } from "@/lib/constants";

interface MarketSelectorProps {
  selectedMarket: string;
  onSelectMarket: (symbol: string) => void;
}

export default function MarketSelector({ selectedMarket, onSelectMarket }: MarketSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: markets } = useMarkets();

  const displayMarkets = markets || [];
  const current = displayMarkets.find((m) => m.symbol === selectedMarket);
  const currentPrice = current ? parseFloat(current.price) : 0;
  const currentChange = current ? parseFloat(current.change_24h) : 0;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const iconColor = (symbol: string) =>
    symbol === "BTC-PERP" ? "bg-warning/15 text-warning" :
    symbol === "ETH-PERP" ? "bg-info/15 text-info" :
    "bg-accent/15 text-accent";

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-[var(--radius-card)] border border-border-subtle bg-surface hover:bg-elevated transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold", iconColor(selectedMarket))}>
            {current?.name?.[0] ?? "?"}
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-text-primary">{selectedMarket}</div>
            {currentPrice > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-text-secondary tabular-nums">{formatCurrency(currentPrice)}</span>
                <span className={cn("text-[10px] font-mono tabular-nums", currentChange >= 0 ? "text-long" : "text-short")}>
                  {currentChange >= 0 ? "+" : ""}{currentChange.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Chevron */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={cn("text-text-tertiary transition-transform", open && "rotate-180")}>
          <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-[var(--radius-card)] border border-border-subtle bg-surface shadow-[var(--shadow-elevated)] overflow-hidden animate-fade-down">
          {displayMarkets.map((m) => {
            const price = parseFloat(m.price);
            const change = parseFloat(m.change_24h);
            const isSelected = m.symbol === selectedMarket;

            return (
              <button
                key={m.symbol}
                onClick={() => { onSelectMarket(m.symbol); setOpen(false); }}
                className={cn(
                  "w-full px-4 py-3 flex items-center justify-between transition-colors text-left",
                  isSelected ? "bg-hover/40" : "hover:bg-hover/20",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold", iconColor(m.symbol))}>
                    {m.name[0]}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-text-primary">{m.symbol}</div>
                    <div className="text-[10px] text-text-ghost">{m.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-text-primary tabular-nums">{formatCurrency(price)}</div>
                  <div className={cn("text-[10px] font-mono tabular-nums", change >= 0 ? "text-long" : "text-short")}>
                    {change >= 0 ? "+" : ""}{change.toFixed(2)}%
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
