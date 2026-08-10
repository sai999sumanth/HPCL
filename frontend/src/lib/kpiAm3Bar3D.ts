/**
 * Shared amCharts 3 serial 3D column settings for **Zone-wise Retail Outlet Stockouts
 * Distribution** (`RetailOutletStockoutsAm3BarChart`) and **Zone-wise Retail Outlet
 * Stockouts** binary bars (`RetailOutletStockoutsAm3BarChartBinary`).
 *
 * amCharts 5 stacked bars (`ZoneGroupedBarChart` + `glass3DColumnStyle`) use the same
 * angle and fill alpha so the Loss drill chart matches this 3D look as closely as
 * the v5 API allows (gradient pseudo-3D, not extruded columns).
 */
export const KPI_AM3_ZONE_BAR_3D = {
  depth3D: 22,
  angle: 30,
  columnWidth: 0.58,
  columnSpacing: 22,
} as const;

export const KPI_AM3_ZONE_BAR_3D_BINARY = {
  depth3D: 22,
  angle: 30,
  columnWidth: 0.6,
  columnSpacing: 22,
} as const;

/** Same as graph `fillAlphas` on those am3 stockouts charts (glassy columns). */
export const KPI_AM3_ZONE_BAR_GLASS_FILL_ALPHA = 0.9;

/** Shared amCharts 3 category scrollbar — SVG round grips; center drag pans, ends resize. */
export const KPI_AM3_ZONE_BAR_SCROLLBAR = {
  enabled: true,
  resizeEnabled: true,
  hideResizeGrips: false,
  oppositeAxis: false,
  scrollbarHeight: 10,
  backgroundAlpha: 1,
  backgroundColor: "#e5e7eb",
  selectedBackgroundAlpha: 1,
  selectedBackgroundColor: "#9ca3af",
  graphFillAlpha: 0,
  graphLineAlpha: 0,
  selectedGraphFillAlpha: 0,
  selectedGraphLineAlpha: 0,
  offset: 24,
  updateOnReleaseOnly: false,
} as const;

const SCROLLBAR_GRIP_RADIUS = 9;

function appendRoundGrip(scrollbarRoot: Element, cx: number, cy: number): void {
  const ns = "http://www.w3.org/2000/svg";
  const g = document.createElementNS(ns, "g");
  g.setAttribute("data-kpi-scrollbar-grip", "1");
  g.setAttribute("pointer-events", "none");

  const circle = document.createElementNS(ns, "circle");
  circle.setAttribute("cx", String(cx));
  circle.setAttribute("cy", String(cy));
  circle.setAttribute("r", String(SCROLLBAR_GRIP_RADIUS));
  circle.setAttribute("fill", "#d1d5db");
  circle.setAttribute("stroke", "#aeb6c2");
  circle.setAttribute("stroke-width", "1");

  const line1 = document.createElementNS(ns, "rect");
  line1.setAttribute("x", String(cx - 2.5));
  line1.setAttribute("y", String(cy - 4));
  line1.setAttribute("width", "1.2");
  line1.setAttribute("height", "8");
  line1.setAttribute("rx", "0.5");
  line1.setAttribute("fill", "#4b5563");

  const line2 = document.createElementNS(ns, "rect");
  line2.setAttribute("x", String(cx + 1.3));
  line2.setAttribute("y", String(cy - 4));
  line2.setAttribute("width", "1.2");
  line2.setAttribute("height", "8");
  line2.setAttribute("rx", "0.5");
  line2.setAttribute("fill", "#4b5563");

  g.appendChild(circle);
  g.appendChild(line1);
  g.appendChild(line2);
  scrollbarRoot.appendChild(g);
}

function getScrollbarRoot(containerEl: HTMLElement, chart?: Am3ChartLike): Element | null {
  const fromChart = chart?.chartScrollbar?.set?.node as Element | undefined;
  if (fromChart) return fromChart;

  const svg = containerEl.querySelector("svg");
  if (!svg) return null;

  return (
    svg.querySelector('[class*="scrollbar-bg"]')?.parentElement ??
    svg.querySelector('[class*="scrollbar"]') ??
    null
  );
}

function paintScrollbarRects(scrollbarRoot: Element): void {
  scrollbarRoot.querySelectorAll("rect").forEach((rect) => {
    const cls = rect.getAttribute("class") ?? "";
    if (cls.includes("scrollbar-bg-selected")) {
      rect.setAttribute("fill", "#9ca3af");
      rect.setAttribute("fill-opacity", "1");
      rect.removeAttribute("rx");
      rect.removeAttribute("ry");
      return;
    }
    if (cls.includes("scrollbar-bg") && !cls.includes("selected")) {
      rect.setAttribute("fill", "#e5e7eb");
      rect.setAttribute("fill-opacity", "1");
      rect.setAttribute("rx", "8");
      rect.setAttribute("ry", "8");
    }
  });

  scrollbarRoot.querySelectorAll("path, polyline, image").forEach((el) => {
    (el as SVGElement).setAttribute("display", "none");
  });
}

