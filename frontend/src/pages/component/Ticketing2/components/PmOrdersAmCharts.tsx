
import { useEffect, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

/** Same palette as TicketsTable PM period bars (LPG rejection zone colors). */
const PM_PERIOD_BAR_COLORS = [
  "#5e74e9",
  "#282f64",
  "#5b3474",
  "#8a3679",
  "#b63a76",
  "#d94769",
  "#f36355",
  "#1976D2",
  "#388E3C",
  "#0288D1",
  "#F57C00",
  "#8E24AA",
  "#C2185B",
  "#FBC02D",
  "#7986CB",
  "#64B5F6",
  "#BA68C8",
  "#4DD0E1",
  "#7E57C2",
  "#F06292",
  "#E57FC8",
] as const;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const hexToRgb = (hex: string) => {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 128, g: 128, b: 128 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((x) => Math.round(Math.max(0, Math.min(255, x))))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")}`;

const periodBarGradientStops = (baseHex: string) => {
  const { r, g, b } = hexToRgb(baseHex);
  const mix = (t: number) => rgbToHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
  const shade = (f: number) => rgbToHex(r * f, g * f, b * f);
  return { top: mix(0.32), bottom: shade(0.78) };
};

/** Same vertical gradient as period columns (tooltip bg uses fill, not fillGradient on sprite). */
const createPeriodBarGradient = (root: am5.Root, baseHex: string) => {
  const { top, bottom } = periodBarGradientStops(baseHex);
  const gradient = am5.LinearGradient.new(root, {
    stops: [
      { color: am5.color(top) },
      { color: am5.color(bottom) },
    ],
  });
  gradient.set("rotation", 90);
  return gradient;
};

export type PmWeeklyChartPoint = { name: string; value: number };

export type WeekLineSeriesEntry = {
  monthKey: string;
  monthStart: Date;
  label: string;
  dataKey: string;
  points: PmWeeklyChartPoint[];
};

type MergedWeekRow = Record<string, string | number | null>;

/** PM orders by period — column chart with gradient fills; bar click toggles week line month. */
export function PmPeriodBarChartAm5({
  data,
  onBarClick,
}: {
  data: PmWeeklyChartPoint[];
  onBarClick: (periodLabel: string) => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const clickRef = useRef(onBarClick);
  clickRef.current = onBarClick;

  useEffect(() => {
    if (!divRef.current || data.length === 0) return;

    const root = am5.Root.new(divRef.current);
    rootRef.current = root;
    root.setThemes([am5themes_Animated.new(root)]);
    root._logo?.dispose();

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingTop: 8,
        paddingRight: 8,
        paddingBottom: 4,
        paddingLeft: 4,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "name",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 24,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
          stroke: am5.color(0xd1d5db),
          strokeOpacity: 1,
          strokeWidth: 1,
        }),
      })
    );

    const rot = data.length > 8 ? -35 : 0;
    xAxis.get("renderer").labels.template.setAll({
      fontSize: 11,
      fill: am5.color(0x6b7280),
      rotation: rot,
      centerY: am5.p50,
      centerX: rot !== 0 ? am5.p100 : am5.p50,
      oversizedBehavior: "truncate",
      maxWidth: 120,
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        strictMinMax: false,
        renderer: am5xy.AxisRendererY.new(root, {
          stroke: am5.color(0xd1d5db),
          strokeOpacity: 1,
          strokeWidth: 1,
        }),
        numberFormat: "#",
      })
    );
    yAxis.get("renderer").labels.template.setAll({ fontSize: 11, fill: am5.color(0x6b7280) });

    const periodTooltip = am5.Tooltip.new(root, {
      labelText: "[bold]{categoryX}[/]\nOrders: [bold]{valueY}[/]",
      getFillFromSprite: false,
      autoTextColor: false,
    });
    periodTooltip.label.setAll({
      fill: am5.color(0xffffff),
      fontSize: 12,
      paddingTop: 6,
      paddingBottom: 6,
      paddingLeft: 8,
      paddingRight: 8,
      maxWidth: 240,
      oversizedBehavior: "wrap",
    });

    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: "Orders",
        xAxis,
        yAxis,
        valueYField: "value",
        categoryXField: "name",
        tooltip: periodTooltip,
      })
    );

    /** Fixed px width so bars stay the same thickness when the date range adds/removes months (percent width grows with each category cell). */
    series.columns.template.setAll({
      cornerRadiusTL: 10,
      cornerRadiusTR: 10,
      strokeOpacity: 0,
      width: 22,
      tooltipX: 0,
      tooltipPosition: "pointer",
      cursorOverStyle: "pointer",
      interactive: true,
    });

    const periodBaseForTarget = (ctx: { name?: string } | undefined) => {
      const idx = ctx?.name != null ? data.findIndex((d) => d.name === ctx.name) : 0;
      const safe = idx >= 0 ? idx : 0;
      return PM_PERIOD_BAR_COLORS[safe % PM_PERIOD_BAR_COLORS.length];
    };

    /** Solid fill matches bar hue; gradient on tooltip bg often draws black before layout. Sync on tooltipTarget, not pointerover. */
    const syncPeriodTooltipFromTarget = () => {
      const ttTarget = periodTooltip.get("tooltipTarget");
      if (!ttTarget) return;
      const dataItem = ttTarget.dataItem ?? ttTarget.parent?.dataItem;
      const ctx = dataItem?.dataContext as { name?: string } | undefined;
      const base = periodBaseForTarget(ctx);
      const bg = periodTooltip.get("background");
      if (bg) {
        bg.setAll({
          fill: am5.color(base),
          fillOpacity: 1,
          strokeOpacity: 0,
        });
      }
      periodTooltip.label.set("fill", am5.color(0xffffff));
    };

    periodTooltip.on("tooltipTarget", () => {
      syncPeriodTooltipFromTarget();
      root.events.once("frameended", syncPeriodTooltipFromTarget);
    });

    series.columns.template.adapters.add("fillGradient", (_grad, target) => {
      const ctx = target.dataItem?.dataContext as { name?: string } | undefined;
      const base = periodBaseForTarget(ctx);
      return createPeriodBarGradient(root, base);
    });

    xAxis.data.setAll(data);
    series.data.setAll(data);

    series.columns.template.events.on("click", (ev) => {
      const ctx = ev.target.dataItem?.dataContext as { name?: string } | undefined;
      const name = ctx?.name;
      if (name != null && name !== "") clickRef.current(String(name));
    });

    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        xAxis,
        yAxis,
      })
    );

    yAxis.get("renderer").grid.template.setAll({
      strokeOpacity: 0.15,
      strokeDasharray: [3, 3],
      stroke: am5.color(0xe5e7eb),
    });
    xAxis.get("renderer").grid.template.setAll({
      strokeOpacity: 0.15,
      strokeDasharray: [3, 3],
      stroke: am5.color(0xe5e7eb),
    });

    return () => {
      root.dispose();
      rootRef.current = null;
    };
  }, [data]);

  return <div ref={divRef} className="h-64 w-full min-w-0" />;
}

