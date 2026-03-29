"use client";

import { useOnChainPortfolio } from "@/hooks/useOnChainPortfolio";
import { useWallet } from "@/hooks/useWallet";
import { cn, formatCurrency } from "@/lib/constants";
import Card from "@/components/ui/Card";
import EncryptedValue from "@/components/ui/EncryptedValue";

export default function RiskModule() {
  const { isConnected, isCorrectChain, targetChainName } = useWallet();
  const {
    data: portfolio,
    isPending,
    isError,
    error,
    hasDeployment,
  } = useOnChainPortfolio();

  const openPositions = portfolio.positions.filter((position) => position.status === "open");
  const marginUsed = portfolio.summary.margin_used;
  const avgMargin = openPositions.length > 0
    ? openPositions.reduce((sum, position) => sum + position.margin_ratio, 0) / openPositions.length
    : 0;
  const isLoading = isConnected && isCorrectChain && hasDeployment && isPending;

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
        <span className="text-xs font-medium tracking-widest uppercase text-text-secondary">
          Risk Overview
        </span>
        <span className="text-[10px] text-accent/50 tracking-wider uppercase">confidential</span>
      </div>

      <div className="p-5 space-y-5">
        {!isConnected ? (
          <div className="py-4 text-center">
            <span className="text-xs text-text-ghost">Connect wallet to view risk</span>
          </div>
        ) : !isCorrectChain ? (
          <div className="py-4 text-center">
            <span className="text-xs text-text-ghost">Switch to {targetChainName} to decrypt risk</span>
          </div>
        ) : !hasDeployment ? (
          <div className="py-4 text-center">
            <span className="text-xs text-text-ghost">Deploy the FHE contract to load on-chain risk</span>
          </div>
        ) : isError ? (
          <div className="py-4 text-center">
            <span className="text-xs text-text-ghost">
              {error instanceof Error ? error.message : "Unable to decrypt portfolio risk"}
            </span>
          </div>
        ) : (
          <>
            {/* Overall margin gauge */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-tertiary">Aggregate Margin Ratio</span>
                <span className={cn(
                  "text-sm font-mono font-medium tabular-nums",
                  avgMargin > 0.7 ? "text-long" : avgMargin > 0.4 ? "text-warning" : "text-short",
                )}>
                  {openPositions.length > 0 ? `${(avgMargin * 100).toFixed(1)}%` : "—"}
                </span>
              </div>
              <div className="h-3 rounded-full bg-muted overflow-hidden relative">
                <div
                  className={cn(
                    "h-full rounded-full",
                    avgMargin > 0.7 ? "bg-long" : avgMargin > 0.4 ? "bg-warning" : "bg-short",
                  )}
                  style={{ width: `${avgMargin * 100}%` }}
                />
                <div className="absolute top-0 bottom-0 left-[30%] w-px bg-short/30" />
                <div className="absolute top-0 bottom-0 left-[70%] w-px bg-long/30" />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-short/50">Critical</span>
                <span className="text-[9px] text-warning/50">Warning</span>
                <span className="text-[9px] text-long/50">Healthy</span>
              </div>
            </div>

            {/* Risk metrics */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-border-subtle/30">
                <span className="text-xs text-text-tertiary">Total Exposure</span>
                {isLoading ? (
                  <EncryptedValue width="w-20" />
                ) : (
                  <span className="text-xs font-mono text-text-primary tabular-nums">
                    {formatCurrency(portfolio.summary.total_exposure)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border-subtle/30">
                <span className="text-xs text-text-tertiary">Available Margin</span>
                {isLoading ? (
                  <EncryptedValue width="w-16" />
                ) : (
                  <span className="text-xs font-mono text-text-primary tabular-nums">
                    {formatCurrency(portfolio.summary.available_margin)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border-subtle/30">
                <span className="text-xs text-text-tertiary">Margin Used</span>
                <span className="text-xs font-mono text-text-primary tabular-nums">
                  {openPositions.length > 0 ? `${(marginUsed * 100).toFixed(1)}%` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-text-tertiary">Active Positions</span>
                <span className="text-xs font-mono text-text-primary tabular-nums">{openPositions.length}</span>
              </div>
            </div>

            {/* Per-position risk bars */}
            {openPositions.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-border-subtle">
                <span className="text-[10px] text-text-ghost uppercase tracking-widest">Per-Position Risk</span>
                {openPositions.map((pos) => {
                  const ratio = pos.margin_ratio;
                  return (
                    <div key={pos.id} className="flex items-center gap-3">
                      <span className="text-[11px] font-mono text-text-secondary w-20 shrink-0">{pos.market}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            ratio > 0.7 ? "bg-long" : ratio > 0.4 ? "bg-warning" : "bg-short",
                          )}
                          style={{ width: `${ratio * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-text-ghost tabular-nums w-8 text-right">
                        {(ratio * 100).toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
