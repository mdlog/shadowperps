"use client";

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { injected } from "wagmi/connectors";
import { defaultChain } from "@/lib/wagmi";

export function useWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const isCorrectChain = chainId === defaultChain.id;

  const connectWallet = () => {
    connect({ connector: injected() });
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
    switchToTarget,
    disconnect,
  };
}
