"use client";

import { useState } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { parseGwei } from "viem";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useWallet } from "@/hooks/useWallet";
import { CONTRACT_ADDRESSES, SHADOW_POOL_ABI, ERC20_ABI } from "@/lib/contracts";
import { cn, formatCurrency } from "@/lib/constants";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

const USDC_DECIMALS = 6;

export default function PoolPage() {
  const { isConnected, connectWallet } = useWallet();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "approving" | "confirming" | "pending" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const poolAddr = CONTRACT_ADDRESSES.pool;
  const usdcAddr = CONTRACT_ADDRESSES.usdc;

  // Pool stats
  const { data: poolStats, refetch: refetchStats } = useReadContract({
    address: poolAddr,
    abi: SHADOW_POOL_ABI,
    functionName: "getPoolStats",
    query: { enabled: !!poolAddr, refetchInterval: 10_000 },
  });

  // User's LP token balance
  const { data: lpBalance, refetch: refetchLp } = useReadContract({
    address: poolAddr,
    abi: SHADOW_POOL_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!poolAddr, refetchInterval: 10_000 },
  });

  // User's USDC balance
  const { data: usdcBalance, refetch: refetchUsdc } = useReadContract({
    address: usdcAddr,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10_000 },
  });

  const tvl = poolStats ? Number(poolStats[0]) / 1e6 : 0;
  const lpSupply = poolStats ? Number(poolStats[1]) / 1e6 : 0;
  const lpPrice = poolStats ? Number(poolStats[2]) / 1e6 : 1;
  const feesEarned = poolStats ? Number(poolStats[3]) / 1e6 : 0;
  const traderProfits = poolStats ? Number(poolStats[4]) / 1e6 : 0;
  const traderLosses = poolStats ? Number(poolStats[5]) / 1e6 : 0;
  const userLp = lpBalance ? Number(lpBalance) / 1e6 : 0;
  const userUsdc = usdcBalance ? Number(usdcBalance) / 1e6 : 0;
  const userLpValue = userLp * lpPrice;
  const apy = tvl > 0 ? ((feesEarned + traderLosses - traderProfits) / tvl * 100) : 0;

  async function getGas() {
    if (!publicClient) return {};
    const block = await publicClient.getBlock();
    const base = block.baseFeePerGas ?? parseGwei("0.1");
    const maxFee = base * 5n + parseGwei("0.5");
    return { maxFeePerGas: maxFee, maxPriorityFeePerGas: maxFee / 10n };
  }

  const refetchAll = () => { refetchStats(); refetchLp(); refetchUsdc(); };

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || !address || !publicClient) return;
    const amountRaw = BigInt(Math.round(amount * 1e6));

    setStatus("approving");
    setError(null);
    try {
      const gas = await getGas();
      // Approve
      const allowance = await publicClient.readContract({
        address: usdcAddr, abi: ERC20_ABI, functionName: "allowance", args: [address, poolAddr],
      });
      if ((allowance as bigint) < amountRaw) {
        const h = await writeContractAsync({ address: usdcAddr, abi: ERC20_ABI, functionName: "approve", args: [poolAddr, amountRaw], ...gas });
        await publicClient.waitForTransactionReceipt({ hash: h });
      }
      // Deposit
      setStatus("confirming");
      const h2 = await writeContractAsync({ address: poolAddr, abi: SHADOW_POOL_ABI, functionName: "deposit", args: [amountRaw], ...gas });
      setStatus("pending");
      await publicClient.waitForTransactionReceipt({ hash: h2 });
      setStatus("success");
      setDepositAmount("");
      refetchAll();
    } catch (e: unknown) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || !address || !publicClient) return;
    const amountRaw = BigInt(Math.round(amount * 1e6));

    setStatus("confirming");
    setError(null);
    try {
      const gas = await getGas();
      const h = await writeContractAsync({ address: poolAddr, abi: SHADOW_POOL_ABI, functionName: "withdraw", args: [amountRaw], ...gas });
      setStatus("pending");
      await publicClient.waitForTransactionReceipt({ hash: h });
      setStatus("success");
      setWithdrawAmount("");
      refetchAll();
    } catch (e: unknown) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const isBusy = status === "approving" || status === "confirming" || status === "pending";

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen bg-base">
        <div className="max-w-[960px] mx-auto px-6 lg:px-10 py-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary mb-2">
            Liquidity Pool
          </h1>
          <p className="text-sm text-text-tertiary mb-8">
            Deposit USDC to earn yield from trading fees and trader losses. You are the counterparty.
          </p>

          {/* Pool Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <Card className="p-4">
              <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-2">TVL</div>
              <div className="text-lg font-mono font-medium text-text-primary tabular-nums">{formatCurrency(tvl)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-2">spUSDC Price</div>
              <div className="text-lg font-mono font-medium text-text-primary tabular-nums">${lpPrice.toFixed(4)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-2">Fees Earned</div>
              <div className="text-lg font-mono font-medium text-long tabular-nums">{formatCurrency(feesEarned)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-2">Net P&L (Pool)</div>
              <div className={cn("text-lg font-mono font-medium tabular-nums", traderLosses >= traderProfits ? "text-long" : "text-short")}>
                {formatCurrency(traderLosses - traderProfits + feesEarned)}
              </div>
            </Card>
          </div>

          {/* Deposit / Withdraw */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Deposit */}
            <Card className="p-6">
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-widest mb-4">Deposit USDC</h2>
              {!isConnected ? (
                <Button variant="primary" size="lg" className="w-full" onClick={connectWallet}>Connect Wallet</Button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-text-secondary">Amount</label>
                      <button onClick={() => setDepositAmount(userUsdc.toFixed(2))} className="text-[10px] font-mono text-accent/70 hover:text-accent">
                        {userUsdc.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDC
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0.00"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="w-full bg-base border border-border-default rounded-[var(--radius-input)] px-4 py-2.5 pr-16 text-sm text-text-primary font-mono tabular-nums placeholder:text-text-ghost focus:border-accent/40 focus:bg-void transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary font-mono pointer-events-none">USDC</span>
                    </div>
                  </div>
                  <div className="text-xs text-text-ghost">
                    You receive: <span className="text-text-secondary font-mono">
                      {depositAmount && lpPrice > 0 ? (parseFloat(depositAmount) / lpPrice).toFixed(2) : "0.00"} spUSDC
                    </span>
                  </div>
                  <Button variant="primary" size="lg" className="w-full" onClick={handleDeposit} disabled={isBusy || !depositAmount}>
                    {status === "approving" ? "Approving..." : status === "confirming" ? "Confirm..." : status === "pending" ? "Depositing..." : "Deposit"}
                  </Button>
                </div>
              )}
            </Card>

            {/* Withdraw */}
            <Card className="p-6">
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-widest mb-4">Withdraw</h2>
              {!isConnected ? (
                <Button variant="primary" size="lg" className="w-full" onClick={connectWallet}>Connect Wallet</Button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-text-secondary">spUSDC Amount</label>
                      <button onClick={() => setWithdrawAmount(userLp.toFixed(2))} className="text-[10px] font-mono text-accent/70 hover:text-accent">
                        {userLp.toLocaleString(undefined, { minimumFractionDigits: 2 })} spUSDC
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0.00"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full bg-base border border-border-default rounded-[var(--radius-input)] px-4 py-2.5 pr-20 text-sm text-text-primary font-mono tabular-nums placeholder:text-text-ghost focus:border-accent/40 focus:bg-void transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary font-mono pointer-events-none">spUSDC</span>
                    </div>
                  </div>
                  <div className="text-xs text-text-ghost">
                    You receive: <span className="text-text-secondary font-mono">
                      {withdrawAmount ? (parseFloat(withdrawAmount) * lpPrice).toFixed(2) : "0.00"} USDC
                    </span>
                  </div>
                  <Button variant="secondary" size="lg" className="w-full" onClick={handleWithdraw} disabled={isBusy || !withdrawAmount}>
                    {status === "confirming" ? "Confirm..." : status === "pending" ? "Withdrawing..." : "Withdraw"}
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* Your Position */}
          {isConnected && userLp > 0 && (
            <Card className="mt-6 p-6">
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-widest mb-4">Your LP Position</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-1">spUSDC Balance</div>
                  <div className="text-sm font-mono text-text-primary tabular-nums">{userLp.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-1">Value</div>
                  <div className="text-sm font-mono text-text-primary tabular-nums">{formatCurrency(userLpValue)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-1">Pool Share</div>
                  <div className="text-sm font-mono text-text-primary tabular-nums">
                    {lpSupply > 0 ? ((userLp / lpSupply) * 100).toFixed(2) : "0.00"}%
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Status messages */}
          {status === "success" && (
            <div className="mt-4 p-3 rounded-lg bg-long-bg border border-long/20 text-center">
              <p className="text-xs text-long font-medium">Transaction successful!</p>
            </div>
          )}
          {status === "error" && (
            <div className="mt-4 p-3 rounded-lg bg-short-bg border border-short/20 text-center">
              <p className="text-xs text-short">{error}</p>
            </div>
          )}

          {/* How it works */}
          <Card className="mt-8 p-6">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-widest mb-4">How It Works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-text-tertiary leading-relaxed">
              <div>
                <div className="text-text-primary font-medium mb-1">1. Deposit USDC</div>
                You deposit USDC and receive spUSDC LP tokens representing your share of the pool.
              </div>
              <div>
                <div className="text-text-primary font-medium mb-1">2. Earn Yield</div>
                Trading fees (0.10% per trade) and trader losses flow into the pool. Your spUSDC grows in value.
              </div>
              <div>
                <div className="text-text-primary font-medium mb-1">3. Withdraw Anytime</div>
                Burn spUSDC to receive USDC back, including your share of accumulated fees and profits.
              </div>
            </div>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  );
}
