/**
 * Merge ticketing location (zone / sap_id) into KPI `cross_filters` without duplicating
 * zone or plant keys from the LPG top bar (when zone/plant are hidden there).
 */

export function mergeKpiTicketingCrossFilters(
  baseCrossFilters: Array<{ key: string; cond: string; value: string }>,
  ticketingZone: string | null,
  ticketingSapId: string | null
): Array<{ key: string; cond: string; value: string }> {
  const isLocationKey = (key: string) => {
    const k = key.replace(/^"(.*)"$/, "$1").toLowerCase();
    return k === "zone" || k === "sap_id";
  };

  const without = baseCrossFilters.filter((c) => !isLocationKey(c.key));
  const out = [...without];

  if (ticketingZone && ticketingZone !== "all") {
    out.push({ key: '"zone"', cond: "equals", value: ticketingZone });
  }
  if (ticketingSapId && ticketingSapId !== "all") {
    out.push({ key: '"sap_id"', cond: "equals", value: ticketingSapId });
  }
  return out;
}
