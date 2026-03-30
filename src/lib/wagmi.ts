"use client";

import { http, createConfig, createStorage } from "wagmi";
import { injected } from "@wagmi/core";
import { arbitrumSepolia, sepolia } from "wagmi/chains";

// ══════════════════════════════════════════════
//  CoFHE — deploys to standard EVM chains
//  Arbitrum Sepolia is the primary testnet (lower gas)
// ══════════════════════════════════════════════

export const defaultChain = arbitrumSepolia;

export const metaMaskConnector = injected({
  target: "metaMask",
  unstable_shimAsyncInject: 1_500,
});

export const injectedConnector = injected({
  unstable_shimAsyncInject: 1_500,
});

export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia, sepolia],
  connectors: [metaMaskConnector, injectedConnector],
  transports: {
    [arbitrumSepolia.id]: http(),
    [sepolia.id]: http(),
  },
  storage: createStorage({
    storage: typeof window !== "undefined" ? window.localStorage : undefined as unknown as Storage,
  }),
  ssr: true,
});
