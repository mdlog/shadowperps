"use client";

import { type ReactNode, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";

const CofheReactProvider = dynamic(
  () => import("@/components/providers/CofheReactProvider"),
  { ssr: false },
);

export default function Web3Provider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5_000,
            refetchInterval: 15_000, // refresh data every 15s
          },
        },
      }),
  );
  const needsCofheProvider =
    pathname === "/trade" || pathname === "/portfolio" || pathname === "/pool";

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {needsCofheProvider ? (
          <CofheReactProvider>
            {children}
          </CofheReactProvider>
        ) : (
          children
        )}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
