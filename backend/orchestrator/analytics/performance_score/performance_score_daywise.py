import urdhva_base
import json
from datetime import datetime
from decimal import Decimal
from hpcl_ceg_model import PerformanceScoreHistory


TAS_CATEGORIES = {
    "Safety_Interlocks",
    "Gantry_Interlocks",
    "Process_Interlocks",
    "Water_Quantity",
    "Foam_Quantity",
    "Fire_Engines_In_Auto_Mode",
    "Hydrant_Line",
}


def sanitize_records(records):
    return [
        {k: float(v) if isinstance(v, Decimal) else v for k, v in row.items()}
        for row in records
    ]


def resolve_tas_with_categories(categories):
    tas = next((c for c in categories if c.get("name") == "TAS"), None)

    if not tas or not tas.get("results"):
        return {"categories": []}

    tas_categories = [
        c for c in tas["results"]
        if c.get("name") in TAS_CATEGORIES
    ]

    return {
        "categories": [
            {
                "name": c.get("name"),
                "score": c.get("score"),
                "weightage": c.get("weightage"),
                "module": c.get("name"),
                "categories": [
                    {
                        "name": r.get("name"),
                        "score": r.get("score"),
                        "weightage": r.get("weightage"),
                        "module": r.get("module"),
                    }
                    for r in c.get("results", [])
                ],
            }
            for c in tas_categories
        ]
    }


def add_filters(query_str, key, values):
    if not values:
        return query_str

    if isinstance(values, list):
        query_str += f" AND {key} IN {tuple(values)}"
    else:
        query_str += f" AND {key} = '{values}'"

    return query_str


# ================= MAIN API =================
async def performance_score_daywise_action(data):

    query_str = f"bu = '{data.bu}'"

    if data.start_date:
        query_str += f" AND created_at::date >= '{data.start_date}'"

    if data.end_date:
        query_str += f" AND created_at::date <= '{data.end_date}'"

    if data.zone:
        query_str = add_filters(query_str, "zone", data.zone)

    if data.name:
        query_str = add_filters(query_str, "name", data.name)

    where_clause = query_str

    query = f"""
        SELECT DISTINCT ON (zone, name, created_at::date)
            zone,
            name,
            created_at::date AS score_date,
            category
        FROM performance_score_history
        WHERE {where_clause}
        ORDER BY zone, name, created_at::date, created_at DESC;
    """

    resp = await urdhva_base.BasePostgresModel.get_aggr_data(query, limit=0)
    grouped = sanitize_records(resp.get("data", []))

    if not grouped:
        return {"status": "success", "zones": []}

    zones_map = {}

    # overall
    zone_scores = {}
    plant_scores = {}

    # day-wise
    date_zone_scores = {}
    date_plant_scores = {}

    for row in grouped:
        zone = row["zone"]
        plant = row["name"]
        score_date = str(row["score_date"])
        category = row["category"]

        if isinstance(category, str):
            category = json.loads(category)

        # Extract ONLY TAS score
        tas_entry = next(
            (c for c in category if c.get("name") == "TAS"),
            None
        )

        if not tas_entry:
            continue

        raw_score = tas_entry.get("score", 0)

        # Convert safely for response display
        try:
            score_val = float(raw_score)
        except (ValueError, TypeError):
            score_val = 0

        # -------- Always append for response (even if 0) --------
        score_data = {
            "date": score_date,
            "name": "TAS",
            "score": score_val,
            "categories": resolve_tas_with_categories(category).get("categories", [])
        }

        zones_map.setdefault(zone, {}).setdefault(plant, []).append(score_data)

        # -------- Only use VALID NON-ZERO scores for averages --------
        if raw_score in (None, "", 0, "0"):
            continue

        try:
            valid_score = float(raw_score)
        except (ValueError, TypeError):
            continue

        if valid_score == 0:
            continue

        # ---------- overall ----------
        zone_scores.setdefault(zone, []).append(valid_score)
        plant_scores.setdefault((zone, plant), []).append(valid_score)

        # ---------- day-wise ----------
        date_zone_scores.setdefault(score_date, {}).setdefault(zone, []).append(valid_score)
        date_plant_scores.setdefault(score_date, {}).setdefault(plant, []).append(valid_score)

    # ================= SAFE AVERAGE FUNCTION =================
    def safe_avg(values):
        return round(sum(values) / len(values), 2) if values else 0

    # ================= OVERALL AVERAGES =================
    zone_avg = safe_avg([
        safe_avg(v) for v in zone_scores.values() if v
    ])

    plant_avg = safe_avg([
        safe_avg(v) for v in plant_scores.values() if v
    ])

    # ================= DAY-WISE ZONE AVG =================
    zone_avg_daywise = []

    for date, zones in sorted(date_zone_scores.items()):
        zone_level_avgs = [
            safe_avg(scores) for scores in zones.values() if scores
        ]
        zone_avg_daywise.append({
            "date": date,
            "avg_score": safe_avg(zone_level_avgs)
        })

    # ================= DAY-WISE PLANT AVG =================
    plant_avg_daywise = []

    for date, plants in sorted(date_plant_scores.items()):
        plant_level_avgs = [
            safe_avg(scores) for scores in plants.values() if scores
        ]
        plant_avg_daywise.append({
            "date": date,
            "avg_score": safe_avg(plant_level_avgs)
        })

    # ================= RESPONSE =================
    return {
        "status": "success",
        "score_type": data.score_type,
        "zone_avg": zone_avg,
        "plant_avg": plant_avg,
        "zone_avg_daywise": zone_avg_daywise,
        "plant_avg_daywise": plant_avg_daywise,
        "zones": [
            {
                "zone": zone,
                "plants": [
                    {
                        "name": plant,
                        "daywise_scores": sorted(scores, key=lambda x: x["date"])
                    }
                    for plant, scores in plants.items()
                ]
            }
            for zone, plants in zones_map.items()
        ]
    }
