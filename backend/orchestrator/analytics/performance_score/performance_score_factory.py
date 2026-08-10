import urdhva_base
import os
import pandas as pd
import hpcl_ceg_model


class PerformanceIndex:
    def __init__(self):
        self.base_path = f"{os.path.dirname(hpcl_ceg_model.__file__)}/../orchestrator/masters"
        self.bu = ""

    async def get_all_alerts(self, location_id):
        # Load all alerts in open state
        ...

    async def load_performance_index(self):
        df = pd.read_excel(os.path.join(self.base_path, "PerformanceIndex_Rules.xlsx"), sheet_name=self.bu)
        return df

    async def generate_performance_index(self, location_id):
        ...
