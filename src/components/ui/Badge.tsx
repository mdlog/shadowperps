import { cn } from "@/lib/constants";

type BadgeVariant = "default" | "accent" | "long" | "short" | "warning" | "encrypted";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-muted text-text-secondary border-border-subtle",
  accent: "bg-accent-subtle text-accent border-accent/15",
  long: "bg-long-bg text-long border-long/15",
  short: "bg-short-bg text-short border-short/15",
  warning: "bg-warning-bg text-warning border-warning/15",
  encrypted: "bg-accent-subtle/50 text-accent/80 border-accent/10",
};

export default function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase border rounded-[var(--radius-pill)]",
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
