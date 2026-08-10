"""
Novex daily combined report — same logic as novex_daily_report_combined_vamsi_test.py.

Recipients are taken from the legacy single-audience scripts (not from the vamsi-only file):
  testing  → novex_daily_report_dryout_testing.py
  employee → novex_daily_report_dryout.py
  chairman → novex_daily_report_segregation.py

Failure-summary email uses the same To/CC/BCC as seg1 (daily) for that audience.
See novex_daily_report_combined_vamsi_test module docstring for segments and CLI examples
(substitute this module name in -m / path).

Examples:
  python -m orchestrator.reporting_services.novex_daily_report_combined_audience_emails testing
  python -m orchestrator.reporting_services.novex_daily_report_combined_audience_emails 'employee[retail, lpg]'

Usage:
    python novex_daily_report_combined_audience_emails.py testing
    python novex_daily_report_combined_audience_emails.py 'testing[retail, lpg]'
    python novex_daily_report_combined_audience_emails.py testing [retail]
    python novex_daily_report_combined_audience_emails.py testing retail
    python novex_daily_report_combined_audience_emails.py testing nozzle
    python novex_daily_report_combined_audience_emails.py employee
    python novex_daily_report_combined_audience_emails.py chairman

  """
from __future__ import annotations

import urdhva_base
import argparse
import html
import os   
import sys
import asyncio
import traceback
import jinja2
import hpcl_ceg_model
import urdhva_base.utilities
from types import SimpleNamespace
import utilities.helpers as helpers
import orchestrator.notification_manager.notification_factory as notification_factory
from orchestrator.reporting_services.reporting_helpers import (
    get_alert_data,
    lpg_data,
    retail_data,
    sales_data,
    sod_data,
    ro_va_cleanliness,
    nozzle_sales_trend,
)

WRITE_TO_DB = False

# --segments canonical keys: daily=seg1 (Novex Daily Report), retail, lpg, sod, combined=seg5, clean=MIS
SEGMENT_ALIASES: dict[str, str] = {
    "daily": "daily",
    "seg1": "daily",
    "main": "daily",
    "novex": "daily",
    "retail": "retail",
    "lpg": "lpg",
    "sod": "sod",
    "combined": "combined",
    "seg5": "combined",
    "full": "combined",
    "bundle": "combined",
    "clean": "clean",
    "toilet": "clean",
    "mis": "clean",
    "nozzle": "nozzle",
    "trend": "nozzle",
    "nozzle_trend": "nozzle",
}


async def get_email_users_by_type(email_type:str, audience: str):
    all_users = await hpcl_ceg_model.DailyEmailNotificationUsers.get_all(resp_type='plain')
    print("all uers from db ---->\n", all_users)
    result = {}
    for users in all_users["data"]:
        if users.get("audience") == audience and users.get("email_type").lower() == email_type:
            print("matched user ---->\n", users)
            email_type = users.get("email_type").lower()
            print("email type ---->\n", email_type)
            to_recipients = users.get("to_recipients", [])
            print("to recipients ---->\n", to_recipients)
            cc_recipients = users.get("cc_recipients", [])
            print("cc recipients ---->\n", cc_recipients)
            bcc_recipients = users.get("bcc_recipients", [])
            print("bcc recipients ---->\n", bcc_recipients)
            subject = users.get("subject")
            print("subject ---->\n", subject)

            result.setdefault(f"{email_type}_to", [])
            result.setdefault(f"{email_type}_cc", [])
            result.setdefault(f"{email_type}_bcc", [])
            result.setdefault(f"{email_type}_subject", subject)

            result[f"{email_type}_to"].extend(to_recipients)
            result[f"{email_type}_cc"].extend(cc_recipients)
            result[f"{email_type}_bcc"].extend(bcc_recipients)

    print("result ----->\n", result)
    return result


async def _segment_set_wants(segments: frozenset[str] | None, key: str) -> bool:
    """If segments is None, all segments are wanted; else only keys in the set."""
    return segments is None or key in segments


def _data_needed(segments: frozenset[str] | None, *segment_keys: str) -> bool:
    """
    When segments is None, load all data (full run).
    Otherwise run a data step if any requested segment needs it.
    """
    if segments is None:
        return True
    return bool(segments.intersection(segment_keys))


def _parse_segments_arg(raw: list[str] | None) -> frozenset[str] | None:
    if raw is None:
        return None
    out: set[str] = set()
    for item in raw:
        for part in item.replace(";", ",").split(","):
            part = part.strip().lower()
            if not part:
                continue
            canon = SEGMENT_ALIASES.get(part)
            if canon is None:
                valid = "daily, retail, lpg, sod, combined, clean, nozzle"
                raise SystemExit(
                    f"Unknown segment {part!r}. Use one or more of: {valid} "
                    "(aliases: seg1→daily, seg5→combined, mis/toilet→clean)."
                )
            out.add(canon)
    return frozenset(out)


def _split_audience_brackets(token: str) -> tuple[str, list[str] | None]:
    """Parse testing[retail, lpg] → ('testing', ['retail', 'lpg']); testing → ('testing', None for all mails)."""
    token = token.strip()
    if "[" not in token:
        return token.lower(), None
    if not token.endswith("]"):
        raise SystemExit(f"Invalid audience {token!r}: missing closing ]")
    base, _, rest = token.partition("[")
    inner = rest[:-1].strip()
    audience = base.strip().lower()
    if not inner:
        return audience, None
    parts = [p.strip() for p in inner.replace(";", ",").split(",") if p.strip()]
    return audience, parts if parts else None


def _merge_positional_audience(pos: list[str]) -> str:
    """
    Shell splits `testing [retail]` into two argv entries — merge back to testing[retail].
    Also merges `testing [retail, lpg]` split as ['testing', '[retail,', 'lpg]'].
    Optional: `testing retail` → testing[retail] when second word is a known segment name.
    """
    if len(pos) == 1:
        return pos[0].strip()
    if len(pos) >= 2 and pos[1].startswith("["):
        return pos[0].strip() + "".join(pos[1:])
    if len(pos) == 2:
        aud = pos[0].strip().lower()
        seg = pos[1].strip().lower()
        _audiences = frozenset({"testing", "employee", "chairman"})
        if aud in _audiences and (seg in SEGMENT_ALIASES or seg in set(SEGMENT_ALIASES.values())):
            return f"{aud}[{seg}]"
    raise SystemExit(
        "Provide one audience (optionally with segments). Examples:\n"
        "  python novex_daily_report_combined_audience_emails.py testing\n"
        "  python novex_daily_report_combined_audience_emails.py 'testing[retail, lpg]'\n"
        "  python novex_daily_report_combined_audience_emails.py testing [retail]\n"
        "  python novex_daily_report_combined_audience_emails.py testing retail\n"
        "  python novex_daily_report_combined_audience_emails.py testing nozzle\n"
        "Optional prefix: true"
    )


def _safe_exc_str(exc: BaseException) -> str:
    """Never raise: some wrappers (e.g. asyncpg RaiseError) break __str__."""
    try:
        s = str(exc)
        if isinstance(s, str) and s:
            return f"{type(exc).__name__}: {s}"
    except Exception:
        pass
    try:
        return f"{type(exc).__name__}: {repr(exc)}"
    except Exception:
        pass
    return f"{type(exc).__name__}: <exception str() failed>"


