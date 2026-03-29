"use client";

import { cn } from "@/lib/constants";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "long" | "short";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-void hover:bg-accent-dim active:bg-accent-muted font-medium",
  secondary:
    "bg-surface border border-border-default text-text-primary hover:bg-elevated hover:border-border-bright active:bg-muted",
  ghost:
    "bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface active:bg-elevated",
  danger:
    "bg-short-bg border border-short/20 text-short hover:bg-short/15 active:bg-short/20",
  long:
    "bg-long-bg border border-long/20 text-long hover:bg-long/15 active:bg-long/20",
  short:
    "bg-short-bg border border-short/20 text-short hover:bg-short/15 active:bg-short/20",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-sm",
};

export default function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-body rounded-[var(--radius-button)] transition-all duration-200 cursor-pointer select-none whitespace-nowrap",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-base",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
