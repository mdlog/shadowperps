"use client";

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { ProviderNotFoundError } from "@wagmi/core";
import { defaultChain, injectedConnector, metaMaskConnector } from "@/lib/wagmi";

export function useWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connectAsync } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, switchChainAsync } = useSwitchChain();

  const isCorrectChain = chainId === defaultChain.id;

  const ensureTargetChain = async (activeChainId?: number | undefined) => {
    const resolvedChainId = activeChainId ?? chainId;

    if (resolvedChainId === defaultChain.id) {
      return;
    }

    if (switchChainAsync) {
      await switchChainAsync({ chainId: defaultChain.id });
      return;
    }

    switchChain({ chainId: defaultChain.id });
  };

  const connectWalletAsync = async () => {
    let result;

    try {
      result = await connectAsync({ connector: metaMaskConnector });
    } catch (error) {
      // If MetaMask is not installed, fall back to any injected EIP-1193 wallet.
      if (!(error instanceof ProviderNotFoundError)) {
        throw error;
      }

      result = await connectAsync({ connector: injectedConnector });
    }

    await ensureTargetChain(result.chainId);
    return result;
  };

  const connectWallet = () => {
    void connectWalletAsync();
  };

  const switchToTarget = () => {
    switchChain({ chainId: defaultChain.id });
  };

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  return {
    address,
    shortAddress,
    isConnected,
    isConnecting,
    isCorrectChain,
    chainId,
    targetChainName: defaultChain.name,
    connectWallet,
    connectWalletAsync,
    ensureTargetChain,
    switchToTarget,
    disconnect,
  };
}
