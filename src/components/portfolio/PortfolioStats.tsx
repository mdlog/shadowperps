"use client";

import { useOnChainPortfolio } from "@/hooks/useOnChainPortfolio";
import { useWallet } from "@/hooks/useWallet";
import { formatCurrency, cn } from "@/lib/constants";
import Card from "@/components/ui/Card";
import EncryptedValue from "@/components/ui/EncryptedValue";
import PrivacyIndicator from "@/components/ui/PrivacyIndicator";

export default function PortfolioStats() {
  const { isConnected, isCorrectChain, targetChainName } = useWallet();
  const {
    data: portfolio,
    isPending,
    isError,
    error,
    hasDeployment,
  } = useOnChainPortfolio();

  const totalPnl = portfolio.summary.total_pnl;
  const totalPnlPct = portfolio.summary.total_pnl_percent;
  const totalValue = portfolio.summary.total_value;
  const totalCollateral = portfolio.summary.total_collateral;
  const marginHealth = portfolio.summary.margin_health;
  const isLoading = isConnected && isCorrectChain && hasDeployment && isPending;
  const canShowValues = isConnected && isCorrectChain && hasDeployment && !isError;
  const statusText = !isConnected
    ? "connect wallet"
    : !isCorrectChain
      ? `switch to ${targetChainName}`
      : !hasDeployment
        ? "deploy contract"
        : isError
          ? (error instanceof Error ? error.message : "decrypt failed")
          : "wallet decrypted";
  const healthLabel = marginHealth > 0.7 ? "Healthy" : marginHealth > 0.4 ? "Caution" : "Critical";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium tracking-[0.18em] uppercase text-text-secondary">
            Vault Snapshot
          </h2>
          <p className="mt-1 text-xs text-text-ghost">
            Wallet-side summary of your decrypted on-chain portfolio.
          </p>
        </div>
        <PrivacyIndicator label="Your Eyes Only" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Value */}
        <Card className="h-full p-5 flex flex-col">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="text-[10px] font-medium tracking-widest uppercase text-text-tertiary">
              Portfolio Value
            </div>
            <span className="text-[10px] text-accent/60 tracking-wider uppercase">
              {statusText}
            </span>
          </div>
          {isLoading ? (
            <div className="mb-2">
              <EncryptedValue width="w-32" className="h-7" />
            </div>
          ) : (
            <div className="font-mono text-2xl font-medium text-text-primary tabular-nums mb-2">
              {canShowValues ? formatCurrency(totalValue) : "—"}
            </div>
          )}
          <div className="mt-auto text-[11px] text-text-ghost">
            Gross value across all decrypted positions.
          </div>
        </Card>

        {/* Total PnL */}
        <Card className="h-full p-5 flex flex-col">
          <div className="text-[10px] font-medium tracking-widest uppercase text-text-tertiary mb-3">
            Unrealized PnL
          </div>
          {isLoading ? (
            <div className="mb-2">
              <EncryptedValue width="w-28" className="h-7" />
            </div>
          ) : canShowValues ? (
            <>
              <div className={cn(
                "font-mono text-2xl font-medium tabular-nums mb-2",
                totalPnl >= 0 ? "text-long" : "text-short",
              )}>
                {totalPnl >= 0 ? "+" : ""}{formatCurrency(totalPnl)}
              </div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className={cn(
                  "text-xs font-mono tabular-nums",
                  totalPnlPct >= 0 ? "text-long/70" : "text-short/70",
                )}>
                  {totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="font-mono text-2xl font-medium text-text-ghost tabular-nums mb-2">
                $0.00
              </div>
              <div className="text-xs text-text-ghost mb-2">No data</div>
            </>
          )}
          <div className="mt-auto text-[11px] text-text-ghost">
            Based on live mark price from the synced on-chain oracle.
          </div>
        </Card>

        {/* Collateral */}
        <Card className="h-full p-5 flex flex-col">
          <div className="text-[10px] font-medium tracking-widest uppercase text-text-tertiary mb-3">
            Total Collateral
          </div>
          {isLoading ? (
            <div className="mb-2">
              <EncryptedValue width="w-28" className="h-7" />
            </div>
          ) : (
            <div className="font-mono text-2xl font-medium text-text-primary tabular-nums mb-2">
              {canShowValues ? formatCurrency(totalCollateral) : "—"}
            </div>
          )}
          <div className="mt-auto flex items-center gap-1.5">
            <span className="text-[10px] text-accent/60 tracking-wider uppercase">
              {canShowValues ? "wallet decrypted" : statusText}
            </span>
          </div>
        </Card>

        {/* Margin Health */}
        <Card className="h-full p-5 flex flex-col">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="text-[10px] font-medium tracking-widest uppercase text-text-tertiary">
              Margin Health
            </div>
            <span className={cn(
              "text-[10px] tracking-wider uppercase",
              marginHealth > 0.7 ? "text-long/70" : marginHealth > 0.4 ? "text-warning/70" : "text-short/70",
            )}>
              {healthLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="font-mono text-2xl font-medium text-text-primary tabular-nums">
              {canShowValues ? `${(marginHealth * 100).toFixed(0)}%` : "—"}
            </div>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                marginHealth > 0.7 ? "bg-long" : marginHealth > 0.4 ? "bg-warning" : "bg-short",
              )}
              style={{ width: `${marginHealth * 100}%` }}
            />
          </div>
          <div className="mt-auto flex justify-between pt-1.5">
            <span className="text-[10px] text-text-ghost">Liquidation</span>
            <span className="text-[10px] text-text-ghost">Healthy</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