def _failure_message_with_traceback(exc: BaseException) -> str:
    """Same text as typical log output: safe message plus full traceback."""
    return f"{_safe_exc_str(exc)}\n\n--- Traceback ---\n{traceback.format_exc()}"


def _mark_sod_data_failed(sod_state: dict | None) -> None:
    if sod_state is not None:
        sod_state["failed"] = True


async def _merge_awaitable_dict(
    failures: list[tuple[str, str]],
    status_data: dict,
    job_label: str,
    coro,
    *,
    sod_state: dict | None = None,
) -> None:
    """Merge result of an awaitable into status_data; record failure and continue on error."""
    try:
        data = await coro
        if data is None:
            failures.append((job_label, "Returned None (upstream error or timeout)"))
            _mark_sod_data_failed(sod_state)
            return
        if not isinstance(data, dict):
            failures.append((job_label, f"Expected dict, got {type(data).__name__}"))
            _mark_sod_data_failed(sod_state)
            return
        status_data.update(data)
    except Exception as exc:
        failures.append((job_label, _failure_message_with_traceback(exc)))
        _mark_sod_data_failed(sod_state)
        traceback.print_exc()


def _merge_sync_dict(
    failures: list[tuple[str, str]],
    status_data: dict,
    job_label: str,
    fn,
) -> None:
    """Merge result of a sync callable into status_data; record failure and continue on error."""
    try:
        data = fn()
        if data is None:
            # ro_va_cleanliness.main() catches API errors and returns None; stderr has Read timeout etc.
            detail = (
                "No dict returned — ro_va_cleanliness API likely failed (check stdout for "
                "HTTPSConnectionPool / Read timed out or other HTTP errors)"
            ) if fn is ro_va_cleanliness.main else "Returned None (upstream error or timeout)"
            failures.append((job_label, detail))
            return
        if not isinstance(data, dict):
            failures.append((job_label, f"Expected dict, got {type(data).__name__}"))
            return
        status_data.update(data)
    except Exception as exc:
        failures.append((job_label, _failure_message_with_traceback(exc)))
        traceback.print_exc()


def dict_to_object(d):
    """Convert dictionary to object (recursively for nested dictionaries)."""
    if isinstance(d, list):
        return [dict_to_object(i) for i in d]
    if isinstance(d, dict):
        return SimpleNamespace(**{k: dict_to_object(v) for k, v in d.items()})
    return d


# _SOD_DATA_PY = "orchestrator/reporting_services/reporting_helpers/sod_data.py"
_SOD_DATA_PY = os.path.join(
        os.path.dirname(hpcl_ceg_model.__file__),
        '..', 'orchestrator', 'reporting_services',
        'reporting_helpers', 'sod_data.py'
        )

def _apply_sod_placeholders_for_partial_seg1(status_data: dict) -> None:
    """seg1.html uses sod_blocked_data_resp.*; fill when SOD pipeline did not merge."""
    status_data.setdefault(
        "sod_blocked_data_resp",
        {
            "TTs_Blocked_by_Novex_SOD": "N/A",
            "TTs_Manually_Unblocked_SOD": "N/A",
            "TTs_Auto_Unblocked_SOD": "N/A",
            "TTs_currently_under_Block_SOD": "N/A",
        },
    )


def _extract_sod_root_error(failures: list[tuple[str, str]]) -> str | None:
    for label, msg in failures:
        if "VTS SOD blocked" in label:
            return msg
    for label, msg in failures:
        if label.startswith("Data:") and "SOD" in label:
            return msg
    return None


def _infer_error_type(msg: str) -> str:
    m = (msg or "").lower()
    if any(
        x in m
        for x in (
            "connection",
            "too many connections",
            "timeout",
            "asyncpg",
            "operationalerror",
            "could not connect",
            "server closed",
            "ssl",
            "database",
            "password authentication",
        )
    ):
        return "Database Connection Error"
    if any(
        x in m
        for x in (
            "undefined",
            "jinja",
            "keyerror",
            "attributeerror",
            "typeerror",
            "nameerror",
            "template",
            "templateerror",
            "render",
        )
    ):
        return "Application/Error in Code"
    return "Unknown / Other Error"


def _failure_bracket_label(label: str) -> str | None:
    """Map internal step label to short bracket tag for subject (email steps only). No 'Combined' tag."""
    if label.startswith("Email:"):
        if "seg1.html" in label:
            return "Daily"
        if "Retail" in label or "seg2.html" in label:
            return "Retail"
        if "LPG" in label and "seg3" in label:
            return "LPG"
        if "SOD" in label and "seg4" in label:
            return "SOD"
        if "combined" in label.lower() or "seg5" in label:
            return None
        if "Clean Toilet" in label or "ro_va_cleanliness" in label:
            return "VA Cleanliness"
        if "Nozzle" in label or "nozzle_sales_trend.html" in label:
            return "Nozzle Trend"
    if label.startswith("Skipped (SOD data)") and "Email:" in label:
        if "SOD" in label and "seg4" in label:
            return "SOD"
        if "combined" in label.lower() or "seg5" in label:
            return None
    return None


def _failure_email_display_line(label: str) -> str | None:
    """Heading for Failed Components (email sends / skips only). None for unrecognized."""
    if label.startswith("Email:"):
        if "seg1.html" in label:
            return "EMAIL – Novex Daily Report [Daily]"
        if "Retail" in label or "seg2.html" in label:
            return "EMAIL – Novex Daily Report [Retail]"
        if "LPG" in label and "seg3" in label:
            return "EMAIL – Novex Daily Report [LPG]"
        if "SOD" in label and "seg4" in label:
            return "EMAIL – Novex Daily Report [SOD]"
        if "combined" in label.lower() or "seg5" in label:
            return "EMAIL – Novex Daily Report [multi-segment report]"
        if "Clean Toilet" in label or "ro_va_cleanliness" in label:
            return "EMAIL – Novex Daily Report [VA Cleanliness]"
        if "Nozzle" in label or "nozzle_sales_trend.html" in label:
            return "EMAIL – Nozzle Sales Trend Monitoring"
    if label.startswith("Skipped (SOD data)") and "Email:" in label:
        if "SOD" in label and "seg4" in label:
            return "EMAIL – Novex Daily Report [SOD]"
        if "combined" in label.lower() or "seg5" in label:
            return "EMAIL – Novex Daily Report [multi-segment report]"
    return None


def _failure_summary_subject(failures: list[tuple[str, str]]) -> str:
    """Subject uses only Daily, Retail, SOD, LPG, VA Cleanliness — never Combined."""
    tags: list[str] = []
    seen: set[str] = set()
    for label, _ in failures:
        if not (
            label.startswith("Email:")
            or (label.startswith("Skipped (SOD data)") and "Email:" in label)
        ):
            continue
        b = _failure_bracket_label(label)
        if b is not None and b not in seen:
            seen.add(b)
            tags.append(b)
    if tags:
        return f"Novex Daily Report [{', '.join(tags)}] – Partial Failure"
    return "Novex Daily Report – Partial Failure"


