"use client";

import { usePositions, useMarkets } from "@/hooks/useEngine";
import { useOnChainPortfolio } from "@/hooks/useOnChainPortfolio";
import { useWallet } from "@/hooks/useWallet";
import { useOnChainTrading } from "@/hooks/useOnChainTrading";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { formatCurrency, cn } from "@/lib/constants";
import Badge from "@/components/ui/Badge";

export default function PositionSummary() {
  const { isConnected } = useWallet();
  const { data: positions } = usePositions();
  const onChainPortfolio = useOnChainPortfolio();
  const { closePosition, status: closeStatus, error: closeError } = useOnChainTrading();
  const queryClient = useQueryClient();

  const { data: markets } = useMarkets();

  // Build live price map from market data (same source as chart)
  const livePrices = useMemo(() => {
    const map: Record<string, number> = {};
    (markets || []).forEach((m) => { map[m.symbol] = parseFloat(m.price); });
    return map;
  }, [markets]);

  const allPositions = positions || [];
  const useOnChainSource = onChainPortfolio.isOnChainReady && !onChainPortfolio.isError;
  const openPositions = useOnChainSource
    ? onChainPortfolio.data.positions
      .filter((position) => position.status === "open")
      .map((position) => ({
        id: position.id,
        market: position.market,
        direction: position.direction,
        leverage: position.leverage,
        entryPrice: position.entry_price,
        markPrice: position.mark_price,
        pnl: position.unrealized_pnl,
        pnlPct: position.pnl_percent,
        marginRatio: position.margin_ratio,
        onChainId: position.on_chain_id,
      }))
    : allPositions
      .filter((position) => position.status === "open")
      .map((position) => {
        const entryPrice = parseFloat(position.entry_price);
        const size = parseFloat(position.size || "0") || parseFloat(position.collateral || "0") * position.leverage;
        const collateral = parseFloat(position.collateral || "0");
        const markPrice = livePrices[position.market] || parseFloat(position.mark_price);
        const pnl = entryPrice > 0
          ? size * (
            position.direction === "long"
              ? (markPrice - entryPrice) / entryPrice
              : (entryPrice - markPrice) / entryPrice
          )
          : 0;

        return {
          id: position.id,
          market: position.market,
          direction: position.direction,
          leverage: position.leverage,
          entryPrice,
          markPrice,
          pnl,
          pnlPct: collateral > 0 ? (pnl / collateral) * 100 : 0,
          marginRatio: collateral > 0 ? Math.max(0, Math.min(1, (collateral + pnl) / collateral)) : 0,
          onChainId: position.on_chain_id ?? undefined,
        };
      });
  const liquidatedPositions = useOnChainSource
    ? onChainPortfolio.data.positions
      .filter((position) => position.status === "liquidated")
      .map((position) => ({
        id: position.id,
        market: position.market,
        direction: position.direction,
        leverage: position.leverage,
      }))
    : allPositions
      .filter((position) => position.status === "liquidated")
      .map((position) => ({
        id: position.id,
        market: position.market,
        direction: position.direction,
        leverage: position.leverage,
      }));
  const isClosing = closeStatus === "confirming" || closeStatus === "decrypting" || closeStatus === "pending";

  return (
    <div className="rounded-[var(--radius-card)] border border-border-subtle bg-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
        <span className="text-xs font-medium tracking-widest uppercase text-text-secondary">
          Open Positions
        </span>
        <Badge variant="encrypted">
          {isConnected ? `${openPositions.length} Active` : "Not Connected"}
        </Badge>
      </div>

      {!isConnected ? (
        <div className="px-5 py-6 text-center">
          <p className="text-xs text-text-ghost">Connect wallet to view positions</p>
        </div>
      ) : openPositions.length === 0 && liquidatedPositions.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <p className="text-xs text-text-ghost">No open positions</p>
        </div>
      ) : (
        <>
          {/* Table header */}
          {openPositions.length > 0 && (
            <div className="grid grid-cols-[1fr_80px_80px_80px_70px_70px] gap-2 px-5 py-2 border-b border-border-subtle/50 bg-base/50">
              {["Market", "Entry", "Mark", "PnL", "Margin", ""].map((h) => (
                <span key={h} className="text-[10px] font-medium tracking-widest uppercase text-text-ghost">{h}</span>
              ))}
            </div>
          )}

          <div className="divide-y divide-border-subtle/30">
            {/* Liquidated */}
            {liquidatedPositions.map((pos) => (
              <div key={pos.id} className="grid grid-cols-[1fr_80px_80px_80px_70px_70px] gap-2 px-5 py-3 items-center bg-short-bg/20">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-primary">{pos.market}</span>
                  <Badge variant="short">LIQ</Badge>
                </div>
                <span className="text-xs font-mono text-text-ghost tabular-nums">—</span>
                <span className="text-xs font-mono text-text-ghost tabular-nums">—</span>
                <span className="text-xs font-mono text-short tabular-nums">-100%</span>
                <span className="text-xs font-mono text-short tabular-nums">0%</span>
                <span />
              </div>
            ))}

            {/* Open */}
            {openPositions.map((pos) => {
              const leverageLabel = pos.leverage >= 10 ? pos.leverage.toFixed(0) : pos.leverage.toFixed(1);

              return (
                <div key={pos.id} className="grid grid-cols-[1fr_80px_80px_80px_70px_70px] gap-2 px-5 py-3 items-center hover:bg-hover/20 transition-colors">
                  {/* Market + Direction */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-text-primary">{pos.market}</span>
                    <Badge variant={pos.direction === "long" ? "long" : "short"}>
                      {pos.direction} {leverageLabel}x
                    </Badge>
                  </div>

                  {/* Entry */}
                  <span className="text-xs font-mono text-text-secondary tabular-nums">
                    {formatCurrency(pos.entryPrice)}
                  </span>

                  {/* Mark */}
                  <span className="text-xs font-mono text-text-secondary tabular-nums">
                    {formatCurrency(pos.markPrice)}
                  </span>

                  {/* PnL */}
                  <div className={cn("text-xs font-mono font-medium tabular-nums", pos.pnl >= 0 ? "text-long" : "text-short")}>
                    <div>{pos.pnl >= 0 ? "+" : ""}{formatCurrency(pos.pnl)}</div>
                    <div className="opacity-60 text-[10px]">{pos.pnl >= 0 ? "+" : ""}{pos.pnlPct.toFixed(2)}%</div>
                  </div>

                  {/* Margin bar */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", pos.marginRatio > 0.7 ? "bg-long" : pos.marginRatio > 0.4 ? "bg-warning" : "bg-short")}
                        style={{ width: `${pos.marginRatio * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-text-ghost tabular-nums">
                      {(pos.marginRatio * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* Close */}
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
  );
}
