"use client";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PortfolioStats from "@/components/portfolio/PortfolioStats";
import PositionList from "@/components/portfolio/PositionList";
import RiskModule from "@/components/portfolio/RiskModule";

export default function PortfolioPage() {
  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen bg-base">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-8">
          {/* Privacy banner */}
          <div className="mb-8 p-4 rounded-xl border border-accent/10 bg-accent-subtle/20 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-subtle border border-accent/15 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-accent">
                <rect x="2" y="7" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="8" cy="11" r="1" fill="currentColor" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-text-primary font-medium">
                Private Vault — Your Eyes Only
              </p>
              <p className="text-xs text-text-tertiary mt-0.5">
                Encrypted position fields are owned by your wallet and can be decrypted locally through the CoFHE flow.
              </p>
            </div>
          </div>

          {/* Stats */}
          <PortfolioStats />

          {/* Main content grid */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <PositionList />
            </div>
            <div className="lg:col-span-1">
              <RiskModule />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