def _partial_failure_body_html(failures: list[tuple[str, str]]) -> str:
    email_rows = [
        (label, msg)
        for label, msg in failures
        if label.startswith("Email:")
        or (label.startswith("Skipped (SOD data)") and "Email:" in label)
    ]
    data_rows = [(label, msg) for label, msg in failures if label.startswith("Data:")]

    mail_tags: list[str] = []
    seen_m: set[str] = set()
    for label, _ in email_rows:
        b = _failure_bracket_label(label)
        if b is not None and b not in seen_m:
            seen_m.add(b)
            mail_tags.append(b)

    if mail_tags:
        if len(mail_tags) == 1:
            intro = (
                f"The Novex Daily Report execution completed with an issue. The {mail_tags[0]} mail "
                "encountered an error and was not triggered. All remaining mails were triggered successfully."
            )
        else:
            joined = ", ".join(mail_tags[:-1]) + f" and {mail_tags[-1]}"
            intro = (
                f"The Novex Daily Report execution completed with an issue. The {joined} mails "
                "encountered an error and were not triggered. All remaining mails were triggered successfully."
            )
    elif data_rows:
        intro = (
            "The Novex Daily Report execution completed with an issue. One or more data load steps failed. "
            "Full messages are below (same text as in the run log)."
        )
    else:
        intro = (
            "The Novex Daily Report execution completed with an issue. See the error details below."
        )

    def _full_error_pre(msg: str) -> str:
        return (
            f'<pre style="white-space:pre-wrap;word-break:break-word;background:#f8f8f8;'
            f'padding:10px;border:1px solid #ddd;font-size:12px;">{html.escape(msg)}</pre>'
        )

    email_blocks: list[str] = []
    for label, msg in email_rows:
        disp = _failure_email_display_line(label)
        if disp is None:
            continue
        typ = _infer_error_type(msg)
        email_blocks.append(
            f"<p><strong>{html.escape(disp)}</strong><br/>"
            f"Type: {html.escape(typ)}</p>"
            f"<p><strong>Error (full)</strong></p>{_full_error_pre(msg)}"
        )

    data_blocks: list[str] = []
    for label, msg in data_rows:
        # No "DATA – Data: ..." prefix; short step name only, full text as in logs
        step = label[len("Data:") :].strip() if label.startswith("Data:") else label
        data_blocks.append(
            f"<p><strong>{html.escape(step)}</strong></p>"
            f"<p><strong>Error (full)</strong></p>{_full_error_pre(msg)}"
        )

    sod_root = _extract_sod_root_error(failures)
    sod_note = ""
    if sod_root:
        sod_note = (
            "<p><strong>Context (SOD/TAS data pipeline)</strong><br/>"
            f"<code>{html.escape(_SOD_DATA_PY)}</code> — root error from the SOD chain:</p>"
            f"{_full_error_pre(sod_root)}"
        )

    failed_components = "".join(email_blocks) if email_blocks else "<p><em>(No email send failures.)</em></p>"
    data_section = ""
    if data_blocks:
        data_section = (
            "<p><strong>Data load failures</strong></p>"
            "<p>Step names below; error text matches the run log.</p>"
            + "".join(data_blocks)
        )

    return (
        "<html><body style=\"font-family:Arial,sans-serif;font-size:14px;line-height:1.5;\">"
        "<p>Hi Team,</p>"
        f"<p>{html.escape(intro)}</p>"
        "<p>Error details are below:</p>"
        "<p><strong>Failed Components</strong></p>"
        + failed_components
        + data_section
        + sod_note
        + "</body></html>"
    )


async def send_failure_summary_email(
    failures: list[tuple[str, str]],
    *,
    to_recipients: list[str],
    cc_recipients: list[str],
    bcc_recipients: list[str],
) -> None:
    """Partial-failure digest; recipients follow seg1 (daily) for the selected audience."""
    if not failures:
        return
    body = _partial_failure_body_html(failures)
    try:
        ins = await notification_factory.get_notification_module("email")
        await ins.publish_message(
            subject=_failure_summary_subject(failures),
            recipients=to_recipients,
            cc_recipients=cc_recipients,
            bcc_recipients=bcc_recipients,
            html_content=True,
            body=body,
            force_send=True,
            inline_images={},
            attachments=[],
        )
    except Exception:
        traceback.print_exc()


async def _load_merge_data(
    segments: frozenset[str] | None,
    failures: list[tuple[str, str]],
    status_data: dict,
    sod_state: dict,
) -> None:
    """Load only data required for the requested segment(s); full run when segments is None."""
    if _data_needed(segments, "daily", "retail", "combined"):
        await _merge_awaitable_dict(failures, status_data, "Data: sales", sales_data.fetch_sales_data())
    if _data_needed(segments, "daily", "retail", "combined", "sod"):
        await _merge_awaitable_dict(
            failures, status_data, "Data: retail dry-out", retail_data.fetch_dryout_data(WRITE_TO_DB)
        )
    if _data_needed(segments, "daily", "lpg", "combined"):
        await _merge_awaitable_dict(failures, status_data, "Data: LPG rejection", lpg_data.get_lpg_rejection())
    if _data_needed(segments, "daily", "retail", "combined"):
        await _merge_awaitable_dict(failures, status_data, "Data: RO alerts", retail_data.get_ro_alerts())
    if _data_needed(segments, "daily", "sod", "combined"):
        await _merge_awaitable_dict(
            failures, status_data, "Data: TAS alerts", sod_data.get_tas_alerts(), sod_state=sod_state
        )
    if _data_needed(segments, "daily", "lpg", "combined"):
        await _merge_awaitable_dict(
            failures, status_data, "Data: LPG top/bottom plants", lpg_data.lpg_top_bottom_score_plants()
        )
    if _data_needed(segments, "daily", "lpg", "combined"):
        await _merge_awaitable_dict(
            failures, status_data, "Data: VTS LPG blocked", lpg_data.get_vts_lpg_blocked_counts()
        )
    if _data_needed(segments, "daily", "sod", "combined"):
        await _merge_awaitable_dict(
            failures,
            status_data,
            "Data: VTS SOD blocked",
            sod_data.get_vts_sod_blocked_counts(),
            sod_state=sod_state,
        )
    if _data_needed(segments, "daily", "sod", "combined"):
        await _merge_awaitable_dict(
            failures, status_data, "Data: SOD %", sod_data.sod_percentage(), sod_state=sod_state
        )
    if _data_needed(segments, "daily", "sod", "combined"):
        await _merge_awaitable_dict(
            failures, status_data, "Data: VA path", sod_data.get_va_path(), sod_state=sod_state
        )
    if _data_needed(segments, "daily", "sod", "combined"):
        await _merge_awaitable_dict(
            failures, status_data, "Data: EMLock path", sod_data.get_emlock_path(), sod_state=sod_state
        )
    if _data_needed(segments, "daily", "sod", "combined"):
        await _merge_awaitable_dict(
            failures, status_data, "Data: TAS path", sod_data.get_tas_path(), sod_state=sod_state
        )
    if _data_needed(segments, "daily", "sod", "combined"):
        await _merge_awaitable_dict(
            failures,
            status_data,
            "Data: fault & maintenance",
            sod_data.get_fault_and_maintenance(),
            sod_state=sod_state,
        )
    if _data_needed(segments, "daily", "sod", "combined"):
        await _merge_awaitable_dict(
            failures,
            status_data,
            "Data: parameters summary",
            sod_data.get_parameters_summary(),
            sod_state=sod_state,
        )
    if _data_needed(segments, "clean"):
        _merge_sync_dict(
            failures,
            status_data,
            "Data: Clean Toilet MIS (ro_va_cleanliness API — feeds email ro_va_cleanliness.html)",
            ro_va_cleanliness.main,
        )
    if _data_needed(segments, "nozzle"):
        await _merge_awaitable_dict(
            failures,
            status_data,
            "Data: nozzle sales trend",
            nozzle_sales_trend.fetch_data(),
        )
    if _data_needed(segments, "nozzle"):
        await _merge_awaitable_dict(
            failures,
            status_data,
            "Data: nozzle sales top performance",
            nozzle_sales_trend.nozzles_sales_top_performance(),
        )
    if _data_needed(segments, "daily", "retail", "combined"):
        await _merge_awaitable_dict(
            failures, status_data, "Data: nozzle sales", retail_data.nozzle_sales(segregation="zone")
        )
    if _data_needed(segments, "daily", "retail", "combined"):
        await _merge_awaitable_dict(failures, status_data, "Data: sales TMT excel", retail_data.sales_tmt_excel())
    if _data_needed(segments, "daily", "lpg", "sod", "combined"):
        for alert_section in ["VA", "VTS", "EMLock", "TAS"]:
            await _merge_awaitable_dict(
                failures,
                status_data,
                f"Data: alerts ({alert_section})",
                get_alert_data.get_alert_data(alert_section),
            )


