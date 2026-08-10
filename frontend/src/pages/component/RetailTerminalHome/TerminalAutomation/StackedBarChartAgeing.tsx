




"use client"

import React, { useState, useEffect, useMemo } from "react"
import { fetchTerminalData } from "../../RetailTerminalHome/ApiServiceFile"

interface AlertData {
  bu: string
  alert_section: string
  alert_ageing: string
  alert_count: number
  alert_ageing_order: number
}

interface StackedBarChartProps {
  bu: string
  alert_section?: string
  height?: number
  timeFilter?: string
  alertStatus?: string
  locationFilter?: {
    zone: string | null
    plant: string | null
  }
}

type AgeingRow = {
  alert_ageing: string
  alert_ageing_order: number
  [section: string]: string | number
}

function isCriticalAgeingLabel(label: string): boolean {
  const t = label.trim().toLowerCase()
  return (
    />\s*10\b/.test(t) ||
    /10\s*\+/.test(t) ||
    /more\s*than\s*10/.test(t) ||
    />\s*10\s*day/.test(t) ||
    /older\s*than\s*10/.test(t) ||
    /above\s*10\s*day/.test(t)
  )
}

function formatAgeingLabelForDisplay(raw: string): string {
  const t = raw.trim()
  if (isCriticalAgeingLabel(t)) return "> 10 Days"
  return t
}

const PRIMARY_BLUE = "#5D8BF4"
/** Unfilled portion of the bar — neutral grey so the blue fill reads as partial width */
const BAR_TRACK_GREY = "#E5E7EB"

