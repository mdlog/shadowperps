"use client";

import { useState } from "react";
import { useOnChainPortfolio } from "@/hooks/useOnChainPortfolio";
import { useWallet } from "@/hooks/useWallet";
import { useOnChainTrading } from "@/hooks/useOnChainTrading";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, cn } from "@/lib/constants";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

export default function PositionList() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { isConnected, isCorrectChain, targetChainName } = useWallet();
  const {
    data: portfolio,
    isPending,
    isError,
    error,
    hasDeployment,
  } = useOnChainPortfolio();
  const { closePosition, status: closeStatus, error: closeError } = useOnChainTrading();
  const queryClient = useQueryClient();

  const openPositions = portfolio.positions.filter((position) => position.status === "open");
  const isLoading = isConnected && isCorrectChain && hasDeployment && isPending;

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-text-secondary tracking-wide">Active Positions</h2>
        <Card className="p-8 text-center">
          <p className="text-sm text-text-ghost">Connect your wallet to view positions</p>
        </Card>
      </div>
    );
  }

  if (!isCorrectChain) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-text-secondary tracking-wide">Active Positions</h2>
        <Card className="p-8 text-center">
          <p className="text-sm text-text-ghost">Switch to {targetChainName} to decrypt positions</p>
        </Card>
      </div>
    );
  }

  if (!hasDeployment) {
    return (
      <div className="space-y-4">
        <h2 className="text-sm font-medium text-text-secondary tracking-wide">Active Positions</h2>
        <Card className="p-8 text-center">
          <p className="text-sm text-text-ghost">Deploy the new ShadowPerps contract to load ciphertext-backed positions</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-secondary tracking-wide">
          Active Positions
          <span className="ml-2 text-text-ghost">({openPositions.length})</span>
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-40" />
            <span className="relative rounded-full h-1.5 w-1.5 bg-accent/70" />
          </span>
          <span className="text-[10px] text-accent/50 tracking-wider uppercase">
            Wallet-decrypted from CoFHE handles
          </span>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center">
          <p className="text-xs text-text-ghost">Decrypting positions in your wallet...</p>
        </Card>
      ) : isError ? (
        <Card className="p-8 text-center">
          <p className="text-xs text-text-ghost">
            {error instanceof Error ? error.message : "Unable to decrypt positions"}
          </p>
        </Card>
      ) : openPositions.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-text-ghost">No open positions</p>
          <p className="text-xs text-text-ghost mt-1">Open a position in the Trading Terminal</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className={cn(
            "space-y-3",
            selectedId ? "lg:col-span-1" : "lg:col-span-3",
          )}>
            {openPositions.map((pos) => {
              const pnl = pos.unrealized_pnl;
              const pnlPct = pos.pnl_percent;
              const marginRatio = pos.margin_ratio;
              const leverageLabel = pos.leverage >= 10 ? pos.leverage.toFixed(0) : pos.leverage.toFixed(1);

              return (
                <Card
                  key={pos.id}
                  hover
                  className={cn(
                    "p-5 cursor-pointer transition-all duration-200",
                    selectedId === pos.id && "border-accent/30 bg-elevated shadow-[var(--shadow-glow)]",
                  )}
                >
                  <button
                    onClick={() => setSelectedId(selectedId === pos.id ? null : pos.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                          pos.market === "BTC-PERP" ? "bg-warning/10 text-warning" :
                          pos.market === "ETH-PERP" ? "bg-info/10 text-info" :
                          "bg-accent/10 text-accent",
                        )}>
                          {pos.market[0]}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-text-primary">{pos.market}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant={pos.direction === "long" ? "long" : "short"}>
                              {pos.direction}
                            </Badge>
                            <span className="text-[10px] font-mono text-text-ghost">{leverageLabel}x</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={cn(
                          "text-lg font-mono font-medium tabular-nums",
                          pnl >= 0 ? "text-long" : "text-short",
                        )}>
                          {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}
                        </div>
                        <div className={cn(
                          "text-xs font-mono tabular-nums",
                          pnlPct >= 0 ? "text-long/70" : "text-short/70",
                        )}>
                          {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    <div className={cn(
                      "grid gap-4",
                      selectedId ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-5",
                    )}>
                        <div>
                          <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Size</div>
                          <div className="text-xs font-mono text-text-secondary tabular-nums">{formatCurrency(pos.size)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Collateral</div>
                        <div className="text-xs font-mono text-text-secondary tabular-nums">{formatCurrency(pos.collateral)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Entry</div>
                        <div className="text-xs font-mono text-text-secondary tabular-nums">{formatCurrency(pos.entry_price)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Mark</div>
                        <div className="text-xs font-mono text-text-secondary tabular-nums">{formatCurrency(pos.mark_price)}</div>
                      </div>
                      {!selectedId && (
                        <div>
                          <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Margin</div>
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-16">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  marginRatio > 0.7 ? "bg-long" : marginRatio > 0.4 ? "bg-warning" : "bg-short",
                                )}
                                style={{ width: `${marginRatio * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-text-ghost tabular-nums">
                              {(marginRatio * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                </Card>
              );
            })}
          </div>

          {/* Detail panel */}
          {selectedId && (() => {
            const pos = openPositions.find((p) => p.id === selectedId);
            if (!pos) return null;
            const pnl = pos.unrealized_pnl;
            const leverageLabel = pos.leverage >= 10 ? pos.leverage.toFixed(0) : pos.leverage.toFixed(1);

            return (
              <div className="lg:col-span-2 animate-slide-in-right">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-medium text-text-primary">
                      {pos.market} — {pos.direction.toUpperCase()} {leverageLabel}x
                    </h3>
                    <button
                      onClick={() => setSelectedId(null)}
                      className="text-text-ghost hover:text-text-secondary"
                    >
                      Close
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Unrealized PnL</div>
                      <div className={cn("text-xl font-mono font-medium tabular-nums", pnl >= 0 ? "text-long" : "text-short")}>
                        {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Entry Price</div>
                      <div className="text-xl font-mono text-text-secondary tabular-nums">
                        {formatCurrency(pos.entry_price)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Size</div>
                      <div className="text-xl font-mono text-text-secondary tabular-nums">
                        {formatCurrency(pos.size)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Liquidation</div>
                      <div className="text-xl font-mono text-text-secondary tabular-nums">
                        {formatCurrency(pos.liquidation_price)}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="short"
                    size="lg"
                    className="w-full"
                    onClick={async () => {
                      await closePosition(pos.id, pos.on_chain_id);
                      await Promise.all([
                        queryClient.invalidateQueries({ queryKey: ["onchain-portfolio"] }),
                        queryClient.invalidateQueries({ queryKey: ["positions"] }),
                        queryClient.invalidateQueries({ queryKey: ["portfolio"] }),
                      ]);
                    }}
                    disabled={closeStatus === "confirming" || closeStatus === "decrypting" || closeStatus === "pending"}
                  >
                    {closeStatus === "confirming" ? "Confirm in Wallet..."
                      : closeStatus === "decrypting" ? "Decrypting Proof..."
                      : closeStatus === "pending" ? "Waiting for Block..."
                      : "Close Position"}
                  </Button>
                  {closeStatus === "error" && closeError && (
                    <p className="mt-3 text-[11px] text-short">{closeError}</p>
                  )}
                </Card>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
