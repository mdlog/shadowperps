use anyhow::Result;
use chrono::Utc;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::RwLock;
use tracing::{info, warn};

use crate::types::*;
use crate::services::price_feed::PriceFeedService;

const PERSIST_FILE: &str = "data/positions.json";

pub struct PositionManager {
    positions: Arc<RwLock<HashMap<u64, Position>>>,
    next_id: AtomicU64,
    price_feed: Arc<PriceFeedService>,
}

impl PositionManager {
    pub fn new(price_feed: Arc<PriceFeedService>) -> Self {
        // Load persisted positions
        let (positions, next_id) = Self::load_from_disk();
        Self {
            positions: Arc::new(RwLock::new(positions)),
            next_id: AtomicU64::new(next_id),
            price_feed,
        }
    }

    fn load_from_disk() -> (HashMap<u64, Position>, u64) {
        match std::fs::read_to_string(PERSIST_FILE) {
            Ok(data) => {
                let positions: Vec<Position> = serde_json::from_str(&data).unwrap_or_default();
                let max_id = positions.iter().map(|p| p.id).max().unwrap_or(0);
                let map: HashMap<u64, Position> = positions.into_iter().map(|p| (p.id, p)).collect();
                info!("Loaded {} positions from disk", map.len());
                (map, max_id + 1)
            }
            Err(_) => (HashMap::new(), 1),
        }
    }

    async fn persist(&self) {
        let positions = self.positions.read().await;
        let list: Vec<&Position> = positions.values().collect();
        if let Ok(json) = serde_json::to_string_pretty(&list) {
            let _ = std::fs::create_dir_all("data");
            if let Err(e) = std::fs::write(PERSIST_FILE, json) {
                warn!("Failed to persist positions: {}", e);
            }
        }
    }

    /// Open a new position (engine-side tracking)
    pub async fn open_position(&self, req: OpenPositionRequest) -> Result<Position> {
        let price = self.price_feed.get_price(&req.market).await
            .ok_or_else(|| anyhow::anyhow!("Market {} not found", req.market))?;

        // Validate leverage
        if req.leverage == 0 || req.leverage > 50 {
            anyhow::bail!("Leverage must be 1-50");
        }
        if req.size <= Decimal::ZERO || req.collateral <= Decimal::ZERO {
            anyhow::bail!("Size and collateral must be positive");
        }

        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let leverage_dec = Decimal::from(req.leverage);

        // Calculate liquidation price
        let liq_price = match req.direction {
            Direction::Long => {
                // liq = entry * (1 - 1/leverage * 0.8)
                let margin_fraction = Decimal::new(8, 1) / leverage_dec;
                price * (Decimal::ONE - margin_fraction)
            }
            Direction::Short => {
                let margin_fraction = Decimal::new(8, 1) / leverage_dec;
                price * (Decimal::ONE + margin_fraction)
            }
        };

        let position = Position {
            id,
            trader: req.trader,
            market: req.market,
            direction: req.direction,
            size: req.size,
            collateral: req.collateral,
            entry_price: price,
            mark_price: price,
            leverage: req.leverage,
            unrealized_pnl: Decimal::ZERO,
            pnl_percent: Decimal::ZERO,
            margin_ratio: Decimal::ONE,
            liquidation_price: liq_price,
            status: PositionStatus::Open,
            opened_at: Utc::now(),
            on_chain_id: req.on_chain_id,
            encrypted: true,
        };

        let mut positions = self.positions.write().await;
        positions.insert(id, position.clone());
        drop(positions);

        info!("Position opened: id={} market={} dir={:?} size={}", id, position.market, position.direction, position.size);
        self.persist().await;

        Ok(position)
    }

    /// Close a position
    pub async fn close_position(&self, position_id: u64, trader: &str) -> Result<Position> {
        let mut positions = self.positions.write().await;
        let pos = positions.get_mut(&position_id)
            .ok_or_else(|| anyhow::anyhow!("Position {} not found", position_id))?;

        if pos.trader != trader {
            anyhow::bail!("Not position owner");
        }
        if pos.status != PositionStatus::Open {
            anyhow::bail!("Position not open");
        }

        let current_price = self.price_feed.get_price(&pos.market).await
            .unwrap_or(pos.mark_price);

        // Calculate final PnL
        let (pnl, pnl_pct) = Self::calculate_pnl(pos, current_price);

        pos.mark_price = current_price;
        pos.unrealized_pnl = pnl;
        pos.pnl_percent = pnl_pct;
        pos.status = PositionStatus::Closed;
        let result = pos.clone();
        drop(positions);

        info!("Position closed: id={} pnl={}", position_id, pnl);
        self.persist().await;

        Ok(result)
    }

