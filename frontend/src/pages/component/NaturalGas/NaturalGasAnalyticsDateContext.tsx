import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

export type NgDatePreset = "tdy" | "ydy" | "1w" | "15d" | "1m" | "custom";

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** Inclusive range for presets; `custom` uses the two YYYY-MM-DD strings. */
export function rangeForPreset(
  p: NgDatePreset,
  customFrom?: string,
  customTo?: string
): { dateFrom: string; dateTo: string } {
  const today = todayLocal();
  const to = localYmd(today);

  if (p === "custom" && customFrom && customTo) {
    return customFrom <= customTo
      ? { dateFrom: customFrom, dateTo: customTo }
      : { dateFrom: customTo, dateTo: customFrom };
  }

  if (p === "tdy") return { dateFrom: to, dateTo: to };

  if (p === "ydy") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    const s = localYmd(y);
    return { dateFrom: s, dateTo: s };
  }

  if (p === "1w") {
    const fr = new Date(today);
    fr.setDate(fr.getDate() - 6);
    return { dateFrom: localYmd(fr), dateTo: to };
  }

  if (p === "15d") {
    const fr = new Date(today);
    fr.setDate(fr.getDate() - 14);
    return { dateFrom: localYmd(fr), dateTo: to };
  }

  if (p === "1m") {
    const fr = new Date(today);
    fr.setDate(fr.getDate() - 29);
    return { dateFrom: localYmd(fr), dateTo: to };
  }

  const fr = new Date(today);
  fr.setDate(fr.getDate() - 29);
  return { dateFrom: localYmd(fr), dateTo: to };
}

type Ctx = {
  preset: NgDatePreset;
  dateFrom: string;
  dateTo: string;
  customFrom: string;
  customTo: string;
  setPreset: (p: NgDatePreset) => void;
  setCustomFrom: (v: string) => void;
  setCustomTo: (v: string) => void;
  /** Bumps when the header Refresh is used — refetch data with current range. */
  refreshToken: number;
  refresh: () => void;
};

const NaturalGasAnalyticsDateContext = createContext<Ctx | null>(null);

const initialRange = rangeForPreset("1m");

export const NaturalGasAnalyticsDateProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [preset, setPresetState] = useState<NgDatePreset>("1m");
  const [customFrom, setCustomFromState] = useState(initialRange.dateFrom);
  const [customTo, setCustomToState] = useState(initialRange.dateTo);
  const [refreshToken, setRefreshToken] = useState(0);

  const { dateFrom, dateTo } = useMemo(() => {
    if (preset === "custom" && (!customFrom?.trim() || !customTo?.trim())) {
      return rangeForPreset("1m");
    }
    return rangeForPreset(preset, customFrom, customTo);
  }, [preset, customFrom, customTo]);

  const setPreset = useCallback((p: NgDatePreset) => {
    setPresetState(p);
    if (p !== "custom") {
      const r = rangeForPreset(p);
      setCustomFromState(r.dateFrom);
      setCustomToState(r.dateTo);
    }
  }, []);

  const setCustomFrom = useCallback((v: string) => {
    setPresetState("custom");
    setCustomFromState(v);
  }, []);

  const setCustomTo = useCallback((v: string) => {
    setPresetState("custom");
    setCustomToState(v);
  }, []);

  const refresh = useCallback(() => {
    setRefreshToken((n) => n + 1);
  }, []);

  const value = useMemo(
    () =>
      ({
        preset,
        dateFrom,
        dateTo,
        customFrom,
        customTo,
        setPreset,
        setCustomFrom,
        setCustomTo,
        refreshToken,
        refresh,
      }) satisfies Ctx,
    [
      preset,
      dateFrom,
      dateTo,
      customFrom,
      customTo,
      setPreset,
      setCustomFrom,
      setCustomTo,
      refreshToken,
      refresh,
    ]
  );

  return (
    <NaturalGasAnalyticsDateContext.Provider value={value}>{children}</NaturalGasAnalyticsDateContext.Provider>
  );
};

export function useNaturalGasAnalyticsDate(): Ctx {
  const ctx = useContext(NaturalGasAnalyticsDateContext);
  if (!ctx) {
    throw new Error("useNaturalGasAnalyticsDate must be used under NaturalGasAnalyticsDateProvider");
  }
  return ctx;
}
