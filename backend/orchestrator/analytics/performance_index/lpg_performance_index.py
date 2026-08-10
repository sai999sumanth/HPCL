
import urdhva_base
import json
import re
import datetime
import requests
import pandas as pd
import hpcl_ceg_model
from utilities.helpers import map_device_category
import orchestrator.analytics.va_analysis as va_analysis
from orchestrator.dbconnector.widget_actions import widget_actions
import orchestrator.analytics.performance_index.performance_index_factory as performance_index_factory


class LPGPerformanceIndex(performance_index_factory.PerformanceIndex):
    def __init__(self):
        super().__init__()
        self.bu = "LPG"
        self.rules_df = None  # Initialize as None

    async def initialize(self):
        """Async method to load performance index rules for LPG."""
        self.rules_df = await self.load_performance_index()

    async def generate_performance_index(self, location_id=None, zone=None):
        # Todo:- Need to generate OI score by location
        lpg = await self.generate_performance_index_lpg(location_id, zone)
        vts = await self.generate_performance_index_vts(location_id, zone)
        va = await self.generate_performance_index_va(location_id, zone)
        pi_index = {**lpg, **vts, **va}
        overall_oi_score = round(sum([pi_index[f'{cat}_oi_score'] for cat in ['lpg', 'vts', 'va']]), 2)

        pi_index['overall_oi_score'] = overall_oi_score
        pi_index['lpg_category_scores']['Video Analytics'] = {'oi_score': va['va_oi_score'], 'weightage': 10}
        return pi_index

    async def generate_performance_index_va(self, location_id=None, zone=None):
        resp = await va_analysis.get_ro_terminal_scores({'LocationType': 'LPG',
                                                   'StartDate': datetime.datetime.now().strftime("%Y-%m-%d")})
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

    async def get_all_alerts(self, location_id=None, zone=None):
        """Fetch all LPG alerts in an open state."""
        req_fields = ['interlock_name', 'created_at', 'sop_id']
        open_alerts = []
        filters = [{"key": 'alert_status', "cond": "equals", "value": "Open"},
                   {"key": 'bu', "cond": "equals", "value": self.bu},
                   {"key": 'alert_section', "cond": "equals", "value": 'LPG'}]

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

    async def generate_performance_index_lpg(self, location_id, zone):
        """
        Generate the performance index for LPG based on alert data and dynamic rules from self.rules_df.
        """
        # Step 1: Fetch all open alerts
        open_alerts = await self.get_all_alerts(location_id, zone)

        if not open_alerts:
            return {"lpg_oi_score": 85, "lpg_category_scores": {}}

        alerts_df = pd.DataFrame(open_alerts)

        if 'interlock_name' not in alerts_df.columns:
            return {"lpg_oi_score": 85, "lpg_category_scores": {}}

        alerts_df = alerts_df[alerts_df['interlock_name'].isin(['O-Ring Leak Rejection',
                                                                'Valve Leak Rejection', 'Check Scale Rejection'])]

        # Step 2: Fetch rules for LPG from self.rules_df
        lpg_rules = self.rules_df[self.rules_df['AlertSection'] == 'LPG']

        if lpg_rules.empty:
            return {"lpg_oi_score": 85, "lpg_category_scores": {}}

        alerts_df['DeviceCategory'] = alerts_df['interlock_name'].map(map_device_category)
        total_devices = alerts_df['interlock_name'].nunique()
        print("total_devices --> ", total_devices)
        if total_devices == 0:
            return {"lpg_oi_score": 85, "lpg_category_scores": {}}

        alert_counts = alerts_df.groupby('DeviceCategory')['interlock_name'].nunique()
        print("alert_counts --> ", alert_counts)

        # Step 5: Compute OI Score
        oi_scores = {}
        total_oi_score = 0

        for _, rule in lpg_rules.iterrows():
            print("*" * 20)
            print("rule --> ", rule)
            category = rule['DeviceCategory']
            print("rule category --> ", category)
            weightage = rule['Weightage']
            print("rule weightage --> ", weightage)

            if category not in alert_counts:
                oi_scores[category] = {"oi_score": float(weightage), "weightage": int(weightage)}
                total_oi_score += float(weightage)
                continue  # Skip if no alerts exist for this category

            open_alert_devices = alert_counts[category]
            print("rule open_alert_devices --> ", open_alert_devices)
            rejection_percentage = (open_alert_devices / total_devices) * 100
            print("rule rejection_percentage --> ", rejection_percentage)

            # Fetch rejection thresholds dynamically
            thresholds = self.extract_thresholds(rule['Rejections'])
            print("rule thresholds --> ", thresholds)

            # Determine score based on rejection percentage
            score = self.calculate_score(rejection_percentage, thresholds)
            if score == 1 and open_alert_devices > 1:
                score = 0.95
            print("rule score --> ", score)

            # Apply weightage
            weighted_score = (score / 100) * weightage
            print("rule weighted_score --> ", weighted_score)
            oi_scores[category] = {"oi_score": float(weighted_score), "weightage": int(weightage)}
            total_oi_score += weighted_score
            print("*" * 20)

        return {"lpg_oi_score": (round(total_oi_score, 2) * 85) / 100, "lpg_category_scores": oi_scores}

    # Helper function to extract threshold ranges from the rules
    def extract_thresholds(self, rejection_rules):
        """
        Parses rejection thresholds dynamically from the rules DataFrame.
        """
        thresholds = []
        rules_list = rejection_rules.split('\n')  # Assuming rules are stored in multiple lines

        for rule in rules_list:
            parts = rule.split('%')
            if len(parts) > 1:
                range_values = re.findall(r'\d+', rule)
                if len(range_values) == 1:
                    thresholds.append((float(range_values[0]), 100 if '≤' in rule else 0))
                elif len(range_values) == 2:
                    thresholds.append((float(range_values[0]), float(range_values[1]), 0, 100))  # range condition
        return thresholds

    # Helper function to calculate score based on rejection percentage
    def calculate_score(self, rejection_percentage, thresholds):
        """
        Determines the score based on dynamic thresholds.
        """
        for threshold in thresholds:
            if len(threshold) == 2 and rejection_percentage <= threshold[0]:
                return threshold[1]
            elif len(threshold) == 4 and threshold[0] < rejection_percentage <= threshold[1]:
                return threshold[3]
        return 0  # Default score if no conditions match
