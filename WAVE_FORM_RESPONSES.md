# Wave Form Responses

## Product Category

Recommended categories:

- DeFi
- Market Infrastructure
- Other: Confidential DeFi

## Updates in this Wave

ShadowPerps in this wave focuses on proving a real confidential trading flow on Fhenix CoFHE rather than claiming a fully private DeFi stack. We shipped a working perps experience on Arbitrum Sepolia where position direction and size are encrypted before submission, validated on-chain through a request/finalize flow, and only decrypted locally by the trader's wallet. The live product now supports opening positions, reading private portfolio state from ciphertext handles, closing positions on-chain, and showing realized PnL correctly in portfolio history.

On the technical side, we hardened the FHE-integrated flow across frontend and contracts. The trading path uses encrypted inputs, CoFHE request/finalize interactions, wallet-side decrypt proofs, and contract reads that return ciphertext handles for portfolio reconstruction. We also improved realized PnL handling for closed positions, tightened the landing-to-trade wallet flow, and kept live chart and oracle-driven market data connected through the Rust engine.

On the product side, we improved the main demo path across the landing page, trade page, and portfolio page so judges can move from wallet connect to encrypted trade execution with less friction. We also tightened the privacy messaging to clearly distinguish what is already private today, such as direction, size, payout flow, and wallet-local decrypt, from what is not yet fully private, such as collateral transfers and the current LP pool. For this wave, the strongest deliverable is a credible Confidential DeFi product: a working on-chain perps terminal with meaningful encrypted execution and a clear roadmap to expand privacy into pool custody in future waves.

## Milestone 2nd Wave

In the 2nd Wave, we plan to extend privacy beyond order execution into protocol accounting and UX hardening. The main milestone is improving confidential portfolio and settlement infrastructure: tighter FHE access control, stronger decrypt/reconnect reliability, cleaner transaction states, and better handling of liquidation and risk views. We also aim to make the privacy-ready LP path more concrete by refining pool-facing contracts, frontend wiring, and user messaging, while keeping the live demo path stable and judge-friendly.

## Milestone 3rd Wave

In the 3rd Wave, we plan to push ShadowPerps from confidential perps into a broader Confidential DeFi protocol. The target milestone is deeper private pool integration: encrypted LP accounting, more private settlement flows between perps and pool, and a stronger end-to-end privacy boundary across trading and liquidity. By this stage, we also want the protocol story to evolve from "private positions" into "confidential trading infrastructure" with a clearer path toward private liquidity, dark-pool style execution, and more advanced market structure primitives.
