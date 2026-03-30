import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-void/50">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="ShadowPerps" className="w-8 h-8 rounded object-contain" />
          <span className="text-xs text-text-tertiary">
            Shadow<span className="text-accent/70">Perps</span> &middot; Confidential Perpetual Trading
          </span>
        </div>

        <div className="flex items-center gap-5">
          <Link href="/trade" className="text-xs text-text-ghost hover:text-text-secondary transition-colors">
            Trade
          </Link>
          <Link href="/portfolio" className="text-xs text-text-ghost hover:text-text-secondary transition-colors">
            Portfolio
          </Link>
          <Link href="#" className="text-xs text-text-ghost hover:text-text-secondary transition-colors">
            Docs
          </Link>
          <Link href="#" className="text-xs text-text-ghost hover:text-text-secondary transition-colors">
            GitHub
          </Link>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-accent animate-ping opacity-40" />
            <span className="relative rounded-full h-1.5 w-1.5 bg-accent/70" />
          </span>
          <span className="text-[11px] text-text-ghost">
            Powered by Fhenix FHE
          </span>
        </div>
      </div>
    </footer>
  );
}
