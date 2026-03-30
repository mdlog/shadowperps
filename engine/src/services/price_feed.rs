use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use rust_decimal::prelude::FromPrimitive;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, broadcast};
use tracing::{info, warn};

use crate::types::{Market, PriceUpdate};
use crate::services::oracle_sync::OracleSyncService;

/// Aggregated price feed service — fetches from CryptoCompare (free, no key)
pub struct PriceFeedService {
    pub markets: Arc<RwLock<HashMap<String, Market>>>,
    http: reqwest::Client,
    updates_tx: broadcast::Sender<Vec<PriceUpdate>>,
}

// CryptoCompare multi-price response:
// { "BTC": { "USD": 69000, ... }, "ETH": { ... } }
#[derive(Debug, Deserialize)]
struct CryptoCompareMulti {
    #[serde(alias = "BTC")]
    btc: Option<CryptoCompareUsd>,
    #[serde(alias = "ETH")]
    eth: Option<CryptoCompareUsd>,
    #[serde(alias = "SOL")]
    sol: Option<CryptoCompareUsd>,
}

#[derive(Debug, Deserialize)]
struct CryptoCompareUsd {
    #[serde(alias = "USD")]
    usd: f64,
    #[serde(alias = "USD_24HOUR_CHANGE", default)]
    usd_24hour_change: Option<f64>,
    #[serde(alias = "USD_24HOUR_VOLUME", default)]
    usd_24hour_volume: Option<f64>,
}

impl PriceFeedService {
    pub fn new() -> Self {
        let markets = Arc::new(RwLock::new(Self::default_markets()));
        let (updates_tx, _) = broadcast::channel(64);
        Self {
            markets,
            http: reqwest::Client::new(),
            updates_tx,
        }
    }

    fn default_markets() -> HashMap<String, Market> {
        let mut m = HashMap::new();
        let now = Utc::now();

        m.insert("BTC-PERP".into(), Market {
            symbol: "BTC-PERP".into(),
            name: "Bitcoin".into(),
            price: Decimal::ZERO,
            change_24h: Decimal::ZERO,
            volume_24h: Decimal::ZERO,
            funding_rate: Decimal::new(42, 4),
            open_interest: Decimal::new(892_000_000, 0),
            last_updated: now,
        });

        m.insert("ETH-PERP".into(), Market {
            symbol: "ETH-PERP".into(),
            name: "Ethereum".into(),
            price: Decimal::ZERO,
            change_24h: Decimal::ZERO,
            volume_24h: Decimal::ZERO,
            funding_rate: Decimal::new(18, 4),
            open_interest: Decimal::new(456_000_000, 0),
            last_updated: now,
        });

        m.insert("SOL-PERP".into(), Market {
            symbol: "SOL-PERP".into(),
            name: "Solana".into(),
            price: Decimal::ZERO,
            change_24h: Decimal::ZERO,
            volume_24h: Decimal::ZERO,
            funding_rate: Decimal::new(65, 4),
            open_interest: Decimal::new(234_000_000, 0),
            last_updated: now,
        });

        m
    }

    /// Fetch live prices from CryptoCompare (free, no key required)
    pub async fn fetch_prices(&self) -> Result<Vec<PriceUpdate>> {
        // Use pricemultifull for price + 24h change + volume
        let url = "https://min-api.cryptocompare.com/data/pricemultifull?fsyms=BTC,ETH,SOL&tsyms=USD";

        let resp = self.http.get(url)
            .header("Accept", "application/json")
            .send()
            .await?;

        if !resp.status().is_success() {
            anyhow::bail!("CryptoCompare API error: {}", resp.status());
        }

        // pricemultifull returns: { "RAW": { "BTC": { "USD": { PRICE, CHANGEPCT24HOUR, VOLUME24HOURTO, ... } } } }
        let body: serde_json::Value = resp.json().await?;
        let raw = body.get("RAW").ok_or_else(|| anyhow::anyhow!("No RAW field"))?;

        let now = Utc::now();
        let mut updates = Vec::new();
        let mut markets = self.markets.write().await;

        let mapping: [(&str, &str, &str); 3] = [
            ("BTC", "BTC-PERP", "Bitcoin"),
            ("ETH", "ETH-PERP", "Ethereum"),
            ("SOL", "SOL-PERP", "Solana"),
        ];

        for (fsym, symbol, name) in &mapping {
            if let Some(coin) = raw.get(*fsym).and_then(|c| c.get("USD")) {
                let price = coin.get("PRICE").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let change_pct = coin.get("CHANGEPCT24HOUR").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let volume = coin.get("TOTALVOLUME24HTO").and_then(|v| v.as_f64()).unwrap_or(0.0);

                let price_dec = Decimal::from_f64(price).unwrap_or(Decimal::ZERO);
                let change_dec = Decimal::from_f64(change_pct).unwrap_or(Decimal::ZERO);
                let volume_dec = Decimal::from_f64(volume).unwrap_or(Decimal::ZERO);

                if let Some(market) = markets.get_mut(*symbol) {
                    market.price = price_dec;
                    market.change_24h = change_dec;
                    market.volume_24h = volume_dec;
                    market.last_updated = now;
                } else {
                    markets.insert((*symbol).to_string(), Market {
                        symbol: (*symbol).to_string(),
                        name: (*name).to_string(),
                        price: price_dec,
                        change_24h: change_dec,
                        volume_24h: volume_dec,
                        funding_rate: Decimal::ZERO,
                        open_interest: Decimal::ZERO,
                        last_updated: now,
                    });
                }

                updates.push(PriceUpdate {
                    symbol: (*symbol).to_string(),
                    price: price_dec,
                    timestamp: now,
                    source: "cryptocompare".into(),
                });
            }
        }

        info!("Updated {} prices from CryptoCompare", updates.len());
        if !updates.is_empty() {
            let _ = self.updates_tx.send(updates.clone());
        }
        Ok(updates)
    }

    /// Start the periodic price update loop
    pub async fn start_price_loop(self: Arc<Self>, interval_secs: u64, oracle_sync: Option<Arc<OracleSyncService>>) {
        info!("Starting price feed loop (interval: {}s)", interval_secs);

        // Fetch immediately on startup
        match self.fetch_prices().await {
            Ok(u) => {
                info!("Initial price load: {} markets", u.len());
                if let Some(syncer) = &oracle_sync {
                    if let Err(error) = syncer.sync_updates(&u).await {
                        warn!("Initial oracle sync failed: {}", error);
                    }
                }
            }
            Err(e) => warn!("Initial price load failed: {}", e),
        }

        let mut interval = tokio::time::interval(
            tokio::time::Duration::from_secs(interval_secs),
        );

        loop {
            interval.tick().await;
            match self.fetch_prices().await {
                Ok(updates) => {
                    info!("Price update: {} markets refreshed", updates.len());
                    if let Some(syncer) = &oracle_sync {
                        if let Err(error) = syncer.sync_updates(&updates).await {
                            warn!("Oracle sync failed: {}", error);
                        }
                    }
                }
                Err(e) => {
                    warn!("Price fetch failed: {}", e);
                }
            }
        }
    }

    /// Get all current markets
    pub async fn get_markets(&self) -> Vec<Market> {
        let markets = self.markets.read().await;
        markets.values().cloned().collect()
    }

    /// Get a single market price
    pub async fn get_price(&self, symbol: &str) -> Option<Decimal> {
        let markets = self.markets.read().await;
        markets.get(symbol).map(|m| m.price)
    }

    pub fn subscribe_updates(&self) -> broadcast::Receiver<Vec<PriceUpdate>> {
        self.updates_tx.subscribe()
    }
}
