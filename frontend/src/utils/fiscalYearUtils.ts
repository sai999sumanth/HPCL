import dayjs from "dayjs"

/** Indian FY: April–March. Returns labels like "2026-2027" and "2025-2026". */
export function getIndianFiscalYearMeta(now: dayjs.Dayjs = dayjs()) {
  const m = now.month()
  const y = now.year()
  const fyStartYear = m >= 3 ? y : y - 1
  return {
    currentFY: `${fyStartYear}-${fyStartYear + 1}`,
    previousFY: `${fyStartYear - 1}-${fyStartYear}`,
    fyStartYear,
  }
}

/**
 * Default FY for dropdowns: on 01-Apr (first calendar day of Indian FY), select previous FY; from 02-Apr through 31-Mar, current FY.
 */
export function getDefaultFiscalYearDropdownValue(now: dayjs.Dayjs = dayjs()) {
  const meta = getIndianFiscalYearMeta(now)
  const isFirstDayOfIndianFy = now.month() === 3 && now.date() === 1
  return isFirstDayOfIndianFy ? meta.previousFY : meta.currentFY
}

export function parseFiscalYearLabel(label: string): { start: number; end: number } | null {
  const parts = String(label).split("-")
  if (parts.length !== 2) return null
  const start = Number.parseInt(parts[0], 10)
  const end = Number.parseInt(parts[1], 10)
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  return { start, end }
}

/** e.g. "2026-2027" → "2025-2026", "2025-2026" → "2024-2025" */
export function getPreviousIndianFiscalYear(label: string): string {
  const fy = parseFiscalYearLabel(label)
  if (!fy) return label
  return `${fy.start - 1}-${fy.end - 1}`
}

/** Previous FY (historical) SBU range: Mar 1 of start year through Mar 31 of end year (e.g. 2025-2026 → 01-Mar-2025 to 31-Mar-2026). */
export function getPreviousFYSbuDateRangeDefaults(fy: { start: number; end: number }) {
  return {
    from: dayjs().year(fy.end).month(2).date(1),
    to: dayjs().year(fy.end).month(2).date(31),
  }
}

/** Present FY: calendar month start through yesterday; on the 1st, end clamps to start (same day). */
export function getCurrentMonthStartThroughYesterdayClamped(now: dayjs.Dayjs = dayjs()) {
  const from = now.startOf("month").startOf("day")
  const yesterday = now.subtract(1, "day").startOf("day")
  const to = yesterday.isBefore(from) ? from : yesterday
  return { from, to }
}

/**
 * DATE RANGE summary cards (SBU / Zone wise): month start → yesterday.
 * On the 1st of a calendar month, use the full previous month (e.g. 1 Jun → 1 May–31 May).
 */
export function getDateRangeCardMonthWindow(now: dayjs.Dayjs = dayjs()) {
  const today = now.startOf("day")
  if (today.date() === 1) {
    const prev = today.subtract(1, "month")
    return {
      from: prev.startOf("month").startOf("day"),
      to: prev.endOf("month").startOf("day"),
    }
  }
  const from = today.startOf("month").startOf("day")
  const to = today.subtract(1, "day").startOf("day")
  return { from, to }
}

/** Full Indian FY for titles: 01-Apr-{start} to 31-Mar-{end} (e.g. 2026-2027 → 01-Apr-2026 to 31-Mar-2027). */
export function getIndianFiscalYearFullRangeDisplay(label: string): string {
  const fy = parseFiscalYearLabel(label)
  if (!fy) return ""
  const from = dayjs().year(fy.start).month(3).date(1)
  const to = dayjs().year(fy.end).month(2).date(31)
  return `${from.format("DD-MMM-YYYY")} to ${to.format("DD-MMM-YYYY")}`
}

/**
 * YTD for a fiscal year label: 01-Apr (start year) through yesterday (inclusive).
 * On 01-Apr, yesterday is still in the old FY — end is clamped to FY start so the range is 01-Apr–01-Apr.
 */
export function getIndianFyYtdAprilStartThroughYesterday(
  fyLabel: string,
  now: dayjs.Dayjs = dayjs()
): { from: dayjs.Dayjs; to: dayjs.Dayjs } | null {
  const fy = parseFiscalYearLabel(fyLabel)
  if (!fy) return null
  const fyStart = now.year(fy.start).month(3).date(1).startOf("day")
  const yesterday = now.subtract(1, "day").startOf("day")
  const to = yesterday.isBefore(fyStart) ? fyStart : yesterday
  return { from: fyStart, to }
}

/**
 * YTPM (till previous month): 01-Apr (FY start) through end of previous calendar month, within FY.
 * In April, "previous month" is March (before FY start) — end clamps to end of April so range stays Apr–Apr.
 */
export function getIndianFyYtpAprilThroughPreviousMonthEnd(
  fyLabel: string,
  now: dayjs.Dayjs = dayjs()
): { from: dayjs.Dayjs; to: dayjs.Dayjs } | null {
  const fy = parseFiscalYearLabel(fyLabel)
  if (!fy) return null
  const fyStart = now.year(fy.start).month(3).date(1).startOf("day")
  const fyEnd = now.year(fy.end).month(2).date(31).endOf("day")
  let endOfPrevMonth = now.subtract(1, "month").endOf("month")
  if (endOfPrevMonth.isBefore(fyStart)) {
    endOfPrevMonth = fyStart.endOf("month")
  }
  const to = endOfPrevMonth.isAfter(fyEnd) ? fyEnd : endOfPrevMonth
  return { from: fyStart, to }
}
