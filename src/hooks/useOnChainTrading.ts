"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, usePublicClient, useWalletClient, useReadContract } from "wagmi";
import { parseGwei, decodeEventLog } from "viem";
import { SHADOW_PERPS_ABI, ERC20_ABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { encryptInputs, decryptForTx } from "@/lib/fhenix";
import { engineApi } from "@/lib/engine-api";

async function getGasOverrides(publicClient: NonNullable<ReturnType<typeof usePublicClient>>) {
  const block = await publicClient.getBlock();
  const baseFee = block.baseFeePerGas ?? parseGwei("0.1");
  const maxFee = baseFee * 5n + parseGwei("0.5");
  return { maxFeePerGas: maxFee, maxPriorityFeePerGas: maxFee / 10n };
}

const USDC_DECIMALS = 6;

function usdToUsdc(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
}

function toEncryptedInput(input: { ctHash: bigint; securityZone: number; utype: number; signature: `0x${string}` }) {
  return {
    ctHash: input.ctHash,
    securityZone: input.securityZone,
    utype: input.utype,
    signature: input.signature,
  } as const;
}

function readEventArgs(
  logs: { data: `0x${string}`; topics: readonly `0x${string}`[] }[],
  eventName: string,
) {
  for (const log of logs) {
    try {
      const topics = [...log.topics] as [`0x${string}`, ...`0x${string}`[]];
      const decoded = decodeEventLog({
        abi: SHADOW_PERPS_ABI,
        data: log.data,
        topics,
      });
      if (decoded.eventName === eventName) {
        return decoded.args as Record<string, unknown>;
      }
    } catch {
      // Ignore unrelated logs
    }
  }

  return undefined;
}

type TxStatus =
  | "idle"
  | "encrypting"
  | "approving"
  | "confirming"
  | "decrypting"
  | "pending"
  | "success"
  | "error";

export function useOnChainTrading() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();
  const [status, setStatus] = useState<TxStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const contractAddress = CONTRACT_ADDRESSES.shadowPerps;
  const usdcAddress = CONTRACT_ADDRESSES.usdc;
  const hasContract = !!contractAddress;
  const isOnChainReady = hasContract && !!publicClient && !!walletClient;

  const { data: usdcRaw } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const openPosition = useCallback(async (params: {
    market: string;
    direction: "long" | "short";
    size: number;
    collateral: number;
    leverage: number;
  }) => {
    if (!address) throw new Error("Wallet not connected");
    setError(null);
    setTxHash(null);

    try {
      if (isOnChainReady) {
        const collateralUsdc = usdToUsdc(params.collateral);
        const sizeUsdc = collateralUsdc * BigInt(params.leverage);

        setStatus("encrypting");
        const [directionInput, sizeInput] = await encryptInputs(publicClient!, walletClient!, [
          { type: "bool", value: params.direction === "long" },
          { type: "uint128", value: sizeUsdc },
        ]);

        setStatus("confirming");
        const requestGas = await getGasOverrides(publicClient!);
        const requestHash = await writeContractAsync({
          address: contractAddress,
          abi: SHADOW_PERPS_ABI,
          functionName: "requestOpenPosition",
          args: [
            params.market,
            collateralUsdc,
            toEncryptedInput(directionInput),
            toEncryptedInput(sizeInput),
          ],
          ...requestGas,
        });

        const requestReceipt = await publicClient!.waitForTransactionReceipt({ hash: requestHash });
        const requestEvent = readEventArgs(requestReceipt.logs, "OpenValidationRequested");
        const requestId = requestEvent?.requestId as bigint | undefined;
        const validationCtHash = requestEvent?.validationCtHash as `0x${string}` | undefined;

        if (requestId === undefined || !validationCtHash) {
          throw new Error("Open validation event not found");
        }

        setStatus("decrypting");
        const validation = await decryptForTx(publicClient!, walletClient!, validationCtHash, true);
        if (validation.decryptedValue !== 1n) {
          throw new Error("Encrypted leverage validation failed");
        }

        setStatus("approving");
        const allowance = await publicClient!.readContract({
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, contractAddress],
        });
        if ((allowance as bigint) < collateralUsdc) {
          const gasOverrides = await getGasOverrides(publicClient!);
          const maxApproval = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
          const approvalHash = await writeContractAsync({
            address: usdcAddress,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [contractAddress, maxApproval],
            ...gasOverrides,
          });
          await publicClient!.waitForTransactionReceipt({ hash: approvalHash });
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        setStatus("confirming");
        const finalizeGas = await getGasOverrides(publicClient!);
        const finalizeHash = await writeContractAsync({
          address: contractAddress,
          abi: SHADOW_PERPS_ABI,
          functionName: "finalizeOpenPosition",
          args: [requestId, true, validation.signature],
          ...finalizeGas,
        });

        setTxHash(finalizeHash);
        setStatus("pending");
        const finalizeReceipt = await publicClient!.waitForTransactionReceipt({ hash: finalizeHash });
        const openedEvent = readEventArgs(finalizeReceipt.logs, "PositionOpened");
        const onChainId = openedEvent?.positionId as bigint | undefined;

        await engineApi.openPosition({
          ...params,
          trader: address,
          on_chain_id: onChainId !== undefined ? Number(onChainId) : undefined,
        }).catch(() => {});

        setStatus("success");
        return { hash: finalizeHash, onChainId: onChainId !== undefined ? Number(onChainId) : undefined };
      }

      setStatus("confirming");
      const position = await engineApi.openPosition({ ...params, trader: address });
      setStatus("success");
      return position;
    } catch (e: unknown) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Transaction failed");
      throw e;
    }
  }, [address, isOnChainReady, contractAddress, usdcAddress, writeContractAsync, publicClient, walletClient]);

  const closePosition = useCallback(async (positionId: number, onChainId?: number) => {
    if (!address) throw new Error("Wallet not connected");
    setStatus("confirming");
    setError(null);
    setTxHash(null);

    try {
      if (isOnChainReady && publicClient && walletClient) {
        let chainId = onChainId;
        if (chainId === undefined) {
          const ids = await publicClient.readContract({
            address: contractAddress,
            abi: SHADOW_PERPS_ABI,
            functionName: "getTraderPositionIds",
            args: [address],
          }) as bigint[];

          for (let i = ids.length - 1; i >= 0; i--) {
            const meta = await publicClient.readContract({
              address: contractAddress,
              abi: SHADOW_PERPS_ABI,
              functionName: "getPositionMeta",
              args: [ids[i]],
            }) as [string, string, bigint, bigint, bigint, number];

            if (Number(meta[5]) === 0) {
              chainId = Number(ids[i]);
              break;
            }
          }
        }

        if (chainId === undefined) {
          const result = await engineApi.closePosition(positionId, address);
          setStatus("success");
          return result;
        }

        const requestGas = await getGasOverrides(publicClient);
        const requestHash = await writeContractAsync({
          address: contractAddress,
          abi: SHADOW_PERPS_ABI,
          functionName: "requestClosePosition",
          args: [BigInt(chainId)],
          ...requestGas,
        });
        await publicClient.waitForTransactionReceipt({ hash: requestHash });

        const ciphertexts = await publicClient.readContract({
          address: contractAddress,
          abi: SHADOW_PERPS_ABI,
          functionName: "getPositionCiphertexts",
          args: [BigInt(chainId)],
        }) as [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`];

        const payoutCtHash = ciphertexts[2];
        if (!payoutCtHash || /^0x0+$/.test(payoutCtHash)) {
          throw new Error("Close payout ciphertext not available");
        }

        // Close payout ciphertext is derived from heavier FHE math than open validation.
        await new Promise((resolve) => setTimeout(resolve, 2500));

        setStatus("decrypting");
        const payoutProof = await decryptForTx(publicClient, walletClient, payoutCtHash, true);

        setStatus("confirming");
        const finalizeGas = await getGasOverrides(publicClient);
        const finalizeHash = await writeContractAsync({
          address: contractAddress,
          abi: SHADOW_PERPS_ABI,
          functionName: "finalizeClosePosition",
          args: [BigInt(chainId), payoutProof.decryptedValue, payoutProof.signature],
          ...finalizeGas,
        });

        setTxHash(finalizeHash);
        setStatus("pending");
        await publicClient.waitForTransactionReceipt({ hash: finalizeHash });
        await engineApi.closePosition(positionId, address).catch(() => {});
        setStatus("success");
        return finalizeHash;
      }

      const result = await engineApi.closePosition(positionId, address);
      setStatus("success");
      return result;
    } catch (e: unknown) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Transaction failed");
      throw e;
    }
  }, [address, isOnChainReady, contractAddress, writeContractAsync, publicClient, walletClient]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setTxHash(null);
  }, []);

  return {
    openPosition,
    closePosition,
    status,
    error,
    txHash,
    hasContract,
    isOnChainReady,
    usdcBalance: usdcRaw ? Number(usdcRaw) / 10 ** USDC_DECIMALS : 0,
    reset,
  };
}
