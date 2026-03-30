"use client";

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Chart from "@/components/trading/Chart";
import OrderPanel from "@/components/trading/OrderPanel";
import AccountInfo from "@/components/trading/AccountInfo";
import PositionSummary from "@/components/trading/PositionSummary";

function formatChartInterval(interval: string): string {
  switch (interval) {
    case "1":
    case "1m":
      return "1m";
    case "5":
    case "5m":
      return "5m";
    case "15":
    case "15m":
      return "15m";
    case "60":
    case "1h":
      return "1H";
    case "240":
    case "4h":
      return "4H";
    case "1D":
    case "D":
    case "1d":
      return "1D";
    default:
      return interval.toUpperCase();
  }
}

export default function TradePage() {
  const [selectedMarket, setSelectedMarket] = useState("BTC-PERP");
  const [selectedInterval, setSelectedInterval] = useState("1h");

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen bg-base">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-3 lg:py-4">
          {/* Top bar */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-semibold text-text-primary tracking-tight">
                Trading Terminal
              </h1>
              <div className="h-4 w-px bg-border-subtle" />
              <span className="text-xs text-text-tertiary font-mono">{selectedMarket}</span>
              <div className="h-4 w-px bg-border-subtle" />
              <span className="text-xs text-text-tertiary font-mono">{formatChartInterval(selectedInterval)}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-pill)] bg-accent-subtle/40 border border-accent/10">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-60" />
                <span className="relative rounded-full h-1.5 w-1.5 bg-accent" />
              </span>
              <span className="text-[11px] text-accent/80 font-medium tracking-wide">
                All Orders FHE Encrypted
              </span>
            </div>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-12 gap-3 lg:gap-4 lg:items-stretch">
            {/* Center — Chart + Positions */}
            <div className="col-span-12 flex flex-col gap-3 lg:col-span-9 lg:min-h-full">
              <Chart
                symbol={selectedMarket}
                onSymbolChange={setSelectedMarket}
                onIntervalChange={setSelectedInterval}
              />
              <div className="flex flex-1">
                <PositionSummary />
              </div>
            </div>

            {/* Right sidebar — Order Panel + Account */}
            <div className="col-span-12 flex flex-col gap-3 lg:col-span-3">
              <OrderPanel market={selectedMarket} />
              <AccountInfo />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
