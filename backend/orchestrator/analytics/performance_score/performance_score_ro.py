"""
Retail Outlet (RO) performance score — rules from pi_masters/ro_performance_rules.json.

TEMP: SALES_PERFORMANCE is disabled; NOZZLE_SALES_PATTERN (40%) uses last-30d daily nozzle
pattern (stability) and compares nozzle 30d totals to estimated dryout sales loss.
"""
from __future__ import annotations

import json
import os
import statistics
from typing import Any, Dict, List, Optional, Tuple

import hpcl_ceg_model
import charts_actions
import dashboard_studio_model
import orchestrator.analytics.performance_score.performance_score_factory as performance_score_factory
import orchestrator.analytics.performance_score.performance_score_insights as psi
import utilities.connection_mapping as connection_mapping


def _clamp(score: float) -> float:
    return max(0.0, min(100.0, float(score)))


# VA API returns 0–10; when missing for an RO, use mid-scale so the location is not scored as zero.
RO_VA_NEUTRAL_OVERALL = 0.0

# Retail RO daily volumes are often volatile; CV>1 is common. Map CV on ~0–2.5 scale instead of hard cap at 1.
RO_NOZZLE_CV_SOFT_CAP = 2.5


def score_daily_nozzle_pattern_stability(cv: Optional[float]) -> Tuple[float, str]:
    """
    Last-30d daily nozzle volumes: coefficient of variation (std/mean).
    Softer curve than min(1,cv) so typical retail volatility does not collapse to 0.
    """
    if cv is None:
        return 50.0, "Insufficient daily nozzle data (need ≥3 days with volume); neutral 50."
    c = max(0.0, float(cv))
    s = 100.0 * max(0.0, 1.0 - (c / RO_NOZZLE_CV_SOFT_CAP))
    return _clamp(s), (
        f"Daily volume CV (std/mean): {c:.4f}; score uses 100×(1−CV/{RO_NOZZLE_CV_SOFT_CAP}) "
        f"(retail-friendly; lower CV is better)."
    )


def score_nozzle_vs_sales_loss_share(loss_share: Optional[float]) -> Tuple[float, str]:
    """
    loss_share = estimated dryout loss volume / nozzle 30d total sales volume (0–1+).
    Higher loss share → lower score.
    """
    if loss_share is None:
        return 50.0, "Cannot compare; missing nozzle 30d total or loss estimate."
    r = max(0.0, float(loss_share))
    s = 100.0 * (1.0 - min(1.0, r))
    return _clamp(s), f"Estimated dryout loss volume / nozzle 30d sales = {r:.4f}."


def score_dryout_frequency(count: Optional[float]) -> Tuple[float, str]:
    """§4.1 — Score = 100 − (count × 10), min 0."""
    c = float(count or 0)
    s = 100.0 - (c * 10.0)
    return _clamp(s), f"Dryout events (30d): {c:.0f}; formula 100 − 10×count."


def score_dryout_sales_loss(loss_pct: Optional[float]) -> Tuple[float, str]:
    """§4.2 — Score = 100 − (Loss% × 15)."""
    if loss_pct is None:
        return 50.0, "Dryout sales loss % unavailable; neutral score 50."
    lp = float(loss_pct)
    s = 100.0 - (lp * 15.0)
    return _clamp(s), f"Dryout loss {lp:.2f}% of sales; penalty 15×loss%."


def score_max_dryout_days(max_days: Optional[float]) -> Tuple[float, str]:
    """§4.3 — Score = 100 − (max_days × 20)."""
    d = float(max_days or 0)
    s = 100.0 - (d * 20.0)
    return _clamp(s), f"Max consecutive dryout days (30d window basis): {d:.1f}."


