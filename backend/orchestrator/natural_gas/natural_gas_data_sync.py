import urdhva_base

import io
import json
import sys
import uuid
import typing
import asyncio
import fastapi
import datetime
import hpcl_ceg_model
import urdhva_base.redispool
import dateutil.parser as dateutil_parser
from fastapi.encoders import jsonable_encoder
import orchestrator.natural_gas.daily_cmd_dpr_detailed_report as ng_dpr_detail

_LMC_KEY = "backlog_lmc_registration_to_lmc"
_NGC_KEY = "ngc_lmc_to_ngc"
_TARGET_KEY = "connection_target_day_wise"
_ACTUAL_ON_PREFIX = "actual_achieved_on"
_ACTUAL_TILL_PREFIX = "actual_achieved_till"


def _to_int(val: typing.Any, default: int = 0) -> int:
    if val is None:
        return default
    if isinstance(val, bool):
        return int(val)
    if isinstance(val, int):
        return val
    if isinstance(val, float):
        return int(val)
    try:
        return int(str(val).replace(",", "").strip())
    except (TypeError, ValueError):
        return default


def _conn_date_from_prefixed_key(key: str, prefix: str) -> typing.Optional[datetime.date]:
    """Map ``{prefix}`` / ``{prefix}_DD_MM_YY`` to a calendar date."""
    if key == prefix:
        return datetime.date.today()
    sep = prefix + "_"
    if not key.startswith(sep):
        return None
    rest = key[len(sep) :]
    nums: typing.List[int] = []
    for part in rest.split("_"):
        if part.isdigit():
            nums.append(int(part))
    if len(nums) >= 3:
        day, month, year = nums[0], nums[1], nums[2]
        if year < 100:
            year += 2000
        try:
            return datetime.date(year, month, day)
        except ValueError:
            return None
    return None


def _is_metric_key(key: str, prefix: str) -> bool:
    return key == prefix or key.startswith(prefix + "_")


def _append_gv_row_for_key(
    out: typing.List[typing.Dict[str, typing.Any]],
    flat: typing.Dict[str, typing.Any],
    key: str,
    value: typing.Any,
    prefix: str,
) -> None:
    gv = flat.get("gv_name")
    ga = flat.get("ga_name")
    if not gv or not ga:
        return
    conn_date = _conn_date_from_prefixed_key(key, prefix)
    if conn_date is None:
        return
    out.append(
        {
            "gv_name": str(gv).strip(),
            "ga_name": str(ga).strip(),
            "conn_date": conn_date,
            "achieved_count": _to_int(value, 0),
            "day_wise_target": _to_int(flat.get(_TARGET_KEY), 0),
            "backlog_lmc": _to_int(flat.get(_LMC_KEY), 0),
            "backlog_ngc": _to_int(flat.get(_NGC_KEY), 0),
        }
    )


def flat_detailed_rows_to_gv_split(
    rows: typing.List[typing.Dict[str, typing.Any]],
) -> typing.Dict[str, typing.List[typing.Dict[str, typing.Any]]]:
    """
    Expand flat Detailed Report rows into two daywise lists:

    * ``detailed_report`` — one row per ``actual_achieved_on*`` column.
    * ``summary`` — one row per ``actual_achieved_till*`` column (cumulative / till-date).

    Same field shape as ``NaturalGasGVConnections`` rows.
    """
    detailed_report: typing.List[typing.Dict[str, typing.Any]] = []
    summary: typing.List[typing.Dict[str, typing.Any]] = []

    for flat in rows:
        for k, v in flat.items():
            if k in ("gv_name", "ga_name", _LMC_KEY, _NGC_KEY, _TARGET_KEY):
                continue
            if _is_metric_key(k, _ACTUAL_ON_PREFIX):
                _append_gv_row_for_key(detailed_report, flat, k, v, _ACTUAL_ON_PREFIX)
            elif _is_metric_key(k, _ACTUAL_TILL_PREFIX):
                _append_gv_row_for_key(summary, flat, k, v, _ACTUAL_TILL_PREFIX)

    return {"detailed_report": detailed_report, "consolidated": summary}


