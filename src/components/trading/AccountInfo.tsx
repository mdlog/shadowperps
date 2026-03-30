"use client";

import { useOnChainPortfolio } from "@/hooks/useOnChainPortfolio";
import { useOnChainTrading } from "@/hooks/useOnChainTrading";
import { useWallet } from "@/hooks/useWallet";
import { formatCurrency, cn } from "@/lib/constants";

export default function AccountInfo() {
  const { isConnected } = useWallet();
  const { usdcBalance } = useOnChainTrading();
  const { data: portfolio } = useOnChainPortfolio();

  const s = portfolio.summary;
  const openCount = portfolio.positions.filter((p) => p.status === "open").length;

  if (!isConnected) {
    return (
      <div className="rounded-[var(--radius-card)] border border-border-subtle bg-surface overflow-hidden">
        <div className="px-4 py-3 border-b border-border-subtle">
          <span className="text-xs font-medium tracking-widest uppercase text-text-secondary">Account</span>
        </div>
        <div className="px-4 py-6 text-center">
          <span className="text-xs text-text-ghost">Connect wallet</span>
        </div>
      </div>
    );
  }

  const rows: { label: string; value: string; color?: string; bold?: boolean }[] = [
    { label: "USDC Balance", value: formatCurrency(usdcBalance), bold: true },
    { label: "Total Collateral", value: formatCurrency(s.total_collateral) },
    { label: "Unrealized PNL", value: `${s.total_pnl >= 0 ? "+" : ""}${formatCurrency(s.total_pnl)}`, color: s.total_pnl >= 0 ? "text-long" : "text-short" },
    { label: "Account Value", value: formatCurrency(s.total_value), bold: true },
  ];

  const perpsRows: { label: string; value: string; color?: string }[] = [
    { label: "Open Positions", value: `${openCount}` },
    { label: "Total Exposure", value: formatCurrency(s.total_exposure) },
    { label: "Available Margin", value: formatCurrency(s.available_margin) },
    { label: "Margin Health", value: `${(s.margin_health * 100).toFixed(1)}%`, color: s.margin_health > 0.7 ? "text-long" : s.margin_health > 0.4 ? "text-warning" : "text-short" },
    { label: "Margin Used", value: `${(s.margin_used * 100).toFixed(2)}%` },
    { label: "PNL %", value: `${s.total_pnl_percent >= 0 ? "+" : ""}${s.total_pnl_percent.toFixed(2)}%`, color: s.total_pnl_percent >= 0 ? "text-long" : "text-short" },
  ];

  return (
    <div className="rounded-[var(--radius-card)] border border-border-subtle bg-surface overflow-hidden">
      {/* Account Equity */}
      <div className="px-4 py-3 border-b border-border-subtle">
        <span className="text-xs font-medium tracking-widest uppercase text-text-secondary">Account Equity</span>
      </div>
      <div className="px-4 py-2 space-y-0">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2 border-b border-border-subtle/30 last:border-0">
            <span className="text-xs text-text-tertiary">{r.label}</span>
            <span className={cn(
              "text-xs font-mono tabular-nums",
              r.bold ? "text-text-primary font-medium" : "text-text-secondary",
              r.color,
            )}>
              {r.value}
            </span>
          </div>
        ))}
      </div>

      {/* Perps Overview */}
      <div className="px-4 py-3 border-t border-border-subtle border-b border-border-subtle">
        <span className="text-xs font-medium tracking-widest uppercase text-text-secondary">Perps Overview</span>
      </div>
      <div className="px-4 py-2 space-y-0">
        {perpsRows.map((r) => (
          <div key={r.label} className="flex items-center justify-between py-2 border-b border-border-subtle/30 last:border-0">
            <span className="text-xs text-text-tertiary">{r.label}</span>
            <span className={cn("text-xs font-mono tabular-nums text-text-secondary", r.color)}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
