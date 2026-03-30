"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useBalance } from "wagmi";
import { useReadContract } from "wagmi";
import { cn } from "@/lib/constants";
import { useWallet } from "@/hooks/useWallet";
import { useEngineHealth } from "@/hooks/useEngine";
import { ERC20_ABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import Button from "@/components/ui/Button";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { address, shortAddress, isConnected, isConnecting, isCorrectChain, targetChainName, connectWallet, connectWalletAsync, ensureTargetChain, switchToTarget, disconnect } = useWallet();
  const { data: health } = useEngineHealth();
  const [walletOpen, setWalletOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isApp = pathname === "/trade" || pathname === "/portfolio" || pathname === "/pool";

  // ETH balance
  const { data: ethBalance } = useBalance({
    address,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  // USDC balance
  const { data: usdcRaw } = useReadContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const usdcBalance = usdcRaw ? Number(usdcRaw) / 1e6 : 0;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setWalletOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLaunchApp = async () => {
    if (isConnected) {
      if (!isCorrectChain) {
        await ensureTargetChain();
      }
      router.push("/trade");
      return;
    }

    try {
      await connectWalletAsync();
      router.push("/trade");
    } catch (error) {
      console.error("Wallet connect failed", error);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
        <nav className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <img src="/logo.png" alt="ShadowPerps" className="w-10 h-10 rounded-lg object-contain" />
            <span className="font-display text-xl font-semibold tracking-tight text-text-primary">
              Shadow<span className="text-accent">Perps</span>
            </span>
          </Link>

          {/* Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { href: "/", label: "Home" },
              { href: "/trade", label: "Terminal" },
              { href: "/portfolio", label: "Portfolio" },
              { href: "/pool", label: "Pool" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 text-sm rounded-[var(--radius-button)] transition-all duration-200",
                  pathname === link.href
                    ? "text-text-primary bg-surface border border-border-subtle"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface/50",
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-3">
            {/* Engine status */}
            {isApp && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-pill)] bg-accent-subtle/40 border border-accent/10">
                <span className="relative flex h-1.5 w-1.5">
                  <span className={cn(
                    "absolute inset-0 rounded-full animate-ping opacity-60",
                    health?.status === "ok" ? "bg-accent" : "bg-warning",
                  )} />
                  <span className={cn(
                    "relative rounded-full h-1.5 w-1.5",
                    health?.status === "ok" ? "bg-accent" : "bg-warning",
                  )} />
                </span>
                <span className="text-[11px] text-accent/80 font-medium tracking-wide">
                  {health?.status === "ok" ? "Confidential Mode" : "Engine Offline"}
                </span>
              </div>
            )}

            {/* Network indicator */}
            {isConnected && !isCorrectChain && (
              <Button variant="secondary" size="sm" onClick={switchToTarget}>
                Switch to {targetChainName}
              </Button>
            )}

            {/* Wallet button + dropdown */}
            {isConnected ? (
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setWalletOpen(!walletOpen)}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs rounded-[var(--radius-button)] bg-surface border border-border-default text-text-primary hover:bg-elevated hover:border-border-bright transition-all duration-200"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="relative rounded-full h-1.5 w-1.5 bg-accent" />
                  </span>
                  {shortAddress}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={cn("text-text-tertiary transition-transform", walletOpen && "rotate-180")}>
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {/* Dropdown */}
                {walletOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-[var(--radius-card)] border border-border-subtle bg-surface shadow-[var(--shadow-elevated)] overflow-hidden animate-fade-down z-50">
                    {/* Address */}
                    <div className="px-4 py-3 border-b border-border-subtle/50">
                      <div className="text-[10px] text-text-ghost uppercase tracking-wider mb-1">Wallet</div>
                      <div className="text-xs font-mono text-text-primary truncate">{address}</div>
                      <div className="text-[10px] text-accent/60 mt-0.5">{targetChainName}</div>
                    </div>

                    {/* Balances */}
                    <div className="px-4 py-3 space-y-3">
                      <div className="text-[10px] text-text-ghost uppercase tracking-wider">Balances</div>

                      {/* ETH */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img src="/eth-logo.jpeg" alt="ETH" className="w-6 h-6 rounded-full object-cover" />
                          <span className="text-xs text-text-secondary">ETH</span>
                        </div>
                        <span className="text-xs font-mono text-text-primary tabular-nums">
                          {ethBalance ? (Number(ethBalance.value) / 1e18).toFixed(4) : "0.0000"}
                        </span>
                      </div>

                      {/* USDC */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img src="/usdcx-logo.png" alt="USDC" className="w-6 h-6 rounded-full object-cover" />
                          <span className="text-xs text-text-secondary">USDC</span>
                        </div>
                        <span className="text-xs font-mono text-text-primary tabular-nums">
                          {usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="px-4 py-3 border-t border-border-subtle/50 space-y-2">
                      <a
                        href={`https://sepolia.arbiscan.io/address/${address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between w-full text-xs text-text-tertiary hover:text-text-secondary transition-colors"
                      >
                        View on Explorer
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-text-ghost">
                          <path d="M4 3H9V8M9 3L3 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                      <button
                        onClick={() => { disconnect(); setWalletOpen(false); }}
                        className="w-full text-left text-xs text-short hover:text-short/80 transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={isApp ? connectWallet : () => void handleLaunchApp()}
                disabled={isConnecting}
              >
                {isConnecting ? "Connecting..." : isApp ? "Connect Wallet" : "Launch App"}
              </Button>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
