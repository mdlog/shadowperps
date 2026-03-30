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
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-8 space-y-8">
          <PortfolioStats />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4 lg:items-stretch">
            <div className="flex lg:col-span-3">
              <PositionList />
            </div>
            <div className="self-start lg:col-span-1 lg:sticky lg:top-24">
              <RiskModule />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