# ---------------------------------------------------------------------------
# Testing — recipients from novex_daily_report_dryout_testing.py
# ---------------------------------------------------------------------------
async def publish_daily_novex_status_email_testing(segments: frozenset[str] | None = None):
    global WRITE_TO_DB
    date = urdhva_base.utilities.get_present_time()
    print("="*100)
    print("Execution date ---->", date)
    print("Testing Email")
    date_yes = helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                       date_time_format=None)
    report_generated_time = date.strftime('%I:%M %p')
    if date.strftime('%Y-%m-%d').split('-')[-1] == '01' or date.strftime('%Y-%m-%d').split('-')[-1] == '1':
        print("datde inside if",date)
        status_yes_date = date
        tmp_date = urdhva_base.utilities.get_present_time()
        tmp_date_yes = helpers.get_time_stamp_by_delta(tmp_date, days=1, with_month_start_day=False,
                                               date_time_format=None)
        tmp_date_start = helpers.get_time_stamp_by_delta(tmp_date, days=1, with_month_start_day=True,
                                               date_time_format=None)

        status_data = {'today_date': date.strftime('%d-%B-%Y'), 'report_generated_time': report_generated_time,
                   'yesterday_date': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                               date_time_format='%d-%B-%Y'),
                   'today_week': date.strftime('%A'), 'yesterday_week':
                       helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                 date_time_format='%A'),
                   'today': date.strftime('%d-%B-%Y'),
                   'yesterday': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                          date_time_format='%d-%B-%Y'),
                   'present_month': f"01-{tmp_date_start.strftime('%b')} to {tmp_date_yes.strftime('%d')}-{tmp_date_yes.strftime('%b')}"}
                  # 'present_month': f"01-{date.strftime('%b')} to {date_yes.strftime('%d')}-{date_yes.strftime('%b')}"}
    else:
         status_data = {'today_date': date.strftime('%d-%B-%Y'), 'report_generated_time': report_generated_time,
                   'yesterday_date': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                               date_time_format='%d-%B-%Y'),
                   'today_week': date.strftime('%A'), 'yesterday_week':
                       helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                 date_time_format='%A'),
                   'today': date.strftime('%d-%B-%Y'),
                   'yesterday': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                          date_time_format='%d-%B-%Y'),
                  # 'present_month': f"01-{tmp_date_start.strftime('%b')} to {tmp_date_yes.strftime('%d')}-{tmp_date_yes.strftime('%b')}"}
                   'present_month': f"01-{date.strftime('%b')} to {date_yes.strftime('%d')}-{date_yes.strftime('%b')}"}

    failures: list[tuple[str, str]] = []
    sod_state: dict = {"failed": False}

    await _load_merge_data(segments, failures, status_data, sod_state)

    if sod_state["failed"]:
        if _segment_set_wants(segments, "sod"):
            failures.append((
                "Skipped (SOD data): Email: Novex Daily Report: SOD (seg4.html)",
                "Not sent: SOD/TAS data incomplete; see Data: TAS/SOD/... rows above.",
            ))
        if _segment_set_wants(segments, "combined"):
            failures.append((
                "Skipped (SOD data): Email: Novex Daily Report combined (seg5.html)",
                "Not sent: combined mail includes SOD/TAS sections.",
            ))
    if sod_state["failed"] and _segment_set_wants(segments, "daily"):
        _apply_sod_placeholders_for_partial_seg1(status_data)

    if _segment_set_wants(segments, "daily"):
        recipients = await get_email_users_by_type("daily", "testing")
        await _send_email_safe(
            "Email: Novex Daily Report (seg1.html)",
            failures,
            template_name="seg1.html",
            to_recipients=recipients.get("daily_to", []),
            subject=recipients.get("daily_subject", ""),
            cc_recipients=recipients.get("daily_cc", []),
            bcc_recipients=recipients.get("daily_bcc", []),
            notification_data=status_data,
            inline_images={
                "dry_out_lost": f"{status_data.get('chart_path')}",
                "last_30_days_dry_out_trends": f"{status_data.get('zone_wise_chart')}",
                "nozzel_sales_chart": f"{status_data.get('nozzel_sales_chart')}",
            },
            attachments=[status_data.get("zone_wise_pdf_path")],
        )
    if _segment_set_wants(segments, "retail"):
        recipients = await get_email_users_by_type("retail", "testing")
        await _send_email_safe(
            "Email: Novex Daily Report: Retail (seg2.html)",
            failures,
            template_name="seg2.html",
            to_recipients=recipients.get("retail_to", []),
            subject=recipients.get("retail_subject", ""),
            cc_recipients=recipients.get("retail_cc", []),
            bcc_recipients=recipients.get("retail_bcc", []),
            notification_data=status_data,
            inline_images={
                "dry_out_lost": f"{status_data.get('chart_path')}",
                "last_30_days_dry_out_trends": f"{status_data.get('zone_wise_chart')}",
                "nozzel_sales_chart": f"{status_data.get('nozzel_sales_chart')}",
            },
            attachments=[status_data.get("zone_wise_pdf_path")],
        )
    if _segment_set_wants(segments, "lpg"):
        recipients = await get_email_users_by_type("lpg", "testing")
        await _send_email_safe(
            "Email: Novex Daily Report: LPG (seg3.html)",
            failures,
            template_name="seg3.html",
            to_recipients=recipients.get("lpg_to", []),
            subject=recipients.get("lpg_subject", ""),
            cc_recipients=recipients.get("lpg_cc", []),
            bcc_recipients=recipients.get("lpg_bcc", []),
            notification_data=status_data,
            inline_images={
                "monthly_score_path": f"{status_data.get('lpg_monthyl_score_path')}",
                "plant_wise_score_path": f"{status_data.get('plant_wise_score_df_path')}",
            },
            attachments=[
                status_data.get("lpg_day_wise_trend_exl_path"),status_data.get("lpg_va_path"),status_data.get("lpg_pq_path"),
            ],
        )
    if not sod_state["failed"] and _segment_set_wants(segments, "sod"):
        recipients = await get_email_users_by_type("sod", "testing")
        await _send_email_safe(
            "Email: Novex Daily Report: SOD (seg4.html)",
            failures,
            template_name="seg4.html",
            to_recipients=recipients.get("sod_to", []),
            subject=recipients.get("sod_subject", ""),
            cc_recipients=recipients.get("sod_cc", []),
            bcc_recipients=recipients.get("sod_bcc", []),
            notification_data=status_data,
            inline_images={
                "monthly_score_path_sod": f"{status_data.get('sod_monthly_score_path')}",
                "plant_wise_score_path_sod": f"{status_data.get('sod_plant_wise_score_df_path')}",
            },
            attachments=[
                status_data.get("zone_wise_pdf_path"),status_data.get("tas_day_wise_trend_exl_path"),
                status_data.get("tas_va_path"),status_data.get("tas_emlock_path"),status_data.get("tas_tas_path"),
            ],
        )
    if _segment_set_wants(segments, "clean"):
        recipients = await get_email_users_by_type("clean", "testing")
        await _send_email_safe(
            "Email: Clean Toilet Picture upload | MIS (ro_va_cleanliness.html)",
            failures,
            template_name="ro_va_cleanliness.html",
            to_recipients=recipients.get("clean_to", []),
            subject=f"{recipients.get('clean_subject', '')} | Date : {status_data.get('yesterday_date')}",
            cc_recipients=recipients.get("clean_cc", []),
            bcc_recipients=recipients.get("clean_bcc", []),
            notification_data=status_data,
        )
    if _segment_set_wants(segments, "nozzle"):
        recipients = await get_email_users_by_type("nozzle", "testing")
        await _send_email_safe(
            "Email: Nozzle Sales Trend (nozzle_sales_trend.html)",
            failures,
            template_name="nozzle_sales_trend.html",
            to_recipients=recipients.get("nozzle_to", []),
            subject=recipients.get("nozzle_subject", ""),
            cc_recipients=recipients.get("nozzle_cc", []),
            bcc_recipients=recipients.get("nozzle_bcc", []),
            notification_data=status_data,
            inline_images={
                "nozzle_trend_chart": f"{status_data.get('nozzle_trend_chart')}",
                "power_conversion_graph": f"{status_data.get('power_conversion_graph')}"
            },
            attachments = [status_data.get('nozzle_sales_excel')]
        )
    if not sod_state["failed"] and _segment_set_wants(segments, "combined"):
        recipients = await get_email_users_by_type("combined", "testing")
        await _send_email_safe(
            "Email: Novex Daily Report combined (seg5.html)",
            failures,
            template_name="seg5.html",
            to_recipients=recipients.get("combined_to", []),
            subject=recipients.get("combined_subject", ""),
            cc_recipients=recipients.get("combined_cc", []),
            bcc_recipients=recipients.get("combined_bcc", []),
            notification_data=status_data,
            inline_images={
                "dry_out_lost": f"{status_data.get('chart_path')}",
                "last_30_days_dry_out_trends": f"{status_data.get('zone_wise_chart')}",
                "monthly_score_path": f"{status_data.get('lpg_monthyl_score_path')}",
                "plant_wise_score_path": f"{status_data.get('plant_wise_score_df_path')}",
                "nozzel_sales_chart": f"{status_data.get('nozzel_sales_chart')}",
                "monthly_score_path_sod": f"{status_data.get('sod_monthly_score_path')}",
                "plant_wise_score_path_sod": f"{status_data.get('sod_plant_wise_score_df_path')}",
            },
            attachments=[
                status_data.get("zone_wise_pdf_path"),status_data.get("lpg_day_wise_trend_exl_path"),
                status_data.get("lpg_va_path"),status_data.get("lpg_pq_path"),status_data.get("tas_day_wise_trend_exl_path"),
                status_data.get("tas_va_path"),status_data.get("tas_emlock_path"),status_data.get("tas_tas_path")
            ],
        )
    if failures:
        recipients = await get_email_users_by_type("daily", "testing")
        await send_failure_summary_email(
            failures,
            to_recipients=recipients.get("daily_to", []),
            cc_recipients=recipients.get("daily_cc", []),
            bcc_recipients=recipients.get("daily_bcc", []),
        )


