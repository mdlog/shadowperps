"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { useWallet } from "@/hooks/useWallet";

const LEFT_STREAMS = Array.from({ length: 12 }, (_, row) =>
  Array.from({ length: 40 }, (_, col) => ((row * 41 + col * 17) % 5 < 2 ? "█" : "░")).join(""),
);

const RIGHT_STREAMS = Array.from({ length: 10 }, (_, row) =>
  Array.from({ length: 30 }, (_, col) => ((row * 29 + col * 13) % 4 < 2 ? "█" : "░")).join(""),
);

export default function Hero() {
  const router = useRouter();
  const { isConnected, isConnecting, connectWalletAsync } = useWallet();

  const handleLaunchApp = async () => {
    if (isConnected) {
      router.push("/trade");
      return;
    }

    try {
      await connectWalletAsync();
      router.push("/trade");
    } catch {
      // User rejected the wallet prompt or the connector failed.
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-base/50 to-base" />

      {/* Radial glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full bg-accent/[0.03] blur-[120px]" />

      {/* Decorative encrypted data streams */}
      <div className="absolute top-20 left-[10%] opacity-[0.04] font-mono text-xs leading-loose select-none pointer-events-none" aria-hidden>
        {LEFT_STREAMS.map((stream, i) => (
          <div key={i} className="whitespace-nowrap">
            {stream}
          </div>
        ))}
      </div>
      <div className="absolute top-32 right-[8%] opacity-[0.04] font-mono text-xs leading-loose select-none pointer-events-none" aria-hidden>
        {RIGHT_STREAMS.map((stream, i) => (
          <div key={i} className="whitespace-nowrap">
            {stream}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-[1440px] mx-auto px-6 lg:px-10 pt-32 pb-24">
        <div className="max-w-3xl mx-auto text-center">
          {/* Status line */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--radius-pill)] bg-surface border border-border-subtle mb-10 animate-fade-down opacity-0">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-60" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-accent" />
            </span>
            <span className="text-xs text-text-secondary tracking-wide">
              Powered by Fully Homomorphic Encryption
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-semibold leading-[1.05] tracking-tight mb-7 animate-fade-up opacity-0 stagger-1">
            Confidential Execution
            <br />
            <span className="text-accent">for Serious Onchain</span>
            <br />
            Traders
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto mb-10 animate-fade-up opacity-0 stagger-2">
            Open leveraged perpetual positions without exposing your strategy.
            Private collateral, encrypted order flow, MEV-resistant execution
            — built for institutional-grade capital.
          </p>

          {/* CTA */}
          <div className="flex items-center justify-center gap-4 animate-fade-up opacity-0 stagger-3">
            <Button variant="primary" size="lg" onClick={() => void handleLaunchApp()} disabled={isConnecting}>
              {isConnecting ? "Connecting..." : "Launch App"}
            </Button>
            <Link href="#architecture">
              <Button variant="secondary" size="lg">
                View Architecture
              </Button>
            </Link>
          </div>

          {/* Stats bar */}
          <div className="mt-20 grid grid-cols-3 gap-6 max-w-xl mx-auto animate-fade-up opacity-0 stagger-4">
            {[
              { value: "$892M", label: "Open Interest" },
              { value: "$1.28B", label: "24h Volume" },
              { value: "100%", label: "Confidential" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="font-mono text-2xl sm:text-3xl font-medium text-text-primary tabular-nums">
                  {stat.value}
                </div>
                <div className="text-xs text-text-tertiary tracking-wide mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Terminal Preview */}
        <div className="mt-24 max-w-4xl mx-auto animate-fade-up opacity-0 stagger-5">
          <div className="rounded-2xl border border-border-subtle bg-surface/80 shadow-[var(--shadow-elevated)] overflow-hidden">
            {/* Terminal header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-short/40" />
                <div className="w-3 h-3 rounded-full bg-warning/40" />
                <div className="w-3 h-3 rounded-full bg-accent/40" />
              </div>
              <span className="text-[11px] text-text-ghost font-mono tracking-wider">
                SHADOWPERPS TERMINAL v1.0
              </span>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-60" />
                  <span className="relative rounded-full h-1.5 w-1.5 bg-accent" />
                </span>
                <span className="text-[10px] text-accent/60">LIVE</span>
              </div>
            </div>

            {/* Terminal body */}
            <div className="p-6 grid grid-cols-12 gap-4">
              {/* Chart area */}
              <div className="col-span-8 h-48 rounded-xl bg-base border border-border-subtle relative overflow-hidden">
                <div className="absolute inset-0 chart-gradient" />
                {/* Simulated chart line */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke="rgba(62,207,142,0.4)"
                    strokeWidth="2"
                    points="0,150 30,140 60,145 90,120 120,130 150,100 180,110 210,80 240,90 270,60 300,70 330,45 360,55 400,30"
                  />
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(62,207,142,0.15)" />
                    <stop offset="100%" stopColor="rgba(62,207,142,0)" />
                  </linearGradient>
                  <polygon
                    fill="url(#chartFill)"
                    points="0,150 30,140 60,145 90,120 120,130 150,100 180,110 210,80 240,90 270,60 300,70 330,45 360,55 400,30 400,200 0,200"
                  />
                </svg>
                <div className="absolute top-3 left-4 flex items-center gap-3">
                  <span className="text-sm font-mono font-medium text-text-primary">BTC-PERP</span>
                  <span className="text-sm font-mono text-long">$67,842.50</span>
                  <span className="text-xs font-mono text-long">+2.34%</span>
                </div>
              </div>

              {/* Side panel */}
              <div className="col-span-4 space-y-3">
                <div className="p-3 rounded-lg bg-base border border-border-subtle">
                  <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-2">
                    Position Size
                  </div>
                  <div className="h-4 rounded bg-accent-subtle/40 border border-accent/8 encrypted-field w-full" />
                </div>
                <div className="p-3 rounded-lg bg-base border border-border-subtle">
                  <div className="text-[10px] text-text-ghost uppercase tracking-widest mb-2">
                    Collateral
                  </div>
                  <div className="h-4 rounded bg-accent-subtle/40 border border-accent/8 encrypted-field w-full" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="py-2 rounded-lg bg-long-bg border border-long/15 text-center text-xs text-long font-medium">
                    Long
                  </div>
                  <div className="py-2 rounded-lg bg-short-bg border border-short/15 text-center text-xs text-short font-medium">
                    Short
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
