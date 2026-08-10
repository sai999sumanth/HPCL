import { fetchTerminalData } from "../RetailTerminalHome/ApiServiceFile";

interface AnalyticsFilter {
  key: string;
  cond: string;
  value: string;
}

export const fetchAnalyticsData = async (filters: AnalyticsFilter[]) => {
  try {
    const bu = filters.find(f => f.key === "bu")?.value || "";
    const alert_status = filters.find(f => f.key === "alert_status")?.value || "";
    const alert_section = ""; // Add if needed

    const response = await fetchTerminalData("analytics", bu, alert_section, alert_status);
    return response.data.interlock_alerts || [];
  } catch (error) {
    throw new Error('Failed to fetch analytics data');
  }
};