from sqlalchemy import text
from orchestrator.dashboard.chart_factory import charts_functions
import decimal
from orchestrator.dashboard.charts.bar_chart import BarChart

class TimeSeriesBarChart:
    async def get_data(self, metrics_data):
        return await BarChart.get_data(self, metrics_data)
