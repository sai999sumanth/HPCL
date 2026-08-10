"""
Parse **Detailed Report** sheet from Daily CMD DPR workbooks (layout may vary by section).

Each GA line is **one JSON object**: ``gv_name`` (text before ``'`` in the section title,
e.g. ``HPCL's GA`` → ``HPCL``), ``ga_name``, plus **flat snake_case keys** for every metric
column (no nested ``actual_achieved_on`` /
``other_metrics``). Headers like ``Actual achieved on 04/04/26`` become e.g.
``actual_achieved_on_04_04_26``; cumulative columns ``Actual achieved till …`` become
``actual_achieved_till_…``.

This module does not import other orchestrator natural_gas sync modules (avoids cycles).
"""
from __future__ import annotations

import json
import math
import re
from typing import Any, Dict, List, Optional, Tuple, Union

import pandas as pd

PREFIX_ACTUAL_ON = "actual achieved on "
PREFIX_ACTUAL_TILL = "actual achieved till "


def _gv_name_from_section_header(header: str) -> str:
    """Section title like ``HPCL's GA`` → ``HPCL`` (substring before ``'``)."""
    t = str(header).strip()
    if "'" in t:
        return t.split("'", 1)[0].strip()
    return t


def _cell(row: pd.Series, j: int) -> str:
    if j >= len(row):
        return ""
    v = row.iloc[j]
    if v is None or (isinstance(v, float) and (math.isnan(v) or pd.isna(v))):
        return ""
    return str(v).strip()


def _num(v: Any) -> Optional[float]:
    if v is None or (isinstance(v, float) and (math.isnan(v) or pd.isna(v))):
        return None
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return float(v)
    try:
        return float(str(v).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def _json_safe_number(val: Optional[float]) -> Optional[Union[int, float]]:
    if val is None:
        return None
    if isinstance(val, float) and val == int(val):
        return int(val)
    return val


def _normalize_metric_field_name(header: str) -> str:
    """Excel header text -> stable snake_case key (one flat field per metric)."""
    h = re.sub(r"\s+", " ", str(header).strip())
    low = h.lower()
    if low.startswith(PREFIX_ACTUAL_ON):
        rest = h[len(PREFIX_ACTUAL_ON) :].strip()
        rest = re.sub(r"[^\w\d]+", "_", rest).strip("_")
        return f"actual_achieved_on_{rest}" if rest else "actual_achieved_on"
    if low.startswith(PREFIX_ACTUAL_TILL):
        rest = h[len(PREFIX_ACTUAL_TILL) :].strip()
        rest = re.sub(r"[^\w\d]+", "_", rest).strip("_")
        return f"actual_achieved_till_{rest}" if rest else "actual_achieved_till"
    key = re.sub(r"[^\w\s.-]", "", h)
    key = re.sub(r"\s+", "_", key.strip()).lower()
    return key or "metric"


def _is_section_title_row(row: pd.Series) -> bool:
    c1 = _cell(row, 1).lower()
    c2 = _cell(row, 2)
    return bool(c1 and c2 == "Backlog" and c1.endswith("'s ga"))


def _is_subheader_row(row: pd.Series) -> bool:
    return _cell(row, 2) == "LMC (Registration - LMC)" and _cell(row, 3) == "NGC (LMC-NGC)"


def _is_total_row(row: pd.Series) -> bool:
    return _cell(row, 1).lower() == "total"


def _build_schema(
    title_row: pd.Series, sub_row: pd.Series
) -> Tuple[Dict[int, str], str]:
    """
    Returns (col_index -> flat field name, gv_name).
    """
    raw_title = _cell(title_row, 1)
    gv_name = _gv_name_from_section_header(raw_title)
    field_by_index: Dict[int, str] = {}
    n = max(len(title_row), len(sub_row))
    for j in range(n):
        h1 = _cell(title_row, j)
        h2 = _cell(sub_row, j)
        if j == 1:
            field_by_index[j] = "ga_name"
            continue
        if j == 2:
            field_by_index[j] = "backlog_lmc_registration_to_lmc"
            continue
        if j == 3:
            field_by_index[j] = "ngc_lmc_to_ngc"
            continue
        if j == 4:
            field_by_index[j] = "connection_target_day_wise"
            continue
        if not h1 and not h2:
            continue
        top = h1 or h2
        field_by_index[j] = _normalize_metric_field_name(top)

    return field_by_index, gv_name


def _row_to_flat_record(
    row: pd.Series,
    field_by_index: Dict[int, str],
    *,
    gv_name: str,
) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "gv_name": gv_name,
        "ga_name": _cell(row, 1),
    }
    for j, fname in field_by_index.items():
        if j == 1 or fname == "ga_name":
            continue
        if j >= len(row):
            continue
        val = _num(row.iloc[j])
        if val is None:
            continue
        out[fname] = _json_safe_number(val)
    return out


