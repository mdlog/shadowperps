"use client";

import { useCallback } from "react";
import { Encryptable, FheTypes, type EncryptableItem, type EncryptedItemInput } from "@cofhe/sdk";
import { useCofheClient, useCofheConnection, useCofheEncrypt } from "@cofhe/react";
import type { PublicClient, WalletClient } from "viem";

const DECRYPT_428_RETRY_DELAYS_MS = [1500, 3000, 5000, 8000, 12000, 16000];

type FhenixInputValue = { type: string; value: bigint | boolean };

function isDecrypt428Error(error: unknown): boolean {
  return error instanceof Error && error.message.includes("HTTP 428");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeCofheError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error("Unknown CoFHE error");
  }

  const message = error.message;
  const isBrowserFetchFailure =
    message.includes("ZK proof verification failed") && message.includes("Failed to fetch");

  if (isBrowserFetchFailure) {
    return new Error(
      "CoFHE verifier request failed. The browser could not reach the verifier service. " +
        "This app now uses a local /api/cofhe proxy, so if this persists check that `npm run dev` is running cleanly and your network can reach the Fhenix testnet services.",
    );
  }

  return error;
}

function toEncryptable(value: FhenixInputValue): EncryptableItem {
  switch (value.type) {
    case "bool":
      return Encryptable.bool(Boolean(value.value));
    case "uint32":
      return Encryptable.uint32(value.value as bigint);
    case "uint64":
      return Encryptable.uint64(value.value as bigint);
    case "uint128":
      return Encryptable.uint128(value.value as bigint);
    default:
      return Encryptable.uint64(value.value as bigint);
  }
}

function getFheType(fheType: string) {
  switch (fheType) {
    case "bool":
      return FheTypes.Bool;
    case "uint32":
      return FheTypes.Uint32;
    case "uint128":
      return FheTypes.Uint128;
    default:
      return FheTypes.Uint64;
  }
}

export function useCofheHelpers() {
  const client = useCofheClient();
  const { connected, account, chainId } = useCofheConnection();
  const encryption = useCofheEncrypt();

  const ensureConnected = useCallback(async (
    publicClient?: PublicClient,
    walletClient?: WalletClient,
  ) => {
    const nextChainId = walletClient?.chain?.id ?? publicClient?.chain?.id;
    const nextAccount = walletClient?.account?.address?.toLowerCase();
    const sameConnection =
      connected &&
      chainId === nextChainId &&
      account?.toLowerCase() === nextAccount;

    if (sameConnection) {
      return;
    }

    if (!publicClient || !walletClient) {
      throw new Error("Wallet or CoFHE client not ready");
    }

    await client.connect(publicClient, walletClient);
  }, [account, chainId, client, connected]);

  const ensureSelfPermit = useCallback(async (
    publicClient?: PublicClient,
    walletClient?: WalletClient,
    forceRefresh = false,
  ) => {
    const currentChainId = publicClient?.chain?.id ?? walletClient?.chain?.id ?? chainId;
    const currentAccount = walletClient?.account?.address ?? account;

    if (forceRefresh && currentChainId && currentAccount) {
      await client.permits.removeActivePermit(currentChainId, currentAccount);
    }

    return await client.permits.getOrCreateSelfPermit();
  }, [account, chainId, client]);

  const encryptInputs = useCallback(async (
    publicClient: PublicClient,
    walletClient: WalletClient,
    values: FhenixInputValue[],
  ): Promise<readonly EncryptedItemInput[]> => {
    try {
      await ensureConnected(publicClient, walletClient);
      return await encryption.encryptInputsAsync({
        items: values.map(toEncryptable),
      });
    } catch (error) {
      throw normalizeCofheError(error);
    }
  }, [encryption, ensureConnected]);

  const decryptForView = useCallback(async (
    publicClient: PublicClient,
    walletClient: WalletClient,
    ctHash: string,
    fheType: string,
  ): Promise<bigint | boolean> => {
    try {
      await ensureConnected(publicClient, walletClient);
      await ensureSelfPermit(publicClient, walletClient);

      return await client.decryptForView(ctHash, getFheType(fheType)).execute();
    } catch (error) {
      throw normalizeCofheError(error);
    }
  }, [client, ensureConnected, ensureSelfPermit]);

  const decryptForTx = useCallback(async (
    publicClient: PublicClient,
    walletClient: WalletClient,
    ctHash: string,
    usePermit = true,
  ): Promise<{ decryptedValue: bigint; signature: `0x${string}` }> => {
    try {
      await ensureConnected(publicClient, walletClient);

      if (usePermit) {
        let lastError: unknown;

        for (let attempt = 0; attempt <= DECRYPT_428_RETRY_DELAYS_MS.length; attempt++) {
          try {
            await ensureSelfPermit(publicClient, walletClient, attempt > 0);
            return await client.decryptForTx(ctHash).withPermit().execute();
          } catch (error) {
            lastError = error;

            if (!isDecrypt428Error(error) || attempt === DECRYPT_428_RETRY_DELAYS_MS.length) {
              throw error;
            }

            await sleep(DECRYPT_428_RETRY_DELAYS_MS[attempt]);
          }
        }

        throw lastError instanceof Error ? lastError : new Error("decryptForTx failed");
      }

      return await client.decryptForTx(ctHash).withoutPermit().execute();
    } catch (error) {
      throw normalizeCofheError(error);
    }
  }, [client, ensureConnected, ensureSelfPermit]);

  return {
    decryptForTx,
    decryptForView,
    encryptInputs,
    encryptionStep: encryption.stepsState.lastStep,
    isCofheReady: connected,
    isEncrypting: encryption.isEncrypting,
  };
}
