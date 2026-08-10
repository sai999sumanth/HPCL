import type { AmPm, BreakPeriod, ShiftTiming, Time12h } from '../types';

export function normalizeTime12h(time: Partial<Time12h> & { period?: AmPm }): Time12h {
  return {
    hour: Math.min(12, Math.max(1, time.hour || 12)),
    minute: Math.min(59, Math.max(0, time.minute ?? 0)),
    second: Math.min(59, Math.max(0, time.second ?? 0)),
    period: time.period === 'PM' ? 'PM' : 'AM',
  };
}

export function formatTime12h(time: Time12h): string {
  const normalized = normalizeTime12h(time);
  return `${normalized.hour}:${String(normalized.minute).padStart(2, '0')}:${String(normalized.second).padStart(2, '0')} ${normalized.period}`;
}

export function parseTime12h(timeStr: string): Time12h {
  const trimmed = timeStr?.trim() ?? '';
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (match) {
    return normalizeTime12h({
      hour: Number(match[1]),
      minute: Number(match[2]),
      second: match[3] ? Number(match[3]) : 0,
      period: match[4].toUpperCase() as AmPm,
    });
  }

  const compactMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(AM|PM)$/i);
  if (compactMatch) {
    return normalizeTime12h({
      hour: Number(compactMatch[1]),
      minute: Number(compactMatch[2]),
      second: compactMatch[3] ? Number(compactMatch[3]) : 0,
      period: compactMatch[4].toUpperCase() as AmPm,
    });
  }

  return { hour: 6, minute: 0, second: 0, period: 'AM' };
}

export function parseApiTime(timeStr: string): Time12h {
  const trimmed = timeStr?.trim() ?? '';
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match24) {
    const hour24 = Number(match24[1]);
    const minute = Number(match24[2]);
    const second = match24[3] ? Number(match24[3]) : 0;
    return decimalToTime12h(hour24 + minute / 60 + second / 3600);
  }
  return parseTime12h(trimmed);
}

export function formatApiTime(time: Time12h): string {
  const normalized = normalizeTime12h(time);
  const decimal = time12hToDecimal(normalized);
  const totalSeconds = Math.round(decimal * 3600);
  const hour24 = Math.floor(totalSeconds / 3600) % 24;
  const remaining = totalSeconds % 3600;
  const minute = Math.floor(remaining / 60);
  const second = remaining % 60;
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

export function shiftDurationHours(start: Time12h, end: Time12h): number {
  const startDec = time12hToDecimal(start);
  const endDec = time12hToDecimal(end);
  return endDec >= startDec ? endDec - startDec : 24 - startDec + endDec;
}

export function time12hToDecimal(time: Time12h): number {
  const normalized = normalizeTime12h(time);
  const h = normalized.hour;
  let decimal24: number;
  if (normalized.period === 'AM') {
    decimal24 = h === 12 ? 0 : h;
  } else {
    decimal24 = h === 12 ? 12 : h + 12;
  }
  return decimal24 + normalized.minute / 60 + normalized.second / 3600;
}

export function decimalToTime12h(decimalHour: number): Time12h {
  const normalized = ((decimalHour % 24) + 24) % 24;
  const h24 = Math.floor(normalized);
  const remaining = normalized - h24;
  const minute = Math.floor(remaining * 60);
  const second = Math.min(59, Math.round((remaining * 60 - minute) * 60));
  const period: AmPm = h24 >= 12 ? 'PM' : 'AM';
  let hour12 = h24 % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour: hour12, minute, second, period };
}

export function inferBreakTimes(
  startTime: Time12h,
  endTime: Time12h,
  breakHours: number
): { breakStartTime: Time12h; breakEndTime: Time12h } {
  const startDec = time12hToDecimal(startTime);
  const gross = shiftDurationHours(startTime, endTime);
  const breakStartDec = (startDec + gross / 2) % 24;
  const breakEndDec = (breakStartDec + breakHours) % 24;
  return {
    breakStartTime: decimalToTime12h(breakStartDec),
    breakEndTime: decimalToTime12h(breakEndDec),
  };
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

export function totalBreakHours(breaks: BreakPeriod[]): number {
  const total = breaks.reduce(
    (sum, b) => sum + shiftDurationHours(b.startTime, b.endTime),
    0
  );
  return roundHours(total);
}

export function computeShiftMetrics(shift: {
  startTime: Time12h;
  endTime: Time12h;
  breaks: BreakPeriod[];
}): { grossHours: number; breakHours: number; productionHours: number } {
  const grossHours = shiftDurationHours(shift.startTime, shift.endTime);
  const breakHours = totalBreakHours(shift.breaks);
  const productionHours = Math.max(0, grossHours - breakHours);
  return {
    grossHours: roundHours(grossHours),
    breakHours,
    productionHours: roundHours(productionHours),
  };
}

export function recalculateShift<T extends ShiftTiming>(shift: T): T {
  const metrics = computeShiftMetrics(shift);
  return {
    ...shift,
    breakHours: metrics.breakHours,
    productionHours: metrics.productionHours,
  };
}

export function createDefaultBreak(shift: Pick<ShiftTiming, 'startTime' | 'endTime'>): BreakPeriod {
  const inferred = inferBreakTimes(shift.startTime, shift.endTime, 0.25);
  return {
    id: `break-${Date.now()}`,
    startTime: inferred.breakStartTime,
    endTime: inferred.breakEndTime,
  };
}

function normalizeBreak(raw: Record<string, unknown>, index: number): BreakPeriod {
  return {
    id: typeof raw.id === 'string' ? raw.id : `break-${index + 1}`,
    startTime: normalizeTime12h(raw.startTime as Partial<Time12h>),
    endTime: normalizeTime12h(raw.endTime as Partial<Time12h>),
  };
}

export function normalizeShiftTiming(shift: Record<string, unknown>): Pick<
  ShiftTiming,
  'startTime' | 'endTime' | 'breaks' | 'breakHours' | 'productionHours'
> {
  let startTime: Time12h;
  let endTime: Time12h;

  if (shift.startTime && shift.endTime) {
    startTime = normalizeTime12h(shift.startTime as Partial<Time12h>);
    endTime = normalizeTime12h(shift.endTime as Partial<Time12h>);
  } else {
    const startHour = typeof shift.startHour === 'number' ? shift.startHour : 6;
    const endHour = typeof shift.endHour === 'number' ? shift.endHour : 14;
    startTime = decimalToTime12h(startHour);
    endTime = decimalToTime12h(endHour);
  }

  let breaks: BreakPeriod[];
  if (Array.isArray(shift.breaks) && shift.breaks.length > 0) {
    breaks = (shift.breaks as Record<string, unknown>[]).map(normalizeBreak);
  } else if (shift.breakStartTime && shift.breakEndTime) {
    breaks = [
      {
        id: 'break-1',
        startTime: normalizeTime12h(shift.breakStartTime as Partial<Time12h>),
        endTime: normalizeTime12h(shift.breakEndTime as Partial<Time12h>),
      },
    ];
  } else {
    const legacyBreakHours = typeof shift.breakHours === 'number' ? shift.breakHours : 0.5;
    const inferred = inferBreakTimes(startTime, endTime, legacyBreakHours);
    breaks = [
      {
        id: 'break-1',
        startTime: inferred.breakStartTime,
        endTime: inferred.breakEndTime,
      },
    ];
  }

  const metrics = computeShiftMetrics({ startTime, endTime, breaks });
  return {
    startTime,
    endTime,
    breaks,
    breakHours: metrics.breakHours,
    productionHours: metrics.productionHours,
  };
}
