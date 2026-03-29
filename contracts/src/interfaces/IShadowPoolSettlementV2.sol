// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IShadowPoolSettlementV2 {
    function recordTraderDelta(bytes32 deltaCtHash, bool traderWins) external;
    function recordTradingFee(bytes32 feeCtHash) external;
}
