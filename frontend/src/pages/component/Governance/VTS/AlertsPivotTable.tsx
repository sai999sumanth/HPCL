import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import { Plus, Minus } from "lucide-react";
import { Button } from "@/@/components/ui/button";

interface StatusCounts {
  total: number;
  blocked: number;
  auto_unblock: number;
  manual_unblock: number;
}

export interface InstancePivotData {
  instance: string;
  groups: { [key: string]: StatusCounts };
  total: StatusCounts;
}

export interface Column {
  id: string;
  name: string;
}

interface AlertsPivotTableProps {
  data: InstancePivotData[];
  columns: Column[];
}

const AlertsPivotTable: React.FC<AlertsPivotTableProps> = ({ data, columns }) => {
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  const tableScrollOuterRef = useRef<HTMLDivElement>(null);
  const tableScrollInnerRef = useRef<HTMLDivElement>(null);
  const hCustomTrackRef = useRef<HTMLDivElement>(null);
  const [hScrollMetrics, setHScrollMetrics] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
    trackWidth: 0,
  });

  const updateHScrollMetrics = useCallback(() => {
    const inner = tableScrollInnerRef.current;
    const track = hCustomTrackRef.current;
    if (!inner) return;
    setHScrollMetrics({
      scrollLeft: inner.scrollLeft,
      scrollWidth: inner.scrollWidth,
      clientWidth: inner.clientWidth,
      trackWidth: track?.clientWidth ?? inner.clientWidth,
    });
  }, []);

  const handleHThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const inner = tableScrollInnerRef.current;
    const track = hCustomTrackRef.current;
    if (!inner || !track) return;
    const maxScroll = Math.max(0, inner.scrollWidth - inner.clientWidth);
    if (maxScroll <= 0) return;
    const trackW = track.clientWidth;
    const thumbW = Math.max(40, (inner.clientWidth / inner.scrollWidth) * trackW);
    const movable = Math.max(1, trackW - thumbW);
    const startX = e.clientX;
    const startScroll = inner.scrollLeft;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      inner.scrollLeft = Math.min(maxScroll, Math.max(0, startScroll + (dx / movable) * maxScroll));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const handleHTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).dataset.thumb === "true") return;
    const inner = tableScrollInnerRef.current;
    const track = hCustomTrackRef.current;
    if (!inner || !track) return;
    const maxScroll = Math.max(0, inner.scrollWidth - inner.clientWidth);
    if (maxScroll <= 0) return;
    const rect = track.getBoundingClientRect();
    const trackW = track.clientWidth;
    const thumbW = Math.max(40, (inner.clientWidth / inner.scrollWidth) * trackW);
    const movable = Math.max(1, trackW - thumbW);
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, (x - thumbW / 2) / movable));
    inner.scrollLeft = ratio * maxScroll;
  };

  useEffect(() => {
    const inner = tableScrollInnerRef.current;
    const outer = tableScrollOuterRef.current;
    const track = hCustomTrackRef.current;
    if (!inner) return;
    const ro = new ResizeObserver(() => {
      updateHScrollMetrics();
    });
    ro.observe(inner);
    if (outer) ro.observe(outer);
    if (track) ro.observe(track);
    window.addEventListener("resize", updateHScrollMetrics);
    const raf = requestAnimationFrame(() => {
      updateHScrollMetrics();
      const t = hCustomTrackRef.current;
      if (t) ro.observe(t);
    });
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", updateHScrollMetrics);
    };
  }, [updateHScrollMetrics, data, columns, expandedRows]);

  useLayoutEffect(() => {
    updateHScrollMetrics();
  }, [updateHScrollMetrics, data, columns, expandedRows]);

  const toggleRow = (instance: string) => {
    setExpandedRows((prev) =>
      prev.includes(instance) ? prev.filter((v) => v !== instance) : [...prev, instance]
    );
  };

  const renderSubRow = (
    label: string,
    key: "blocked" | "auto_unblock" | "manual_unblock",
    instanceData: InstancePivotData
  ) => {
    const labelStyle = {
      blocked: "text-red-500",
      auto_unblock: "text-green-500",
      manual_unblock: "text-orange-500",
    };

    return (
      <tr key={`${instanceData.instance}-${key}`} className="bg-gray-50/50 hover:bg-gray-100/80">
        <td className="py-2 pl-12 pr-2 text-xs bg-gray-50/50 sticky left-0 z-20 border-r border-gray-200">
          <span className={labelStyle[key]}>{label}</span>
        </td>
        {columns.map((col) => (
          <td key={col.id} className="p-2 text-center text-xs text-gray-600">
            {instanceData.groups[col.id]?.[key].toLocaleString() ?? 0}
          </td>
        ))}
        <td className="p-2 text-center text-xs font-medium text-gray-800 bg-gray-50/50 sticky right-0 z-20 border-l border-gray-200">
          {instanceData.total[key].toLocaleString()}
        </td>
      </tr>
    );
  };

  const { scrollLeft, scrollWidth, clientWidth, trackWidth } = hScrollMetrics;
  const tw = Math.max(trackWidth || 1, 1);
  const sw = Math.max(scrollWidth, 1);
  const maxScroll = Math.max(0, scrollWidth - clientWidth);
  const thumbW = maxScroll <= 0 ? tw : Math.max(40, (clientWidth / sw) * tw);
  const thumbLeft = maxScroll <= 0 ? 0 : (scrollLeft / maxScroll) * Math.max(1, tw - thumbW);

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-lg border bg-white">
      <div
        ref={tableScrollOuterRef}
        className="vts-alerts-summary-pivot-scroll min-h-0 min-w-0 w-full max-h-[60vh] overflow-y-auto overflow-x-hidden"
      >
        <div
          ref={tableScrollInnerRef}
          onScroll={updateHScrollMetrics}
          className="vts-alerts-summary-pivot-h-inner min-w-0 w-full overflow-x-auto"
        >
          <table className="min-w-max text-sm border-collapse">
            <thead className="sticky top-0 z-30 bg-gray-100">
              <tr>
                <th className="sticky left-0 z-40 w-64 border-r border-gray-300 bg-gray-100 p-2 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                  Instance
                </th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className="min-w-[150px] p-2 text-center text-xs font-bold uppercase tracking-wider text-gray-500"
                  >
                    {col.name}
                  </th>
                ))}
                <th className="sticky right-0 z-40 min-w-[100px] border-l border-gray-300 bg-gray-100 p-2 text-center text-xs font-bold uppercase tracking-wider text-gray-500">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((item) => {
                const isExpanded = expandedRows.includes(item.instance);
                return (
                  <React.Fragment key={item.instance}>
                    <tr className="hover:bg-blue-50">
                      <td className="sticky left-0 z-20 border-r border-gray-200 bg-white p-2 whitespace-nowrap">
                        <div className="flex items-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => toggleRow(item.instance)}
                          >
                            {isExpanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          </Button>
                          <span className="ml-2 font-semibold text-gray-800">{item.instance}</span>
                        </div>
                      </td>
                      {columns.map((col) => (
                        <td key={col.id} className="p-2 text-center font-medium text-gray-700">
                          {item.groups[col.id]?.total.toLocaleString() ?? 0}
                        </td>
                      ))}
                      <td className="sticky right-0 z-20 border-l border-gray-200 bg-white p-2 text-center font-bold text-blue-700">
                        {item.total.total.toLocaleString()}
                      </td>
                    </tr>
                    {isExpanded && (
                      <>
                        {renderSubRow("Blocked", "blocked", item)}
                        {renderSubRow("Auto Unblock", "auto_unblock", item)}
                        {renderSubRow("Manual Unblock", "manual_unblock", item)}
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div
        ref={hCustomTrackRef}
        className="vts-alerts-summary-pivot-h-mirror relative h-3.5 w-full shrink-0 cursor-pointer select-none border-t border-gray-200 bg-gray-200"
        onClick={handleHTrackClick}
        role="presentation"
      >
        <div
          data-thumb="true"
          className="pointer-events-auto absolute top-0.5 bottom-0.5 rounded bg-gray-500 shadow hover:bg-gray-600"
          style={{
            width: `${thumbW}px`,
            left: `${thumbLeft}px`,
            minWidth: 40,
          }}
          onMouseDown={handleHThumbMouseDown}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
};

export default AlertsPivotTable;
