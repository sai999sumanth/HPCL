export interface AnalyticsData {
  sbu_name?: string;
  zone_name?: string;
  region_name?: string;
  Sales?: { [key: string]: number };
  History?: { [key: string]: number };
  Growth?: { [key: string]: number };
  "Market Share"?: { [key: string]: number };
  "Market Share History"?: { [key: string]: number };
  "Volume G/L"?: { [key: string]: number };
  "Market % Gr"?: { [key: string]: number };
  [key: string]: any;
}

/**
 * Calculates all derived metrics (Growth, Market Share, etc.) from base Sales and History data.
 * This ensures that metrics are consistent whether the data is for a region or an aggregated zone.
 */
export function calculateAllMetrics(data: AnalyticsData[]): AnalyticsData[] {
  return data.map(item => {
    const companies = new Set([...Object.keys(item.History || {}), ...Object.keys(item.Sales || {})]);
    const newItem = JSON.parse(JSON.stringify(item));

    const volumeGL: { [key: string]: number } = {};
    const growth: { [key: string]: number } = {};
    const marketShareData: { [key: string]: number } = {};
    const marketShareHistoryData: { [key: string]: number } = {};
    const marketGr: { [key: string]: number } = {};

    let currentMarketTotal = 0;
    let historyMarketTotal = 0;
    companies.forEach(c => {
      currentMarketTotal += item.Sales?.[c] || 0;
      historyMarketTotal += item.History?.[c] || 0;
    });

    companies.forEach(company => {
      const sales = item.Sales?.[company] || 0;
      const history = item.History?.[company] || 0;

      // Volume G/L
      volumeGL[company] = parseFloat((sales - history).toFixed(2));

      // Growth %
      growth[company] = history > 0 ? parseFloat((((sales - history) / history) * 100).toFixed(2)) : 0;
      
      // Market Share & History
      const currentShare = currentMarketTotal > 0 ? (sales / currentMarketTotal) * 100 : 0;
      const historyShare = historyMarketTotal > 0 ? (history / historyMarketTotal) * 100 : 0;
      
      marketShareData[company] = parseFloat(currentShare.toFixed(2));
      marketShareHistoryData[company] = parseFloat(historyShare.toFixed(2));

      // Market % Gr
      marketGr[company] = historyShare > 0 ? parseFloat((((currentShare - historyShare) / historyShare) * 100).toFixed(2)) : 0;
    });
    
    newItem["Volume G/L"] = volumeGL;
    newItem["Growth"] = growth;
    newItem["Market Share"] = marketShareData;
    newItem["Market Share History"] = marketShareHistoryData;
    newItem["Market % Gr"] = marketGr;
    
    return newItem;
  });
}

/**
 * Aggregates raw data (with regions) by zone_name.
 * It only sums the base metrics (Sales, History) which can then be used to recalculate derived metrics.
 */
export function aggregateDataByZone(data: AnalyticsData[]): AnalyticsData[] {
  const zoneMap = new Map<string, any>();

  data.forEach(item => {
    if (!item.zone_name) return;

    if (!zoneMap.has(item.zone_name)) {
      zoneMap.set(item.zone_name, {
        zone_name: item.zone_name,
        Sales: {},
        History: {},
      });
    }

    const zoneData = zoneMap.get(item.zone_name);
    const companies = new Set([...Object.keys(item.Sales || {}), ...Object.keys(item.History || {})]);

    companies.forEach(company => {
      zoneData.Sales[company] = (zoneData.Sales[company] || 0) + (item.Sales?.[company] || 0);
      zoneData.History[company] = (zoneData.History[company] || 0) + (item.History?.[company] || 0);
    });
  });

  return Array.from(zoneMap.values());
}
