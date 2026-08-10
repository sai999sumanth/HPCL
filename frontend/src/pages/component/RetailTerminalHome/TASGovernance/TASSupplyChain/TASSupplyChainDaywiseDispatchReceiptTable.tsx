import React, { useMemo } from 'react';

type DaywiseTrendInputRow = {
  date_time?: string;
  day?: string;
  date?: string;
  product?: string;
  product_name?: string;
  product_grp?: string;
  dispatch?: number | string;
  tank_dispatch?: number | string;
  dispatch_qty?: number | string;
  total_dispatch?: number | string;
  reciept?: number | string;
  receipt?: number | string;
};

type DaywiseTableRow = {
  day: string;
  dispatch: number;
  reciept: number;
};

type Props = {
  rows: DaywiseTrendInputRow[];
  isLoading: boolean;
  selectedProduct: string;
};

function normalizeDayLabel(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '-';
  const firstPart = raw.split(' ')[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(firstPart)) return firstPart.slice(0, 10);
  const parsed = new Date(raw.includes(' ') ? raw.replace(' ', 'T') : raw);
  if (!Number.isFinite(parsed.getTime())) return raw;
  return parsed.toISOString().slice(0, 10);
}

function parseNumberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDispatchValue(row: DaywiseTrendInputRow): number {
  const candidate = row.dispatch ?? row.tank_dispatch ?? row.dispatch_qty ?? row.total_dispatch ?? 0;
  return parseNumberValue(candidate);
}

function getProductDisplayName(product: string): string {
  const key = product.trim().toUpperCase();
  if (key === 'ETHANOL') return 'ETH';
  if (key === 'BIODIESEL') return 'BD';
  return product;
}

function formatKl(value: number) {
  return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function TASSupplyChainDaywiseDispatchReceiptTable({
  rows,
  isLoading,
  selectedProduct,
}: Props) {
  const tableRows = useMemo(() => {
    if (!selectedProduct) return [] as DaywiseTableRow[];

    const grouped = new Map<string, DaywiseTableRow>();

    rows.forEach((row) => {
      const day = normalizeDayLabel(row.date_time ?? row.day ?? row.date);
      if (day === '-') return;

      const productRaw = String(row.product ?? row.product_name ?? row.product_grp ?? 'Unknown').trim() || 'Unknown';
      const product = getProductDisplayName(productRaw);
      if (product !== selectedProduct) return;

      const dispatch = parseDispatchValue(row);
      const reciept = parseNumberValue(row.reciept ?? row.receipt);
      const previous = grouped.get(day);

      if (!previous) {
        grouped.set(day, { day, dispatch, reciept });
        return;
      }

      grouped.set(day, {
        day,
        dispatch: previous.dispatch + dispatch,
        reciept: previous.reciept + reciept,
      });
    });

    return Array.from(grouped.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [rows, selectedProduct]);

  if (isLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
        <div className="flex flex-col items-center gap-2">
          <svg className="h-6 w-6 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span>Loading table data...</span>
        </div>
      </div>
    );
  }

  if (!tableRows.length) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
        No trend data available
      </div>
    );
  }

  return (
    <div className="h-[300px] overflow-auto rounded-md border border-slate-200">
      <table className="w-full min-w-[320px] border-collapse text-[11px]">
        <thead className="sticky top-0 z-[1] bg-slate-50">
          <tr>
            <th className="border-b border-slate-200 px-2 py-1.5 text-left font-semibold text-slate-700">Date</th>
            <th className="border-b border-slate-200 px-2 py-1.5 text-right font-semibold text-blue-600">
              Dispatch (KL)
            </th>
            <th className="border-b border-slate-200 px-2 py-1.5 text-right font-semibold text-green-600">
              Receipt (KL)
            </th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row) => (
            <tr key={row.day} className="odd:bg-white even:bg-slate-50/70">
              <td className="border-b border-slate-100 px-2 py-1 text-slate-800">{row.day}</td>
              <td className="border-b border-slate-100 px-2 py-1 text-right font-medium text-slate-900">
                {formatKl(row.dispatch)}
              </td>
              <td className="border-b border-slate-100 px-2 py-1 text-right font-medium text-slate-900">
                {formatKl(row.reciept)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