const StackedBarChartAgeing: React.FC<StackedBarChartProps> = ({
  bu,
  timeFilter,
  locationFilter,
  alertStatus = "Open",
  alert_section,
  height: _height = 210,
}) => {
  const [chartData, setChartData] = useState<AgeingRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)

        let locationFilterObj = {
          ...(locationFilter?.zone && { zone: locationFilter.zone }),
          ...(locationFilter?.plant && { plant: locationFilter.plant }),
        }

        const sap_id = localStorage.getItem("sapId")
        const zone = localStorage.getItem("zone")

        if (sap_id || zone) {
          locationFilterObj = {
            zone: zone,
            plant: sap_id,
          }
        }

        const response = await fetchTerminalData(
          "alert_ageing",
          bu,
          alert_section,
          alertStatus,
          timeFilter,
          "equals",
          locationFilterObj,
        )

        const transformedData = response.data.reduce((acc: AgeingRow[], item: AlertData) => {
          const existingItem = acc.find((x) => x.alert_ageing === item.alert_ageing)

          if (existingItem) {
            const key = item.alert_section
            existingItem[key] = (Number(existingItem[key]) || 0) + item.alert_count
            existingItem.alert_ageing_order = Math.min(
              existingItem.alert_ageing_order,
              item.alert_ageing_order,
            )
          } else {
            acc.push({
              alert_ageing: item.alert_ageing,
              alert_ageing_order: item.alert_ageing_order,
              [item.alert_section]: item.alert_count,
            })
          }

          return acc
        }, [])

        transformedData.sort((a, b) => a.alert_ageing_order - b.alert_ageing_order)
        setChartData(transformedData)
        setIsLoading(false)
      } catch (err) {
        console.error("Error fetching data:", err)
        setError("Failed to fetch chart data")
        setIsLoading(false)
      }
    }

    fetchData()
  }, [bu, timeFilter, locationFilter, alertStatus, alert_section])

  const sectionKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const row of chartData) {
      for (const k of Object.keys(row)) {
        if (k !== "alert_ageing" && k !== "alert_ageing_order") keys.add(k)
      }
    }
    return [...keys]
  }, [chartData])

  const rowTotals = useMemo(() => {
    return chartData.map((row) =>
      sectionKeys.reduce((sum, key) => sum + (Number(row[key]) || 0), 0),
    )
  }, [chartData, sectionKeys])

  const maxTotal = useMemo(() => Math.max(1, ...rowTotals, 1), [rowTotals])

  /** ≤6 rows: equal-height grid fills card (no dead space at bottom); >6: stacked + scroll */
  const fillCardHeight = chartData.length > 0 && chartData.length <= 6
  const gridRowsStyle = fillCardHeight
    ? ({ gridTemplateRows: `repeat(${chartData.length}, minmax(0, 1fr))` } as React.CSSProperties)
    : undefined

  /* ── Skeleton loader ── */
  if (isLoading) {
    return (
      <div className="w-full flex flex-col h-full">
        {/* Header skeleton */}
        <div className="flex items-center gap-2 mb-3 mt-1">
          <div className="h-3 w-3 rounded-full bg-gray-200 animate-pulse" />
          <div className="h-3.5 w-40 rounded bg-gray-200 animate-pulse" />
        </div>
        {/* Bar skeletons */}
        <div className="flex flex-col gap-3">
          {[80, 60, 45, 70, 35].map((w, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <div className="h-3 w-20 rounded bg-gray-200 animate-pulse" />
                <div className="h-5 w-16 rounded-full bg-gray-200 animate-pulse" />
              </div>
              <div className="h-2 w-full rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-gray-200 animate-pulse"
                  style={{ width: `${w}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="w-full flex flex-col h-full">
        <HeaderBlock alertStatus={alertStatus} alert_section={alert_section} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#EF4444" strokeWidth="1.5" />
              <path d="M8 4.5v4M8 10.5v1" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        </div>
      </div>
    )
  }

  /* ── Empty state ── */
  if (chartData.length === 0) {
    return (
      <div className="w-full flex flex-col h-full">
        <HeaderBlock alertStatus={alertStatus} alert_section={alert_section} />
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4">
       
          <span className="text-xs text-gray-400 font-medium">No ageing data available</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <HeaderBlock alertStatus={alertStatus} alert_section={alert_section} />

      {/* Grid (≤6): equal rows fill remaining height; flex (>6): scroll */}
      <div
        className={
          "ageing-rows-scroll min-h-0 flex-1 gap-1.5 overflow-x-hidden py-0 " +
          (fillCardHeight
            ? "grid overflow-hidden"
            : "flex flex-col overflow-y-auto")
        }
        style={{ scrollbarWidth: "none", ...gridRowsStyle }}
      >
        {chartData.map((row, index) => {
          const total = rowTotals[index] ?? 0
          const widthPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0
          const labelRaw = row.alert_ageing
          const label = formatAgeingLabelForDisplay(labelRaw)
          const critical = isCriticalAgeingLabel(labelRaw)

          return (
            <div
              key={index}
              className={
                "flex min-h-0 flex-col gap-1 " +
                (fillCardHeight ? "h-full justify-center" : "")
              }
              style={{ animation: `fadeUp 0.35s ease both`, animationDelay: `${index * 35}ms` }}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex min-w-0 items-center gap-1">
                  <span
                    className="h-1 w-1 shrink-0 rounded-full"
                    style={{ background: critical ? "#EF4444" : PRIMARY_BLUE }}
                  />
                  <span
                    className="truncate text-[11px] font-medium leading-tight"
                    style={{ color: critical ? "#B91C1C" : "#374151" }}
                  >
                    {label}
                  </span>
                </div>

                <span
                  className="shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold tabular-nums"
                  style={
                    critical
                      ? {
                          color: "#DC2626",
                          background: "#FEF2F2",
                          border: "1px solid #FECACA",
                          boxShadow: "0 1px 2px rgba(220,38,38,0.08)",
                        }
                      : {
                          color: PRIMARY_BLUE,
                          background: "#EFF6FF",
                          border: "1px solid #BFDBFE",
                          boxShadow: "0 1px 2px rgba(93,139,244,0.08)",
                        }
                  }
                >
                  {total.toLocaleString()} alerts
                </span>
              </div>

              <div
                className="relative h-1.5  w-full overflow-hidden rounded-full"
                style={{ background: BAR_TRACK_GREY }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${widthPct}%`,
                    background: critical ? "#DC2626" : PRIMARY_BLUE,
                    boxShadow: critical
                      ? "0 0 6px rgba(220,38,38,0.3)"
                      : "0 0 6px rgba(93,139,244,0.25)",
                    transition: "width 0.6s cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ageing-rows-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}

/* ── Shared header ── */
const HeaderBlock = ({
  alertStatus,
  alert_section,
}: {
  alertStatus?: string
  alert_section?: string
}) => (
  <div className="mb-1 shrink-0 leading-none">
    <h3 className="text-[13px] font-bold leading-tight text-gray-800">
      {alertStatus} Alert Ageing {alert_section ? `— ${alert_section}` : ""}
    </h3>
  </div>
)

export default StackedBarChartAgeing