"use client";

import { usePositions } from "@/hooks/useEngine";
import { useOnChainPortfolio } from "@/hooks/useOnChainPortfolio";
import { useWallet } from "@/hooks/useWallet";
import { formatCurrency, cn } from "@/lib/constants";
import Badge from "@/components/ui/Badge";
import EncryptedValue from "@/components/ui/EncryptedValue";

export default function OrderHistory() {
  const { isConnected } = useWallet();
  const { data: positions } = usePositions();
  const onChainPortfolio = useOnChainPortfolio();
  const useOnChainSource = onChainPortfolio.isOnChainReady && !onChainPortfolio.isError;

  // Show all positions (open + closed) as execution history, newest first
  const history = useOnChainSource
    ? [...onChainPortfolio.data.positions]
      .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
      .map((position) => ({
        id: position.id,
        market: position.market,
        direction: position.direction,
        leverage: position.leverage,
        entryPrice: position.entry_price,
        openedAt: position.opened_at,
        status: position.status,
      }))
    : [...(positions || [])]
      .sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime())
      .map((position) => ({
        id: position.id,
        market: position.market,
        direction: position.direction,
        leverage: position.leverage,
        entryPrice: parseFloat(position.entry_price),
        openedAt: position.opened_at,
        status: position.status,
      }));

  return (
    <div className="rounded-[var(--radius-card)] border border-border-subtle bg-surface overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
        <span className="text-xs font-medium tracking-widest uppercase text-text-secondary">
          Execution History
        </span>
        <span className="text-[10px] text-text-ghost">
          {isConnected ? `${history.length} transactions` : "Connect wallet"}
        </span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-6 px-5 py-2 border-b border-border-subtle/50 bg-base/50">
        {["Market", "Type", "Size", "Entry", "Time", "Status"].map((h) => (
          <div key={h} className="text-[10px] font-medium tracking-widest uppercase text-text-ghost">
            {h}
          </div>
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-border-subtle/30">
        {!isConnected ? (
          <div className="px-5 py-6 text-center">
            <span className="text-xs text-text-ghost">Connect wallet to view history</span>
          </div>
        ) : history.length === 0 ? (
          <div className="px-5 py-6 text-center">
            <span className="text-xs text-text-ghost">No transactions yet</span>
          </div>
        ) : (
          history.map((pos) => {
            const isLong = pos.direction === "long";
            const time = new Date(pos.openedAt);
            const timeStr = `${time.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
            const leverageLabel = pos.leverage >= 10 ? pos.leverage.toFixed(0) : pos.leverage.toFixed(1);

            const typeLabel = pos.status === "closed"
              ? `Close ${isLong ? "Long" : "Short"}`
              : `Open ${isLong ? "Long" : "Short"}`;

            const statusVariant = pos.status === "open" ? "accent"
              : pos.status === "closed" ? "warning"
              : "short";

            return (
              <div
                key={pos.id}
                className="grid grid-cols-6 px-5 py-3 hover:bg-hover/20 transition-colors duration-100 items-center"
              >
                <div className="text-xs font-mono text-text-primary">{pos.market}</div>
                <div>
                  <span className={cn(
                    "text-xs font-medium",
                    isLong ? "text-long" : "text-short",
                  )}>
                    {typeLabel} {leverageLabel}x
                  </span>
                </div>
                <div className="flex items-center">
                  <EncryptedValue width="w-14" />
                </div>
                <div className="text-xs font-mono text-text-secondary tabular-nums">
                  {formatCurrency(pos.entryPrice)}
                </div>
                <div className="text-xs text-text-tertiary">{timeStr}</div>
                <div>
                  <Badge variant={statusVariant as "accent" | "warning" | "short"}>
                    {pos.status}
                  </Badge>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
