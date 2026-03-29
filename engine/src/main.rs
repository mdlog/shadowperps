mod api;
mod services;
mod types;

use std::sync::Arc;
use std::time::Instant;
use tracing::info;

use api::routes::{AppState, create_router};
use services::liquidation::LiquidationEngine;
use services::oracle_sync::OracleSyncService;
use services::position_manager::PositionManager;
use services::price_feed::PriceFeedService;
use types::config::EngineConfig;

fn load_env_files() {
    let _ = dotenvy::from_filename(".env.local");
    let _ = dotenvy::from_path("../.env.local");
    let _ = dotenvy::dotenv();
    let _ = dotenvy::from_path("../.env");
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load env files from either the repo root or the engine directory.
    load_env_files();

    // Init tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "shadowperps_engine=info,tower_http=info".into()),
        )
        .init();

    // Load config
    let config = EngineConfig::from_env()?;
    info!("ShadowPerps Engine v{}", env!("CARGO_PKG_VERSION"));
    info!("RPC: {}", config.rpc_url);
    info!("Chain ID: {}", config.chain_id);

    // Init services
    let price_feed = Arc::new(PriceFeedService::new());
    let position_manager = Arc::new(PositionManager::new(price_feed.clone()));
    let liquidation_engine = Arc::new(LiquidationEngine::new(
        position_manager.clone(),
        price_feed.clone(),
    ));
    let oracle_sync = OracleSyncService::from_config(&config);

    // Build app state
    let state = Arc::new(AppState {
        config: config.clone(),
        price_feed: price_feed.clone(),
        position_manager: position_manager.clone(),
        liquidation_engine: liquidation_engine.clone(),
        started_at: Instant::now(),
    });

    // Spawn background tasks
    let pf = price_feed.clone();
    let price_interval = config.price_update_interval_secs;
    let oracle_sync_task = oracle_sync.clone();
    tokio::spawn(async move {
        pf.start_price_loop(price_interval, oracle_sync_task).await;
    });

    let le = liquidation_engine.clone();
    let liq_interval = config.liquidation_check_interval_secs;
    tokio::spawn(async move {
        le.start_liquidation_loop(liq_interval).await;
    });

    // Start HTTP server
    let addr = config.server_addr();
    info!("Engine listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    let router = create_router(state);

    axum::serve(listener, router).await?;

    Ok(())
}
