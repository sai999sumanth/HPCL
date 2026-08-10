import polars as pl
import urdhva_base
import hpcl_ceg_model 
import re
import unicodedata
import json
import os
from fastapi.responses import StreamingResponse


class BlockedTruckService:

    _instance = None

    # =====================================================
    # SINGLETON CREATION
    # =====================================================
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(BlockedTruckService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    # =====================================================
    # INITIALIZATION (RUNS ONLY ONCE)
    # =====================================================
    def _initialize(self):

        base_dir = os.path.dirname(__file__)

        # go up one level → orchestrator
        project_root = os.path.dirname(base_dir)

        self.EXCEL_PATH = os.path.join(
            project_root,
            "masters",
            "Tas_Dashboard_exception_report.xlsx"
        )


        self.SHEET_NAME = "Alerts summary report"
        self.SOP_ENABLED = False

        # Default empty dataframe
        self._sop_df = pl.DataFrame({
            "event_name": [],
            "reason": [],
            "impact": [],
            "action_required": [],
            "backend_rules": [],
            "norm_event": []
        })


        # Safe file loading
        try:
            if not os.path.exists(self.EXCEL_PATH):
                print("⚠ SOP Excel file not found. Running without SOP.")
                return

            sop_df = pl.read_excel(
                self.EXCEL_PATH,
                sheet_name=self.SHEET_NAME
            )

            sop_df = sop_df.rename({c: c.strip() for c in sop_df.columns})

            sop_df = sop_df.rename({
                "Event / Alarm name": "event_name",
                "Reason": "reason",
                "Impact": "impact",
                "Action required for alert closer": "action_required",
                "Backend Interlock Check points": "backend_rules"
            })

            sop_df = sop_df.with_columns(
                pl.col("event_name").forward_fill()
            )

            sop_df = sop_df.with_columns(
                pl.col("event_name")
                .cast(pl.Utf8)
                .map_elements(self.normalize_exact)
                .alias("norm_event")
            )

            sop_df = sop_df.with_columns(
                pl.col("backend_rules")
                .fill_null("")
                .map_elements(
                    lambda x: [r.strip() for r in str(x).split(",") if r.strip()]
                )
            )

            self._sop_df = sop_df
            self.SOP_ENABLED = True
            print("SOP Excel loaded successfully")

        except Exception as e:
            print(f"Error loading SOP Excel: {e}")
            self.SOP_ENABLED = False

    # =====================================================
    # NORMALIZATION
    # =====================================================
    @staticmethod
    def normalize_exact(text: str) -> str:
        if not text or not isinstance(text, str):
            return ""

        text = unicodedata.normalize("NFKC", text)
        text = re.sub(r"[\u00A0\u2000-\u200F\u202F\u205F\u3000]", " ", text)
        text = re.sub(r"[\u200B-\u200D\uFEFF]", "", text)
        text = text.lower().strip()
        text = re.sub(r"\s+", " ", text)
        return text

    # =====================================================
    # BACKEND INTERLOCK CHECK
    # =====================================================
    async def check_any_interlock_exists(
        self,
        interlock_names: list[str],
        start_date: str,
        end_date: str,
        alert_status: str
    ) -> bool:

        if not interlock_names:
            return False

        names = ",".join(f"'{n}'" for n in interlock_names)

        query = (
            f"interlock_name IN ({names}) "
            f"AND alert_status = '{alert_status}' "
            "AND bu = 'TAS' "
            "AND alert_section = 'TAS' "
            f"AND created_at::date BETWEEN '{start_date}' AND '{end_date}'"
        )

        try:
            params = urdhva_base.queryparams.QueryParams(q=query, limit=1)
            resp = await hpcl_ceg_model.Alerts.get_all(params, resp_type="plain")
            return bool(resp.get("data"))
        except Exception as e:
            print(f" Error checking backend interlock: {e}")
            return False

    # =====================================================
    # SOP RESOLUTION
    # =====================================================
    async def resolve_sop_logic(
        self,
        interlock_name: str,
        start_date: str,
        end_date: str,
        alert_status: str
    ) -> dict:

        if not self.SOP_ENABLED:
            return {
                "reason": "SOP not configured",
                "impact": "Operational alert",
                "action_required": "Manual verification required"
            }

        norm_alert = self.normalize_exact(interlock_name)

        sop_rows = self._sop_df.filter(
            pl.col("norm_event") == norm_alert
        )

        if sop_rows.height == 0:
            sop_rows = self._sop_df.filter(
                pl.col("norm_event").str.contains(norm_alert, literal=True)
                | pl.col("norm_event").str.contains(norm_alert.replace("_", " "), literal=True)
                | pl.col("norm_event").str.contains(norm_alert.replace(" ", "_"), literal=True)
            )

        if sop_rows.height == 0:
            return {
                "reason": "No SOP defined",
                "impact": "Operational / monitoring alert",
                "action_required": "Escalate to Safety / Operations"
            }

        for row in sop_rows.iter_rows(named=True):
            if row["backend_rules"]:
                if await self.check_any_interlock_exists(
                    row["backend_rules"],
                    start_date,
                    end_date,
                    alert_status
                ):
                    return {
                        "reason": row["reason"],
                        "impact": row["impact"],
                        "action_required": row["action_required"]
                    }

        fallback_rows = sop_rows.filter(
            pl.col("backend_rules").list.len() == 0
        )

        if fallback_rows.height > 0:
            row = fallback_rows.row(0, named=True)
            return {
                "reason": row["reason"],
                "impact": row["impact"],
                "action_required": row["action_required"]
            }

        return {
            "reason": "False alert from TAS system",
            "impact": "No supporting backend interlocks detected",
            "action_required": "Verify alert source and instrumentation"
        }

    # =====================================================
    # STREAMING RESPONSE
    # =====================================================
    async def streaming_data(self, df: pl.DataFrame):
        async def json_generator():
            yield json.dumps(df.to_dicts())

        return StreamingResponse(
            json_generator(),
            media_type="application/json"
        )

    # =====================================================
    # MAIN SERVICE
    # =====================================================
    async def get_blocked_trucks_service(
        self,
        alert_status: str,
        start_date: str,
        end_date: str
    ):

        alert_query = (
            f"alert_status = '{alert_status}' "
            "AND bu = 'TAS' "
            "AND alert_section = 'TAS' "
            f"AND (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date BETWEEN '{start_date}' AND '{end_date}'"
        )

        alert_params = urdhva_base.queryparams.QueryParams(
            q=alert_query,
            limit=0
        )

        alert_params.fields = [
            "sap_id",
            "unique_id",
            "alert_status",
            "interlock_name",
            "location_name",
            "created_at"
        ]

        try:
            alerts_resp = await hpcl_ceg_model.Alerts.get_all(alert_params, resp_type="plain")
            alerts_data = alerts_resp.get("data", [])
        except Exception as e:
            print("Error fetching alerts:", e)
            return {
                "status": False,
                "message": "Failed to fetch alerts",
                "data": []
            }

        if not alerts_data:
            return {
                "status": True,
                "message": "No alerts found for given filters",
                "data": []
            }

        result = []

        for alert in alerts_data:
            sop_result = await self.resolve_sop_logic(
                alert.get("interlock_name"),
                start_date,
                end_date,
                alert_status
            )

            result.append({
                "sap_id": alert.get("sap_id"),
                "location_name": alert.get("location_name"),
                "unique_id": alert.get("unique_id"),
                "interlock_name": alert.get("interlock_name"),
                "created_at": alert.get("created_at"),
                "reason": sop_result["reason"],
                "impact": sop_result["impact"],
                "action_required": sop_result["action_required"]
            })

        df = pl.DataFrame(result).with_columns(
            pl.col("created_at")
            .cast(pl.Datetime)
            .dt.strftime("%Y-%m-%dT%H:%M:%S")
        )

        return await self.streaming_data(df)
