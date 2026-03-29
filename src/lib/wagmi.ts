"use client";

import { http, createConfig, createStorage } from "wagmi";
import { arbitrumSepolia, sepolia } from "wagmi/chains";

// ══════════════════════════════════════════════
//  CoFHE — deploys to standard EVM chains
//  Arbitrum Sepolia is the primary testnet (lower gas)
// ══════════════════════════════════════════════

export const defaultChain = arbitrumSepolia;

export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia, sepolia],
  transports: {
    [arbitrumSepolia.id]: http(),
    [sepolia.id]: http(),
  },
  storage: createStorage({
    storage: typeof window !== "undefined" ? window.localStorage : undefined as unknown as Storage,
  }),
  ssr: true,
});
