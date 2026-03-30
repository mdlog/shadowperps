use axum::extract::{Path, Query, State};
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::Json;
use serde::Deserialize;
use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;
use tokio_stream::StreamExt;
use tokio_stream::wrappers::BroadcastStream;

use crate::api::routes::AppState;
use crate::types::*;

// ══════════════════════════════════════════════
//  Health
// ══════════════════════════════════════════════

pub async fn health(State(state): State<Arc<AppState>>) -> Json<EngineHealth> {
    let markets = state.price_feed.get_markets().await;
    let last_update = markets.iter().map(|m| m.last_updated).max();

    Json(EngineHealth {
        status: "ok".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        uptime_secs: state.started_at.elapsed().as_secs(),
        markets_count: markets.len(),
        last_price_update: last_update,
        chain_id: state.config.chain_id,
        rpc_connected: !state.config.rpc_url.is_empty(),
    })
}

// ══════════════════════════════════════════════
//  Markets
// ══════════════════════════════════════════════

pub async fn get_markets(State(state): State<Arc<AppState>>) -> Json<ApiResponse<Vec<Market>>> {
    let markets = state.price_feed.get_markets().await;
    Json(ApiResponse::ok(markets))
}

pub async fn stream_prices(
    State(state): State<Arc<AppState>>,
) -> Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>> {
    let receiver = state.price_feed.subscribe_updates();
    let stream = BroadcastStream::new(receiver).filter_map(|message| {
        match message {
            Ok(updates) => {
                let payload = match serde_json::to_string(&updates) {
                    Ok(payload) => payload,
                    Err(_) => return None,
                };

                Some(Ok(Event::default().event("prices").data(payload)))
            }
            Err(_) => None,
        }
    });

    Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(10))
            .text("keep-alive"),
    )
}

pub async fn get_market(
    State(state): State<Arc<AppState>>,
    Path(symbol): Path<String>,
) -> Json<ApiResponse<Market>> {
    let markets = state.price_feed.get_markets().await;
    match markets.into_iter().find(|m| m.symbol == symbol) {
        Some(market) => Json(ApiResponse::ok(market)),
        None => Json(ApiResponse::err(format!("Market {} not found", symbol))),
    }
}

// ══════════════════════════════════════════════
//  Positions
// ══════════════════════════════════════════════

pub async fn open_position(
    State(state): State<Arc<AppState>>,
    Json(req): Json<OpenPositionRequest>,
) -> Json<ApiResponse<Position>> {
    match state.position_manager.open_position(req).await {
        Ok(pos) => Json(ApiResponse::ok(pos)),
        Err(e) => Json(ApiResponse::err(e.to_string())),
    }
}

pub async fn close_position(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ClosePositionRequest>,
) -> Json<ApiResponse<Position>> {
    match state.position_manager.close_position(req.position_id, &req.trader).await {
        Ok(pos) => Json(ApiResponse::ok(pos)),
        Err(e) => Json(ApiResponse::err(e.to_string())),
    }
}

#[derive(Deserialize)]
pub struct TraderQuery {
    pub trader: String,
}

pub async fn get_positions(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TraderQuery>,
) -> Json<ApiResponse<Vec<Position>>> {
    let positions = state.position_manager.get_trader_positions(&query.trader).await;
    Json(ApiResponse::ok(positions))
}

pub async fn get_position(
    State(state): State<Arc<AppState>>,
    Path(id): Path<u64>,
) -> Json<ApiResponse<Position>> {
    match state.position_manager.get_position(id).await {
        Some(pos) => Json(ApiResponse::ok(pos)),
        None => Json(ApiResponse::err(format!("Position {} not found", id))),
    }
}

// ══════════════════════════════════════════════
//  Portfolio
// ══════════════════════════════════════════════

pub async fn get_portfolio(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TraderQuery>,
) -> Json<ApiResponse<PortfolioSummary>> {
    let summary = state.position_manager.get_portfolio(&query.trader).await;
    Json(ApiResponse::ok(summary))
}

