import type { TradingViewEntityId, TradingViewOverlayChartApi } from "@/lib/tradingview/private-overlays";

export interface TradingViewExecutionMarker {
  key: string;
  market: string;
  time: number;
  price: number;
  text: string;
  color: string;
}

export function clearExecutionMarkers(
  chart: TradingViewOverlayChartApi | null,
  markerIds: TradingViewEntityId[],
): void {
  if (!chart || markerIds.length === 0) {
    return;
  }

  for (const markerId of markerIds) {
    try {
      chart.removeEntity(markerId);
    } catch {
      // Ignore stale marker ids during redraw.
    }
  }
}

async function createExecutionMarker(
  chart: TradingViewOverlayChartApi,
  marker: TradingViewExecutionMarker,
): Promise<TradingViewEntityId> {
  return chart.createShape(
    {
      time: marker.time,
      price: marker.price,
    },
    {
      shape: "flag",
      text: marker.text,
      lock: true,
      disableSave: true,
      disableSelection: true,
      disableUndo: true,
      showInObjectsTree: false,
      zOrder: "top",
      overrides: {
        color: marker.color,
        fontsize: 12,
        bold: true,
      },
    },
  );
}

export async function drawExecutionMarkers(
  chart: TradingViewOverlayChartApi,
  markers: TradingViewExecutionMarker[],
): Promise<TradingViewEntityId[]> {
  const markerIds: TradingViewEntityId[] = [];

  for (const marker of markers) {
    if (marker.price <= 0 || marker.time <= 0) {
      continue;
    }

    markerIds.push(await createExecutionMarker(chart, marker));
  }

  return markerIds;
}
