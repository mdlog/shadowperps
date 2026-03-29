"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";
import { CONTRACT_ADDRESSES, PRICE_ORACLE_ABI, SHADOW_PERPS_ABI } from "@/lib/contracts";
import { decryptForView } from "@/lib/fhenix";
import { defaultChain } from "@/lib/wagmi";

const USDC_DECIMALS = 6;
const ORACLE_DECIMALS = 8;

type PositionStatus = "open" | "closed" | "liquidated";
type PositionMetaResult = readonly [`0x${string}`, `0x${string}`, bigint, bigint, bigint, number];
type PositionCiphertextResult = readonly [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`];
type OraclePriceResult = readonly [bigint, bigint];

export interface OnChainPortfolioPosition {
  id: number;
  on_chain_id: number;
  market: string;
  direction: "long" | "short";
  size: number;
  collateral: number;
  entry_price: number;
  mark_price: number;
  leverage: number;
  unrealized_pnl: number;
  pnl_percent: number;
  margin_ratio: number;
  liquidation_price: number;
  status: PositionStatus;
  opened_at: string;
  encrypted: true;
  ciphertexts: {
    direction: `0x${string}`;
    size: `0x${string}`;
    closePayout: `0x${string}`;
    liquidationCheck: `0x${string}`;
  };
}

export interface OnChainPortfolioSummary {
  total_value: number;
  total_pnl: number;
  total_pnl_percent: number;
  total_collateral: number;
  total_exposure: number;
  available_margin: number;
  margin_health: number;
  margin_used: number;
  position_count: number;
}

export interface OnChainPortfolioData {
  positions: OnChainPortfolioPosition[];
  summary: OnChainPortfolioSummary;
  decrypted_at: string | null;
}

const EMPTY_PORTFOLIO: OnChainPortfolioData = {
  positions: [],
  summary: {
    total_value: 0,
    total_pnl: 0,
    total_pnl_percent: 0,
    total_collateral: 0,
    total_exposure: 0,
    available_margin: 0,
    margin_health: 0,
    margin_used: 0,
    position_count: 0,
  },
  decrypted_at: null,
};

function toDecimal(value: bigint, decimals: number): number {
  return Number.parseFloat(formatUnits(value, decimals));
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max);
}

function decodeStatus(status: number): PositionStatus {
  if (status === 1) return "closed";
  if (status === 2) return "liquidated";
  return "open";
}

function calculatePnl(
  direction: "long" | "short",
  size: number,
  entryPrice: number,
  markPrice: number,
): number {
  if (entryPrice <= 0 || size <= 0) {
    return 0;
  }

  const priceDelta = direction === "long"
    ? (markPrice - entryPrice) / entryPrice
    : (entryPrice - markPrice) / entryPrice;

  return size * priceDelta;
}

function calculateLiquidationPrice(
  direction: "long" | "short",
  entryPrice: number,
  size: number,
  collateral: number,
): number {
  if (entryPrice <= 0 || size <= 0 || collateral <= 0) {
    return 0;
  }

  const thresholdMove = (collateral * 0.8 * entryPrice) / size;
  if (direction === "long") {
    return Math.max(entryPrice - thresholdMove, 0);
  }

  return entryPrice + thresholdMove;
}

function comparePositions(a: OnChainPortfolioPosition, b: OnChainPortfolioPosition): number {
  const rank = (status: PositionStatus) => {
    if (status === "open") return 0;
    if (status === "liquidated") return 1;
    return 2;
  };

  return rank(a.status) - rank(b.status)
    || Date.parse(b.opened_at) - Date.parse(a.opened_at)
    || b.id - a.id;
}

export function useOnChainPortfolio() {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const contractAddress = CONTRACT_ADDRESSES.shadowPerps;
  const oracleAddress = CONTRACT_ADDRESSES.priceOracle;
  const hasDeployment = Boolean(contractAddress);
  const hasOracle = Boolean(oracleAddress);
  const requiresChainSwitch = Boolean(address) && chainId !== defaultChain.id;
  const isOnChainReady = Boolean(address && contractAddress && publicClient && walletClient) && !requiresChainSwitch;

  const query = useQuery<OnChainPortfolioData>({
    queryKey: ["onchain-portfolio", address, chainId, contractAddress, oracleAddress],
    enabled: isOnChainReady,
    staleTime: 10_000,
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!address || !contractAddress || !publicClient || !walletClient) {
        throw new Error("Wallet or contract not ready");
      }

      const traderAddress = address;
      const chainReader = publicClient;
      const cofheWallet = walletClient;

      const positionIds = await chainReader.readContract({
        address: contractAddress,
        abi: SHADOW_PERPS_ABI,
        functionName: "getTraderPositionIds",
        args: [traderAddress],
      }) as bigint[];

      if (positionIds.length === 0) {
        return {
          ...EMPTY_PORTFOLIO,
          decrypted_at: new Date().toISOString(),
        };
      }

      const rawPositions = await Promise.all(positionIds.map(async (positionId) => {
        const [meta, ciphertexts] = await Promise.all([
          chainReader.readContract({
            address: contractAddress,
            abi: SHADOW_PERPS_ABI,
            functionName: "getPositionMeta",
            args: [positionId],
          }) as Promise<PositionMetaResult>,
          chainReader.readContract({
            address: contractAddress,
            abi: SHADOW_PERPS_ABI,
            functionName: "getPositionCiphertexts",
            args: [positionId],
          }) as Promise<PositionCiphertextResult>,
        ]);

        return { positionId, meta, ciphertexts };
      }));

      const uniqueMarketIds = [...new Set(rawPositions.map((position) => position.meta[1]))];
      const marketSymbols = await Promise.all(uniqueMarketIds.map(async (marketId) => {
        const symbol = await chainReader.readContract({
          address: contractAddress,
          abi: SHADOW_PERPS_ABI,
          functionName: "marketSymbols",
          args: [marketId],
        }) as string;
        return [marketId, symbol] as const;
      }));

      const marketById = new Map(marketSymbols);
      const uniqueSymbols = [...new Set(marketSymbols.map(([, symbol]) => symbol).filter(Boolean))];
      const priceEntries = hasOracle && oracleAddress
        ? await Promise.all(uniqueSymbols.map(async (symbol) => {
          const [price] = await chainReader.readContract({
            address: oracleAddress,
            abi: PRICE_ORACLE_ABI,
            functionName: "getPrice",
            args: [symbol],
          }) as OraclePriceResult;

          return [symbol, toDecimal(price, ORACLE_DECIMALS)] as const;
        }))
        : [];

      const priceBySymbol = new Map(priceEntries);

      const positions = await Promise.all(rawPositions.map(async ({ positionId, meta, ciphertexts }) => {
        const [marketId, collateralRaw, entryPriceRaw, openedAtRaw, statusRaw] = [
          meta[1],
          meta[2],
          meta[3],
          meta[4],
          meta[5],
        ];
        const symbol = marketById.get(marketId) || "UNKNOWN";

        const [directionValue, sizeValue] = await Promise.all([
          decryptForView(chainReader, cofheWallet, ciphertexts[0], "bool"),
          decryptForView(chainReader, cofheWallet, ciphertexts[1], "uint128"),
        ]);

        const direction = Boolean(directionValue) ? "long" : "short";
        const size = toDecimal(sizeValue as bigint, USDC_DECIMALS);
        const collateral = toDecimal(collateralRaw, USDC_DECIMALS);
        const entryPrice = toDecimal(entryPriceRaw, ORACLE_DECIMALS);
        const markPrice = priceBySymbol.get(symbol) ?? entryPrice;
        const status = decodeStatus(statusRaw);

        let unrealizedPnl = 0;
        let pnlPercent = 0;
        let marginRatio = 1;

        if (status === "open") {
          unrealizedPnl = calculatePnl(direction, size, entryPrice, markPrice);
          pnlPercent = collateral > 0 ? (unrealizedPnl / collateral) * 100 : 0;
          marginRatio = collateral > 0 ? clamp((collateral + unrealizedPnl) / collateral) : 0;
        } else if (status === "liquidated") {
          unrealizedPnl = -collateral;
          pnlPercent = collateral > 0 ? -100 : 0;
          marginRatio = 0;
        }

        return {
          id: Number(positionId),
          on_chain_id: Number(positionId),
          market: symbol,
          direction,
          size,
          collateral,
          entry_price: entryPrice,
          mark_price: markPrice,
          leverage: collateral > 0 ? size / collateral : 0,
          unrealized_pnl: unrealizedPnl,
          pnl_percent: pnlPercent,
          margin_ratio: marginRatio,
          liquidation_price: calculateLiquidationPrice(direction, entryPrice, size, collateral),
          status,
          opened_at: new Date(Number(openedAtRaw) * 1000).toISOString(),
          encrypted: true as const,
          ciphertexts: {
            direction: ciphertexts[0],
            size: ciphertexts[1],
            closePayout: ciphertexts[2],
            liquidationCheck: ciphertexts[3],
          },
        } satisfies OnChainPortfolioPosition;
      }));

      positions.sort(comparePositions);

      const openPositions = positions.filter((position) => position.status === "open");
      const totalCollateral = openPositions.reduce((sum, position) => sum + position.collateral, 0);
      const totalExposure = openPositions.reduce((sum, position) => sum + position.size, 0);
      const totalPnl = openPositions.reduce((sum, position) => sum + position.unrealized_pnl, 0);
      const totalValue = totalCollateral + totalPnl;
      const totalPnlPercent = totalCollateral > 0 ? (totalPnl / totalCollateral) * 100 : 0;
      const marginHealth = openPositions.length > 0
        ? openPositions.reduce((sum, position) => sum + position.margin_ratio, 0) / openPositions.length
        : 0;

      return {
        positions,
        summary: {
          total_value: totalValue,
          total_pnl: totalPnl,
          total_pnl_percent: totalPnlPercent,
          total_collateral: totalCollateral,
          total_exposure: totalExposure,
          available_margin: Math.max(totalValue, 0),
          margin_health: marginHealth,
          margin_used: openPositions.length > 0 ? 1 - marginHealth : 0,
          position_count: openPositions.length,
        },
        decrypted_at: new Date().toISOString(),
      };
    },
  });

  return {
    ...query,
    data: query.data ?? EMPTY_PORTFOLIO,
    hasDeployment,
    hasOracle,
    isOnChainReady,
    requiresChainSwitch,
  };
}