# ---------------------------------------------------------------------------
# Employee — recipients from novex_daily_report_dryout.py
# ---------------------------------------------------------------------------
async def publish_daily_novex_status_email_employee(segments: frozenset[str] | None = None):
    global WRITE_TO_DB
    date = urdhva_base.utilities.get_present_time()
    print("="*100)
    print("Execution date ---->", date)
    print("Employee Email")
    date_yes = helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                       date_time_format=None)
    report_generated_time = date.strftime('%I:%M %p')
    if date.strftime('%Y-%m-%d').split('-')[-1] == '01' or date.strftime('%Y-%m-%d').split('-')[-1] == '1':
        print("datde inside if",date)
        status_yes_date = date
        tmp_date = urdhva_base.utilities.get_present_time()
        tmp_date_yes = helpers.get_time_stamp_by_delta(tmp_date, days=1, with_month_start_day=False,
                                               date_time_format=None)
        tmp_date_start = helpers.get_time_stamp_by_delta(tmp_date, days=1, with_month_start_day=True,
                                               date_time_format=None)

        status_data = {'today_date': date.strftime('%d-%B-%Y'), 'report_generated_time': report_generated_time,
                   'yesterday_date': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                               date_time_format='%d-%B-%Y'),
                   'today_week': date.strftime('%A'), 'yesterday_week':
                       helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                 date_time_format='%A'),
                   'today': date.strftime('%d-%B-%Y'),
                   'yesterday': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                          date_time_format='%d-%B-%Y'),
                   'present_month': f"01-{tmp_date_start.strftime('%b')} to {tmp_date_yes.strftime('%d')}-{tmp_date_yes.strftime('%b')}"}
                  # 'present_month': f"01-{date.strftime('%b')} to {date_yes.strftime('%d')}-{date_yes.strftime('%b')}"}
    else:
         status_data = {'today_date': date.strftime('%d-%B-%Y'), 'report_generated_time': report_generated_time,
                   'yesterday_date': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                               date_time_format='%d-%B-%Y'),
                   'today_week': date.strftime('%A'), 'yesterday_week':
                       helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                 date_time_format='%A'),
                   'today': date.strftime('%d-%B-%Y'),
                   'yesterday': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                          date_time_format='%d-%B-%Y'),
                  # 'present_month': f"01-{tmp_date_start.strftime('%b')} to {tmp_date_yes.strftime('%d')}-{tmp_date_yes.strftime('%b')}"}
                   'present_month': f"01-{date.strftime('%b')} to {date_yes.strftime('%d')}-{date_yes.strftime('%b')}"}

    failures: list[tuple[str, str]] = []
    sod_state: dict = {"failed": False}

    await _load_merge_data(segments, failures, status_data, sod_state)

    if sod_state["failed"]:
        if _segment_set_wants(segments, "sod"):
            failures.append((
                "Skipped (SOD data): Email: Novex Daily Report: SOD (seg4.html)",
                "Not sent: SOD/TAS data incomplete; see Data: TAS/SOD/... rows above.",
            ))
        if _segment_set_wants(segments, "combined"):
            failures.append((
                "Skipped (SOD data): Email: Novex Daily Report combined (seg5.html)",
                "Not sent: combined mail includes SOD/TAS sections.",
            ))
    if sod_state["failed"] and _segment_set_wants(segments, "daily"):
        _apply_sod_placeholders_for_partial_seg1(status_data)

    if _segment_set_wants(segments, "daily"):
        recipients = await get_email_users_by_type("daily", "employee")
        await _send_email_safe(
            "Email: Novex Daily Report (seg1.html)",
            failures,
            template_name="seg1.html",
            to_recipients=recipients.get("daily_to", []),
            subject=recipients.get("daily_subject", ""),
            cc_recipients=recipients.get("daily_cc", []),
            bcc_recipients=recipients.get("daily_bcc", []),
            notification_data=status_data,
            inline_images={
                "dry_out_lost": f"{status_data.get('chart_path')}",
                "last_30_days_dry_out_trends": f"{status_data.get('zone_wise_chart')}",
                "nozzel_sales_chart": f"{status_data.get('nozzel_sales_chart')}",
            },
            attachments=[status_data.get("zone_wise_pdf_path")],
        )
    if _segment_set_wants(segments, "retail"):
        recipients = await get_email_users_by_type("retail", "employee")
        await _send_email_safe(
            "Email: Novex Daily Report: Retail (seg2.html)",
            failures,
            template_name="seg2.html",
            to_recipients=recipients.get("retail_to", []),
            subject=recipients.get("retail_subject", ""),
            cc_recipients=recipients.get("retail_cc", []),
            bcc_recipients=recipients.get("retail_bcc", []),
            notification_data=status_data,
            inline_images={
                "dry_out_lost": f"{status_data.get('chart_path')}",
                "last_30_days_dry_out_trends": f"{status_data.get('zone_wise_chart')}",
                "nozzel_sales_chart": f"{status_data.get('nozzel_sales_chart')}",
            },
            attachments=[status_data.get("zone_wise_pdf_path")],
        )
    if _segment_set_wants(segments, "lpg"):
        recipients = await get_email_users_by_type("lpg", "employee")
        await _send_email_safe(
            "Email: Novex Daily Report: LPG (seg3.html)",
            failures,
            template_name="seg3.html",
            to_recipients=recipients.get("lpg_to", []),
            subject=recipients.get("lpg_subject", ""),
            cc_recipients=recipients.get("lpg_cc", []),
            bcc_recipients=recipients.get("lpg_bcc", []),
            notification_data=status_data,
            inline_images={
                "monthly_score_path": f"{status_data.get('lpg_monthyl_score_path')}",
                "plant_wise_score_path": f"{status_data.get('plant_wise_score_df_path')}",
            },
            attachments=[
                status_data.get("lpg_day_wise_trend_exl_path"),status_data.get("lpg_va_path"),status_data.get("lpg_pq_path"),
            ],
        )
    if not sod_state["failed"] and _segment_set_wants(segments, "sod"):
        recipients = await get_email_users_by_type("sod", "employee")
        await _send_email_safe(
            "Email: Novex Daily Report: SOD (seg4.html)",
            failures,
            template_name="seg4.html",
            to_recipients=recipients.get("sod_to", []),
            subject=recipients.get("sod_subject", ""),
            cc_recipients=recipients.get("sod_cc", []),
            bcc_recipients=recipients.get("sod_bcc", []),
            notification_data=status_data,
            inline_images={
                "monthly_score_path_sod": f"{status_data.get('sod_monthly_score_path')}",
                "plant_wise_score_path_sod": f"{status_data.get('sod_plant_wise_score_df_path')}",
            },
            attachments=[
                status_data.get("zone_wise_pdf_path"),status_data.get("tas_day_wise_trend_exl_path"),
                status_data.get("tas_va_path"),status_data.get("tas_emlock_path"),status_data.get("tas_tas_path"),
            ],
        )
    if _segment_set_wants(segments, "clean"):
        recipients = await get_email_users_by_type("clean", "employee")
        await _send_email_safe(
            "Email: Clean Toilet Picture upload | MIS (ro_va_cleanliness.html)",
            failures,
            template_name="ro_va_cleanliness.html",
            to_recipients=recipients.get("clean_to", []),
            subject=f"{recipients.get('clean_subject', '')} | Date : {status_data.get('yesterday_date')}",
            cc_recipients=recipients.get("clean_cc", []),
            bcc_recipients=recipients.get("clean_bcc", []),
            notification_data=status_data,
        )
    if _segment_set_wants(segments, "nozzle"):
        recipients = await get_email_users_by_type("nozzle", "employee")
        await _send_email_safe(
            "Email: Nozzle Sales Trend (nozzle_sales_trend.html)",
            failures,
            template_name="nozzle_sales_trend.html",
            to_recipients=recipients.get("nozzle_to", []),
            subject=recipients.get("nozzle_subject", ""),
            cc_recipients=recipients.get("nozzle_cc", []),
            bcc_recipients=recipients.get("nozzle_bcc", []),
            notification_data=status_data,
            inline_images={
                "nozzle_trend_chart": f"{status_data.get('nozzle_trend_chart')}",
                "power_conversion_graph": f"{status_data.get('power_conversion_graph')}"
            },
            attachments = [status_data.get('nozzle_sales_excel')]
        )
    if not sod_state["failed"] and _segment_set_wants(segments, "combined"):
        recipients = await get_email_users_by_type("combined", "testing")
        await _send_email_safe(
            "Email: Novex Daily Report combined (seg5.html)",
            failures,
            template_name="seg5.html",
            to_recipients=recipients.get("combined_to", []),
            subject=recipients.get("combined_subject", ""),
            cc_recipients=recipients.get("combined_cc", []),
            bcc_recipients=recipients.get("combined_bcc", []),
            notification_data=status_data,
            inline_images={
                "dry_out_lost": f"{status_data.get('chart_path')}",
                "last_30_days_dry_out_trends": f"{status_data.get('zone_wise_chart')}",
                "monthly_score_path": f"{status_data.get('lpg_monthyl_score_path')}",
                "plant_wise_score_path": f"{status_data.get('plant_wise_score_df_path')}",
                "nozzel_sales_chart": f"{status_data.get('nozzel_sales_chart')}",
                "monthly_score_path_sod": f"{status_data.get('sod_monthly_score_path')}",
                "plant_wise_score_path_sod": f"{status_data.get('sod_plant_wise_score_df_path')}",
            },
            attachments=[
                status_data.get("zone_wise_pdf_path"),status_data.get("lpg_day_wise_trend_exl_path"),
                status_data.get("lpg_va_path"),status_data.get("lpg_pq_path"),status_data.get("tas_day_wise_trend_exl_path"),
                status_data.get("tas_va_path"),status_data.get("tas_emlock_path"),status_data.get("tas_tas_path")
            ],
        )
    if failures:
        recipients = await get_email_users_by_type("daily", "testing")
        await send_failure_summary_email(
            failures,
            to_recipients=recipients.get("daily_to", []),
            cc_recipients=recipients.get("daily_cc", []),
            bcc_recipients=recipients.get("daily_bcc", [])
        )