def parse_detailed_report_dataframe(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """
    Parse raw **Detailed Report** data (``header=None`` from :func:`pd.read_excel`).

    Rebuilds column schema on each section block (e.g. HPCL's GA vs BGL's GA) because
    headers can differ by section.
    """
    records: List[Dict[str, Any]] = []
    i = 0
    field_by_index: Dict[int, str] = {}
    gv_name = ""

    while i < len(df):
        row = df.iloc[i]
        if _is_section_title_row(row):
            if i + 1 >= len(df):
                break
            sub = df.iloc[i + 1]
            if not _is_subheader_row(sub):
                i += 1
                continue
            field_by_index, gv_name = _build_schema(row, sub)
            i += 2
            continue
        if not field_by_index:
            i += 1
            continue
        if _is_subheader_row(row):
            i += 1
            continue
        if _is_total_row(row):
            i += 1
            continue
        if not _cell(row, 1):
            i += 1
            continue

        rec = _row_to_flat_record(
            row,
            field_by_index,
            gv_name=gv_name,
        )
        records.append(rec)
        i += 1

    return records


def json_safe_detailed_records(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Ensure plain Python types for JSON (ints where whole numbers)."""
    out: List[Dict[str, Any]] = []
    for r in records:
        row: Dict[str, Any] = {}
        for k, v in r.items():
            if isinstance(v, float) and v == int(v):
                row[k] = int(v)
            else:
                row[k] = v
        out.append(row)
    return out


def decode_detailed_report_workbook(
    path_or_file: Union[str, Any],
    *,
    sheet_name: str = "Detailed Report",
) -> Dict[str, Any]:
    """
    Load workbook and return JSON-serializable payload for the **Detailed Report** sheet.

    ``detailed_report`` is a list of **flat** row dicts (one per GA line item).

    ``path_or_file`` may be a path or file-like object (e.g. ``BytesIO``).
    """
    xls = pd.ExcelFile(path_or_file)
    name = _find_sheet(xls.sheet_names, sheet_name)
    if not name:
        return {
            "sheet": None,
            "sheets_present": list(xls.sheet_names),
            "detailed_report": [],
            "error": f"Sheet matching {sheet_name!r} not found",
        }
    raw = pd.read_excel(xls, sheet_name=name, header=None)
    rows = parse_detailed_report_dataframe(raw)
    return {
        "sheet": name,
        "sheets_present": list(xls.sheet_names),
        "detailed_report": json_safe_detailed_records(rows),
    }


def _find_sheet(names: List[str], want: str) -> Optional[str]:
    w = want.strip().lower().replace(" ", "")
    for s in names:
        if s.strip().lower().replace(" ", "") == w:
            return s
    for s in names:
        if want.strip().lower() in s.strip().lower():
            return s
    return None


def detailed_report_summary_json(
    path_or_file: Union[str, Any],
    *,
    sheet_name: str = "Detailed Report",
) -> str:
    """Convenience: return pretty-printed JSON string for CLI / logging."""
    payload = decode_detailed_report_workbook(path_or_file, sheet_name=sheet_name)
    return json.dumps(payload, indent=2, default=str)


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print(
            "Usage: python -m orchestrator.natural_gas.daily_cmd_dpr_detailed_report <path.xlsx>"
        )
        sys.exit(1)
    print(detailed_report_summary_json(sys.argv[1]))