class ROPerformanceScore(performance_score_factory.PerformanceIndex):
    """Retail (RO) weighted score: VA 30% + Nozzle pattern/loss 40% + Dryout 30%."""

    def __init__(self):
        super().__init__()
        self.bu = "RO"
        self.config: Optional[Dict[str, Any]] = None
        self.va_data: Dict[str, Any] = {}
        # One load per location per generate_performance_index (nozzle sales, dryout, daily CV)
        self._ro_location_id: Optional[str] = None
        self._cache_nozzle_sales: Optional[Dict[str, Any]] = None
        self._cache_dryout: Optional[Dict[str, Any]] = None
        self._cache_nozzle_daily: Optional[Tuple[List[float], Optional[float]]] = None

    async def initialize(self):
        base = os.path.dirname(performance_score_factory.__file__)
        path = os.path.join(base, "pi_masters", "ro_performance_rules.json")
        with open(path, encoding="utf-8") as f:
            self.config = json.load(f)

    async def configure_va(self, va_data):
        self.va_data = va_data or {}

    async def generate_performance_index(self, location_id=None):
        await self._ensure_ro_inputs(location_id)
        module_scores: Dict[str, Any] = {}
        total_weight = sum(m["weightage"] for m in self.config.values())
        for module_name, module in self.config.items():
            fn = getattr(self, f"_compute_{module_name.lower()}_pi_score")
            module_scores[module_name] = await fn(module_name, module, location_id)
        return module_scores, total_weight

    def _clear_ro_input_cache(self) -> None:
        self._ro_location_id = None
        self._cache_nozzle_sales = None
        self._cache_dryout = None
        self._cache_nozzle_daily = None

    async def _ensure_ro_inputs(self, location_id: Optional[str]) -> None:
        """Load nozzle sales, daily series/CV, and dryout (30d) once per location."""
        if not location_id:
            return
        loc = str(location_id).strip()
        if (
            self._ro_location_id == loc
            and self._cache_nozzle_sales is not None
            and self._cache_dryout is not None
            and self._cache_nozzle_daily is not None
        ):
            return
        self._clear_ro_input_cache()
        self._cache_nozzle_sales = await self._query_nozzle_sales_inputs(loc)
        self._cache_nozzle_daily = await self._query_nozzle_daily_volumes_30d(loc)
        self._cache_dryout = await self._query_dryout_inputs(loc, window_days=30, sales=self._cache_nozzle_sales)
        self._ro_location_id = loc

    async def _fetch_nozzle_sales_inputs(self, location_id: str) -> Dict[str, Any]:
        """Return cached nozzle aggregates for this location (populated in _ensure_ro_inputs)."""
        await self._ensure_ro_inputs(location_id)
        return dict(self._cache_nozzle_sales or {})

    async def _query_nozzle_sales_inputs(self, loc: str) -> Dict[str, Any]:
        """
        Rolling 30d / prior 30d on nozzle_sales only (no YoY windows — those need 12+ months
        of history; feeds often only retain ~6 months of nozzle data).
        """
        loc = loc.replace("'", "''")
        query = f"""
        WITH cur AS (
            SELECT COALESCE(SUM(sales_volume), 0)::float8 AS v
            FROM nozzle_sales
            WHERE sap_id = '{loc}'
              AND transaction_date::date >= CURRENT_DATE - INTERVAL '30 days'
              AND transaction_date::date < CURRENT_DATE
        ),
        prev AS (
            SELECT COALESCE(SUM(sales_volume), 0)::float8 AS v
            FROM nozzle_sales
            WHERE sap_id = '{loc}'
              AND transaction_date::date >= CURRENT_DATE - INTERVAL '60 days'
              AND transaction_date::date < CURRENT_DATE - INTERVAL '30 days'
        )
        SELECT cur.v AS cur_30d, prev.v AS prev_30d
        FROM cur, prev
        """
        try:
            resp = await hpcl_ceg_model.NozzleSales.get_aggr_data(query, limit=0)
            row = (resp.get("data") or [{}])[0]
        except Exception:
            row = {}
        cur_30 = float(row.get("cur_30d") or 0)
        prev_30 = float(row.get("prev_30d") or 0)

        growth_pct = None
        if prev_30 > 0:
            growth_pct = (cur_30 - prev_30) / prev_30 * 100.0
        elif cur_30 > 0:
            growth_pct = 100.0

        target = prev_30 * 1.05 if prev_30 > 0 else None
        achievement_pct = (cur_30 / target * 100.0) if target and target > 0 else None

        return {
            "growth_pct": growth_pct,
            "achievement_pct": achievement_pct,
            "yoy_pct": None,
            "cur_30d": cur_30,
            "prev_30d": prev_30,
        }

    async def _fetch_dryout_inputs(self, location_id: str, window_days: int = 30) -> Dict[str, Any]:
        """Use cached dryout for default 30d window; otherwise re-query alerts with same cached sales."""
        await self._ensure_ro_inputs(location_id)
        if window_days == 30 and self._cache_dryout is not None:
            return dict(self._cache_dryout)
        sap_key = str(location_id).strip()
        sales = self._cache_nozzle_sales or await self._query_nozzle_sales_inputs(sap_key)
        return await self._query_dryout_inputs(sap_key, window_days=window_days, sales=sales)

    async def _query_dryout_inputs(
        self, location_id: str, window_days: int = 30, sales: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Dryout episodes for this RO: merge alerts on (sap_id, product_code) with
        - 2h continuity (close/reopen churn counts as one episode),
        - multiple indent_no collapsed per episode (MIN start, MAX end),
        - window overlap: episode starts in window OR started before window and still open / ended after window start.
        """
        sap_key = str(location_id).strip()
        loc = sap_key.replace("'", "''")
        q_merged = f"""
        WITH base AS (
            SELECT
                id,
                sap_id,
                COALESCE(NULLIF(TRIM(product_code), ''), '') AS product_code,
                dry_out_start_time,
                dry_out_end_time
            FROM alerts
            WHERE interlock_name = 'Dry Out Each Indent Wise MainFlow'
              AND dry_out_start_time IS NOT NULL
              AND sap_id = '{loc}'
        ),
        ordered AS (
            SELECT
                id,
                sap_id,
                product_code,
                dry_out_start_time,
                dry_out_end_time,
                LAG(dry_out_end_time) OVER (
                    PARTITION BY sap_id, product_code
                    ORDER BY dry_out_start_time ASC, id ASC
                ) AS prev_end_time
            FROM base
        ),
        flagged AS (
            SELECT
                *,
                CASE
                    WHEN prev_end_time IS NULL THEN 1
                    WHEN dry_out_start_time <= prev_end_time + INTERVAL '2 hours' THEN 0
                    ELSE 1
                END AS new_group_flag
            FROM ordered
        ),
        grouped AS (
            SELECT
                *,
                SUM(new_group_flag) OVER (
                    PARTITION BY sap_id, product_code
                    ORDER BY dry_out_start_time ASC, id ASC
                    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                ) AS grp
            FROM flagged
        ),
        merged AS (
            SELECT
                sap_id,
                product_code,
                MIN(dry_out_start_time) AS start_time,
                MAX(dry_out_end_time) AS end_time,
                COUNT(*)::int AS alert_count
            FROM grouped
            GROUP BY sap_id, product_code, grp
        ),
        filtered AS (
            SELECT *
            FROM merged
            WHERE
                (
                    start_time >= (NOW() - INTERVAL '{window_days} days')
                    AND start_time <= NOW()
                )
                OR (
                    start_time < (NOW() - INTERVAL '{window_days} days')
                    AND (end_time IS NULL OR end_time >= (NOW() - INTERVAL '{window_days} days'))
                )
        )
        SELECT
            COALESCE((SELECT COUNT(*)::int FROM filtered), 0) AS episode_count,
            COALESCE(
                (SELECT MAX(
                    EXTRACT(EPOCH FROM (COALESCE(end_time, NOW()) - start_time)) / 86400.0
                ) FROM filtered),
                0
            )::float8 AS max_episode_days,
            COALESCE(
                (
                    SELECT json_agg(
                        json_build_object(
                            'sap_id', f.sap_id,
                            'product_code', f.product_code,
                            'start_time', f.start_time,
                            'end_time', f.end_time,
                            'alert_count', f.alert_count,
                            'duration_days', ROUND(
                                (
                                    EXTRACT(EPOCH FROM (COALESCE(f.end_time, NOW()) - f.start_time))
                                    / 86400.0
                                )::numeric,
                                4
                            )
                        )
                        ORDER BY f.start_time
                    )
                    FROM filtered f
                ),
                '[]'::json
            ) AS episodes_json
        """
        try:
            resp = await hpcl_ceg_model.Alerts.get_aggr_data(q_merged, limit=0)
            print("-" * 20)
            print(resp)
            print("-" * 20)
            row = (resp.get("data") or [{}])[0]
            cnt = row.get("episode_count") or 0
            max_days = float(row.get("max_episode_days") or 0)
            episodes_raw = row.get("episodes_json")
            if isinstance(episodes_raw, str):
                episodes_validation = json.loads(episodes_raw)
            elif isinstance(episodes_raw, list):
                episodes_validation = episodes_raw
            elif episodes_raw is None:
                episodes_validation = []
            else:
                episodes_validation = list(episodes_raw) if episodes_raw else []
        except Exception:
            cnt, max_days = 0, 0
            episodes_validation = []

        if sales is None:
            sales = await self._query_nozzle_sales_inputs(sap_key)
        total_30 = float(sales.get("cur_30d") or 0)
        est_daily = total_30 / 30.0 if total_30 > 0 else 0.0
        rough_loss_vol = float(cnt) * est_daily

        cris_loss = await self._fetch_ro_loss_of_sales(sap_key)
        if cris_loss is not None:
            loss_volume_est = float(cris_loss)
            loss_source = "cris_daily_product_dry_out"
        else:
            loss_volume_est = rough_loss_vol
            loss_source = "dryout_count_x_avg_daily_nozzle"

        loss_pct = (loss_volume_est / total_30 * 100.0) if total_30 > 0 else None
        loss_share = (loss_volume_est / total_30) if total_30 > 0 else None

        return {
            "dryout_count": float(cnt),
            "max_dryout_days": float(max_days),
            "loss_pct": loss_pct,
            "loss_volume_est": loss_volume_est,
            "loss_share_vs_nozzle_30d": loss_share,
            "loss_volume_cris": cris_loss,
            "loss_volume_rough": rough_loss_vol,
            "loss_source": loss_source,
            "dryout_episodes_validation": episodes_validation,
        }

    async def _fetch_ro_loss_of_sales(self, location_id: str) -> Optional[float]:
        """
        Last 30 days aggregate loss_of_sale from CRIS (HPCL_HOS.daily_product_dry_out).
        Returns None if the query fails so callers can fall back to a rough estimate.
        """
        loc = str(location_id).replace("'", "''")
        query = f"""
        SELECT COALESCE(SUM(dryout_hrs), 0)::float8 AS dryout_hrs,
               COALESCE(SUM(loss_of_sale), 0)::float8 AS loss_of_sale
        FROM "HPCL_HOS".daily_product_dry_out
        WHERE rosapcode = '{loc}'
          AND product_name IN ('MS', 'HSD', 'E20')
          AND executed_on >= CURRENT_DATE - INTERVAL '30 days'
        """
        try:
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.connection_id = connection_mapping.connection_mapping.get(
                "cris", "1"
            )
            dashboard_studio_model.Charts_Connection_Vault_RoutingParams.action = "execute_query"
            function = await charts_actions.charts_connection_vault_routing(
                dashboard_studio_model.Charts_Connection_Vault_RoutingParams
            )
            data = await function(query=query)
            return float(sum([row["loss_of_sale"] for row in data if
                       row.get("loss_of_sale", 0)])) if data else None
        except Exception:
            return None

    async def _fetch_nozzle_daily_volumes_30d(self, location_id: str) -> Tuple[List[float], Optional[float]]:
        """Daily total nozzle sales_volume for last 30 days; uses cache from _ensure_ro_inputs."""
        await self._ensure_ro_inputs(location_id)
        return self._cache_nozzle_daily or ([], None)

    async def _query_nozzle_daily_volumes_30d(self, loc: str) -> Tuple[List[float], Optional[float]]:
        """Daily total nozzle sales_volume for last 30 days; return (volumes, cv or None)."""
        loc = loc.replace("'", "''")
        query = f"""
        SELECT transaction_date::date AS d, SUM(sales_volume)::float8 AS vol
        FROM nozzle_sales
        WHERE sap_id = '{loc}'
          AND transaction_date::date >= CURRENT_DATE - INTERVAL '30 days'
          AND transaction_date::date < CURRENT_DATE
        GROUP BY transaction_date::date
        ORDER BY transaction_date::date
        """
        try:
            resp = await hpcl_ceg_model.NozzleSales.get_aggr_data(query, limit=0)
            rows = resp.get("data") or []
        except Exception:
            rows = []
        volumes = [float(r.get("vol") or 0) for r in rows if r.get("vol") is not None]
        if len(volumes) < 3:
            return volumes, None
        mean = statistics.mean(volumes)
        if mean <= 0:
            return volumes, None
        stdev = statistics.stdev(volumes) if len(volumes) > 1 else 0.0
        cv = stdev / mean
        return volumes, cv

    async def _compute_va_score_pi_score(self, name: str, rules: Dict, location_id: str):
        pi_score = []
        for rule in rules["rules"]:
            score = 0.0
            msg = ""
            details: Dict[str, Any] = {}
            if rule["model"] == "va_portal":
                raw_va = None
                if self.va_data:
                    try:
                        raw_va = float(self.va_data.get("OVERALL_SCORE", 0) or 0)
                    except (TypeError, ValueError):
                        raw_va = None
                if raw_va is not None:
                    va_overall = raw_va
                    score = round((va_overall * 10.0 * rule["weightage"]) / 100.0, 2)
                    msg = f"VA Portal overall score {va_overall}; scaled to rule weight."
                else:
                    va_overall = RO_VA_NEUTRAL_OVERALL
                    score = round((va_overall * 10.0 * rule["weightage"]) / 100.0, 2)
                    msg = (
                        "VA Portal data not available for this location; "
                        f"neutral {RO_VA_NEUTRAL_OVERALL}/10 applied (not scored as zero)."
                    )
                details = {
                    "va_overall_score_used": va_overall,
                    "va_neutral_applied": raw_va is None,
                }
            else:
                msg = f"Unknown VA rule model {rule.get('model')}"
            item = {
                "name": rule["name"],
                "score": score,
                "weightage": rule["weightage"],
                "module": rules.get("name", name),
                "msg": msg,
                "details": details,
            }
            item = psi.enhance_result_with_insights(item, rule["model"])
            pi_score.append(item)

        final = sum(s["score"] for s in pi_score)
        final = round((final * rules["weightage"]) / 100.0, 2)
        for rec in pi_score:
            rec["score"] = round(rec["score"], 2)
        module_result = {
            "name": rules.get("name", name),
            "score": final,
            "weightage": rules["weightage"],
            "results": pi_score,
        }
        module_result["insights"] = psi.generate_summary_insights(module_result)
        return module_result

    async def _compute_nozzle_sales_pattern_pi_score(self, name: str, rules: Dict, location_id: str):
        """
        TEMP replacement for SALES_PERFORMANCE: 30d daily nozzle pattern (stability)
        and comparison of nozzle 30d volume vs estimated dryout sales loss volume.
        """
        sales = await self._fetch_nozzle_sales_inputs(location_id)
        dry = await self._fetch_dryout_inputs(location_id, window_days=30)
        volumes, cv = await self._fetch_nozzle_daily_volumes_30d(location_id)

        pi_score = []
        for rule in rules["rules"]:
            model = rule["model"]
            raw = 0.0
            msg = ""
            if model == "nozzle_sales_30d_pattern":
                raw, msg = score_daily_nozzle_pattern_stability(cv)
            elif model == "nozzle_vs_sales_loss":
                share = dry.get("loss_share_vs_nozzle_30d")
                raw, msg = score_nozzle_vs_sales_loss_share(share)
            else:
                raw, msg = 0.0, f"Unknown nozzle pattern model {model}"
            rw = float(rule["weightage"])
            mscore = round((raw * rw) / 100.0, 2)
            item = {
                "name": rule["name"],
                "score": mscore,
                "weightage": rule["weightage"],
                "module": rules.get("name", name),
                "msg": msg,
                "details": {
                    "metric_score_0_100": round(raw, 2),
                    "nozzle_30d_total": sales.get("cur_30d"),
                    "daily_days_observed": len(volumes),
                    "daily_volume_cv": cv,
                    "loss_volume_est": dry.get("loss_volume_est"),
                    "loss_volume_cris": dry.get("loss_volume_cris"),
                    "loss_volume_rough": dry.get("loss_volume_rough"),
                    "loss_source": dry.get("loss_source"),
                    "loss_share_vs_nozzle_30d": dry.get("loss_share_vs_nozzle_30d"),
                    "dryout_episodes_validation": dry.get("dryout_episodes_validation"),
                },
            }
            item = psi.enhance_result_with_insights(item, model)
            pi_score.append(item)

        section = sum(s["score"] for s in pi_score)
        final = round((section * rules["weightage"]) / 100.0, 2)
        module_result = {
            "name": rules.get("name", name),
            "score": final,
            "weightage": rules["weightage"],
            "results": pi_score,
        }
        module_result["insights"] = psi.generate_summary_insights(module_result)
        return module_result

    async def _compute_dryout_patterns_pi_score(self, name: str, rules: Dict, location_id: str):
        pi_score = []
        window = 30
        if rules.get("rules"):
            window = int(rules["rules"][0].get("time_window_days") or 30)
        dry = await self._fetch_dryout_inputs(location_id, window_days=window)
        for rule in rules["rules"]:
            model = rule["model"]
            raw = 0.0
            msg = ""
            if model == "dryout_frequency_30d":
                raw, msg = score_dryout_frequency(dry.get("dryout_count"))
            elif model == "dryout_sales_loss_30d":
                raw, msg = score_dryout_sales_loss(dry.get("loss_pct"))
            elif model == "max_dryout_days_30d":
                raw, msg = score_max_dryout_days(dry.get("max_dryout_days"))
            else:
                raw, msg = 0.0, f"Unknown dryout model {model}"
            rw = float(rule["weightage"])
            mscore = round((raw * rw) / 100.0, 2)
            item = {
                "name": rule["name"],
                "score": mscore,
                "weightage": rule["weightage"],
                "module": rules.get("name", name),
                "msg": msg,
                "details": {"metric_score_0_100": round(raw, 2), "dryout": dry},
            }
            item = psi.enhance_result_with_insights(item, model)
            pi_score.append(item)

        section = sum(s["score"] for s in pi_score)
        final = round((section * rules["weightage"]) / 100.0, 2)
        module_result = {
            "name": rules.get("name", name),
            "score": final,
            "weightage": rules["weightage"],
            "results": pi_score,
        }
        module_result["insights"] = psi.generate_summary_insights(module_result)
        return module_result
