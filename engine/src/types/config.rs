use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct EngineConfig {
    /// HTTP server host
    pub host: String,
    /// HTTP server port
    pub port: u16,
    /// Fhenix RPC URL
    pub rpc_url: String,
    /// Chain ID
    pub chain_id: u64,
    /// ShadowPerps contract address
    pub perps_contract: String,
    /// MockPriceOracle contract address
    pub oracle_contract: String,
    /// Engine private key (for price updates, liquidations)
    pub engine_private_key: String,
    /// Price update interval in seconds
    pub price_update_interval_secs: u64,
    /// Liquidation check interval in seconds
    pub liquidation_check_interval_secs: u64,
}

impl EngineConfig {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Self {
            host: std::env::var("ENGINE_HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: std::env::var("ENGINE_PORT")
                .unwrap_or_else(|_| "3010".into())
                .parse()?,
            rpc_url: std::env::var("FHENIX_RPC_URL")
                .unwrap_or_else(|_| "https://api.nitrogen.fhenix.zone".into()),
            chain_id: std::env::var("FHENIX_CHAIN_ID")
                .unwrap_or_else(|_| "8008148".into())
                .parse()?,
            perps_contract: std::env::var("SHADOWPERPS_CONTRACT")
                .unwrap_or_else(|_| String::new()),
            oracle_contract: std::env::var("ORACLE_CONTRACT")
                .unwrap_or_else(|_| String::new()),
            engine_private_key: std::env::var("ENGINE_PRIVATE_KEY")
                .unwrap_or_else(|_| String::new()),
            price_update_interval_secs: std::env::var("PRICE_UPDATE_INTERVAL")
                .unwrap_or_else(|_| "30".into())
                .parse()?,
            liquidation_check_interval_secs: std::env::var("LIQUIDATION_CHECK_INTERVAL")
                .unwrap_or_else(|_| "10".into())
                .parse()?,
        })
    }

    pub fn server_addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}
