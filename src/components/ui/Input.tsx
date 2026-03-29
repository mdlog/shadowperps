"use client";

import { cn } from "@/lib/constants";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  suffix?: string;
  encrypted?: boolean;
}

export default function Input({ label, suffix, encrypted = false, className, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="flex items-center gap-2 text-xs text-text-secondary font-medium tracking-wide uppercase">
          {label}
          {encrypted && (
            <span className="text-[10px] text-accent/70 font-normal tracking-wider normal-case">
              shielded
            </span>
          )}
        </label>
      )}
      <div className={cn("relative", encrypted && "encrypted-field")}>
        <input
          className={cn(
            "w-full bg-base border border-border-default rounded-[var(--radius-input)] px-4 py-2.5 text-sm text-text-primary font-mono tabular-nums",
            suffix && "pr-16",
            "placeholder:text-text-ghost",
            "transition-colors duration-200",
            "focus:border-accent/40 focus:bg-void",
            encrypted && "border-accent/10 bg-accent-subtle/30",
            className,
          )}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary font-mono pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
