"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { engineApi, type Market, type Position, type PortfolioSummary } from "@/lib/engine-api";

// ══════════════════════════════════════════════
//  Market Data Hooks
// ══════════════════════════════════════════════

export function useMarkets() {
  return useQuery<Market[]>({
    queryKey: ["markets"],
    queryFn: () => engineApi.getMarkets(),
    refetchInterval: 10_000, // refresh every 10s
  });
}

export function useMarket(symbol: string) {
  return useQuery<Market>({
    queryKey: ["market", symbol],
    queryFn: () => engineApi.getMarket(symbol),
    enabled: !!symbol,
    refetchInterval: 5_000,
  });
}

// ══════════════════════════════════════════════
//  Position Hooks
// ══════════════════════════════════════════════

export function usePositions() {
  const { address } = useAccount();
  return useQuery<Position[]>({
    queryKey: ["positions", address],
    queryFn: () => engineApi.getPositions(address!),
    enabled: !!address,
    refetchInterval: 5_000,
  });
}

export function usePosition(id: number) {
  return useQuery<Position>({
    queryKey: ["position", id],
    queryFn: () => engineApi.getPosition(id),
    enabled: id > 0,
    refetchInterval: 5_000,
  });
}

// ══════════════════════════════════════════════
//  Portfolio Hook
// ══════════════════════════════════════════════

export function usePortfolio() {
  const { address } = useAccount();
  return useQuery<PortfolioSummary>({
    queryKey: ["portfolio", address],
    queryFn: () => engineApi.getPortfolio(address!),
    enabled: !!address,
    refetchInterval: 10_000,
  });
}

// ══════════════════════════════════════════════
//  Trading Mutations
// ══════════════════════════════════════════════

export function useOpenPosition() {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      market: string;
      direction: "long" | "short";
      size: number;
      collateral: number;
      leverage: number;
    }) =>
      engineApi.openPosition({ ...params, trader: address! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
}

export function useClosePosition() {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (positionId: number) =>
      engineApi.closePosition(positionId, address!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
}

// ══════════════════════════════════════════════
//  Engine Health
// ══════════════════════════════════════════════

export function useEngineHealth() {
  return useQuery({
    queryKey: ["engine-health"],
    queryFn: () => engineApi.health(),
    refetchInterval: 30_000,
    retry: 1,
  });
}
