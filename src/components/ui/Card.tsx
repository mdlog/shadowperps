import { cn } from "@/lib/constants";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}

export default function Card({ children, className, hover = false, glow = false }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-border-subtle bg-surface",
        "shadow-[var(--shadow-card)]",
        hover && "transition-all duration-300 hover:border-border-default hover:bg-elevated hover:shadow-[var(--shadow-elevated)]",
        glow && "shadow-[var(--shadow-glow)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