# ---------------------------------------------------------------------------
# Chairman — recipients from novex_daily_report_segregation.py
# ---------------------------------------------------------------------------
async def publish_daily_novex_status_email_chairman(segments: frozenset[str] | None = None):
    date = urdhva_base.utilities.get_present_time()
    print("="*100)
    print("Execution date ---->", date)
    print("Chairman Email")
    date_yes = helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                       date_time_format=None)
    report_generated_time = date.strftime('%I:%M %p')
    if date.strftime('%Y-%m-%d').split('-')[-1] == '01' or date.strftime('%Y-%m-%d').split('-')[-1] == '1':
        print("datde inside if",date)
        status_yes_date = date
        tmp_date = urdhva_base.utilities.get_present_time()
        tmp_date_yes = helpers.get_time_stamp_by_delta(tmp_date, days=1, with_month_start_day=False,
                                               date_time_format=None)
        tmp_date_start = helpers.get_time_stamp_by_delta(tmp_date, days=1, with_month_start_day=True,
                                               date_time_format=None)

        status_data = {'today_date': date.strftime('%d-%B-%Y'), 'report_generated_time': report_generated_time,
                   'yesterday_date': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                               date_time_format='%d-%B-%Y'),
                   'today_week': date.strftime('%A'), 'yesterday_week':
                       helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                 date_time_format='%A'),
                   'today': date.strftime('%d-%B-%Y'),
                   'yesterday': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                          date_time_format='%d-%B-%Y'),
                   'present_month': f"01-{tmp_date_start.strftime('%b')} to {tmp_date_yes.strftime('%d')}-{tmp_date_yes.strftime('%b')}"}
                  # 'present_month': f"01-{date.strftime('%b')} to {date_yes.strftime('%d')}-{date_yes.strftime('%b')}"}
    else:
         status_data = {'today_date': date.strftime('%d-%B-%Y'), 'report_generated_time': report_generated_time,
                   'yesterday_date': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                               date_time_format='%d-%B-%Y'),
                   'today_week': date.strftime('%A'), 'yesterday_week':
                       helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                 date_time_format='%A'),
                   'today': date.strftime('%d-%B-%Y'),
                   'yesterday': helpers.get_time_stamp_by_delta(date, days=1, with_month_start_day=False,
                                                                          date_time_format='%d-%B-%Y'),
                  # 'present_month': f"01-{tmp_date_start.strftime('%b')} to {tmp_date_yes.strftime('%d')}-{tmp_date_yes.strftime('%b')}"}
                   'present_month': f"01-{date.strftime('%b')} to {date_yes.strftime('%d')}-{date_yes.strftime('%b')}"}

    failures: list[tuple[str, str]] = []
    sod_state: dict = {"failed": False}

    await _load_merge_data(segments, failures, status_data, sod_state)

    if sod_state["failed"]:
        if _segment_set_wants(segments, "sod"):
            failures.append((
                "Skipped (SOD data): Email: Novex Daily Report: SOD (seg4.html)",
                "Not sent: SOD/TAS data incomplete; see Data: TAS/SOD/... rows above.",
            ))
        if _segment_set_wants(segments, "combined"):
            failures.append((
                "Skipped (SOD data): Email: Novex Daily Report combined (seg5.html)",
                "Not sent: combined mail includes SOD/TAS sections.",
            ))
    if sod_state["failed"] and _segment_set_wants(segments, "daily"):
        _apply_sod_placeholders_for_partial_seg1(status_data)

    if _segment_set_wants(segments, "daily"):
        recipients = await get_email_users_by_type("daily", "chairman")
        await _send_email_safe(
            "Email: Novex Daily Report (seg1.html)",
            failures,
            template_name="seg1.html",
            to_recipients= recipients.get("daily_to", []),
            subject=recipients.get("daily_subject", ""),
            cc_recipients= recipients.get("daily_cc", []),
            bcc_recipients= recipients.get("daily_bcc", []),
            notification_data=status_data,
            inline_images={
                "dry_out_lost": f"{status_data.get('chart_path')}",
                "last_30_days_dry_out_trends": f"{status_data.get('zone_wise_chart')}",
                "nozzel_sales_chart": f"{status_data.get('nozzel_sales_chart')}",
            },
            attachments=[status_data.get("zone_wise_pdf_path")],
        )
    if _segment_set_wants(segments, "retail"):
        recipients = await get_email_users_by_type("retail", "chairman")
        await _send_email_safe(
            "Email: Novex Daily Report: Retail (seg2.html)",
            failures,
            template_name="seg2.html",
            to_recipients= recipients.get("retail_to", []),
            subject=recipients.get("retail_subject", ""),
            cc_recipients= recipients.get("retail_cc", []),
            bcc_recipients= recipients.get("retail_bcc", []),
            notification_data=status_data,
            inline_images={
                "dry_out_lost": f"{status_data.get('chart_path')}",
                "last_30_days_dry_out_trends": f"{status_data.get('zone_wise_chart')}",
                "nozzel_sales_chart": f"{status_data.get('nozzel_sales_chart')}",
            },
            attachments=[status_data.get("zone_wise_pdf_path")],
        )
    if _segment_set_wants(segments, "lpg"):
        recipients = await get_email_users_by_type("lpg", "chairman")
        await _send_email_safe(
            "Email: Novex Daily Report: LPG (seg3.html)",
            failures,
            template_name="seg3.html",
            to_recipients= recipients.get("lpg_to", []),
            subject=recipients.get("lpg_subject", ""),
            cc_recipients= recipients.get("lpg_cc", []),
            bcc_recipients= recipients.get("lpg_bcc", []),
            notification_data=status_data,
            inline_images={
                "monthly_score_path": f"{status_data.get('lpg_monthyl_score_path')}",
                "plant_wise_score_path": f"{status_data.get('plant_wise_score_df_path')}",
            },
            attachments=[
                status_data.get("lpg_day_wise_trend_exl_path"),status_data.get("lpg_va_path"),status_data.get("lpg_pq_path"),
            ],
        )
    if not sod_state["failed"] and _segment_set_wants(segments, "sod"):
        recipients = await get_email_users_by_type("sod", "chairman")
        await _send_email_safe(
            "Email: Novex Daily Report: SOD (seg4.html)",
            failures,
            template_name="seg4.html",
            to_recipients= recipients.get("sod_to", []),
            subject=recipients.get("sod_subject", ""),
            cc_recipients= recipients.get("sod_cc", []),
            bcc_recipients= recipients.get("sod_bcc", []),
            notification_data=status_data,
            inline_images={
                "monthly_score_path_sod": f"{status_data.get('sod_monthly_score_path')}",
                "plant_wise_score_path_sod": f"{status_data.get('sod_plant_wise_score_df_path')}",
            },
            attachments=[
                status_data.get("zone_wise_pdf_path"),status_data.get("tas_day_wise_trend_exl_path"),
                status_data.get("tas_va_path"),status_data.get("tas_emlock_path"),status_data.get("tas_tas_path"),
            ],
        )
    if not sod_state["failed"] and _segment_set_wants(segments, "combined"):
        recipients = await get_email_users_by_type("combined", "chairman")
        await _send_email_safe(
            "Email: Novex Daily Report combined (seg5.html)",
            failures,
            template_name="seg5.html",
            to_recipients= recipients.get("combined_to", []),
            subject=recipients.get("combined_subject", ""),
            cc_recipients= recipients.get("combined_cc", []),
            bcc_recipients= recipients.get("combined_bcc", []),
            notification_data=status_data,
            inline_images={
                "dry_out_lost": f"{status_data.get('chart_path')}",
                "last_30_days_dry_out_trends": f"{status_data.get('zone_wise_chart')}",
                "monthly_score_path": f"{status_data.get('lpg_monthyl_score_path')}",
                "plant_wise_score_path": f"{status_data.get('plant_wise_score_df_path')}",
                "nozzel_sales_chart": f"{status_data.get('nozzel_sales_chart')}",
                "monthly_score_path_sod": f"{status_data.get('sod_monthly_score_path')}",
                "plant_wise_score_path_sod": f"{status_data.get('sod_plant_wise_score_df_path')}",
            },
            attachments=[
                status_data.get("zone_wise_pdf_path"),status_data.get("lpg_day_wise_trend_exl_path"),
                status_data.get("lpg_va_path"),status_data.get("lpg_pq_path"),status_data.get("tas_day_wise_trend_exl_path"),
                status_data.get("tas_va_path"),status_data.get("tas_emlock_path"),status_data.get("tas_tas_path")
            ],
        )
    if _segment_set_wants(segments, "clean"):
        recipients = await get_email_users_by_type("clean", "chairman")
        await _send_email_safe(
            "Email: Clean Toilet Picture upload | MIS (ro_va_cleanliness.html)",
            failures,
            template_name="ro_va_cleanliness.html",
            to_recipients= recipients.get("clean_to", []),
            subject=f"{recipients.get('clean_subject', '')} | Date : {status_data.get('yesterday_date')}",
            cc_recipients= recipients.get("clean_cc", []),
            bcc_recipients= recipients.get("clean_bcc", []),
            notification_data=status_data,
        )
    if _segment_set_wants(segments, "nozzle"):
        recipients = await get_email_users_by_type("nozzle", "chairman")
        await _send_email_safe(
            "Email: Nozzle Sales Trend (nozzle_sales_trend.html)",
            failures,
            template_name="nozzle_sales_trend.html",
            to_recipients= recipients.get("nozzle_to", []),
            subject=recipients.get("nozzle_subject", ""),
            cc_recipients= recipients.get("nozzle_cc", []),
            bcc_recipients= recipients.get("nozzle_bcc", []),
            notification_data=status_data,
            inline_images={
                "nozzle_trend_chart": f"{status_data.get('nozzle_trend_chart')}",
                "power_conversion_graph": f"{status_data.get('power_conversion_graph')}"
            },
            attachments = [status_data.get('nozzle_sales_excel')]
        )
    if failures:
        recipients = await get_email_users_by_type("daily", "testing")
        await send_failure_summary_email(
            failures,
            to_recipients=recipients.get("daily_to", []),
            cc_recipients=recipients.get("daily_cc", []),
            bcc_recipients=recipients.get("daily_bcc", [])
        )


