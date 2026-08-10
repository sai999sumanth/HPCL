import React, { useMemo } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/@/components/ui/button";
import type { ConnectionJvRow } from "./connectionDataUtils";
import { convertUTCDateToLocalDate } from "@/hooks/useRelativeTime";

type Props = {
  jv: ConnectionJvRow[];
  /** Section heading above the table */
  jvTitle?: string;
  onRefreshConnections?: () => void;
  connectionsRefreshing?: boolean;
};

function cell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  return String(v);
}

function fmtConnDate(s: string | undefined): string {
  if (!s) return "—";
  const d = s.trim().slice(0, 10);
  if (d.length === 10 && d[4] === "-") return d;
  return s;
}

function fmtDateTime(s: string | undefined): string {
  if (!s) return "—";
  try {
    const utcDate = new Date(s);
    if (Number.isNaN(utcDate.getTime())) return s;
    const localDate = convertUTCDateToLocalDate(utcDate);
    return localDate.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  } 
  catch {
    return s;
  }
}

/** Prefer GA / GV names from GV API; fall back to legacy upload columns. */
function rowGaName(row: ConnectionJvRow): string {
  return row.ga_name ?? row.ga_area ?? "—";
}

function rowGvName(row: ConnectionJvRow): string {
  return row.gv_name ?? row.jv_name ?? "—";
}

const tableScrollWrapJv =
  "max-h-[min(420px,55vh)] w-full overflow-auto rounded-md border border-gray-200 bg-white";
const tableClass = "w-full min-w-0 border-collapse text-sm";
const th =
  "sticky top-0 z-[1] border border-gray-200 bg-gray-100 px-2 py-1.5 text-left text-xs font-semibold text-gray-800";
const td = "border border-gray-200 px-2 py-1.5 text-xs text-gray-900";

export const ConnectionPreviewTables: React.FC<Props> = ({
  jv,
  jvTitle = "Natural Gas Connections",
  onRefreshConnections,
  connectionsRefreshing = false,
}) => {
  const jvRows = useMemo(() => jv ?? [], [jv]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-800">{jvTitle}</h3>
          {onRefreshConnections ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={connectionsRefreshing}
              onClick={() => void onRefreshConnections()}
            >
              {connectionsRefreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              )}
              <span className="ml-1.5">Refresh</span>
            </Button>
          ) : null}
        </div>
        <div className={tableScrollWrapJv}>
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={th}>GA name</th>
                <th className={th}>GV name</th>
                <th className={th}>Conn date</th>
                <th className={th}>Day-wise target</th>
                <th className={th}>Achieved</th>
                <th className={th}>Backlog LMC</th>
                <th className={th}>Backlog NGC</th>
                <th className={th}>ID</th>
                <th className={th}>Entity ID</th>
                <th className={th}>Created</th>
                <th className={th}>Updated</th>
              </tr>
            </thead>
            <tbody>
              {jvRows.length === 0 ? (
                <tr>
                  <td className={td} colSpan={11}>
                    No rows.
                  </td>
                </tr>
              ) : (
                jvRows.map((row, i) => (
                  <tr key={row.id != null ? `gv-${row.id}` : `row-${i}`}>
                    <td className={td}>{rowGaName(row)}</td>
                    <td className={td}>{rowGvName(row)}</td>
                    <td className={td}>{fmtConnDate(row.conn_date)}</td>
                    <td className={`${td} tabular-nums`}>{cell(row.day_wise_target)}</td>
                    <td className={`${td} tabular-nums`}>{cell(row.achieved_count)}</td>
                    <td className={`${td} tabular-nums`}>{cell(row.backlog_lmc)}</td>
                    <td className={`${td} tabular-nums`}>{cell(row.backlog_ngc)}</td>
                    <td className={`${td} font-mono text-[11px]`}>{cell(row.id)}</td>
                    <td className={`${td} font-mono text-[11px]`}>{cell(row.entity_id)}</td>
                    <td className={td}>{fmtDateTime(row.created_at)}</td>
                    <td className={td}>{fmtDateTime(row.updated_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
