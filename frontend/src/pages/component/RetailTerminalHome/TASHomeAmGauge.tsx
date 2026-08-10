/**
 * TAS home gauge: same `get_pi_score` request and TAS normalization as `TASScoreCard`,
 * needle shows **average TAS %** across plants (non-zero scores only).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5radar from "@amcharts/amcharts5/radar";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/@/components/ui/table";
import { apiClient } from "@/services/apiClient";
import useAuthStore from "@/store/authStore";

const CHART_CONTAINER_ID = "tas-home-gauge-chartdiv";

/** First non-empty zone / SAP from session — same as Terminal Home / `TASScoreCard`. */
function firstUserScopeToken(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) {
    for (const x of v) {
      const s = String(x).trim();
      if (s) return s;
    }
    return "";
  }
  return String(v).trim();
}

export interface TASHomeAmGaugeProps {
  locationFilter?: {
    zone: string | null;
    plant: string | null;
  };
  /** Kept for API parity; payload always uses `TAS`. */
  bu: string;
  timeFilter?: string | null;
  dateRangeFilter?: { value?: string } | null;
  height?: number;
  /** Bump when parent refreshes (same idea as `TASScoreCard` `refreshTrigger`). */
  refreshTrigger?: number;
}

type PlantTasRow = { location: string; zone: string; score: number };

/** Same row transform as `TASScoreCard` (TAS category → % of weightage). */
function mapApiRowToTasPercent(item: any, index: number): PlantTasRow {
  const tasCategory = item.category?.find((cat: any) => cat.name === "TAS");
  let tasScore = 0;
  let tasWeightage = 20;
  if (tasCategory && tasCategory.score !== undefined) {
    tasScore = tasCategory.score;
    tasWeightage = tasCategory.weightage || 20;
  } else {
    tasScore = item.overall_oi_score ?? item.score ?? 0;
  }
  const normalizedScore = tasWeightage > 0 ? (tasScore / tasWeightage) * 100 : 0;
  return {
    location: item.name || item.location || `Location ${index + 1}`,
    zone: item.zone || "",
    score: Math.round(normalizedScore * 100) / 100,
  };
}