// ══════════════════════════════════════════════
//  Liquidations
// ══════════════════════════════════════════════

pub async fn get_liquidations(
    State(state): State<Arc<AppState>>,
) -> Json<ApiResponse<Vec<crate::services::liquidation::LiquidationEvent>>> {
    let events = state.liquidation_engine.get_liquidation_log().await;
    Json(ApiResponse::ok(events))
}

// ══════════════════════════════════════════════
//  Candle / OHLCV Data (proxy Binance public API)
// ══════════════════════════════════════════════

#[derive(Deserialize)]
pub struct CandleQuery {
    pub interval: Option<String>,
    pub limit: Option<u32>,
}

#[derive(serde::Serialize)]
pub struct Candle {
    pub time: u64,   // unix seconds
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

pub async fn get_candles(
    Path(symbol): Path<String>,
    Query(query): Query<CandleQuery>,
) -> Json<ApiResponse<Vec<Candle>>> {
    // Map ShadowPerps symbol -> CryptoCompare fsym
    let fsym = match symbol.as_str() {
        "BTC-PERP" => "BTC",
        "ETH-PERP" => "ETH",
        "SOL-PERP" => "SOL",
        other => {
            return Json(ApiResponse::err(format!("Unknown market: {other}")));
        }
    };

    let interval = query.interval.as_deref().unwrap_or("1h");
    let limit = query.limit.unwrap_or(200).min(500);

    // CryptoCompare endpoints by interval
    let url = match interval {
        "1m" | "5m" | "15m" | "30m" =>
            format!(
                "https://min-api.cryptocompare.com/data/v2/histominute?fsym={}&tsym=USD&limit={}",
                fsym, limit
            ),
        "1h" | "4h" =>
            format!(
                "https://min-api.cryptocompare.com/data/v2/histohour?fsym={}&tsym=USD&limit={}",
                fsym, limit
            ),
        "1d" | "1D" | "1w" =>
            format!(
                "https://min-api.cryptocompare.com/data/v2/histoday?fsym={}&tsym=USD&limit={}",
                fsym, limit
            ),
        _ =>
            format!(
                "https://min-api.cryptocompare.com/data/v2/histohour?fsym={}&tsym=USD&limit={}",
                fsym, limit
            ),
    };

    let http = reqwest::Client::new();
    let resp = match http.get(&url).send().await {
        Ok(r) => r,
        Err(e) => return Json(ApiResponse::err(format!("CryptoCompare request failed: {e}"))),
    };

    if !resp.status().is_success() {
        return Json(ApiResponse::err(format!("CryptoCompare API error: {}", resp.status())));
    }

    // CryptoCompare response structure
    #[derive(Deserialize)]
    struct CryptoCompareResp {
        #[serde(alias = "Response")]
        response: String,
        #[serde(alias = "Data")]
        data: Option<CryptoCompareData>,
    }
    #[derive(Deserialize)]
    struct CryptoCompareData {
        #[serde(alias = "Data")]
        data: Vec<CryptoCompareCandle>,
    }
    #[derive(Deserialize)]
    struct CryptoCompareCandle {
        time: u64,
        open: f64,
        high: f64,
        low: f64,
        close: f64,
        volumefrom: f64,
    }

    let data: CryptoCompareResp = match resp.json().await {
        Ok(d) => d,
        Err(e) => return Json(ApiResponse::err(format!("Parse error: {e}"))),
    };

    if data.response != "Success" {
        return Json(ApiResponse::err("CryptoCompare returned error"));
    }

    let candles: Vec<Candle> = data
        .data
        .map(|d| {
            d.data
                .into_iter()
                .map(|k| Candle {
                    time: k.time,
                    open: k.open,
                    high: k.high,
                    low: k.low,
                    close: k.close,
                    volume: k.volumefrom,
                })
                .collect()
        })
        .unwrap_or_default();

    Json(ApiResponse::ok(candles))
}
