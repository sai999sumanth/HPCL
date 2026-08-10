export interface LocationFilter {
    zone: string | null
    plant: string | null
  }
  
  export type TimeFilter = "t" | "1d" | "1w" | "15d" | "1m" | "3m"
  
  
export function aggregateFilters(
  sapId: string,
  locationFilter: LocationFilter,
  timeFilter: TimeFilter | null,
  dateRangeFilter: any | null,
) {
  let query = `sap_id='${sapId}'`

  if (locationFilter.zone) {
    query += ` AND zone='${locationFilter.zone}'`
  }

  if (timeFilter) {
    const timeFilterQuery = getTimeFilterQuery(timeFilter)
    if (timeFilterQuery) {
      query += ` AND ${timeFilterQuery}`
    }
  } else if (dateRangeFilter) {
    const [startDate, endDate] = dateRangeFilter.value.split(",")
    query += ` AND created_at::DATE BETWEEN '${startDate}' AND '${endDate}'`
  }

  return query
}

function getTimeFilterQuery(filter: string): string {
  const timeFilterMap: { [key: string]: string } = {
    t: "created_at::DATE = CURRENT_DATE",
    "1d": "created_at::DATE = CURRENT_DATE - INTERVAL '1 DAY'",
    "1w": "created_at::DATE >= CURRENT_DATE - INTERVAL '7 DAY'",
    "15d": "created_at::DATE >= CURRENT_DATE - INTERVAL '15 DAY'",
    "1m": "created_at::DATE >= CURRENT_DATE - INTERVAL '1 MONTH'",
    "3m": "created_at::DATE >= CURRENT_DATE - INTERVAL '3 MONTH'",
  }

  return timeFilterMap[filter] || ""
}

