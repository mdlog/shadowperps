use axum::{Router, routing::{get, post}};
use std::sync::Arc;
use std::time::Instant;
use tower_http::cors::{CorsLayer, Any};
use tower_http::trace::TraceLayer;

use crate::api::handlers;
use crate::services::liquidation::LiquidationEngine;
use crate::services::position_manager::PositionManager;
use crate::services::price_feed::PriceFeedService;
use crate::types::config::EngineConfig;

pub struct AppState {
    pub config: EngineConfig,
    pub price_feed: Arc<PriceFeedService>,
    pub position_manager: Arc<PositionManager>,
    pub liquidation_engine: Arc<LiquidationEngine>,
    pub started_at: Instant,
}

pub fn create_router(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        // Health
        .route("/health", get(handlers::health))
        // Markets
        .route("/api/markets", get(handlers::get_markets))
        .route("/api/markets/{symbol}", get(handlers::get_market))
        // Positions
        .route("/api/positions", get(handlers::get_positions))
        .route("/api/positions/{id}", get(handlers::get_position))
        .route("/api/positions/open", post(handlers::open_position))
        .route("/api/positions/close", post(handlers::close_position))
        // Portfolio
        .route("/api/portfolio", get(handlers::get_portfolio))
        // Candles (OHLCV)
        .route("/api/candles/{symbol}", get(handlers::get_candles))
        // Liquidations
        .route("/api/liquidations", get(handlers::get_liquidations))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
