import urdhva_base
import os
import pandas as pd
import utilities.fiscal_year as fiscal_year

base_path = f"{os.path.dirname(fiscal_year.__file__)}/../orchestrator/masters"


class PerformanceIndex:
    def __init__(self):
        self.bu = ""

    async def get_all_alerts(self, location_id):
        # Load all alerts in open state
        ...

    async def load_performance_index(self):
        df = pd.read_excel(os.path.join(base_path, "PerformanceIndex_Rules.xlsx"), sheet_name=self.bu)
        return df

    async def generate_performance_index(self, location_id):
        ...
