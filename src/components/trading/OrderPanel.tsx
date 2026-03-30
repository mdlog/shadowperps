"use client";

import { useState, useEffect } from "react";
import { cn, LEVERAGE_OPTIONS, formatCurrency } from "@/lib/constants";
import { useWallet } from "@/hooks/useWallet";
import { useMarket } from "@/hooks/useEngine";
import { useOnChainMarketPrice } from "@/hooks/useOnChainMarket";
import { useOnChainTrading } from "@/hooks/useOnChainTrading";
import { useQueryClient } from "@tanstack/react-query";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PrivacyIndicator from "@/components/ui/PrivacyIndicator";

interface OrderPanelProps {
  market: string;
}

export default function OrderPanel({ market }: OrderPanelProps) {
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [leverage, setLeverage] = useState(10);
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [collateral, setCollateral] = useState("");
  const [limitPrice, setLimitPrice] = useState("");

  const { isConnected, isCorrectChain, connectWallet, switchToTarget, targetChainName } = useWallet();
  const { data: marketData } = useMarket(market);
  const { price: oraclePrice } = useOnChainMarketPrice(market);
  const {
    openPosition,
    status,
    error: txError,
    txHash,
    hasContract,
    isOnChainReady,
    requiresChainSwitch,
    isMockTradingEnabled,
    usdcBalance,
    reset,
  } = useOnChainTrading();
  const queryClient = useQueryClient();

  const enginePrice = marketData ? parseFloat(marketData.price) : 0;
  const currentPrice = isOnChainReady && oraclePrice > 0 ? oraclePrice : enginePrice;
  const collateralNum = parseFloat(collateral) || 0;
  const size = collateralNum * leverage;
  const isBusy = status === "encrypting" || status === "approving" || status === "confirming" || status === "decrypting" || status === "pending";
  const hasEnoughUsdc = collateralNum <= 0 || collateralNum <= usdcBalance;
  const isProductionOnChainOnly = !isMockTradingEnabled;
  const submitBlocked = isBusy
    || !collateralNum
    || (isOnChainReady && !hasEnoughUsdc)
    || (isProductionOnChainOnly && !isOnChainReady && isConnected && isCorrectChain);

  // Clear success state after 3s
  useEffect(() => {
    if (status === "success") {
      const t = setTimeout(() => reset(), 3000);
      return () => clearTimeout(t);
    }
  }, [status, reset]);

  const handleSubmit = async () => {
    if (!isConnected) {
      connectWallet();
      return;
    }

    if (!isCorrectChain) {
      switchToTarget();
      return;
    }

    if (!collateralNum || !size) return;

    try {
      await openPosition({
        market,
        direction,
        size,
        collateral: collateralNum,
        leverage,
      });
      setCollateral("");
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    } catch {
      // error is already captured in the hook
    }
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-border-subtle bg-surface overflow-hidden flex flex-col">
      {/* Panel header */}
      <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between">
        <span className="text-xs font-medium tracking-widest uppercase text-text-secondary">
          Order Ticket
        </span>
        <PrivacyIndicator label="FHE Encrypted" />
      </div>

      <div className="p-5 flex-1 space-y-5">
        {/* Direction toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-[var(--radius-button)] bg-base border border-border-subtle">
          <button
            onClick={() => setDirection("long")}
            className={cn(
              "py-2.5 text-sm font-medium rounded-md transition-all duration-200",
              direction === "long"
                ? "bg-long-bg text-long border border-long/20 shadow-sm"
                : "text-text-tertiary hover:text-text-secondary",
            )}
          >
            Long
          </button>
          <button
            onClick={() => setDirection("short")}
            className={cn(
              "py-2.5 text-sm font-medium rounded-md transition-all duration-200",
              direction === "short"
                ? "bg-short-bg text-short border border-short/20 shadow-sm"
                : "text-text-tertiary hover:text-text-secondary",
            )}
          >
            Short
          </button>
        </div>

        {/* Order type */}
        <div className="flex gap-1">
          {(["market", "limit"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize",
                orderType === t
                  ? "bg-surface border border-border-default text-text-primary"
                  : "text-text-tertiary hover:text-text-secondary",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          {orderType === "limit" && (
            <Input
              label="Limit Price"
              placeholder="0.00"
              suffix="USD"
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
            />
          )}

          <div>
            <Input
              label="Collateral"
              placeholder="0.00"
              suffix="USDC"
              type="number"
              encrypted
              value={collateral}
              onChange={(e) => setCollateral(e.target.value)}
            />
            {isConnected && hasContract && (
              <div className="flex items-center justify-between mt-1.5 px-1">
                <span className="text-[10px] text-text-ghost">Balance</span>
                <button
                  type="button"
                  onClick={() => setCollateral(usdcBalance.toFixed(2))}
                  className="text-[10px] font-mono text-accent/70 hover:text-accent cursor-pointer"
                >
                  {usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                </button>
              </div>
            )}
            {isOnChainReady && collateralNum > 0 && !hasEnoughUsdc && (
              <p className="mt-1.5 px-1 text-[10px] text-short">
                Testnet USDC balance is too low for this collateral amount.
              </p>
            )}
          </div>
        </div>

        {/* Leverage selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-text-secondary font-medium tracking-wide uppercase">
              Leverage
            </label>
            <span className="text-sm font-mono font-medium text-text-primary tabular-nums">
              {leverage}x
            </span>
          </div>

          <div className="relative h-8 flex items-center">
            <div className="absolute inset-x-0 h-1 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-accent/40"
                style={{
                  width: `${(LEVERAGE_OPTIONS.indexOf(leverage as typeof LEVERAGE_OPTIONS[number]) / (LEVERAGE_OPTIONS.length - 1)) * 100}%`,
                }}
              />
            </div>
            <div className="relative w-full flex justify-between">
              {LEVERAGE_OPTIONS.map((lev) => (
                <button
                  key={lev}
                  onClick={() => setLeverage(lev)}
                  className={cn(
                    "relative z-10 w-6 h-6 rounded-full border-2 transition-all duration-200 text-[9px] font-mono",
                    leverage === lev
                      ? "bg-accent border-accent text-void scale-110"
                      : lev <= leverage
                        ? "bg-accent/20 border-accent/30 text-accent/60"
                        : "bg-muted border-border-default text-text-ghost hover:border-border-bright",
                  )}
                >
                  {lev > 9 ? "" : ""}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            {LEVERAGE_OPTIONS.map((lev) => (
              <span key={lev} className="text-[9px] font-mono text-text-ghost w-6 text-center">
                {lev}x
              </span>
            ))}
          </div>
        </div>

        {/* Order summary */}
        <div className="p-4 rounded-xl bg-base border border-border-subtle space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-text-tertiary">Position Size</span>
            <span className="text-xs font-mono text-text-primary tabular-nums">
              {size > 0 ? formatCurrency(size) : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-text-tertiary">Est. Entry</span>
            <span className="text-xs font-mono text-text-secondary tabular-nums">
              {currentPrice > 0 ? formatCurrency(currentPrice) : "—"}
            </span>
          </div>
          {isOnChainReady && (
            <div className="flex justify-end">
              <span className="text-[10px] text-accent/50 uppercase tracking-wider">
                on-chain oracle
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-xs text-text-tertiary">Liquidation</span>
            <span className="text-xs font-mono text-text-secondary tabular-nums flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-accent-subtle/40 border border-accent/10 encrypted-field inline-block" />
              shielded
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-text-tertiary">Fee</span>
            <span className="text-xs font-mono text-text-secondary tabular-nums">0.10%</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-border-subtle">
            <span className="text-xs text-text-secondary font-medium">Max Loss</span>
            <span className="text-xs font-mono text-text-secondary tabular-nums flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-accent-subtle/40 border border-accent/10 encrypted-field inline-block" />
              encrypted
            </span>
          </div>
        </div>

        {/* Submit button */}
        {!isConnected ? (
          <Button
            variant="primary"
            size="lg"
            className="w-full text-sm font-semibold"
            onClick={connectWallet}
          >
            Connect Wallet
          </Button>
        ) : (
          <Button
            variant={direction === "long" ? "long" : "short"}
            size="lg"
            className="w-full text-sm font-semibold"
            onClick={handleSubmit}
            disabled={submitBlocked}
          >
            {!isCorrectChain ? `Switch to ${targetChainName}`
              : status === "encrypting" ? "Encrypting Order..."
              : status === "approving" ? "Approve USDC in Wallet..."
              : status === "confirming" ? "Confirm Transaction..."
              : status === "decrypting" ? "Decrypting Proof..."
              : status === "pending" ? "Waiting for Block..."
              : isOnChainReady && !hasEnoughUsdc ? "Insufficient Testnet USDC"
              : isProductionOnChainOnly && !isOnChainReady ? "On-chain Trading Required"
              : `Open ${direction === "long" ? "Long" : "Short"} — ${leverage}x`}
          </Button>
        )}

        {/* Tx status */}
        {status === "success" && (
          <div className="p-2.5 rounded-lg bg-long-bg border border-long/20 text-center">
            <p className="text-[11px] text-long font-medium">Position opened successfully!</p>
            {txHash && (
              <p className="text-[10px] text-long/60 font-mono mt-0.5 truncate">{txHash}</p>
            )}
          </div>
        )}
        {status === "error" && (
          <div className="p-2.5 rounded-lg bg-short-bg border border-short/20 text-center">
            <p className="text-[10px] text-short">{txError || "Transaction failed"}</p>
          </div>
        )}

        {/* Mode indicator */}
        <div className="flex items-center justify-center gap-1.5">
          <span className={cn(
            "w-1.5 h-1.5 rounded-full",
            isOnChainReady ? "bg-accent" : hasContract ? "bg-warning" : "bg-short",
          )} />
          <p className="text-[10px] text-text-ghost text-center leading-relaxed">
            {isOnChainReady
              ? "On-chain mode — USDC collateral via Arbitrum Sepolia"
              : isProductionOnChainOnly
                ? requiresChainSwitch
                  ? `Production mode — switch to ${targetChainName} to trade live`
                  : hasContract
                    ? "Production mode — on-chain trading only. Testnet USDC is required."
                    : "Production mode — on-chain trading only. ShadowPerps contract env is missing."
              : hasContract
                ? "Connect wallet to Arbitrum Sepolia for on-chain mode"
                : "Engine mode — deploy contracts for on-chain"}
          </p>
        </div>
      </div>
    </div>
  );
}
