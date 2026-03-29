"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { useChainId, usePublicClient } from "wagmi";
import { CONTRACT_ADDRESSES, PRICE_ORACLE_ABI } from "@/lib/contracts";
import { defaultChain } from "@/lib/wagmi";

interface OnChainMarketPrice {
  price: number;
  updatedAt: number;
}

function toDecimal(value: bigint, decimals: number): number {
  return Number.parseFloat(formatUnits(value, decimals));
}

export function useOnChainMarketPrice(symbol: string) {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const oracleAddress = CONTRACT_ADDRESSES.priceOracle;
  const isEnabled = Boolean(symbol && oracleAddress && publicClient) && chainId === defaultChain.id;

  const query = useQuery<OnChainMarketPrice>({
    queryKey: ["onchain-market-price", symbol, chainId, oracleAddress],
    enabled: isEnabled,
    refetchInterval: 15_000,
    staleTime: 10_000,
    queryFn: async () => {
      if (!symbol || !oracleAddress || !publicClient) {
        throw new Error("Oracle price unavailable");
      }

      const [price, updatedAt] = await publicClient.readContract({
        address: oracleAddress,
        abi: PRICE_ORACLE_ABI,
        functionName: "getPrice",
        args: [symbol],
      }) as [bigint, bigint];

      return {
        price: toDecimal(price, 8),
        updatedAt: Number(updatedAt),
      };
    },
  });

  return {
    ...query,
    price: query.data?.price ?? 0,
    updatedAt: query.data?.updatedAt ?? null,
    isOnChainReady: isEnabled,
  };
}
