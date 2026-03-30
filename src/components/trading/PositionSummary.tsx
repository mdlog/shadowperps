"use client";

import { useState, useMemo } from "react";
import { usePositions, useMarkets } from "@/hooks/useEngine";
import { useOnChainPortfolio } from "@/hooks/useOnChainPortfolio";
import { useWallet } from "@/hooks/useWallet";
import { useOnChainTrading } from "@/hooks/useOnChainTrading";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, cn } from "@/lib/constants";
import Badge from "@/components/ui/Badge";

type Tab = "positions" | "history";

export default function PositionSummary() {
  const [tab, setTab] = useState<Tab>("positions");
  const { isConnected } = useWallet();
  const { data: positions } = usePositions();
  const onChainPortfolio = useOnChainPortfolio();
  const { closePosition, status: closeStatus, error: closeError } = useOnChainTrading();
  const queryClient = useQueryClient();
  const { data: markets } = useMarkets();

  const livePrices = useMemo(() => {
    const map: Record<string, number> = {};
    (markets || []).forEach((m) => { map[m.symbol] = parseFloat(m.price); });
    return map;
  }, [markets]);

  const allPositions = positions || [];
  const useOnChainSource = onChainPortfolio.isOnChainReady && !onChainPortfolio.isError;

  // Open positions
  const openPositions = useOnChainSource
    ? onChainPortfolio.data.positions
        .filter((p) => p.status === "open")
        .map((p) => ({
          id: p.id, market: p.market, direction: p.direction, leverage: p.leverage,
          entryPrice: p.entry_price, markPrice: p.mark_price,
          pnl: p.unrealized_pnl, pnlPct: p.pnl_percent,
          marginRatio: p.margin_ratio, onChainId: p.on_chain_id,
        }))
    : allPositions
        .filter((p) => p.status === "open")
        .map((p) => {
          const entry = parseFloat(p.entry_price);
          const size = parseFloat(p.size || "0") || parseFloat(p.collateral || "0") * p.leverage;
          const coll = parseFloat(p.collateral || "0");
          const mark = livePrices[p.market] || parseFloat(p.mark_price);
          const pnl = entry > 0 ? size * (p.direction === "long" ? (mark - entry) / entry : (entry - mark) / entry) : 0;
          return {
            id: p.id, market: p.market, direction: p.direction, leverage: p.leverage,
            entryPrice: entry, markPrice: mark, pnl,
            pnlPct: coll > 0 ? (pnl / coll) * 100 : 0,
            marginRatio: coll > 0 ? Math.max(0, Math.min(1, (coll + pnl) / coll)) : 0,
            onChainId: p.on_chain_id ?? undefined,
          };
        });

  // History (closed + liquidated)
  const history = useOnChainSource
    ? [...onChainPortfolio.data.positions]
        .filter((p) => p.status !== "open")
        .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
        .map((p) => ({
          id: p.id, market: p.market, direction: p.direction, leverage: p.leverage,
          entryPrice: p.entry_price, openedAt: p.opened_at, status: p.status,
        }))
    : [...allPositions]
        .filter((p) => p.status !== "open")
        .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
        .map((p) => ({
          id: p.id, market: p.market, direction: p.direction, leverage: p.leverage,
          entryPrice: parseFloat(p.entry_price), openedAt: p.opened_at, status: p.status,
        }));

  const isClosing = closeStatus === "confirming" || closeStatus === "decrypting" || closeStatus === "pending";

  return (
    <div className="flex h-full min-h-[400px] w-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-border-subtle bg-surface">
      {/* Tabs */}
      <div className="flex items-center border-b border-border-subtle">
        <button
          onClick={() => setTab("positions")}
          className={cn(
            "px-5 py-3 text-xs font-medium tracking-widest uppercase transition-colors relative",
            tab === "positions" ? "text-text-primary" : "text-text-ghost hover:text-text-secondary",
          )}
        >
          Positions
          {openPositions.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-accent/15 text-accent">
              {openPositions.length}
            </span>
          )}
          {tab === "positions" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />}
        </button>
        <button
          onClick={() => setTab("history")}
          className={cn(
            "px-5 py-3 text-xs font-medium tracking-widest uppercase transition-colors relative",
            tab === "history" ? "text-text-primary" : "text-text-ghost hover:text-text-secondary",
          )}
        >
          History
          {history.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-surface text-text-ghost border border-border-subtle">
              {history.length}
            </span>
          )}
          {tab === "history" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />}
        </button>
      </div>

      {/* Tab: Positions */}
      {tab === "positions" && (
        <div className="flex flex-1 flex-col">
          {!isConnected ? (
            <div className="px-5 py-6 text-center flex-1 flex items-center justify-center">
              <p className="text-xs text-text-ghost">Connect wallet to view positions</p>
            </div>
          ) : openPositions.length === 0 ? (
            <div className="px-5 py-6 text-center flex-1 flex items-center justify-center">
              <p className="text-xs text-text-ghost">No open positions</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_0.8fr_0.5fr] gap-2 px-5 py-2 border-b border-border-subtle/50 bg-base/50">
                {["Market", "Entry", "Mark", "PnL", "Margin", ""].map((h) => (
                  <span key={h} className="text-[10px] font-medium tracking-widest uppercase text-text-ghost">{h}</span>
                ))}
              </div>
              <div className="flex-1 divide-y divide-border-subtle/30">
                {openPositions.map((pos) => {
                  const levLabel = pos.leverage >= 10 ? pos.leverage.toFixed(0) : pos.leverage.toFixed(1);
                  return (
                    <div key={pos.id} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_0.8fr_0.5fr] gap-2 px-5 py-3 items-center hover:bg-hover/20 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-medium text-text-primary">{pos.market}</span>
                        <Badge variant={pos.direction === "long" ? "long" : "short"}>
                          {pos.direction} {levLabel}x
                        </Badge>
                      </div>
                      <span className="text-xs font-mono text-text-secondary tabular-nums">{formatCurrency(pos.entryPrice)}</span>
                      <span className="text-xs font-mono text-text-secondary tabular-nums">{formatCurrency(pos.markPrice)}</span>
                      <div className={cn("text-xs font-mono font-medium tabular-nums", pos.pnl >= 0 ? "text-long" : "text-short")}>
                        <div>{pos.pnl >= 0 ? "+" : ""}{formatCurrency(pos.pnl)}</div>
                        <div className="opacity-60 text-[10px]">{pos.pnl >= 0 ? "+" : ""}{pos.pnlPct.toFixed(2)}%</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn("h-full rounded-full", pos.marginRatio > 0.7 ? "bg-long" : pos.marginRatio > 0.4 ? "bg-warning" : "bg-short")}
                            style={{ width: `${pos.marginRatio * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-text-ghost tabular-nums">{(pos.marginRatio * 100).toFixed(0)}%</span>
                      </div>
                      <button
                        disabled={isClosing}
                        onClick={async () => {
                          await closePosition(pos.id, pos.onChainId);
                          await Promise.all([
                            queryClient.invalidateQueries({ queryKey: ["onchain-portfolio"] }),
                            queryClient.invalidateQueries({ queryKey: ["positions"] }),
                            queryClient.invalidateQueries({ queryKey: ["portfolio"] }),
                          ]);
                        }}
                        className="text-[11px] text-short hover:text-short/80 font-medium transition-colors disabled:opacity-40"
                      >
                        {isClosing ? "..." : "Close"}
                      </button>
                    </div>
                  );
                })}
              </div>
              {closeStatus === "error" && closeError && (
                <div className="px-5 py-3 border-t border-border-subtle/30 bg-short-bg/10">
                  <p className="text-[11px] text-short">{closeError}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: History */}
      {tab === "history" && (
        <div className="flex flex-1 flex-col">
          {!isConnected ? (
            <div className="px-5 py-6 text-center flex-1 flex items-center justify-center">
              <p className="text-xs text-text-ghost">Connect wallet to view history</p>
            </div>
          ) : history.length === 0 ? (
            <div className="px-5 py-6 text-center flex-1 flex items-center justify-center">
              <p className="text-xs text-text-ghost">No trade history yet</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-5 px-5 py-2 border-b border-border-subtle/50 bg-base/50">
                {["Market", "Type", "Entry", "Time", "Status"].map((h) => (
                  <span key={h} className="text-[10px] font-medium tracking-widest uppercase text-text-ghost">{h}</span>
                ))}
              </div>
              <div className="flex-1 divide-y divide-border-subtle/30">
                {history.map((pos) => {
                  const isLong = pos.direction === "long";
                  const time = new Date(pos.openedAt);
                  const timeStr = `${time.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
                  const levLabel = pos.leverage >= 10 ? pos.leverage.toFixed(0) : pos.leverage.toFixed(1);
                  const statusVariant = pos.status === "closed" ? "warning" : "short";

                  return (
                    <div key={pos.id} className="grid grid-cols-5 px-5 py-3 items-center hover:bg-hover/20 transition-colors">
                      <span className="text-xs font-mono text-text-primary">{pos.market}</span>
                      <span className={cn("text-xs font-medium", isLong ? "text-long" : "text-short")}>
                        {isLong ? "Long" : "Short"} {levLabel}x
                      </span>
                      <span className="text-xs font-mono text-text-secondary tabular-nums">{formatCurrency(pos.entryPrice)}</span>
                      <span className="text-xs text-text-tertiary">{timeStr}</span>
                      <Badge variant={statusVariant as "warning" | "short"}>
                        {pos.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
