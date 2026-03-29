import Card from "@/components/ui/Card";

const steps = [
  {
    step: "01",
    title: "Encrypt Order",
    description: "Your order parameters — size, collateral, leverage — are encrypted client-side using the protocol's FHE public key.",
  },
  {
    step: "02",
    title: "Submit Ciphertext",
    description: "The encrypted order is submitted on-chain. No validator, indexer, or MEV bot can read the contents.",
  },
  {
    step: "03",
    title: "Confidential Matching",
    description: "The FHE co-processor evaluates encrypted operations. Position state updates without ever decrypting sensitive data.",
  },
  {
    step: "04",
    title: "Private Settlement",
    description: "PnL is computed over ciphertexts. Only the position owner can decrypt and view their trading performance.",
  },
];

export default function Architecture() {
  return (
    <section className="py-28 relative bg-void/30">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-xs font-medium tracking-[0.2em] uppercase text-accent/70 mb-3">
            How It Works
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            Confidential Execution Pipeline
          </h2>
        </div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {steps.map((s, i) => (
              <Card key={s.step} hover className="p-7 relative overflow-hidden group">
                {/* Step number */}
                <div className="absolute top-5 right-5 font-display text-5xl font-bold text-border-subtle group-hover:text-accent/10 transition-colors duration-500">
                  {s.step}
                </div>

                {/* Connector line (visual) */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute -bottom-3 left-1/2 w-px h-6 bg-border-subtle" />
                )}

                <div className="relative z-10">
                  <div className="w-8 h-8 rounded-lg bg-accent-subtle border border-accent/15 flex items-center justify-center mb-4">
                    <span className="text-xs font-mono font-medium text-accent">
                      {s.step}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2 tracking-tight">
                    {s.title}
                  </h3>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {s.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-sm text-text-tertiary">
            Read the full technical specification in our{" "}
            <a href="#" className="text-accent hover:text-accent-dim transition-colors underline underline-offset-4 decoration-accent/30">
              documentation
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
