import { cn } from "@/lib/constants";

interface PrivacyIndicatorProps {
  label?: string;
  className?: string;
}

export default function PrivacyIndicator({ label = "Encrypted", className }: PrivacyIndicatorProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] text-accent/60 tracking-widest uppercase", className)}>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inset-0 rounded-full bg-accent/40 animate-ping" />
        <span className="relative rounded-full h-1.5 w-1.5 bg-accent/70" />
      </span>
      {label}
    </span>
  );
}
