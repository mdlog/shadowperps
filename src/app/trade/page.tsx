"use client";

import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Chart from "@/components/trading/Chart";
import OrderPanel from "@/components/trading/OrderPanel";
import MarketStats from "@/components/trading/MarketStats";
import MarketSelector from "@/components/trading/MarketSelector";
import PositionSummary from "@/components/trading/PositionSummary";
import OrderHistory from "@/components/trading/OrderHistory";

export default function TradePage() {
  const [selectedMarket, setSelectedMarket] = useState("BTC-PERP");

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen bg-base">
        <div className="max-w-[1600px] mx-auto p-3 lg:p-4">
          {/* Top bar */}
          <div className="mb-3 flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-semibold text-text-primary tracking-tight">
                Trading Terminal
              </h1>
              <div className="h-4 w-px bg-border-subtle" />
              <span className="text-xs text-text-tertiary font-mono">{selectedMarket}</span>
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
          <div className="grid grid-cols-12 gap-3 lg:gap-4">
            {/* Left sidebar — Markets */}
            <div className="col-span-12 lg:col-span-2 space-y-3">
              <MarketSelector
                selectedMarket={selectedMarket}
                onSelectMarket={setSelectedMarket}
              />
              <MarketStats symbol={selectedMarket} />
            </div>

            {/* Center — Chart + Positions */}
            <div className="col-span-12 lg:col-span-7 space-y-3">
              <Chart symbol={selectedMarket} />
              <PositionSummary />
              <OrderHistory />
            </div>

            {/* Right sidebar — Order Panel */}
            <div className="col-span-12 lg:col-span-3">
              <OrderPanel market={selectedMarket} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
