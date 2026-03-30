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

function PositionEmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card className="p-8">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border-subtle bg-elevated text-text-secondary">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <path d="M6.5 8.5H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M6.5 11.5H10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        <p className="mt-2 text-xs leading-6 text-text-ghost">{description}</p>
        {actionLabel && onAction && (
          <Button
            variant="secondary"
            size="sm"
            className="mt-5"
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function PositionList() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { isConnected, isCorrectChain, targetChainName, connectWallet, switchToTarget } = useWallet();
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
  const selectedPosition = selectedId ? openPositions.find((position) => position.id === selectedId) ?? null : null;

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-text-secondary tracking-[0.18em] uppercase">Open Positions</h2>
            <p className="mt-1 text-xs text-text-ghost">Decrypt your portfolio view from wallet-owned CoFHE handles.</p>
          </div>
          <Badge variant="encrypted">Wallet view</Badge>
        </div>
        <PositionEmptyState
          title="Wallet not connected"
          description="Connect your wallet first to decrypt the active positions attached to your account."
          actionLabel="Connect Wallet"
          onAction={connectWallet}
        />
      </div>
    );
  }

  if (!isCorrectChain) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-text-secondary tracking-[0.18em] uppercase">Open Positions</h2>
            <p className="mt-1 text-xs text-text-ghost">Decrypt your portfolio view from wallet-owned CoFHE handles.</p>
          </div>
          <Badge variant="warning">Wrong network</Badge>
        </div>
        <PositionEmptyState
          title={`Switch to ${targetChainName}`}
          description="Your private portfolio can only be decrypted on the configured CoFHE deployment network."
          actionLabel={`Switch to ${targetChainName}`}
          onAction={switchToTarget}
        />
      </div>
    );
  }

  if (!hasDeployment) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-text-secondary tracking-[0.18em] uppercase">Open Positions</h2>
            <p className="mt-1 text-xs text-text-ghost">Decrypt your portfolio view from wallet-owned CoFHE handles.</p>
          </div>
          <Badge variant="warning">No deployment</Badge>
        </div>
        <PositionEmptyState
          title="ShadowPerps contract not deployed"
          description="Deploy the ciphertext-backed contract first before loading wallet-side position data here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-text-secondary tracking-[0.18em] uppercase">
            Open Positions
          </h2>
          <p className="mt-1 text-xs text-text-ghost">
            {openPositions.length === 0
              ? "No live exposure right now."
              : `${openPositions.length} active position${openPositions.length > 1 ? "s" : ""} decrypted locally from on-chain ciphertexts.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="encrypted">{openPositions.length} active</Badge>
          <span className="text-[10px] text-accent/50 tracking-wider uppercase">
            CoFHE handles
          </span>
        </div>
      </div>

      {isLoading ? (
        <PositionEmptyState
          title="Decrypting positions"
          description="Your wallet is preparing the local view of encrypted on-chain positions."
        />
      ) : isError ? (
        <PositionEmptyState
          title="Unable to decrypt positions"
          description={error instanceof Error ? error.message : "Unable to decrypt positions"}
        />
      ) : openPositions.length === 0 ? (
        <PositionEmptyState
          title="No open positions"
          description="Open a new position from the Trading Terminal and it will appear here after wallet-side decryption."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className={cn(
            "space-y-3",
            selectedPosition ? "lg:col-span-1" : "lg:col-span-3",
          )}>
            <Card className="overflow-hidden p-0">
              <div className="hidden lg:grid lg:grid-cols-[1.65fr_0.9fr_0.9fr_0.9fr_0.9fr_1fr_0.9fr_0.95fr] gap-3 px-5 py-3 border-b border-border-subtle bg-elevated/30">
                {["Market", "Entry", "Mark", "Size", "Collateral", "PnL", "Margin", "Action"].map((label) => (
                  <div
                    key={label}
                    className="text-[10px] uppercase tracking-[0.18em] text-text-ghost"
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div className="divide-y divide-border-subtle/70">
                {openPositions.map((pos) => {
                  const pnl = pos.unrealized_pnl;
                  const pnlPct = pos.pnl_percent;
                  const marginRatio = pos.margin_ratio;
                  const leverageLabel = pos.leverage >= 10 ? pos.leverage.toFixed(0) : pos.leverage.toFixed(1);
                  const riskLabel = marginRatio > 0.7 ? "Healthy" : marginRatio > 0.4 ? "Watch" : "Critical";

                  return (
                    <div
                      key={pos.id}
                      onClick={() => setSelectedId(selectedId === pos.id ? null : pos.id)}
                      className={cn(
                        "cursor-pointer px-4 py-4 transition-colors hover:bg-elevated/40 lg:px-5 lg:py-3",
                        selectedId === pos.id && "bg-elevated/60",
                      )}
                    >
                      <div className="grid gap-3 lg:grid-cols-[1.65fr_0.9fr_0.9fr_0.9fr_0.9fr_1fr_0.9fr_0.95fr] lg:items-center">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0",
                              pos.market === "BTC-PERP" ? "bg-warning/10 text-warning" :
                              pos.market === "ETH-PERP" ? "bg-info/10 text-info" :
                              "bg-accent/10 text-accent",
                            )}>
                              {pos.market[0]}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-text-primary truncate">{pos.market}</span>
                                <Badge variant={pos.direction === "long" ? "long" : "short"}>
                                  {pos.direction}
                                </Badge>
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-text-ghost">
                                <span>{leverageLabel}x</span>
                                <span className={cn(
                                  "uppercase tracking-wider",
                                  marginRatio > 0.7 ? "text-long/60" : marginRatio > 0.4 ? "text-warning/60" : "text-short/60",
                                )}>
                                  {riskLabel}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="lg:text-right">
                          <div className="text-[10px] uppercase tracking-wider text-text-ghost lg:hidden mb-1">Entry</div>
                          <div className="text-xs font-mono text-text-secondary tabular-nums">{formatCurrency(pos.entry_price)}</div>
                        </div>

                        <div className="lg:text-right">
                          <div className="text-[10px] uppercase tracking-wider text-text-ghost lg:hidden mb-1">Mark</div>
                          <div className="text-xs font-mono text-text-secondary tabular-nums">{formatCurrency(pos.mark_price)}</div>
                        </div>

                        <div className="lg:text-right">
                          <div className="text-[10px] uppercase tracking-wider text-text-ghost lg:hidden mb-1">Size</div>
                          <div className="text-xs font-mono text-text-secondary tabular-nums">{formatCurrency(pos.size)}</div>
                        </div>

                        <div className="lg:text-right">
                          <div className="text-[10px] uppercase tracking-wider text-text-ghost lg:hidden mb-1">Collateral</div>
                          <div className="text-xs font-mono text-text-secondary tabular-nums">{formatCurrency(pos.collateral)}</div>
                        </div>

                        <div className="lg:text-right">
                          <div className="text-[10px] uppercase tracking-wider text-text-ghost lg:hidden mb-1">PnL</div>
                          <div className={cn(
                            "text-sm font-mono font-medium tabular-nums",
                            pnl >= 0 ? "text-long" : "text-short",
                          )}>
                            {pnl >= 0 ? "+" : ""}{formatCurrency(pnl)}
                          </div>
                          <div className={cn(
                            "text-[10px] font-mono tabular-nums",
                            pnlPct >= 0 ? "text-long/70" : "text-short/70",
                          )}>
                            {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-text-ghost lg:hidden mb-1">Margin</div>
                          <div className="flex items-center gap-2 lg:justify-end">
                            <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
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

                        <div className="flex items-center gap-2 lg:justify-end">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedId(selectedId === pos.id ? null : pos.id);
                            }}
                            className="text-[11px] uppercase tracking-wider text-text-ghost hover:text-text-secondary"
                          >
                            {selectedId === pos.id ? "Hide" : "Detail"}
                          </button>
                          <Button
                            variant="short"
                            size="sm"
                            onClick={async (event) => {
                              event.stopPropagation();
                              await closePosition(pos.id, pos.on_chain_id);
                              await Promise.all([
                                queryClient.invalidateQueries({ queryKey: ["onchain-portfolio"] }),
                                queryClient.invalidateQueries({ queryKey: ["positions"] }),
                                queryClient.invalidateQueries({ queryKey: ["portfolio"] }),
                              ]);
                              if (selectedId === pos.id) {
                                setSelectedId(null);
                              }
                            }}
                            disabled={closeStatus === "confirming" || closeStatus === "decrypting" || closeStatus === "pending"}
                          >
                            {closeStatus === "confirming" && selectedId === pos.id ? "Confirming..."
                              : closeStatus === "decrypting" && selectedId === pos.id ? "Decrypting..."
                              : closeStatus === "pending" && selectedId === pos.id ? "Pending..."
                              : "Close"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            {closeStatus === "error" && closeError && (
              <div className="rounded-[var(--radius-card)] border border-short/15 bg-short-bg/40 px-3 py-2">
                <p className="text-[11px] leading-5 text-short">{closeError}</p>
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selectedPosition && (
            <div className="lg:col-span-2 animate-slide-in-right">
              <Card className="p-6 lg:sticky lg:top-24">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={selectedPosition.direction === "long" ? "long" : "short"}>
                        {selectedPosition.direction}
                      </Badge>
                      <Badge variant="encrypted">{selectedPosition.market}</Badge>
                    </div>
                    <h3 className="text-lg font-medium text-text-primary">
                      {selectedPosition.market} Position
                    </h3>
                    <p className="mt-1 text-xs text-text-ghost">
                      Wallet-side detail view for the currently selected on-chain position.
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="text-xs uppercase tracking-wider text-text-ghost hover:text-text-secondary"
                  >
                    Hide
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="rounded-[var(--radius-card)] border border-border-subtle bg-elevated/50 p-4">
                    <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Unrealized PnL</div>
                    <div className={cn("text-xl font-mono font-medium tabular-nums", selectedPosition.unrealized_pnl >= 0 ? "text-long" : "text-short")}>
                      {selectedPosition.unrealized_pnl >= 0 ? "+" : ""}{formatCurrency(selectedPosition.unrealized_pnl)}
                    </div>
                  </div>
                  <div className="rounded-[var(--radius-card)] border border-border-subtle bg-elevated/50 p-4">
                    <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Leverage</div>
                    <div className="text-xl font-mono text-text-primary tabular-nums">
                      {selectedPosition.leverage >= 10 ? selectedPosition.leverage.toFixed(0) : selectedPosition.leverage.toFixed(1)}x
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Entry Price</div>
                    <div className="text-base font-mono text-text-secondary tabular-nums">
                      {formatCurrency(selectedPosition.entry_price)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Mark Price</div>
                    <div className="text-base font-mono text-text-secondary tabular-nums">
                      {formatCurrency(selectedPosition.mark_price)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Position Size</div>
                    <div className="text-base font-mono text-text-secondary tabular-nums">
                      {formatCurrency(selectedPosition.size)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Collateral</div>
                    <div className="text-base font-mono text-text-secondary tabular-nums">
                      {formatCurrency(selectedPosition.collateral)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Liquidation</div>
                    <div className="text-base font-mono text-text-secondary tabular-nums">
                      {formatCurrency(selectedPosition.liquidation_price)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Margin Ratio</div>
                    <div className="text-base font-mono text-text-secondary tabular-nums">
                      {(selectedPosition.margin_ratio * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="rounded-[var(--radius-card)] border border-border-subtle bg-elevated/40 p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-text-ghost">Close Flow</span>
                    <span className="text-[10px] uppercase tracking-wider text-accent/60">
                      request → decrypt → finalize
                    </span>
                  </div>
                  <p className="text-xs leading-6 text-text-ghost">
                    Closing uses the encrypted payout proof path, so a short delay while the threshold network prepares the decrypt proof is expected.
                  </p>
                </div>

                <Button
                  variant="short"
                  size="lg"
                  className="w-full"
                  onClick={async () => {
                    await closePosition(selectedPosition.id, selectedPosition.on_chain_id);
                    await Promise.all([
                      queryClient.invalidateQueries({ queryKey: ["onchain-portfolio"] }),
                      queryClient.invalidateQueries({ queryKey: ["positions"] }),
                      queryClient.invalidateQueries({ queryKey: ["portfolio"] }),
                    ]);
                    setSelectedId(null);
                  }}
                  disabled={closeStatus === "confirming" || closeStatus === "decrypting" || closeStatus === "pending"}
                >
                  {closeStatus === "confirming" ? "Confirm in Wallet..."
                    : closeStatus === "decrypting" ? "Decrypting Proof..."
                    : closeStatus === "pending" ? "Waiting for Block..."
                    : "Close Position"}
                </Button>
                {closeStatus === "error" && closeError && (
                  <div className="mt-3 rounded-[var(--radius-card)] border border-short/15 bg-short-bg/40 px-3 py-2">
                    <p className="text-[11px] leading-5 text-short">{closeError}</p>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
