use std::sync::Arc;

use alloy::{
    network::EthereumWallet,
    primitives::{Address, U256},
    providers::ProviderBuilder,
    signers::local::PrivateKeySigner,
    sol,
};
use anyhow::{Context, Result};
use rust_decimal::{Decimal, prelude::ToPrimitive};
use tracing::{info, warn};

use crate::types::{PriceUpdate, config::EngineConfig};

sol! {
    #[sol(rpc)]
    contract MockPriceOracle {
        function updatePriceBatch(string[] calldata symbols, uint256[] calldata _prices) external;
    }
}

#[derive(Clone)]
pub struct OracleSyncService {
    rpc_url: String,
    oracle_address: Address,
    private_key: String,
}

impl OracleSyncService {
    pub fn from_config(config: &EngineConfig) -> Option<Arc<Self>> {
        if config.rpc_url.is_empty() || config.oracle_contract.is_empty() || config.engine_private_key.is_empty() {
            warn!("Oracle sync disabled: missing FHENIX_RPC_URL / ORACLE_CONTRACT / ENGINE_PRIVATE_KEY");
            return None;
        }

        let oracle_address = match config.oracle_contract.parse::<Address>() {
            Ok(address) => address,
            Err(error) => {
                warn!("Oracle sync disabled: invalid ORACLE_CONTRACT: {}", error);
                return None;
            }
        };

        Some(Arc::new(Self {
            rpc_url: config.rpc_url.clone(),
            oracle_address,
            private_key: normalize_private_key(&config.engine_private_key),
        }))
    }

    pub async fn sync_updates(&self, updates: &[PriceUpdate]) -> Result<()> {
        let updates = updates
            .iter()
            .filter(|update| update.price > Decimal::ZERO)
            .collect::<Vec<_>>();

        if updates.is_empty() {
            return Ok(());
        }

        let signer: PrivateKeySigner = self.private_key
            .parse()
            .context("invalid ENGINE_PRIVATE_KEY")?;
        let wallet = EthereumWallet::new(signer);
        let rpc_url = self.rpc_url.parse().context("invalid FHENIX_RPC_URL")?;
        let provider = ProviderBuilder::new()
            .wallet(wallet)
            .connect_http(rpc_url);

        let oracle = MockPriceOracle::new(self.oracle_address, &provider);
        let symbols = updates
            .iter()
            .map(|update| update.symbol.clone())
            .collect::<Vec<_>>();
        let prices = updates
            .iter()
            .map(|update| decimal_to_oracle_price(update.price))
            .collect::<Result<Vec<_>>>()?;

        let receipt = oracle
            .updatePriceBatch(symbols.clone(), prices)
            .send()
            .await?
            .get_receipt()
            .await?;

        info!(
            "Synced {} prices to oracle {} in tx {}",
            symbols.len(),
            self.oracle_address,
            receipt.transaction_hash
        );

        Ok(())
    }
}

fn normalize_private_key(private_key: &str) -> String {
    if private_key.starts_with("0x") {
        private_key.to_string()
    } else {
        format!("0x{}", private_key)
    }
}

fn decimal_to_oracle_price(price: Decimal) -> Result<U256> {
    let scaled = (price * Decimal::from(100_000_000u64))
        .round()
        .to_u128()
        .context("price overflow while scaling to 8 decimals")?;

    Ok(U256::from(scaled))
}
