"use client";

import { type ReactNode, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createCofheConfig, CofheProvider } from "@cofhe/react";
import { arbSepolia } from "@cofhe/sdk/chains";
import { usePublicClient, useWalletClient } from "wagmi";

function getCofheProxyBaseUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.location.origin;
}

export default function CofheReactProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const config = useMemo(() => {
    const proxyBaseUrl = getCofheProxyBaseUrl();
    const supportedChain = proxyBaseUrl
      ? {
          ...arbSepolia,
          coFheUrl: `${proxyBaseUrl}/api/cofhe/cofhe`,
          verifierUrl: `${proxyBaseUrl}/api/cofhe/verifier`,
          thresholdNetworkUrl: `${proxyBaseUrl}/api/cofhe/threshold`,
        }
      : arbSepolia;

    return createCofheConfig({
      supportedChains: [supportedChain],
      // Keep browser storage disabled until the iframe-backed store is stable enough
      // for this app's current deployment environment.
      fheKeyStorage: null,
      react: {
        autogeneratePermits: false,
        enableShieldUnshield: false,
        shareablePermits: false,
        initialTheme: "dark",
        position: "bottom-right",
      },
    });
  }, []);

  return (
    <CofheProvider
      queryClient={queryClient}
      config={config}
      publicClient={publicClient}
      walletClient={walletClient}
    >
      {children}
    </CofheProvider>
  );
}