async def convert_dpr_file_data(file_pointer: fastapi.UploadFile):
    """
    Parse uploaded workbook **Detailed Report** sheet; cache ``detailed_report`` and
    ``summary`` daywise lists in Redis for ``/naturalgasgvconnections/confirm_data_sync``.
    """
    raw = await file_pointer.read()
    buf = io.BytesIO(raw)
    resp = ng_dpr_detail.decode_detailed_report_workbook(buf)
    flat_rows = resp.get("detailed_report", [])
    if resp.get("error") or flat_rows is None:
        return fastapi.responses.JSONResponse(
            status_code=400,
            content={"message": resp.get("error") or "Detailed Report sheet missing or empty"},
        )
    if len(flat_rows) == 0:
        return fastapi.responses.JSONResponse(
            status_code=400,
            content={"message": "No GA rows parsed from Detailed Report"},
        )
    split = flat_detailed_rows_to_gv_split(flat_rows)
    if not split["detailed_report"] and not split["summary"]:
        return fastapi.responses.JSONResponse(
            status_code=400,
            content={
                "message": "No actual_achieved_on / actual_achieved_till columns with parseable dates.",
            },
        )
    unique_id = str(uuid.uuid4()).replace("-", "")
    r_ins = await urdhva_base.redispool.get_redis_connection()
    await r_ins.setex(
        f"natural_gas_connections_{unique_id}",
        10 * 60,
        json.dumps(split, default=str),
    )
    await r_ins.close()
    return fastapi.responses.JSONResponse(
        content=jsonable_encoder({
            "ack_id": unique_id,
            "payload": split,
        })
    )


async def sync_dpr_data(ack_id: str):
    """
    Load cached payload from Redis and upsert into
    :class:`hpcl_ceg_model.NaturalGasGVConnections` (detailed_report + summary rows).
    """
    r_ins = await urdhva_base.redispool.get_redis_connection()
    raw = await r_ins.get(f"natural_gas_connections_{ack_id}")
    await r_ins.close()
    if not raw:
        return False, "Expired records, Please upload file again"
    data = json.loads(raw)
    if not data['detailed_report']:
        return False, "Unknown cached payload format or no rows to sync."
    for row in data['consolidated']:
        q = f"""gv_name='{row["gv_name"]}' AND ga_name='{row["ga_name"]}' AND conn_date='{row["conn_date"]}'"""
        q_parmas = urdhva_base.queryparams.QueryParams(q=q,limit=1)
        resp = await hpcl_ceg_model.NaturalGasGVConnections.get_all(q_parmas, resp_type='')
        if not resp['data']:
            data['detailed_report'].append(row)
        else:
            continue
    for rec in data['detailed_report']:
        rec['conn_date'] = dateutil_parser.parse(rec['conn_date']).date()
    await hpcl_ceg_model.NaturalGasGVConnections.bulk_update(data['detailed_report'], upsert=True)
    return True, f"Synced {len(data['detailed_report'])} NaturalGasGVConnections row(s))."


async def main(file_path) -> None:
    resp = ng_dpr_detail.decode_detailed_report_workbook(file_path)
    split = flat_detailed_rows_to_gv_split(resp["detailed_report"])
    print(json.dumps(split, default=str))
    from orchestrator.aggregate_query_gateway import query_aggregate_gateway
    print(await query_aggregate_gateway(
        table="natural_gas_gv_connections",
        filters={},
        date_column="conn_date",
        date_from=datetime.date(2026, 4, 1),
        date_to=datetime.date(2026, 4, 8),
        group_by=["gv_name", "conn_date"],
        aggregations=[("Total", "sum", "achieved_count")],
        order_by=[("Total", "desc")],
    ))


if __name__ == "__main__":
    if len(sys.argv) == 1:
        print("Usage: python natural_gas_data_sync.py <file_path>")
        sys.exit(1)
    else:
        asyncio.run(main(sys.argv[1]))
