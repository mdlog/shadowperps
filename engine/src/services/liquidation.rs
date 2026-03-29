use anyhow::Result;
use rust_decimal::Decimal;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

use crate::services::position_manager::PositionManager;
use crate::services::price_feed::PriceFeedService;
use crate::types::{Direction, PositionStatus};

/// Liquidation engine — monitors positions and triggers liquidation
/// when margin ratio falls below threshold
pub struct LiquidationEngine {
    position_manager: Arc<PositionManager>,
    price_feed: Arc<PriceFeedService>,
    /// Margin ratio below which position gets liquidated (e.g. 0.05 = 5%)
    liquidation_threshold: Decimal,
    /// Tracks liquidated position IDs
    liquidation_log: Arc<RwLock<Vec<LiquidationEvent>>>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct LiquidationEvent {
    pub position_id: u64,
    pub trader: String,
    pub market: String,
    pub direction: crate::types::Direction,
    pub size: Decimal,
    pub entry_price: Decimal,
    pub liquidation_price: Decimal,
    pub mark_price_at_liq: Decimal,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl LiquidationEngine {
    pub fn new(
        position_manager: Arc<PositionManager>,
        price_feed: Arc<PriceFeedService>,
    ) -> Self {
        Self {
            position_manager,
            price_feed,
            liquidation_threshold: Decimal::new(5, 2), // 5% margin remaining
            liquidation_log: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Check all open positions for liquidation conditions
    pub async fn check_liquidations(&self) -> Result<Vec<LiquidationEvent>> {
        // First, update all mark prices
        self.position_manager.update_mark_prices().await?;

        let open_positions = self.position_manager.get_open_positions().await;
        let mut liquidated = Vec::new();

        for pos in &open_positions {
            if pos.status != PositionStatus::Open {
                continue;
            }

            let should_liquidate = match pos.direction {
                Direction::Long => pos.mark_price <= pos.liquidation_price,
                Direction::Short => pos.mark_price >= pos.liquidation_price,
            };

            if should_liquidate || pos.margin_ratio < self.liquidation_threshold {
                let event = LiquidationEvent {
                    position_id: pos.id,
                    trader: pos.trader.clone(),
                    market: pos.market.clone(),
                    direction: pos.direction,
                    size: pos.size,
                    entry_price: pos.entry_price,
                    liquidation_price: pos.liquidation_price,
                    mark_price_at_liq: pos.mark_price,
                    timestamp: chrono::Utc::now(),
                };

                // Actually liquidate the position
                match self.position_manager.liquidate_position(pos.id).await {
                    Ok(_) => {
                        warn!(
                            "LIQUIDATED: position={} trader={} market={} price={} liq_price={}",
                            pos.id, pos.trader, pos.market, pos.mark_price, pos.liquidation_price
                        );
                        liquidated.push(event);
                    }
                    Err(e) => {
                        warn!("Failed to liquidate position {}: {}", pos.id, e);
                    }
                }
            }
        }

        if !liquidated.is_empty() {
            let mut log = self.liquidation_log.write().await;
            log.extend(liquidated.clone());
            info!("{} positions liquidated", liquidated.len());
        }

        Ok(liquidated)
    }

    /// Start the periodic liquidation check loop
    pub async fn start_liquidation_loop(self: Arc<Self>, interval_secs: u64) {
        info!("Starting liquidation engine (interval: {}s)", interval_secs);
        let mut interval = tokio::time::interval(
            tokio::time::Duration::from_secs(interval_secs),
        );

        loop {
            interval.tick().await;
            match self.check_liquidations().await {
                Ok(events) => {
                    if !events.is_empty() {
                        info!("Liquidation check: {} events", events.len());
                    }
                }
                Err(e) => {
                    warn!("Liquidation check failed: {}", e);
                }
            }
        }
    }

    /// Get recent liquidation events
    pub async fn get_liquidation_log(&self) -> Vec<LiquidationEvent> {
        let log = self.liquidation_log.read().await;
        log.clone()
    }
}