async def send_notification(template_name, to_recipients, subject, cc_recipients=None, bcc_recipients=None, notification_data=None, inline_images=None, attachments=None):
    template_path = os.path.join(
        os.path.dirname(hpcl_ceg_model.__file__),
        '..', 'orchestrator', 'reporting_services',
        'templates', template_name
        )
    with open(template_path, 'r') as f:
        template_data = jinja2.Template(f.read())
    final_data = template_data.render(**notification_data)

    tmp_file = f"/tmp/{template_name}"
    with open(tmp_file, 'w') as f:
        f.write(final_data)
    # Send email
    ins = await notification_factory.get_notification_module("email")
    await ins.publish_message(
        subject=subject,
        recipients=to_recipients,
        cc_recipients=cc_recipients or [],
        bcc_recipients=bcc_recipients or [],
        html_content=True,
        body=final_data,
        force_send=True,
        inline_images=inline_images or {},
        attachments=attachments or []
    )


async def _send_email_safe(label: str, failures: list[tuple[str, str]], **kwargs) -> None:
    try:
        await send_notification(**kwargs)
    except Exception as exc:
        failures.append((label, _failure_message_with_traceback(exc)))
        traceback.print_exc()


_RUNNERS = {
    "testing": publish_daily_novex_status_email_testing,
    "employee": publish_daily_novex_status_email_employee,
    "chairman": publish_daily_novex_status_email_chairman,
}