/** Invisible amCharts grip hit-targets for resize — visuals are SVG-only. */
function enableResizeHitTargets(chart: Am3ChartLike): void {
  const scrollbar = chart?.chartScrollbar;
  if (!scrollbar?.resizeEnabled) return;
  scrollbar.iconLeft?.show?.();
  scrollbar.iconRight?.show?.();
  if (typeof scrollbar.updateDragIconPositions === "function") {
    scrollbar.updateDragIconPositions();
  }
}

function getDraggerBox(
  scrollbarRoot: Element,
  chart?: Am3ChartLike
): { x: number; y: number; width: number; height: number } | null {
  const selected = scrollbarRoot.querySelector(
    'rect[class*="scrollbar-bg-selected"]'
  ) as SVGRectElement | null;
  if (selected) {
    const x = parseFloat(selected.getAttribute("x") ?? "");
    const y = parseFloat(selected.getAttribute("y") ?? "");
    const width = parseFloat(selected.getAttribute("width") ?? "");
    const height = parseFloat(selected.getAttribute("height") ?? "");
    if (Number.isFinite(x) && Number.isFinite(y) && width >= 4 && height > 0) {
      return { x, y, width, height };
    }
  }

  const dbox = chart?.chartScrollbar?.getDBox?.() as
    | { x: number; y: number; width: number; height: number }
    | undefined;
  if (dbox && dbox.width >= 4) return dbox;
  return null;
}

/**
 * Loss-of-sales style scrollbar: light track, gray thumb, SVG round end grips with || lines.
 * Resize uses invisible amCharts grip hit-targets (no PNG assets).
 */
export function styleKpiAm3ZoneScrollbar(containerEl: HTMLElement, chart?: Am3ChartLike): void {
  const scrollbarRoot = getScrollbarRoot(containerEl, chart);
  if (!scrollbarRoot) return;

  scrollbarRoot.querySelectorAll("[data-kpi-scrollbar-grip]").forEach((n) => n.remove());
  paintScrollbarRects(scrollbarRoot);

  if (chart?.chartScrollbar?.resizeEnabled) {
    enableResizeHitTargets(chart);
  } else {
    chart?.chartScrollbar?.iconLeft?.hide?.();
    chart?.chartScrollbar?.iconRight?.hide?.();
  }

  const box = getDraggerBox(scrollbarRoot, chart);
  if (!box) return;

  const cy = box.y + box.height / 2;
  appendRoundGrip(scrollbarRoot, box.x, cy);
  appendRoundGrip(scrollbarRoot, box.x + box.width, cy);
}

/** amCharts 3 graph (legend row ↔ optional hidden companion layers). */
type Am3GraphLike = { title?: string; hidden?: boolean; switchable?: boolean };

/** amCharts 3 chart with legend listener support. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Am3ChartLike = any;

/**
 * Split stack segments (inside + top label graphs) share one legend row — keep companions
 * in sync when the user clicks the legend to show/hide a series.
 */
export function wireAm3LegendCompanionGraphs(
  chart: Am3ChartLike,
  companionsByTitle: Record<string, string[]>
): void {
  const legend = chart?.legend;
  if (!legend?.addListener) return;

  const syncCompanions = (primary: Am3GraphLike) => {
    const companionTitles = companionsByTitle[primary.title ?? ""];
    if (!companionTitles?.length) return;

    const graphs = chart.graphs as Am3GraphLike[] | undefined;
    if (!Array.isArray(graphs)) return;

    let changed = false;
    companionTitles.forEach((title) => {
      const companion = graphs.find((g) => g.title === title);
      if (!companion || companion.hidden === primary.hidden) return;
      companion.hidden = primary.hidden;
      companion.switchable = true;
      changed = true;
    });

    if (changed) {
      chart.dataChanged = true;
      if (typeof chart.initChart === "function") chart.initChart();
    }
  };

  legend.addListener("hideItem", (e: { dataItem?: Am3GraphLike }) => {
    if (e.dataItem) syncCompanions({ ...e.dataItem, hidden: true });
  });
  legend.addListener("showItem", (e: { dataItem?: Am3GraphLike }) => {
    if (e.dataItem) syncCompanions({ ...e.dataItem, hidden: false });
  });
}
