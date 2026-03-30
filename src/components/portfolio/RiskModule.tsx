"use client";

import { useOnChainPortfolio } from "@/hooks/useOnChainPortfolio";
import { useWallet } from "@/hooks/useWallet";
import { cn, formatCurrency } from "@/lib/constants";
import Card from "@/components/ui/Card";
import EncryptedValue from "@/components/ui/EncryptedValue";

function InfoRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-text-secondary">{label}</span>
      <span
        className={cn(
          "text-sm font-mono tabular-nums",
          accent ? "text-info" : "text-text-primary",
        )}
      >
        {value}
      </span>
    </div>
  );
}

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
  const riskTone = avgMargin > 0.7 ? "Healthy" : avgMargin > 0.4 ? "Watch" : "Critical";
  const spotEquity = 0;
  const perpsEquity = portfolio.summary.total_value;
  const balance = portfolio.summary.total_collateral;
  const unrealizedPnl = portfolio.summary.total_pnl;
  const crossMarginRatio = openPositions.length > 0 ? avgMargin : 0;
  const maintenanceMargin = balance * 0.2;
  const crossAccountLeverage = balance > 0 ? portfolio.summary.total_exposure / balance : 0;

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
        <div>
          <span className="text-xs font-medium tracking-widest uppercase text-text-secondary">
            Risk Overview
          </span>
          <p className="mt-1 text-[11px] text-text-ghost">
            Margin and exposure summary from the decrypted wallet view.
          </p>
        </div>
        <span className={cn(
          "text-[10px] tracking-wider uppercase",
          avgMargin > 0.7 ? "text-long/60" : avgMargin > 0.4 ? "text-warning/60" : "text-short/60",
        )}>
          {riskTone}
        </span>
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
            <div className="rounded-[var(--radius-card)] border border-border-subtle bg-elevated/40 p-4">
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

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[var(--radius-card)] border border-border-subtle bg-elevated/40 p-4">
                <div className="text-[10px] uppercase tracking-wider text-text-ghost mb-2">Exposure</div>
                {isLoading ? (
                  <EncryptedValue width="w-20" />
                ) : (
                  <span className="text-sm font-mono text-text-primary tabular-nums">
                    {formatCurrency(portfolio.summary.total_exposure)}
                  </span>
                )}
              </div>
              <div className="rounded-[var(--radius-card)] border border-border-subtle bg-elevated/40 p-4">
                <div className="text-[10px] uppercase tracking-wider text-text-ghost mb-2">Free Margin</div>
                {isLoading ? (
                  <EncryptedValue width="w-16" />
                ) : (
                  <span className="text-sm font-mono text-text-primary tabular-nums">
                    {formatCurrency(portfolio.summary.available_margin)}
                  </span>
                )}
              </div>
              <div className="rounded-[var(--radius-card)] border border-border-subtle bg-elevated/40 p-4">
                <div className="text-[10px] uppercase tracking-wider text-text-ghost mb-2">Margin Used</div>
                <span className="text-sm font-mono text-text-primary tabular-nums">
                  {openPositions.length > 0 ? `${(marginUsed * 100).toFixed(1)}%` : "—"}
                </span>
              </div>
              <div className="rounded-[var(--radius-card)] border border-border-subtle bg-elevated/40 p-4">
                <div className="text-[10px] uppercase tracking-wider text-text-ghost mb-2">Active Books</div>
                <span className="text-sm font-mono text-text-primary tabular-nums">{openPositions.length}</span>
              </div>
            </div>

            <div className="border-t border-border-subtle/70 pt-4 space-y-4">
              <div>
                <div className="text-sm font-medium text-text-primary">Account Equity</div>
                <div className="mt-3 space-y-2.5">
                  {isLoading ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-text-secondary">Spot</span>
                        <EncryptedValue width="w-14" />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-text-secondary">Perps</span>
                        <EncryptedValue width="w-14" />
                      </div>
                    </>
                  ) : (
                    <>
                      <InfoRow label="Spot" value={formatCurrency(spotEquity)} />
                      <InfoRow label="Perps" value={formatCurrency(perpsEquity)} />
                    </>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-text-primary">Perps Overview</div>
                <div className="mt-3 space-y-2.5">
                  {isLoading ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-text-secondary">Balance</span>
                        <EncryptedValue width="w-16" />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-text-secondary">Unrealized PnL</span>
                        <EncryptedValue width="w-16" />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-text-secondary">Cross Margin Ratio</span>
                        <EncryptedValue width="w-12" />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-text-secondary">Maintenance Margin</span>
                        <EncryptedValue width="w-16" />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-text-secondary">Cross Account Leverage</span>
                        <EncryptedValue width="w-12" />
                      </div>
                    </>
                  ) : (
                    <>
                      <InfoRow label="Balance" value={formatCurrency(balance)} />
                      <InfoRow
                        label="Unrealized PnL"
                        value={formatCurrency(unrealizedPnl)}
                      />
                      <InfoRow
                        label="Cross Margin Ratio"
                        value={`${(crossMarginRatio * 100).toFixed(2)}%`}
                        accent
                      />
                      <InfoRow
                        label="Maintenance Margin"
                        value={formatCurrency(maintenanceMargin)}
                      />
                      <InfoRow
                        label="Cross Account Leverage"
                        value={`${crossAccountLeverage.toFixed(2)}x`}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
