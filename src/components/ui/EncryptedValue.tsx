"use client";

import { cn } from "@/lib/constants";

interface EncryptedValueProps {
  className?: string;
  width?: string;
}

export default function EncryptedValue({ className, width = "w-24" }: EncryptedValueProps) {
  return (
    <span
      className={cn(
        "inline-block h-5 rounded bg-accent-subtle/40 border border-accent/8 encrypted-field",
        width,
        className,
      )}
      aria-label="Encrypted value"
    />
  );
}
