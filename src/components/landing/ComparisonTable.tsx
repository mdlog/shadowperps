import { cn } from "@/lib/constants";

const rows = [
  { feature: "Position Size", traditional: "Fully visible on-chain", shadow: "Encrypted via FHE" },
  { feature: "Collateral Amount", traditional: "Public ledger entry", shadow: "Shielded & private" },
  { feature: "Trading Strategy", traditional: "Inferrable by anyone", shadow: "Completely hidden" },
  { feature: "Liquidation Price", traditional: "Targets for hunters", shadow: "Only you know" },
  { feature: "Order Flow", traditional: "Front-runnable", shadow: "MEV-resistant execution" },
  { feature: "Entry / Exit Prices", traditional: "Trackable & copyable", shadow: "Confidential until settled" },
];

export default function ComparisonTable() {
  return (
    <section className="py-28 relative" id="architecture">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-accent/70 mb-3">
            The Difference
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            Transparent DeFi vs ShadowPerps
          </h2>
          <p className="text-text-secondary mt-4 max-w-xl mx-auto">
            Every data point that competitors expose, we encrypt.
          </p>
        </div>

        {/* Table */}
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-border-subtle bg-surface overflow-hidden shadow-[var(--shadow-card)]">
            {/* Header */}
            <div className="grid grid-cols-3 border-b border-border-subtle">
              <div className="px-6 py-4">
                <span className="text-xs font-medium tracking-widest uppercase text-text-tertiary">
                  Data Point
                </span>
              </div>
              <div className="px-6 py-4 border-l border-border-subtle">
                <span className="text-xs font-medium tracking-widest uppercase text-text-tertiary">
                  Traditional DEX
                </span>
              </div>
              <div className="px-6 py-4 border-l border-border-subtle bg-accent-subtle/30">
                <span className="text-xs font-medium tracking-widest uppercase text-accent">
                  ShadowPerps
                </span>
              </div>
            </div>

            {/* Rows */}
            {rows.map((row, i) => (
              <div
                key={row.feature}
                className={cn(
                  "grid grid-cols-3",
                  i < rows.length - 1 && "border-b border-border-subtle",
                )}
              >
                <div className="px-6 py-4 flex items-center">
                  <span className="text-sm font-medium text-text-primary">
                    {row.feature}
                  </span>
                </div>
                <div className="px-6 py-4 border-l border-border-subtle flex items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-short/60" />
                    <span className="text-sm text-text-secondary">{row.traditional}</span>
                  </div>
                </div>
                <div className="px-6 py-4 border-l border-border-subtle bg-accent-subtle/20 flex items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                    <span className="text-sm text-accent/90 font-medium">{row.shadow}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
