"use client";

import { useOnChainPortfolio } from "@/hooks/useOnChainPortfolio";
import { useWallet } from "@/hooks/useWallet";
import { formatCurrency, cn } from "@/lib/constants";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

export default function TradeHistory() {
  const { isConnected } = useWallet();
  const { data: portfolio } = useOnChainPortfolio();

  const closedPositions = portfolio.positions
    .filter((p) => p.status === "closed" || p.status === "liquidated")
    .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime());

  // Calculate realized PnL totals
  const totalRealizedPnl = closedPositions.reduce((sum, p) => sum + (p.realized_pnl ?? 0), 0);
  const wins = closedPositions.filter((p) => p.status === "closed" && (p.realized_pnl ?? 0) > 0).length;
  const losses = closedPositions.filter((p) => p.status === "closed" && (p.realized_pnl ?? 0) <= 0).length;
  const liquidations = closedPositions.filter((p) => p.status === "liquidated").length;
  const winRate = closedPositions.length > 0 ? (wins / closedPositions.length) * 100 : 0;

  if (!isConnected) {
    return (
      <Card className="p-6 text-center">
        <p className="text-xs text-text-ghost">Connect wallet to view trade history</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-secondary tracking-widest uppercase">
          Trade History
        </h2>
        <span className="text-[10px] text-text-ghost">{closedPositions.length} trades</span>
      </div>

      {/* Realized PnL Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-1">Realized PnL</div>
          <div className={cn("text-lg font-mono font-medium tabular-nums", totalRealizedPnl >= 0 ? "text-long" : "text-short")}>
            {totalRealizedPnl >= 0 ? "+" : ""}{formatCurrency(totalRealizedPnl)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-1">Win Rate</div>
          <div className="text-lg font-mono font-medium text-text-primary tabular-nums">
            {winRate.toFixed(0)}%
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-1">Wins / Losses</div>
          <div className="text-lg font-mono font-medium tabular-nums">
            <span className="text-long">{wins}</span>
            <span className="text-text-ghost"> / </span>
            <span className="text-short">{losses}</span>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-1">Liquidations</div>
          <div className={cn("text-lg font-mono font-medium tabular-nums", liquidations > 0 ? "text-short" : "text-text-primary")}>
            {liquidations}
          </div>
        </Card>
      </div>

      {/* History Table */}
      {closedPositions.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-xs text-text-ghost">No closed trades yet</p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_0.8fr] gap-2 px-5 py-2.5 border-b border-border-subtle/50 bg-base/50">
            {["Market", "Type", "Entry", "PnL", "Time", "Result"].map((h) => (
              <span key={h} className="text-[10px] font-medium tracking-widest uppercase text-text-ghost">{h}</span>
            ))}
          </div>
          <div className="divide-y divide-border-subtle/30">
            {closedPositions.map((pos) => {
              const isLong = pos.direction === "long";
              const isLiq = pos.status === "liquidated";
              const pnl = pos.realized_pnl ?? 0;
              const levLabel = pos.leverage >= 10 ? pos.leverage.toFixed(0) : pos.leverage.toFixed(1);
              const time = new Date(pos.opened_at);
              const timeStr = `${time.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;

              return (
                <div key={pos.id} className={cn(
                  "grid grid-cols-[1.2fr_1fr_1fr_1fr_1fr_0.8fr] gap-2 px-5 py-3 items-center hover:bg-hover/20 transition-colors",
                  isLiq && "bg-short-bg/10",
                )}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text-primary">{pos.market}</span>
                  </div>
                  <span className={cn("text-xs font-medium", isLong ? "text-long" : "text-short")}>
                    {isLong ? "Long" : "Short"} {levLabel}x
                  </span>
                  <span className="text-xs font-mono text-text-secondary tabular-nums">
                    {formatCurrency(pos.entry_price)}
                  </span>
                  <div className={cn("text-xs font-mono font-medium tabular-nums", pnl >= 0 ? "text-long" : "text-short")}>
                    {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}
                  </div>
                  <span className="text-xs text-text-tertiary">{timeStr}</span>
                  <Badge variant={isLiq ? "short" : pnl >= 0 ? "long" : "short"}>
                    {isLiq ? "LIQ" : pnl >= 0 ? "WIN" : "LOSS"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
