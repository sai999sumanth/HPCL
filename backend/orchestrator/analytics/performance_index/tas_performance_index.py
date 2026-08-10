import urdhva_base.queryparams
import os
import json
import datetime
import pandas as pd
import hpcl_ceg_model
from utilities.helpers import map_device_category
import orchestrator.analytics.va_analysis as va_analysis
from orchestrator.dbconnector.widget_actions import widget_actions
import orchestrator.analytics.performance_index.performance_index_factory as performance_index_factory


class TASPerformanceIndex(performance_index_factory.PerformanceIndex):
    def __init__(self):
        super().__init__()
        self.bu = "TAS"
        self.rules_df = None  # Initialize as None

    async def initialize(self):
        """Async method to load performance index rules."""
        self.rules_df = await self.load_performance_index()

    async def get_all_alerts(self, location_id=None, zone=None):
        # Load all alerts in open state
        req_fields = ['interlock_name', 'created_at', 'sop_id']
        open_alerts = []
        filters = [{"key": 'alert_status', "cond": "equals", "value": "Open"},
                   {"key": 'bu', "cond": "equals", "value": self.bu},
                   {"key": 'alert_section', "cond": "equals", "value": 'TAS'}]

        if location_id:
            filters.append({"key": 'sap_id', "cond": "equals", "value": location_id})
        if zone:
            filters.append({"key": 'zone', "cond": "equals", "value": zone})
        clause = await widget_actions.WidgetActions.generate_filter_clause(filters)
        query = f" {','.join(req_fields)} from alerts where {clause} order by created_at desc"
        print(query)
        skip = 0
        while True:
            resp = await hpcl_ceg_model.Alerts.get_aggr_data(query, limit=10000, skip=skip)
            if resp['data']:
                open_alerts.extend(resp['data'])
            if len(resp) < 10000:
                break
            skip += 1
        print(len(open_alerts))
        return open_alerts

    async def generate_performance_index(self, location_id=None, zone=None):
        # Todo:- Need to generate OI score by location
        tas = await self.generate_performance_index_tas(location_id, zone)
        vts = await self.generate_performance_index_vts(location_id, zone)
        va = await self.generate_performance_index_va(location_id, zone)
        em_lock = await self.generate_performance_index_em_lock(location_id, zone)
        dry_out = await self.generate_performance_index_dry_out(location_id, zone)
        pi_index = {**tas, **vts, **va, **em_lock, **dry_out}
        print(pi_index)
        overall_oi_score = round(sum([pi_index[f'{cat}_oi_score'] for cat in ['tas', 'vts', 'va', 'em_lock', 'dry_out']]), 2)

        pi_index['overall_oi_score'] = overall_oi_score
        pi_index['tas_category_scores']['Video Analytics'] = {'oi_score': va['va_oi_score'], 'weightage': 10}
        return pi_index

    async def generate_performance_index_va(self, location_id=None, zone=None):
        resp = await va_analysis.get_ro_terminal_scores({'LocationType': 'TAS',
                                                   'StartDate': datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")})
        if resp['status']:
            va_score = sum([float(rec['OVERALL_SCORE'])
                            if rec.get('OVERALL_SCORE') and
                                                             (not location_id or location_id in rec['LOCATION_ID']) else 0
                            for rec in resp['data']])
            if not location_id:
                va_score = va_score / len(resp['data'])
            return {"va_oi_score": round(va_score, 2), "va_category_scores": {}}
        return {"va_oi_score": 10, "va_category_scores": {}}

    async def generate_performance_index_vts(self, location_id=None, zone=None):
        return {"vts_oi_score": 5, "vts_category_scores": {}}

    async def generate_performance_index_dry_out(self, location_id=None, zone=None):
        return {"dry_out_oi_score": 15, "dry_out_category_scores": {}}

    async def generate_performance_index_em_lock(self, location_id=None, zone=None):
        return {"em_lock_oi_score": 5, "em_lock_category_scores": {}}

    async def generate_performance_index_tas(self, location_id=None, zone=None):
        # Get all open alerts by Device category (Safety, Process, FE&Jockey, WaterLevl, FoamQty, PT) and distinct
        # devices Compute OI Score
        # weightage can be fetched from self.rules
        # oi_score = round(((total_devices - open_alert_devices) / total_devices) * weightage, 2) if total_devices >
        # 0 else 0
        # Example self.rules_df[self.rules_df['DeviceCategory'] == 'Process']['Weightage'][0]
        # Todo:- need to check Enabled key in future
        open_alerts = await self.get_all_alerts(location_id, zone)

        if not open_alerts:
            print("No open alerts found!")
            return {"tas_oi_score": 65, "tas_category_scores": {}}

        alerts_df = pd.DataFrame(open_alerts)
        print("Alerts DataFrame:\n", alerts_df)

        if 'interlock_name' not in alerts_df.columns:
            print("Invalid alert data format. Columns:", alerts_df.columns)
            return {"tas_oi_score": 65, "tas_category_scores": {}}

        # Map interlock_name to DeviceCategory
        alerts_df['DeviceCategory'] = alerts_df['interlock_name'].map(map_device_category)
        print("Mapped Categories:\n", alerts_df[['interlock_name', 'DeviceCategory']])

        # Count total unique devices per category
        total_devices = alerts_df['interlock_name'].nunique()
        print("Total unique devices:", total_devices)

        alert_counts = alerts_df.groupby('DeviceCategory')['interlock_name'].nunique()
        print("Alert counts per category:", alert_counts)

        # Check if self.rules_df is loaded
        if self.rules_df is None:
            print("Error: self.rules_df is not initialized!")
            return {"tas_oi_score": 65, "tas_category_scores": {}}

        print("Rules DataFrame:\n", self.rules_df)

        # Compute OI Score
        oi_scores = {}
        total_oi_score = 0

        for category, open_alert_devices in alert_counts.items():
            print("Processing category:", category)

            # Debug: Check if category exists in rules_df
            weightage = self.rules_df.loc[self.rules_df['DeviceCategory'] == category, 'Weightage'].values
            print(f"Weightage for {category}: {weightage}")

            if len(weightage) == 0:
                print(f"Warning: No weightage found for category '{category}', setting to 0")
                continue
            else:
                weightage = weightage[0]

            oi_score = round(((total_devices - open_alert_devices) / total_devices) * weightage, 2) \
                if total_devices > 0 else weightage
            print(f"OI Score for {category}: {oi_score}")

            oi_scores[category] = {"oi_score": float(oi_score), "weightage": int(weightage)}
            total_oi_score += oi_score
        self.rules_df['DeviceCategory'].fillna('', inplace=True)
        self.rules_df = self.rules_df[self.rules_df['DeviceCategory'] != '']
        for category in self.rules_df['DeviceCategory'].unique():
            if category not in oi_scores:
                weightage = self.rules_df.loc[self.rules_df['DeviceCategory'] == category, 'Weightage'].values[0]
                oi_scores[category] = {"oi_score": float(weightage), "weightage": int(weightage)}
                total_oi_score += float(weightage)
        # print("Final OI Scores:", oi_scores)
        # print("Total OI Score:", total_oi_score)

        return {"tas_oi_score": round(float(total_oi_score), 2), "tas_category_scores": oi_scores}

    async def generate_performance_index_emlock(self, location_id):
        ...