def _parse_args(args: argparse.Namespace) -> tuple[str, bool, list[str] | None]:
    """Returns (audience, write_db, segment_tokens_from_brackets or None if send all)."""
    pos = list(args.positional)
    write_db = bool(args.write_db)
    if pos and pos[0].lower() == "true":
        write_db = True
        pos = pos[1:]
    if pos and pos[0].lower() == "false":
        write_db = False
        pos = pos[1:]
    if args.audience is not None:
        if pos:
            raise SystemExit("Use either --audience or positional arguments, not both.")
        if "[" in args.audience:
            raise SystemExit("Bracket segments must be on the positional audience, e.g. 'testing[retail, lpg]'")
        return args.audience, write_db, None
    if len(pos) < 1:
        raise SystemExit(
            "Provide audience: testing | employee | chairman "
            "(optional segments: testing[retail], testing [retail], or testing retail). "
            "Optional prefix: true."
        )
    merged = _merge_positional_audience(pos)
    audience, seg_from_brackets = _split_audience_brackets(merged)
    if audience not in _RUNNERS:
        raise SystemExit(f"Unknown audience {audience!r}. Use: testing, employee, chairman")
    return audience, write_db, seg_from_brackets


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run Novex combined daily emails; To/CC/BCC match novex_daily_report_dryout_testing / _dryout / _segregation by audience."
    )
    parser.add_argument(
        "--audience",
        choices=tuple(_RUNNERS.keys()),
        default=None,
        metavar="AUDIENCE",
        help="testing | employee | chairman",
    )
    parser.add_argument(
        "positional",
        nargs="*",
        default=[],
        metavar="ARG",
        help='Optional true, then audience or audience[seg,...] e.g. testing or \'testing[retail, lpg]\'',
    )
    parser.add_argument(
        "--write-db",
        action="store_true",
        help="Set WRITE_TO_DB for retail dry-out sync (same as prefix true).",
    )
    parser.add_argument(
        "--segments",
        nargs="+",
        default=None,
        metavar="SEG",
        help=(
            "Alternative to audience[...]: which emails to send. Do not combine with bracket syntax."
        ),
    )
    ns = parser.parse_args()
    audience, write_db, seg_from_brackets = _parse_args(ns)
    if seg_from_brackets is not None and ns.segments is not None:
        raise SystemExit("Use either audience[retail, lpg] or --segments, not both.")
    segments = _parse_segments_arg(seg_from_brackets if seg_from_brackets is not None else ns.segments)
    global WRITE_TO_DB
    WRITE_TO_DB = write_db
    asyncio.run(_RUNNERS[audience](segments))


if __name__ == "__main__":
    main()