    /// Update all open positions with current market prices
    pub async fn update_mark_prices(&self) -> Result<usize> {
        let mut positions = self.positions.write().await;
        let mut updated = 0;

        for pos in positions.values_mut() {
            if pos.status != PositionStatus::Open {
                continue;
            }

            if let Some(price) = self.price_feed.get_price(&pos.market).await {
                pos.mark_price = price;
                let (pnl, pnl_pct) = Self::calculate_pnl(pos, price);
                pos.unrealized_pnl = pnl;
                pos.pnl_percent = pnl_pct;
                pos.margin_ratio = Self::calculate_margin_ratio(pos);
                updated += 1;
            }
        }

        Ok(updated)
    }

    /// Get all positions for a trader
    pub async fn get_trader_positions(&self, trader: &str) -> Vec<Position> {
        let positions = self.positions.read().await;
        positions.values()
            .filter(|p| p.trader == trader)
            .cloned()
            .collect()
    }

    /// Get a single position
    pub async fn get_position(&self, id: u64) -> Option<Position> {
        let positions = self.positions.read().await;
        positions.get(&id).cloned()
    }

    /// Get all open positions (for liquidation checks)
    pub async fn get_open_positions(&self) -> Vec<Position> {
        let positions = self.positions.read().await;
        positions.values()
            .filter(|p| p.status == PositionStatus::Open)
            .cloned()
            .collect()
    }

    /// Force-liquidate a position (called by liquidation engine)
    pub async fn liquidate_position(&self, position_id: u64) -> Result<Position> {
        let mut positions = self.positions.write().await;
        let pos = positions.get_mut(&position_id)
            .ok_or_else(|| anyhow::anyhow!("Position {} not found", position_id))?;

        if pos.status != PositionStatus::Open {
            anyhow::bail!("Position not open");
        }

        pos.status = PositionStatus::Liquidated;
        pos.unrealized_pnl = -pos.collateral; // total loss
        pos.pnl_percent = Decimal::from(-100);
        let result = pos.clone();
        drop(positions);

        warn!("Position LIQUIDATED: id={} market={} collateral lost={}", position_id, result.market, result.collateral);
        self.persist().await;

        Ok(result)
    }

    /// Get portfolio summary for a trader
    pub async fn get_portfolio(&self, trader: &str) -> PortfolioSummary {
        let positions = self.positions.read().await;
        let trader_positions: Vec<&Position> = positions.values()
            .filter(|p| p.trader == trader && p.status == PositionStatus::Open)
            .collect();

        let total_collateral: Decimal = trader_positions.iter()
            .map(|p| p.collateral)
            .sum();

        let total_pnl: Decimal = trader_positions.iter()
            .map(|p| p.unrealized_pnl)
            .sum();

        let total_value = total_collateral + total_pnl;
        let total_pnl_percent = if total_collateral > Decimal::ZERO {
            (total_pnl / total_collateral) * Decimal::from(100)
        } else {
            Decimal::ZERO
        };

        let margin_used = if !trader_positions.is_empty() {
            let avg_margin: Decimal = trader_positions.iter()
                .map(|p| p.margin_ratio)
                .sum::<Decimal>() / Decimal::from(trader_positions.len() as u64);
            Decimal::ONE - avg_margin
        } else {
            Decimal::ZERO
        };

        PortfolioSummary {
            total_value,
            total_pnl,
            total_pnl_percent,
            total_collateral,
            margin_used,
            position_count: trader_positions.len() as u32,
        }
    }

    // ── Helpers ──

    fn calculate_pnl(pos: &Position, current_price: Decimal) -> (Decimal, Decimal) {
        // size already = collateral * leverage, so no need to multiply leverage again
        let pnl = match pos.direction {
            Direction::Long => {
                pos.size * (current_price - pos.entry_price) / pos.entry_price
            }
            Direction::Short => {
                pos.size * (pos.entry_price - current_price) / pos.entry_price
            }
        };

        let pnl_pct = if pos.collateral > Decimal::ZERO {
            (pnl / pos.collateral) * Decimal::from(100)
        } else {
            Decimal::ZERO
        };

        (pnl, pnl_pct)
    }

    fn calculate_margin_ratio(pos: &Position) -> Decimal {
        if pos.collateral <= Decimal::ZERO {
            return Decimal::ZERO;
        }
        let net_collateral = pos.collateral + pos.unrealized_pnl;
        let required = pos.size / Decimal::from(pos.leverage);
        if required > Decimal::ZERO {
            (net_collateral / required).min(Decimal::ONE)
        } else {
            Decimal::ONE
        }
    }
}
