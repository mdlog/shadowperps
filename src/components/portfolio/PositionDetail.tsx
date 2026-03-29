"use client";

import { formatCurrency, cn } from "@/lib/constants";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EncryptedValue from "@/components/ui/EncryptedValue";
import PrivacyIndicator from "@/components/ui/PrivacyIndicator";

interface Position {
  id: string;
  market: string;
  direction: "long" | "short";
  size: string;
  collateral: string;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  pnlPercent: number;
  leverage: number;
  marginRatio: number;
  liquidationPrice: string;
  openedAt: string;
  encrypted: boolean;
}

interface PositionDetailProps {
  position: Position;
  onClose: () => void;
}

export default function PositionDetail({ position: pos, onClose }: PositionDetailProps) {
  return (
    <Card glow className="overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold",
            pos.market === "BTC-PERP" ? "bg-warning/10 text-warning" :
            pos.market === "ETH-PERP" ? "bg-info/10 text-info" :
            "bg-accent/10 text-accent",
          )}>
            {pos.market.split("-")[0]}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-text-primary tracking-tight">{pos.market}</h3>
              <Badge variant={pos.direction === "long" ? "long" : "short"}>
                {pos.direction} {pos.leverage}x
              </Badge>
            </div>
            <PrivacyIndicator label="Position data encrypted" className="mt-0.5" />
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-base border border-border-subtle flex items-center justify-center text-text-ghost hover:text-text-secondary hover:bg-elevated transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M10.5 3.5L3.5 10.5M3.5 3.5l7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* PnL Banner */}
      <div className={cn(
        "px-6 py-5 border-b border-border-subtle",
        pos.unrealizedPnl >= 0 ? "bg-long-bg/50" : "bg-short-bg/50",
      )}>
        <div className="text-[10px] text-text-tertiary uppercase tracking-widest mb-1.5">
          Unrealized PnL
        </div>
        <div className="flex items-end gap-3">
          <span className={cn(
            "font-mono text-3xl font-medium tabular-nums",
            pos.unrealizedPnl >= 0 ? "text-long" : "text-short",
          )}>
            {pos.unrealizedPnl >= 0 ? "+" : ""}{formatCurrency(pos.unrealizedPnl)}
          </span>
          <span className={cn(
            "font-mono text-sm tabular-nums pb-1",
            pos.pnlPercent >= 0 ? "text-long/70" : "text-short/70",
          )}>
            {pos.pnlPercent >= 0 ? "+" : ""}{pos.pnlPercent}%
          </span>
        </div>
      </div>

      {/* Data grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          {/* Market */}
          <div>
            <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-1.5">Market</div>
            <div className="text-sm font-medium text-text-primary">{pos.market}</div>
          </div>

          {/* Direction */}
          <div>
            <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-1.5">Direction</div>
            <Badge variant={pos.direction === "long" ? "long" : "short"} className="text-xs">
              {pos.direction.toUpperCase()}
            </Badge>
          </div>

          {/* Encrypted Size */}
          <div>
            <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              Position Size
              <span className="text-accent/50 normal-case tracking-wider">encrypted</span>
            </div>
            <EncryptedValue width="w-32" className="h-6" />
          </div>

          {/* Encrypted Collateral */}
          <div>
            <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              Collateral
              <span className="text-accent/50 normal-case tracking-wider">encrypted</span>
            </div>
            <EncryptedValue width="w-28" className="h-6" />
          </div>

          {/* Entry Price */}
          <div>
            <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-1.5">Entry Price</div>
            <div className="text-sm font-mono text-text-primary tabular-nums">{formatCurrency(pos.entryPrice)}</div>
          </div>

          {/* Mark Price */}
          <div>
            <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-1.5">Mark Price</div>
            <div className="text-sm font-mono text-text-primary tabular-nums">{formatCurrency(pos.markPrice)}</div>
          </div>

          {/* Leverage */}
          <div>
            <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-1.5">Leverage</div>
            <div className="text-sm font-mono text-text-primary tabular-nums">{pos.leverage}x</div>
          </div>

          {/* Liquidation Price */}
          <div>
            <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              Liquidation
              <span className="text-accent/50 normal-case tracking-wider">shielded</span>
            </div>
            <EncryptedValue width="w-24" className="h-6" />
          </div>
        </div>

        {/* Margin Health */}
        <div className="mt-6 p-4 rounded-xl bg-base border border-border-subtle">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-text-ghost uppercase tracking-widest">Margin Health</span>
            <span className={cn(
              "text-sm font-mono font-medium tabular-nums",
              pos.marginRatio > 0.7 ? "text-long" : pos.marginRatio > 0.4 ? "text-warning" : "text-short",
            )}>
              {(pos.marginRatio * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                pos.marginRatio > 0.7 ? "bg-long" : pos.marginRatio > 0.4 ? "bg-warning" : "bg-short",
              )}
              style={{ width: `${pos.marginRatio * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-short/60">Liquidation Zone</span>
            <span className="text-[10px] text-long/60">Healthy</span>
          </div>
        </div>

        {/* Opened timestamp */}
        <div className="mt-4 flex items-center justify-between px-1">
          <span className="text-[10px] text-text-ghost">
            Opened {new Date(pos.openedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span className="text-[10px] text-text-ghost font-mono">{pos.id}</span>
        </div>

        {/* Actions */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" size="md" className="text-xs">
            Add Collateral
          </Button>
          <Button variant="danger" size="md" className="text-xs">
            Close Position
          </Button>
        </div>
      </div>
    </Card>
  );
}
