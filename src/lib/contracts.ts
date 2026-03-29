// ══════════════════════════════════════════════
//  Contract ABIs & Addresses
//  Update addresses after deployment to Fhenix testnet
// ══════════════════════════════════════════════

export const CONTRACT_ADDRESSES = {
  shadowPerps: (process.env.NEXT_PUBLIC_SHADOWPERPS_CONTRACT || "") as `0x${string}`,
  priceOracle: (process.env.NEXT_PUBLIC_ORACLE_CONTRACT || "") as `0x${string}`,
  pool: (process.env.NEXT_PUBLIC_POOL_CONTRACT || "") as `0x${string}`,
  usdc: (process.env.NEXT_PUBLIC_USDC_CONTRACT || "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d") as `0x${string}`,
} as const;

// ShadowPool ABI
export const SHADOW_POOL_ABI = [
  { name: "deposit", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { name: "withdraw", type: "function", stateMutability: "nonpayable", inputs: [{ name: "lpTokens", type: "uint256" }], outputs: [] },
  { name: "getPoolStats", type: "function", stateMutability: "view", inputs: [], outputs: [
    { name: "tvl", type: "uint256" },
    { name: "lpSupply", type: "uint256" },
    { name: "lpPrice", type: "uint256" },
    { name: "feesEarned", type: "uint256" },
    { name: "traderProfits", type: "uint256" },
    { name: "traderLosses", type: "uint256" },
  ]},
  { name: "getPoolValue", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "getLpTokenPrice", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
] as const;

// ERC20 ABI (approve + balanceOf + allowance)
export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

const ENCRYPTED_INPUT_COMPONENTS = [
  { name: "ctHash", type: "uint256" },
  { name: "securityZone", type: "uint8" },
  { name: "utype", type: "uint8" },
  { name: "signature", type: "bytes" },
] as const;

// ShadowPerps ABI (CoFHE request/finalize flow)
export const SHADOW_PERPS_ABI = [
  {
    name: "requestOpenPosition",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "symbol", type: "string" },
      { name: "collateralUsdc", type: "uint256" },
      { name: "directionInput", type: "tuple", components: ENCRYPTED_INPUT_COMPONENTS },
      { name: "sizeInput", type: "tuple", components: ENCRYPTED_INPUT_COMPONENTS },
    ],
    outputs: [{ name: "requestId", type: "uint256" }],
  },
  {
    name: "finalizeOpenPosition",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "requestId", type: "uint256" },
      { name: "canOpen", type: "bool" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "positionId_", type: "uint256" }],
  },
  {
    name: "requestClosePosition",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "finalizeClosePosition",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "positionId", type: "uint256" },
      { name: "payout", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "requestLiquidationCheck",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "finalizeLiquidation",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "positionId", type: "uint256" },
      { name: "liquidatable", type: "bool" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "getPositionMeta",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [
      { name: "trader", type: "address" },
      { name: "marketId", type: "bytes32" },
      { name: "collateral", type: "uint256" },
      { name: "entryPrice", type: "uint256" },
      { name: "openedAt", type: "uint256" },
      { name: "status", type: "uint8" },
    ],
  },
  {
    name: "getPositionCiphertexts",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "positionId", type: "uint256" }],
    outputs: [
      { name: "directionCtHash", type: "bytes32" },
      { name: "sizeCtHash", type: "bytes32" },
      { name: "closePayoutCtHash", type: "bytes32" },
      { name: "liquidationCheckCtHash", type: "bytes32" },
    ],
  },
  {
    name: "getOpenRequestValidationCiphertext",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "getTraderPositionIds",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "trader", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "marketSymbols",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "marketId", type: "bytes32" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "getTraderPositionCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "trader", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "positionCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalCollateral",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "OpenValidationRequested",
    type: "event",
    inputs: [
      { name: "requestId", type: "uint256", indexed: true },
      { name: "trader", type: "address", indexed: true },
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "validationCtHash", type: "bytes32", indexed: false },
    ],
  },
  {
    name: "PositionOpened",
    type: "event",
    inputs: [
      { name: "positionId", type: "uint256", indexed: true },
      { name: "trader", type: "address", indexed: true },
      { name: "marketId", type: "bytes32", indexed: true },
      { name: "collateral", type: "uint256", indexed: false },
    ],
  },
  {
    name: "CloseRequested",
    type: "event",
    inputs: [
      { name: "positionId", type: "uint256", indexed: true },
      { name: "payoutCtHash", type: "bytes32", indexed: false },
      { name: "exitPrice", type: "uint256", indexed: false },
    ],
  },
  {
    name: "PositionClosed",
    type: "event",
    inputs: [
      { name: "positionId", type: "uint256", indexed: true },
      { name: "trader", type: "address", indexed: true },
      { name: "payout", type: "uint256", indexed: false },
      { name: "pnl", type: "int256", indexed: false },
    ],
  },
  {
    name: "LiquidationCheckRequested",
    type: "event",
    inputs: [
      { name: "positionId", type: "uint256", indexed: true },
      { name: "canLiquidateCtHash", type: "bytes32", indexed: false },
      { name: "price", type: "uint256", indexed: false },
    ],
  },
  {
    name: "PositionLiquidated",
    type: "event",
    inputs: [
      { name: "positionId", type: "uint256", indexed: true },
      { name: "trader", type: "address", indexed: true },
      { name: "collateralLost", type: "uint256", indexed: false },
    ],
  },
] as const;

// MockPriceOracle ABI
export const PRICE_ORACLE_ABI = [
  {
    name: "getPrice",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "symbol", type: "string" }],
    outputs: [
      { name: "price", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
    ],
  },
  {
    name: "getMarketId",
    type: "function",
    stateMutability: "pure",
    inputs: [{ name: "symbol", type: "string" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "DECIMALS",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;
