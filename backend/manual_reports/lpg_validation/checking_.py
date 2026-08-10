import urdhva_base
import sys
import time
import asyncio
import traceback
import numpy as np
import pandas as pd
from zoneinfo import ZoneInfo
sys.path.append("/opt/ceg/algo")
from datetime import datetime, timedelta
from utilities.helpers import get_location_details
from testing_lpg_plant_vs_our_data import LPGOperationsActions
from api_manager.hpcl_ceg_model import LpgPlantOperations, LpgPlantOperationsCreate

logger = urdhva_base.logger.Logger.getInstance("generate_lpg_summary")

class GenerateLPGSummary():
    def __init__(self, sap_id, from_date, to_date, run_on_plant=False , conn = None):
        self.params = {
            "sap_id": sap_id,
            "from_date": from_date,
            "to_date": to_date
        }
        self.instance = LPGOperationsActions(conn, run_on_plant)
    
    async def calculate_productivity(self):
        try:
            print("came")
            productivity = await self.instance.get_productivity(self.params)
            print(productivity)
            print("productivity", productivity)
            exit()
            rows = []
            for carousal, phases in productivity.items():
                row = {"carousal": int(carousal)}
                for phase, metrics in phases.items():
                    for key, value in metrics.items():
                        row[f"{phase}_{key}"] = value
                rows.append(row)
            df = pd.DataFrame(rows)

            net_hours_column = ["normal_net_hours", "break_net_hours", "overtime_net_hours"]
            production_columns = ["normal_total_production", "break_total_production", "overtime_total_production"]
            
            for col in net_hours_column + production_columns:
                if col in df.columns:
                    df[col] = df[col].fillna(0).astype(np.float64).abs()

            df["total_net_hours"] = df["normal_net_hours"] + df["break_net_hours"] + df["overtime_net_hours"]
            df["total_production"] = df["normal_total_production"] + df["break_total_production"] + df["overtime_total_production"]
            df["total_productivity"] = df["total_production"] / df["total_net_hours"]
            print("*"*20)
            print("--- productivity ---")
            print(df[["carousal", "total_production", "total_net_hours", "total_productivity"]])
            print("*"*20)
            return df
        except Exception as e:
            logger.error(f"--- Error In Calculating Productivity {e}---")
            logger.error(f"Traceback : {traceback.format_exc()}")
            return pd.DataFrame()
        
    async def calculate_rejections(self):
        try:
            df = pd.DataFrame()
            cs_rejection = await self.instance.get_cs_rejection(self.params)
            gd_rejection = await self.instance.get_gd_rejection(self.params)
            pt_rejection = await self.instance.get_pt_rejection(self.params)
            
            #### CS REJECTION ####
            cs_rejection = pd.DataFrame.from_dict(cs_rejection, orient="index").reset_index()
            cs_rejection.rename(columns={"index": "carousal"}, inplace=True)
            cs_rejection.rename(columns={"handled": "cs_handled", "sortout": "cs_sortout", 
                                         "rejection_rate": "cs_rejection"}, inplace=True)
            if not cs_rejection.empty:
                cs_rejection = cs_rejection[["carousal", "cs_handled", "cs_sortout", "cs_rejection"]]

            #### GD REJECTION ####
            gd_rejection = pd.DataFrame.from_dict(gd_rejection, orient="index").reset_index()
            gd_rejection.rename(columns={"index": "carousal"}, inplace=True)
            gd_rejection.rename(columns={"handled": "gd_handled", "sortout": "gd_sortout", 
                                         "rejection_rate": "gd_rejection"}, inplace=True)
            if not gd_rejection.empty:
                gd_rejection = gd_rejection[["carousal", "gd_handled", "gd_sortout", "gd_rejection"]]
            
            #### PT REJECTION ####
            pt_rejection = pd.DataFrame.from_dict(pt_rejection, orient="index").reset_index()
            pt_rejection.rename(columns={"index": "carousal"}, inplace=True)
            pt_rejection.rename(columns={"handled": "pt_handled", "sortout": "pt_sortout", 
                                         "rejection_rate": "pt_rejection"}, inplace=True)
            if not pt_rejection.empty:
                pt_rejection = pt_rejection[["carousal", "pt_handled", "pt_sortout", "pt_rejection"]]

            df = pd.concat([cs_rejection, gd_rejection, pt_rejection])
            df = df.fillna(0)
            df = df.groupby("carousal").sum().reset_index()
            print("*"*20)
            print("--- Rejections ---")
            print(df)
            print("*"*20)
            return df
        except Exception as e:
            print("traceback :", traceback.format_exc())
            logger.error("--- Error In Calculating Rejections ---")
            logger.error(f"Traceback : {traceback.format_exc()}")
            return pd.DataFrame()
        
    async def calculate_bottling_summary(self):
        try:
            bottling_summary = await self.instance.get_bottling_summary(self.params)
            rows = []
            for carousal, metrics in bottling_summary.items():
                row = {"carousal": int(carousal)}
                row.update(metrics)
                rows.append(row)
            df = pd.DataFrame(rows)
            print("*"*20)
            print("--- Bottling Summary ---")
            print(df)
            print("*"*20)
            return df
        except Exception as e:
            logger.error("--- Error In Calculating Rejections ---")
            logger.error(f"Traceback : {traceback.format_exc()}")
            return pd.DataFrame()
    

    async def generate_summary(self):
        try:
            
            productivity = await self.calculate_productivity()
            print("productivity", productivity)
            rejections = await self.calculate_rejections()
            bottling_summary = await self.calculate_bottling_summary()
            print("productivity", productivity)
            print("rejections", rejections)
            print("bottling_summary", bottling_summary)
            summary = pd.concat([productivity, rejections, bottling_summary])
            print("summary", summary)
            if summary.empty or summary['total_production'].sum() == 0:
                print(f"--- No Data Found for {self.params['sap_id']} ---")
                logger.info(f"--- No Data Found for {self.params['sap_id']} ---")
                return
            summary = summary.fillna(0)
            summary = summary.groupby("carousal").sum().reset_index()

            status, location_data = await get_location_details("LPG", self.params["sap_id"])
            summary["zone"] = location_data["zone"]
            summary["region"] = location_data["region"]
            summary["sales_area"] = location_data["sales_area"]
            summary["location_name"] = location_data["name"]

            carousals = await self.instance.get_carousals('full', self.params["sap_id"])
            for carousal, data in carousals.items():
                summary.loc[summary["carousal"].astype(int) == int(carousal), "filling_head"] = str(int(data["heads"])) + "H"
            
            for col in summary.columns:
                try:
                    summary[col] = summary[col].fillna(0).astype(np.float64).abs().round(2)
                except Exception:
                    continue
            summary["carousal"] = summary["carousal"].astype(int).astype(str)
            summary.rename(columns={"carousal": "carousel", 
                                    "production_19": "production_19kg", 
                                    "production_14_2": "production_14_2kg"}, inplace=True)
            summary["process_date"] = datetime.strptime(self.params["to_date"], "%Y-%m-%d")
            summary["sap_id"] = self.params["sap_id"]



            return summary
        except Exception as e:
            print("traceback :", traceback.format_exc())
            logger.error("--- Error in Generating Summary ---")
            logger.error(f"Traceback : {traceback.format_exc()}")
            return False

async def process_plant_concurrent(plant,params, conn = None, run_on_plant = False):
        """Process a single plant with concurrency control"""

        try:
            print(f"Starting processing for {plant['plant_name']}")
            current_date =  datetime.strptime(params["date"], "%Y-%m-%d").date()
          
            print(f"Processing plant={plant['plant_name']} date={current_date}")
    
            params = {
                "sap_id": str(plant["erp_id"]),
                "from_date": current_date.strftime("%Y-%m-%d"),
                "to_date": current_date.strftime("%Y-%m-%d")
            }
            if run_on_plant:
                ins = GenerateLPGSummary(**params, conn=conn, run_on_plant=run_on_plant)
            else:
                ins = GenerateLPGSummary(**params)
            sumarry = await ins.generate_summary()

            return sumarry
        except Exception as e:
            print(f"Error processing plant {plant['plant_name']}: {e}")
            logger.error(f"Error processing plant {plant['plant_name']}: {traceback.format_exc()}")






