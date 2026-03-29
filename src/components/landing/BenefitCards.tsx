import Card from "@/components/ui/Card";

const benefits = [
  {
    title: "Hidden Positions",
    description:
      "Your position size, direction, and strategy remain fully encrypted. No one — not even validators — can see your trading intent.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-accent">
        <rect x="4" y="12" width="24" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 12V9a6 6 0 0 1 12 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="16" cy="20" r="2" fill="currentColor" opacity="0.6" />
        <line x1="16" y1="22" x2="16" y2="25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Private Collateral",
    description:
      "Collateral amounts are encrypted on-chain using FHE. Your capital exposure is known only to you.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-accent">
        <rect x="4" y="6" width="24" height="20" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 12h24" stroke="currentColor" strokeWidth="1.5" />
        <rect x="8" y="17" width="8" height="4" rx="1" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1" />
        <line x1="20" y1="18" x2="24" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        <line x1="20" y1="21" x2="23" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      </svg>
    ),
  },
  {
    title: "MEV-Resistant Execution",
    description:
      "Orders are processed through encrypted computation. Front-runners and sandwich attacks cannot extract value from your trades.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-accent">
        <path d="M16 4L28 10v12L16 28 4 22V10L16 4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M16 4v24" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        <path d="M4 10l12 6 12-6" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        <circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M13.5 16l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Institutional Confidentiality",
    description:
      "Built for funds, desks, and serious capital. Full position privacy with verifiable settlement and transparent protocol rules.",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-accent">
        <rect x="6" y="14" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 18h20" stroke="currentColor" strokeWidth="1" opacity="0.3" />
        <path d="M12 4h8l3 10H9L12 4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <line x1="16" y1="7" x2="16" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <rect x="10" y="22" width="4" height="3" rx="0.5" fill="currentColor" opacity="0.15" />
        <rect x="18" y="22" width="4" height="3" rx="0.5" fill="currentColor" opacity="0.15" />
      </svg>
    ),
  },
];

export default function BenefitCards() {
  return (
    <section className="py-28 relative">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-accent/70 mb-3">
            Why ShadowPerps
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            Trading Infrastructure Built for Privacy
          </h2>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {benefits.map((benefit, i) => (
            <Card
              key={benefit.title}
              hover
              className={`p-7 opacity-0 animate-fade-up stagger-${i + 1}`}
            >
              <div className="mb-5 w-12 h-12 rounded-xl bg-accent-subtle border border-accent/10 flex items-center justify-center">
                {benefit.icon}
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-2.5 tracking-tight">
                {benefit.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {benefit.description}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
