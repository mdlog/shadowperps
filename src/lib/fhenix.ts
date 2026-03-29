"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * CoFHE SDK stub — SDK is loaded at runtime only when needed.
 * No static imports to avoid Turbopack bundling the heavy WASM.
 */

let cofheClient: any = null;
let cofheConnectionKey: string | null = null;
const DECRYPT_428_RETRY_DELAYS_MS = [1500, 3000, 5000, 8000, 12000, 16000];

function getCofheProxyBaseUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.location.origin;
}

function getConnectionKey(publicClient: any, walletClient: any): string {
  const chainId = publicClient?.chain?.id ?? "unknown-chain";
  const account = walletClient?.account?.address?.toLowerCase?.() ?? "unknown-account";
  return `${chainId}:${account}`;
}

function isDecrypt428Error(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("HTTP 428");
}

async function ensureSelfPermit(client: any, publicClient: any, walletClient: any, forceRefresh = false) {
  if (forceRefresh) {
    const chainId = await publicClient.getChainId();
    const account = walletClient.account?.address;

    if (account) {
      await client.permits.removeActivePermit(chainId, account);
    }
  }

  return await client.permits.getOrCreateSelfPermit();
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
        "This app now uses a local /api/cofhe proxy, so if this persists check that `npm run dev` is running cleanly and your network can reach the Fhenix testnet services."
    );
  }

  return error;
}

async function loadSDK() {
  // Dynamic import only triggered at runtime when user clicks trade
  const [core, web, chains] = await Promise.all([
    import("@cofhe/sdk"),
    import("@cofhe/sdk/web"),
    import("@cofhe/sdk/chains"),
  ]);
  return { core, web, chains };
}

export async function getCofheClient(publicClient: any, walletClient: any): Promise<any> {
  const nextConnectionKey = getConnectionKey(publicClient, walletClient);

  if (!cofheClient || cofheConnectionKey !== nextConnectionKey) {
    const sdk = await loadSDK();
    const proxyBaseUrl = getCofheProxyBaseUrl();
    const arbSepoliaChain = proxyBaseUrl
      ? {
          ...sdk.chains.arbSepolia,
          coFheUrl: `${proxyBaseUrl}/api/cofhe/cofhe`,
          verifierUrl: `${proxyBaseUrl}/api/cofhe/verifier`,
          thresholdNetworkUrl: `${proxyBaseUrl}/api/cofhe/threshold`,
        }
      : sdk.chains.arbSepolia;
    const config = sdk.web.createCofheConfig({
      supportedChains: [arbSepoliaChain],
      // Disable default cross-origin iframe-backed storage.
      // Some browsers, extensions, or network policies block the storage hub,
      // which causes "Failed to rehydrate keys store" timeouts before encrypt starts.
      fheKeyStorage: null,
    });
    cofheClient = sdk.web.createCofheClient(config);
    await cofheClient.connect(publicClient, walletClient);
    cofheConnectionKey = nextConnectionKey;
  }
  return cofheClient;
}

export async function encryptInputs(
  publicClient: any,
  walletClient: any,
  values: { type: string; value: bigint | boolean }[],
): Promise<any[]> {
  try {
    const sdk = await loadSDK();
    const client = await getCofheClient(publicClient, walletClient);

    const encryptables = values.map((v) => {
      const E = sdk.core.Encryptable;
      switch (v.type) {
        case "bool": return E.bool(Boolean(v.value));
        case "uint64": return E.uint64(v.value as bigint);
        case "uint32": return E.uint32(v.value as bigint);
        case "uint128": return E.uint128(v.value as bigint);
        default: return E.uint64(v.value as bigint);
      }
    });

    return await client.encryptInputs(encryptables).execute();
  } catch (error) {
    throw normalizeCofheError(error);
  }
}

export async function decryptForView(
  publicClient: any,
  walletClient: any,
  ctHash: string,
  fheType: string,
): Promise<bigint | boolean> {
  try {
    const sdk = await loadSDK();
    const client = await getCofheClient(publicClient, walletClient);
    await ensureSelfPermit(client, publicClient, walletClient);

    const typeMap: Record<string, any> = {
      bool: sdk.core.FheTypes?.Bool ?? 0,
      uint64: sdk.core.FheTypes?.Uint64 ?? 5,
      uint32: sdk.core.FheTypes?.Uint32 ?? 3,
      uint128: sdk.core.FheTypes?.Uint128 ?? 6,
    };

    return await client
      .decryptForView(ctHash, typeMap[fheType] ?? typeMap.uint64)
      .execute();
  } catch (error) {
    throw normalizeCofheError(error);
  }
}

export async function decryptForTx(
  publicClient: any,
  walletClient: any,
  ctHash: string,
  usePermit = true,
): Promise<{ decryptedValue: bigint; signature: `0x${string}` }> {
  try {
    const client = await getCofheClient(publicClient, walletClient);
    if (usePermit) {
      let lastError: unknown;

      for (let attempt = 0; attempt <= DECRYPT_428_RETRY_DELAYS_MS.length; attempt++) {
        try {
          await ensureSelfPermit(client, publicClient, walletClient, attempt > 0);
          return await client.decryptForTx(ctHash).withPermit().execute();
        } catch (error) {
          lastError = error;

          if (!isDecrypt428Error(error) || attempt === DECRYPT_428_RETRY_DELAYS_MS.length) {
            throw error;
          }

          // Threshold Network can lag behind transaction receipts for heavier FHE computations.
          await sleep(DECRYPT_428_RETRY_DELAYS_MS[attempt]);
        }
      }

      throw lastError instanceof Error ? lastError : new Error("decryptForTx failed");
    }

    return await client.decryptForTx(ctHash).withoutPermit().execute();
  } catch (error) {
    throw normalizeCofheError(error);
  }
}

export function resetCofheClient() {
  cofheClient = null;
  cofheConnectionKey = null;
}
