pub mod config;

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ══════════════════════════════════════════════
//  Market Types
// ══════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Market {
    pub symbol: String,
    pub name: String,
    pub price: Decimal,
    pub change_24h: Decimal,
    pub volume_24h: Decimal,
    pub funding_rate: Decimal,
    pub open_interest: Decimal,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceUpdate {
    pub symbol: String,
    pub price: Decimal,
    pub timestamp: DateTime<Utc>,
    pub source: String,
}

// ══════════════════════════════════════════════
//  Position Types
// ══════════════════════════════════════════════

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Direction {
    Long,
    Short,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PositionStatus {
    Open,
    Closed,
    Liquidated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub id: u64,
    pub trader: String,
    pub market: String,
    pub direction: Direction,
    pub size: Decimal,
    pub collateral: Decimal,
    pub entry_price: Decimal,
    pub mark_price: Decimal,
    pub leverage: u32,
    pub unrealized_pnl: Decimal,
    pub pnl_percent: Decimal,
    pub margin_ratio: Decimal,
    pub liquidation_price: Decimal,
    pub status: PositionStatus,
    pub opened_at: DateTime<Utc>,
    pub on_chain_id: Option<u64>,
    pub encrypted: bool,
}

// ══════════════════════════════════════════════
//  Order Types
// ══════════════════════════════════════════════

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OrderType {
    Market,
    Limit,
    StopLoss,
    TakeProfit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum OrderStatus {
    Pending,
    Filled,
    Cancelled,
    Rejected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: String,
    pub trader: String,
    pub market: String,
    pub direction: Direction,
    pub order_type: OrderType,
    pub size: Decimal,
    pub collateral: Decimal,
    pub leverage: u32,
    pub price: Option<Decimal>,
    pub status: OrderStatus,
    pub created_at: DateTime<Utc>,
    pub filled_at: Option<DateTime<Utc>>,
    pub tx_hash: Option<String>,
}

// ══════════════════════════════════════════════
//  API Request/Response Types
// ══════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct OpenPositionRequest {
    pub market: String,
    pub direction: Direction,
    pub size: Decimal,
    pub collateral: Decimal,
    pub leverage: u32,
    pub trader: String,
    pub on_chain_id: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct ClosePositionRequest {
    pub position_id: u64,
    pub trader: String,
}

#[derive(Debug, Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self { success: true, data: Some(data), error: None }
    }

    pub fn err(msg: impl Into<String>) -> Self {
        Self { success: false, data: None, error: Some(msg.into()) }
    }
}

#[derive(Debug, Serialize)]
pub struct PortfolioSummary {
    pub total_value: Decimal,
    pub total_pnl: Decimal,
    pub total_pnl_percent: Decimal,
    pub total_collateral: Decimal,
    pub margin_used: Decimal,
    pub position_count: u32,
}

// ══════════════════════════════════════════════
//  Engine Health
// ══════════════════════════════════════════════

#[derive(Debug, Serialize)]
pub struct EngineHealth {
    pub status: String,
    pub version: String,
    pub uptime_secs: u64,
    pub markets_count: usize,
    pub last_price_update: Option<DateTime<Utc>>,
    pub chain_id: u64,
    pub rpc_connected: bool,
}
