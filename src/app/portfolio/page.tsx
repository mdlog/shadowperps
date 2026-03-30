"use client";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PortfolioStats from "@/components/portfolio/PortfolioStats";
import PositionList from "@/components/portfolio/PositionList";
import RiskModule from "@/components/portfolio/RiskModule";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import PrivacyIndicator from "@/components/ui/PrivacyIndicator";
import { useWallet } from "@/hooks/useWallet";
import { useOnChainPortfolio } from "@/hooks/useOnChainPortfolio";

export default function PortfolioPage() {
  const { isConnected, isCorrectChain, shortAddress, targetChainName } = useWallet();
  const { data: portfolio, hasDeployment } = useOnChainPortfolio();

  const openPositions = portfolio.positions.filter((position) => position.status === "open");
  const syncLabel = !isConnected
    ? "Wallet disconnected"
    : !isCorrectChain
      ? `Switch to ${targetChainName}`
      : !hasDeployment
        ? "Contract not deployed"
        : "Wallet-decrypted and live";

  const decryptedAtLabel = portfolio.decrypted_at
    ? new Date(portfolio.decrypted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "Awaiting decrypt";

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen bg-base">
        <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-8 space-y-8">
          <Card className="overflow-hidden">
            <div className="relative px-6 py-6 lg:px-8 lg:py-7">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
              <div className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr] lg:items-start">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="encrypted">Private Vault</Badge>
                    <PrivacyIndicator label={syncLabel} />
                  </div>
                  <div>
                    <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
                      Portfolio
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
                      Position size and direction are decrypted locally in your wallet from CoFHE ciphertext handles.
                      The page below is the private view of your on-chain book, not an engine-side mirror.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="rounded-[var(--radius-card)] border border-border-subtle bg-elevated/50 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-text-ghost">Wallet</div>
                    <div className="mt-2 text-sm font-medium text-text-primary">
                      {isConnected ? shortAddress : "Not connected"}
                    </div>
                  </div>
                  <div className="rounded-[var(--radius-card)] border border-border-subtle bg-elevated/50 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-text-ghost">Open Positions</div>
                    <div className="mt-2 text-sm font-medium text-text-primary">
                      {openPositions.length} active
                    </div>
                  </div>
                  <div className="rounded-[var(--radius-card)] border border-border-subtle bg-elevated/50 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-text-ghost">Last Decrypt</div>
                    <div className="mt-2 text-sm font-medium text-text-primary">
                      {decryptedAtLabel}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <PortfolioStats />

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <PositionList />
            </div>
            <div className="lg:col-span-1 lg:sticky lg:top-24 self-start">
              <RiskModule />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