const TASHomeAmGauge: React.FC<TASHomeAmGaugeProps> = ({
  bu: _bu,
  locationFilter = { zone: null, plant: null },
  timeFilter: _timeFilter,
  dateRangeFilter,
  height: chartHeight = 300,
  refreshTrigger = 0,
}) => {
  const user = useAuthStore((s) => s.user);
  const sessionZone = useMemo(() => firstUserScopeToken(user?.zone), [user?.zone]);
  const sessionSap = useMemo(() => firstUserScopeToken(user?.sap_id), [user?.sap_id]);

  const [tasAverageScore, setTasAverageScore] = useState<number | null>(null);
  const [plantRows, setPlantRows] = useState<PlantTasRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const chartDivRef = useRef<HTMLDivElement>(null);
  const chartRootRef = useRef<am5.Root | null>(null);

  useEffect(() => {
    const fetchLikeScoreCard = async () => {
      try {
        setIsLoading(true);
        setError(null);

        let defaultStartDate: string;
        let defaultEndDate: string;

        if (dateRangeFilter?.value) {
          const parts = dateRangeFilter.value.split(",");
          defaultStartDate = parts[0] || new Date().toISOString().split("T")[0];
          defaultEndDate = parts[1] || defaultStartDate;
        } else {
          defaultStartDate = new Date().toISOString().split("T")[0];
          defaultEndDate = defaultStartDate;
        }

        const zoneFromUi = (locationFilter?.zone ?? "").toString().trim();
        const sapFromUi = (locationFilter?.plant ?? "").toString().trim();
        const zone = zoneFromUi || sessionZone;
        const sap_id = sapFromUi || sessionSap;

        const payload = {
          bu: "TAS",
          category: "",
          region: "",
          zone,
          sap_id,
          strategy: "",
          filters: [
            {
              key: "created_at",
              cond: "date_filter",
              value: `${defaultStartDate},${defaultEndDate}`,
              val: "",
            },
          ],
          is_plant: true,
        };

        const response = await apiClient.post("/api/performanceindex/get_pi_score", payload);

        const apiData = response?.data;
        let dataArray: any[] = Array.isArray(apiData)
          ? apiData
          : typeof apiData === "object" && apiData !== null
            ? Object.values(apiData)
            : [];

        if (dataArray.length === 0) {
          setTasAverageScore(null);
          setPlantRows([]);
          setError("No data");
          return;
        }

        const transformed = dataArray.map((item: any, index: number) => mapApiRowToTasPercent(item, index));
        const nonZero = transformed.filter((row) => (row.score ?? 0) > 0);

        if (nonZero.length === 0) {
          setTasAverageScore(null);
          setPlantRows([]);
          setError("No data");
          return;
        }

        const total = nonZero.reduce((sum, item) => sum + (item.score || 0), 0);
        const avg = Math.round((total / nonZero.length) * 100) / 100;

        setTasAverageScore(avg);
        setPlantRows(nonZero);
        setError(null);
      } catch (err) {
        console.error("TASHomeAmGauge fetch error:", err);
        setError("Failed to fetch data");
        setTasAverageScore(null);
        setPlantRows([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchLikeScoreCard();
  }, [
    dateRangeFilter?.value,
    sessionZone,
    sessionSap,
    locationFilter?.zone,
    locationFilter?.plant,
    refreshTrigger,
  ]);

  useEffect(() => {
    if (chartRootRef.current) {
      chartRootRef.current.dispose();
      chartRootRef.current = null;
    }

    if (isLoading || error || tasAverageScore === null) {
      return;
    }

    const score = tasAverageScore;
    if (typeof score !== "number" || Number.isNaN(score)) {
      return;
    }

    try {
      if (!chartDivRef.current) {
        return;
      }
      const root = am5.Root.new(CHART_CONTAINER_ID);
      chartRootRef.current = root;

      root._logo?.dispose();
      root.setThemes([am5themes_Animated.new(root)]);

      const chart = root.container.children.push(
        am5radar.RadarChart.new(root, {
          panX: false,
          panY: false,
          startAngle: -180,
          endAngle: 0,
          innerRadius: -20,
        })
      );

      chart.set("cursor", am5radar.RadarCursor.new(root, {}));
      chart.events.on("click", () => {
        setDialogOpen(true);
      });

      const axisRenderer = am5radar.AxisRendererCircular.new(root, {
        strokeOpacity: 0.1,
        minGridDistance: 30,
      });

      axisRenderer.ticks.template.setAll({
        visible: true,
        strokeOpacity: 0.5,
      });

      axisRenderer.grid.template.setAll({
        visible: false,
      });

      const axis = chart.xAxes.push(
        am5xy.ValueAxis.new(root, {
          maxDeviation: 0,
          min: 0,
          max: 100,
          strictMinMax: true,
          renderer: axisRenderer,
        })
      );

      const getScoreColor = (value: number) => {
        if (value >= 95) return am5.color(0xe1af0f);
        if (value >= 85) return am5.color(0x5294ce);
        return am5.color(0xff7f7f);
      };

      const createGaugeRange = (start: number, end: number, color: am5.Color) => {
        const rangeDataItem = axis.makeDataItem({
          value: start,
          endValue: end,
        });

        axis.createAxisRange(rangeDataItem);

        rangeDataItem.get("axisFill")?.setAll({
          visible: true,
          fill: color,
          fillOpacity: 0.9,
        });

        rangeDataItem.get("tick")?.setAll({
          visible: false,
        });

        rangeDataItem.get("label")?.setAll({
          visible: false,
        });
      };

      createGaugeRange(0, 85, am5.color(0xff7f7f));
      createGaugeRange(85, 95, am5.color(0x5294ce));
      createGaugeRange(95, 99, am5.color(0xe1af0f));
      createGaugeRange(99, 100, am5.color(0x98c489));

      const handDataItem = axis.makeDataItem({
        value: score,
      });

      handDataItem.set(
        "bullet",
        am5xy.AxisBullet.new(root, {
          location: 0,
          sprite: am5radar.ClockHand.new(root, {
            radius: am5.percent(70),
            pinRadius: 8,
            bottomWidth: 3,
          }),
        })
      );

      axis.createAxisRange(handDataItem);

      chart.children.unshift(
        am5.Label.new(root, {
          text: score.toFixed(2),
          fontSize: 28,
          fontWeight: "bold",
          textAlign: "center",
          centerX: am5.p50,
          centerY: am5.p100,
          x: am5.p50,
          y: am5.p50,
          fill: getScoreColor(score),
        })
      );

      chart.children.each((child) => {
        child.set("cursorOverStyle", "pointer");
      });

      chart.children.push(
        am5.Label.new(root, {
          text: "Click for details",
          fontSize: 12,
          fontStyle: "italic",
          textAlign: "center",
          centerX: am5.p50,
          x: am5.p50,
          y: -10,
          fill: am5.color(0x555555),
        })
      );
    } catch (err) {
      console.error("Error creating chart:", err);
      setError("Failed to render chart");
    }

    return () => {
      if (chartRootRef.current) {
        chartRootRef.current.dispose();
        chartRootRef.current = null;
      }
    };
  }, [isLoading, error, tasAverageScore]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading TAS average...</div>;
  }

  if (error || tasAverageScore === null) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="text-sm text-gray-500">No data available</div>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-0">
        <div className="text-gray-800 text-sm font-bold rounded-full px-3 py-1">TAS average</div>
      </div>

      <div
        id={CHART_CONTAINER_ID}
        ref={chartDivRef}
        style={{ width: "100%", height: `${chartHeight}px`, cursor: "pointer" }}
      />

      <div className="flex justify-between items-center mb-0">
        <div className="w-full">
          <div className="flex gap-4 justify-center content-center item-center flex-wrap">
            <div className="flex gap-2 justify-center content-center">
              <span className="flex bg-[#FF7F7F] p-1 justify-center rounded-full"></span>
              <span className="text-sm md:text-xs">Others(0-85)</span>
            </div>
            <div className="flex gap-2 justify-center content-center">
              <span className="flex bg-[#5294ce] p-1 justify-center rounded-full"></span>
              <span className="text-sm md:text-xs">Silver(85-95)</span>
            </div>
            <div className="flex gap-2 justify-center content-center">
              <span className="flex bg-[#e1af0f] p-1 justify-center rounded-full"></span>
              <span className="text-sm md:text-xs">Gold(95-99)</span>
            </div>
            <div className="flex gap-2 justify-center content-center">
              <span className="flex bg-[#98c489] p-1 justify-center rounded-full"></span>
              <span className="text-sm md:text-xs">Platinum(100)</span>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>TAS average — plant breakdown</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="mb-4 text-center">
              <div className="text-lg font-semibold">Average TAS score</div>
              <div className="text-3xl font-bold">{tasAverageScore.toFixed(2)}%</div>
              <div className="text-xs text-muted-foreground mt-1">
                Mean of normalized TAS % across {plantRows.length} plant
                {plantRows.length === 1 ? "" : "s"} (same logic as TAS Score card)
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead className="text-right">TAS %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plantRows.map((row, idx) => (
                  <TableRow key={`tas-gauge-plant-${idx}-${row.location}`}>
                    <TableCell className="font-medium">{row.location}</TableCell>
                    <TableCell>{row.zone || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.score.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TASHomeAmGauge;