/** PM orders by week — multi-line chart; colors align with period bar month. */
export function PmWeekLineChartAm5({
  mergedData,
  seriesEntries,
  colorForSeries,
}: {
  mergedData: MergedWeekRow[];
  seriesEntries: WeekLineSeriesEntry[];
  colorForSeries: (entry: WeekLineSeriesEntry) => string;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef(colorForSeries);
  colorRef.current = colorForSeries;

  useEffect(() => {
    if (!divRef.current || mergedData.length === 0 || seriesEntries.length === 0) return;

    const manySeries = seriesEntries.length > 5;
    /** Even margins so tooltip positioning stays inside the chart card; layer matches plot bounds. */
    const root = am5.Root.new(divRef.current, {
      ...(manySeries ? { tooltipContainerBounds: { top: 8, left: 8, right: 8, bottom: 8 } } : {}),
    });
    root.setThemes([am5themes_Animated.new(root)]);
    root._logo?.dispose();

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        layout: root.verticalLayout,
        paddingTop: 8,
        paddingRight: 8,
        paddingBottom: 4,
        paddingLeft: 4,
      })
    );

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "name",
        renderer: am5xy.AxisRendererX.new(root, {
          minGridDistance: 24,
          cellStartLocation: 0.1,
          cellEndLocation: 0.9,
          stroke: am5.color(0xd1d5db),
          strokeOpacity: 1,
          strokeWidth: 1,
        }),
      })
    );

    const rot = mergedData.length > 8 ? -35 : 0;
    xAxis.get("renderer").labels.template.setAll({
      fontSize: 11,
      fill: am5.color(0x6b7280),
      rotation: rot,
      centerY: am5.p50,
      centerX: rot !== 0 ? am5.p100 : am5.p50,
      oversizedBehavior: "truncate",
      maxWidth: 120,
      stateAnimationDuration: 0,
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        strictMinMax: false,
        renderer: am5xy.AxisRendererY.new(root, {
          stroke: am5.color(0xd1d5db),
          strokeOpacity: 1,
          strokeWidth: 1,
        }),
        numberFormat: "#",
      })
    );
    yAxis.get("renderer").labels.template.setAll({
      fontSize: 11,
      fill: am5.color(0x6b7280),
      stateAnimationDuration: 0,
    });

    yAxis.get("renderer").grid.template.setAll({
      strokeOpacity: 0.35,
      strokeDasharray: [3, 3],
      stroke: am5.color(0xe5e7eb),
      stateAnimationDuration: 0,
    });
    xAxis.get("renderer").grid.template.setAll({
      strokeOpacity: 0.35,
      strokeDasharray: [3, 3],
      stroke: am5.color(0xe5e7eb),
      stateAnimationDuration: 0,
    });

    const chartData = mergedData.map((row) => {
      const copy: Record<string, string | number | undefined> = { ...row };
      seriesEntries.forEach((s) => {
        const v = copy[s.dataKey];
        if (v === null || v === undefined) {
          copy[s.dataKey] = undefined;
        } else if (typeof v === "number" && !Number.isFinite(v)) {
          copy[s.dataKey] = undefined;
        }
      });
      return copy as Record<string, unknown>;
    });

    xAxis.data.setAll(chartData);

    if (manySeries) {
      xAxis.set("tooltip", am5.Tooltip.new(root, { forceHidden: true }));
      yAxis.set("tooltip", am5.Tooltip.new(root, { forceHidden: true }));
    }

    const weekLineSeries: am5xy.SmoothedXLineSeries[] = [];

    seriesEntries.forEach((s, seriesIndex) => {
      const hex = colorRef.current(s);

      let lineTooltip: am5.Tooltip | undefined;
      if (!manySeries || seriesIndex === 0) {
        lineTooltip = am5.Tooltip.new(root, {
          labelText: manySeries ? "" : `${s.label}\nOrders: {valueY}`,
          getFillFromSprite: false,
          autoTextColor: false,
        });

        if (manySeries && seriesIndex === 0) {
          /** No outer “card”: only colored rows. Table layout avoids flex/scroll bugs that orphan the last row in HTML tooltips. */
          lineTooltip.setAll({
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 0,
            marginBottom: 0,
            centerX: am5.p50,
            centerY: am5.p50,
            /** Flip to keep the box inside the plot; centers on the hovered point. */
            pointerOrientation: "vertical",
            interactive: true,
          });
          lineTooltip.label.setAll({
            fill: am5.color(0xffffff),
            fontSize: 11,
            lineHeight: 1.3,
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 0,
            maxWidth: 136,
            oversizedBehavior: "wrap",
          });
          lineTooltip.label.adapters.add("html", (_html, target) => {
            const dataItem = target.dataItem;
            if (!dataItem) return "";
            const ctx = dataItem.dataContext as Record<string, unknown>;
            const name = ctx.name != null ? String(ctx.name) : "";
            if (!name) return "";
            const row = chartData.find((r) => String(r.name) === name);
            if (!row) return "";
            const tw = 132;
            const rows = seriesEntries
              .map((entry) => {
                const raw = row[entry.dataKey];
                const val =
                  typeof raw === "number" && Number.isFinite(raw) ? raw.toLocaleString() : "—";
                const h = colorRef.current(entry);
                return `<tr><td style="padding:2px 4px;background:${h};color:#fff;font-size:8px;line-height:1.2;border-radius:3px 0 0 3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:50%">${escapeHtml(entry.label)}</td><td style="padding:2px 4px;background:${h};color:#fff;font-size:8px;line-height:1.2;border-radius:0 3px 3px 0;text-align:right;white-space:nowrap;width:50%">Orders: ${val}</td></tr>`;
              })
              .join("");
            return `<div style="box-sizing:border-box;width:${tw}px;max-width:${tw}px;margin:0 auto;max-height:min(218px,52vh);overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;contain:layout;line-height:normal;padding:0"><table role="presentation" style="width:100%;border-collapse:separate;border-spacing:0 2px;table-layout:fixed;font:inherit;line-height:inherit"><tbody>${rows}</tbody></table></div>`;
          });
          const lineTtBg = lineTooltip.get("background");
          if (lineTtBg) {
            lineTtBg.setAll({
              fill: am5.color(0xffffff),
              fillOpacity: 0,
              strokeOpacity: 0,
              strokeWidth: 0,
            });
          }
        } else if (!manySeries) {
          lineTooltip.label.setAll({
            fill: am5.color(0xffffff),
            fontSize: 10,
            lineHeight: 1.25,
            paddingTop: 4,
            paddingBottom: 4,
            paddingLeft: 6,
            paddingRight: 6,
            maxWidth: 140,
            oversizedBehavior: "wrap",
          });
          const lineTtBg = lineTooltip.get("background");
          if (lineTtBg) {
            lineTtBg.setAll({
              fill: am5.color(hex),
              fillOpacity: 1,
              strokeOpacity: 0,
            });
          }
        }
      }

      const lineSeries = chart.series.push(
        am5xy.SmoothedXLineSeries.new(root, {
          name: s.label,
          xAxis,
          yAxis,
          valueYField: s.dataKey,
          categoryXField: "name",
          stroke: am5.color(hex),
          fill: am5.color(hex),
          connect: true,
          /** Monotone curve along weeks — wavy / smooth, not straight segments (like Recharts monotone). */
          tension: 0.45,
          tooltip: lineTooltip,
          ...(manySeries ? { snapTooltip: true } : {}),
        })
      );
      weekLineSeries.push(lineSeries);
      lineSeries.strokes.template.setAll({ strokeWidth: 2 });
      lineSeries.bullets.push(() =>
        am5.Bullet.new(root, {
          sprite: am5.Circle.new(root, {
            radius: 3,
            fill: am5.color(hex),
            stroke: root.interfaceColors.get("background"),
            strokeWidth: 1,
          }),
        })
      );
      lineSeries.data.setAll(chartData);
      /** Staggered draw-in (Recharts-style line animation). */
      lineSeries.appear(1000, 100 + seriesIndex * 60);
    });

    /** Do not call chart.appear() — it animates axes/grids; only line series use appear() above. */

    chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        xAxis,
        yAxis,
        ...(manySeries
          ? {
              snapToSeries: weekLineSeries,
              snapToSeriesBy: "x" as const,
            }
          : {}),
      })
    );

    /** Click plot area to replay line animations. */
    const replayWeekLineAppear = () => {
      weekLineSeries.forEach((ser, i) => {
        ser.appear(900, i * 45);
      });
    };
    const plotClickDisposer = chart.plotContainer.events.on("click", replayWeekLineAppear);

    return () => {
      plotClickDisposer.dispose();
      root.dispose();
    };
  }, [mergedData, seriesEntries]);

  return (
    <div className="flex w-full min-w-0 flex-col gap-0.5 overflow-visible">
      <div ref={divRef} className="relative h-64 w-full min-w-0 overflow-visible" />
      {seriesEntries.length > 0 ? (
        <div
          className={
            seriesEntries.length > 6
              ? "grid w-full grid-cols-6 gap-x-px gap-y-px px-0.5 text-[10px] leading-tight text-gray-700"
              : "flex w-full flex-wrap justify-center gap-x-1 gap-y-1 px-0.5 text-[10px] leading-tight text-gray-700"
          }
        >
          {seriesEntries.map((s) => {
            const hex = colorForSeries(s);
            return (
              <div key={s.dataKey} className="flex min-w-0 max-w-full shrink-0 items-center gap-0.5" title={s.label}>
                <span className="inline-flex shrink-0 items-center" aria-hidden>
                  <svg width="18" height="8" viewBox="0 0 18 8" className="block">
                    <line
                      x1="0"
                      y1="4"
                      x2="18"
                      y2="4"
                      stroke={hex}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray="3 2"
                    />
                    <circle cx="9" cy="4" r="3" fill={hex} stroke="#fff" strokeWidth="1" />
                  </svg>
                </span>
                <span className="min-w-0 truncate">{s.label}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}