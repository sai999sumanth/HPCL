import React, { useCallback, useEffect, useMemo, useState } from "react";
import { buildTwoFyFromSingleFyResponses, getPaDateRange } from "./pa.utils";
import {
  segmentProductCategoryPayload,
  segmentItemPayload,
  segmentMonthlyPayload,
  segmentCategoryMonthlyPayload,
} from "./pa.payloads";
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
  segment: TwoFyRow | null;
  initialCategory?: TwoFyRow | null;
  currentFY: string;
  prevFY: string;
  filters: PAFilterState;
  compareMode?: CompareMode;
}

const PASegmentDrillSheet: React.FC<Props> = ({
  open, onOpenChange, segment, initialCategory, currentFY, prevFY, filters, compareMode = "fy",
}) => {
  const [sheetCategory, setSheetCategory] = useState<TwoFyRow | null>(null);
  const [categoryRows, setCategoryRows] = useState<TwoFyRow[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [itemRows, setItemRows] = useState<TwoFyRow[]>([]);
  const [itemLoading, setItemLoading] = useState(false);

  const loadCategoryRows = useCallback(async (row: TwoFyRow) => {
    setCategoryLoading(true);
    setSheetCategory(null);
    setItemRows([]);
    try {
      const { current, previous } = await postTwoFy(
        (fy) => segmentProductCategoryPayload(fy, row.name, filters, getPaDateRange(fy, compareMode)),
        currentFY,
        prevFY,
      );
      setCategoryRows(
        buildTwoFyFromSingleFyResponses(current, previous, "PRODUCT_CATEGORY"),
      );
    } finally {
      setCategoryLoading(false);
    }
  }, [currentFY, prevFY, filters, compareMode]);

  const handleCategoryClick = useCallback(async (catRow: TwoFyRow) => {
    if (!segment) return;
    setSheetCategory(catRow);
    setItemLoading(true);
    try {
      const { current, previous } = await postTwoFy(
        (fy) => segmentItemPayload(fy, segment.name, catRow.name, filters, getPaDateRange(fy, compareMode)),
        currentFY,
        prevFY,
      );
      setItemRows(buildTwoFyFromSingleFyResponses(current, previous, "MATERIAL_NM"));
    } finally {
      setItemLoading(false);
    }
  }, [segment, currentFY, prevFY, filters, compareMode]);

  useEffect(() => {
    if (open && segment) {
      void loadCategoryRows(segment).then(() => {
        if (initialCategory) void handleCategoryClick(initialCategory);
      });
    }
    if (!open) {
      setSheetCategory(null);
      setCategoryRows([]);
      setItemRows([]);
    }
  }, [open, segment, initialCategory, loadCategoryRows, handleCategoryClick, filters]);

  const buildMonthlyPayload = useMemo(() => {
    if (!segment) return null;
    const active = sheetCategory ?? segment;
    if (sheetCategory) {
      return (fy: string) =>
        segmentCategoryMonthlyPayload(fy, segment.name, active.name, filters, getPaDateRange(fy, compareMode));
    }
    return (fy: string) =>
      segmentMonthlyPayload(fy, active.name, filters, getPaDateRange(fy, compareMode));
  }, [segment, sheetCategory, filters, compareMode]);

  const closeSheet = () => onOpenChange(false);

  if (!segment) return null;

  const active = sheetCategory ?? segment;
  const isCategory = !!sheetCategory;
  const listRows = isCategory ? itemRows : categoryRows;
  const listLoading = isCategory ? itemLoading : categoryLoading;

  return (
    <PASheetRoot open={open} onClose={closeSheet}>
      <PASheetHeader
        badge={isCategory ? "Product category" : "Segment"}
        title={`${active.name}${isCategory ? "" : " Segment"}`}
        isBack={isCategory}
        onAction={() => isCategory ? setSheetCategory(null) : closeSheet()}
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
        title={isCategory ? "Items in this product category" : "Product categories in this segment"}
        count={listRows.length}
        loading={listLoading}
        empty={listRows.length === 0}
      >
        {listRows.map((r) => (
          <PASheetListRow
            key={r.name}
            row={r}
            clickable={!isCategory}
            onClick={!isCategory ? () => void handleCategoryClick(r) : undefined}
          />
        ))}
      </PASheetListSection>
    </PASheetRoot>
  );
};

export default PASegmentDrillSheet;
