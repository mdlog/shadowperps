import type { OnChainPortfolioPosition } from "@/hooks/useOnChainPortfolio";

export type TradingViewEntityId = string | number;

export interface TradingViewOverlayChartApi {
  createShape: (
    point: { time: number; price: number },
    options: Record<string, unknown>,
  ) => Promise<TradingViewEntityId>;
  removeEntity: (entityId: TradingViewEntityId) => void;
}

function getOverlayTime(position: OnChainPortfolioPosition): number {
  const openedAt = Date.parse(position.opened_at);
  if (Number.isFinite(openedAt)) {
    return Math.floor(openedAt / 1000);
  }

  return Math.floor(Date.now() / 1000);
}

async function createPositionEntryOverlay(
  chart: TradingViewOverlayChartApi,
  position: OnChainPortfolioPosition,
): Promise<TradingViewEntityId> {
  return chart.createShape(
    {
      time: getOverlayTime(position),
      price: position.entry_price,
    },
    {
      shape: "horizontal_line",
      lock: true,
      disableSave: true,
      disableSelection: true,
      disableUndo: true,
      showInObjectsTree: false,
      zOrder: "top",
      overrides: {
        color: position.direction === "long" ? "#4fb3ff" : "#f3b64c",
        width: 2,
        style: 2,
        showPrice: true,
        visible: true,
      },
    },
  );
}

async function createPositionEntryLabel(
  chart: TradingViewOverlayChartApi,
  position: OnChainPortfolioPosition,
): Promise<TradingViewEntityId> {
  return chart.createShape(
    {
      time: getOverlayTime(position),
      price: position.entry_price,
    },
    {
      shape: "text",
      text: `ENTRY ${position.direction === "long" ? "LONG" : "SHORT"} #${position.id}`,
      lock: true,
      disableSave: true,
      disableSelection: true,
      disableUndo: true,
      showInObjectsTree: false,
      zOrder: "top",
      overrides: {
        color: position.direction === "long" ? "#4fb3ff" : "#f3b64c",
        fontsize: 12,
        bold: true,
      },
    },
  );
}

async function createPositionLiquidationOverlay(
  chart: TradingViewOverlayChartApi,
  position: OnChainPortfolioPosition,
): Promise<TradingViewEntityId> {
  return chart.createShape(
    {
      time: getOverlayTime(position),
      price: position.liquidation_price,
    },
    {
      shape: "horizontal_line",
      lock: true,
      disableSave: true,
      disableSelection: true,
      disableUndo: true,
      showInObjectsTree: false,
      zOrder: "top",
      overrides: {
        color: "#ef6b6b",
        width: 1,
        style: 1,
        showPrice: true,
        visible: true,
      },
    },
  );
}

async function createPositionLiquidationLabel(
  chart: TradingViewOverlayChartApi,
  position: OnChainPortfolioPosition,
): Promise<TradingViewEntityId> {
  return chart.createShape(
    {
      time: getOverlayTime(position),
      price: position.liquidation_price,
    },
    {
      shape: "text",
      text: `LIQ #${position.id}`,
      lock: true,
      disableSave: true,
      disableSelection: true,
      disableUndo: true,
      showInObjectsTree: false,
      zOrder: "top",
      overrides: {
        color: "#ef6b6b",
        fontsize: 12,
        bold: true,
      },
    },
  );
}

export function clearPrivatePositionOverlays(
  chart: TradingViewOverlayChartApi | null,
  overlayIds: TradingViewEntityId[],
): void {
  if (!chart || overlayIds.length === 0) {
    return;
  }

  for (const overlayId of overlayIds) {
    try {
      chart.removeEntity(overlayId);
    } catch {
      // Ignore stale entity removals. We only manage our own overlay ids.
    }
  }
}

export async function drawPrivatePositionOverlays(
  chart: TradingViewOverlayChartApi,
  positions: OnChainPortfolioPosition[],
): Promise<TradingViewEntityId[]> {
  const overlayIds: TradingViewEntityId[] = [];

  for (const position of positions) {
    if (position.status !== "open") {
      continue;
    }

    if (position.entry_price > 0) {
      overlayIds.push(await createPositionEntryOverlay(chart, position));
      overlayIds.push(await createPositionEntryLabel(chart, position));
    }

    if (position.liquidation_price > 0) {
      overlayIds.push(await createPositionLiquidationOverlay(chart, position));
      overlayIds.push(await createPositionLiquidationLabel(chart, position));
    }
  }

  return overlayIds;
}
