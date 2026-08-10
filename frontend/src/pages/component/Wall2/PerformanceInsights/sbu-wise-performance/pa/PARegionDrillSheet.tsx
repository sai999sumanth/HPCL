import React, { useCallback, useMemo, useState } from "react";
import { buildTwoFyFromSingleFyResponses, getPaDateRange } from "./pa.utils";
import { saPayload, distPayload, regionMonthlyPayload, saMonthlyPayload } from "./pa.payloads";
import { postTwoFy } from "./pa.fetchers";
import PASheetMonthlyBreakdown from "./PASheetMonthlyBreakdown";
import {
  PASheetRoot, PASheetHeader, PASheetKpiGrid,
  PASheetListSection, PASheetListRow,
} from "./pa.sheet";
import type { CompareMode } from "./pa.shared";
import type { TwoFyRow, PAFilterState } from "./pa.types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  region: TwoFyRow | null;
  initialSA?: TwoFyRow | null;
  currentFY: string;
  prevFY: string;
  filters: PAFilterState;
  compareMode?: CompareMode;
}

const PARegionDrillSheet: React.FC<Props> = ({ open, onOpenChange, region, initialSA, currentFY, prevFY, filters, compareMode = "fy" }) => {
  const [sheetSA, setSheetSA] = useState<TwoFyRow | null>(null);
  const [saRows, setSaRows] = useState<TwoFyRow[]>([]);
  const [saLoading, setSaLoading] = useState(false);
  const [distRows, setDistRows] = useState<TwoFyRow[]>([]);
  const [distLoading, setDistLoading] = useState(false);

  const loadSaRows = useCallback(async (row: TwoFyRow) => {
    setSaLoading(true);
    setSheetSA(null);
    setDistRows([]);
    try {
      const { current, previous } = await postTwoFy(
        (fy) => saPayload(fy, row.name, filters, getPaDateRange(fy, compareMode)),
        currentFY,
        prevFY,
      );
      setSaRows(buildTwoFyFromSingleFyResponses(current, previous, "ORG_SA_NM"));
    } finally {
      setSaLoading(false);
    }
  }, [currentFY, prevFY, filters, compareMode]);

  const handleSaClick = useCallback(async (saRow: TwoFyRow) => {
    setSheetSA(saRow);
    setDistLoading(true);
    try {
      const { current, previous } = await postTwoFy(
        (fy) => distPayload(fy, saRow.name, filters, getPaDateRange(fy, compareMode)),
        currentFY,
        prevFY,
      );
      setDistRows(buildTwoFyFromSingleFyResponses(current, previous, "NAME1"));
    } finally {
      setDistLoading(false);
    }
  }, [currentFY, prevFY, filters, compareMode]);

  React.useEffect(() => {
    if (open && region) {
      void loadSaRows(region).then(() => {
        if (initialSA) void handleSaClick(initialSA);
      });
    }
    if (!open) {
      setSheetSA(null);
      setSaRows([]);
      setDistRows([]);
    }
  }, [open, region, initialSA, loadSaRows, handleSaClick, filters]);

  const buildMonthlyPayload = useMemo(() => {
    if (!region) return null;
    const active = sheetSA ?? region;
    if (sheetSA) {
      return (fy: string) => saMonthlyPayload(fy, active.name, filters, getPaDateRange(fy, compareMode));
    }
    return (fy: string) => regionMonthlyPayload(fy, active.name, filters, getPaDateRange(fy, compareMode));
  }, [region, sheetSA, filters, compareMode]);

  const closeSheet = () => onOpenChange(false);

  if (!region) return null;

  const active = sheetSA ?? region;
  const isSA = !!sheetSA;
  const listRows = isSA ? distRows : saRows;
  const listLoading = isSA ? distLoading : saLoading;

  return (
    <PASheetRoot open={open} onClose={closeSheet}>
      <PASheetHeader
        badge={isSA ? "Sales Area" : "Region"}
        title={`${active.name}${isSA ? "" : " Region"}`}
        isBack={isSA}
        onAction={() => isSA ? setSheetSA(null) : closeSheet()}
      />

      <PASheetKpiGrid
        currentFY={currentFY}
        prevFY={prevFY}
        currentTotal={active.currentTotal}
        prevTotal={active.prevTotal}
        growthPct={active.growthPct}
      />

      <PASheetMonthlyBreakdown
        open={open}
        buildMonthlyPayload={buildMonthlyPayload}
        currentFY={currentFY}
        prevFY={prevFY}
      />

      <PASheetListSection
        title={isSA ? "Distributors in this Sales Area" : "Sales Areas in this Region"}
        count={listRows.length}
        loading={listLoading}
        empty={listRows.length === 0}
      >
        {listRows.map((r) => (
          <PASheetListRow
            key={r.name}
            row={r}
            clickable={!isSA}
            onClick={!isSA ? () => handleSaClick(r) : undefined}
          />
        ))}
      </PASheetListSection>
    </PASheetRoot>
  );
};

export default PARegionDrillSheet;
