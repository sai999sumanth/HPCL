"""
Resolve ``date_from`` / ``date_to`` for table analytics: ISO dates or relative tokens.

Supports (case-insensitive, spaces optional):

* ``YYYY-MM-DD`` — fixed ISO date
* ``TDY`` — today (same as ``TODAY``)
* ``TODAY``, ``NOW``, ``CURRENT_DATE``, ``CURRENTDATE`` — today
* ``TODAY-5``, ``CURRENT_DATE + 3`` — offset in days from today (``-`` / ``+``)
* Optional suffix ``D`` / ``DAY`` / ``DAYS`` on the offset (e.g. ``TODAY - 5 DAYS``)
* ``YTD`` — with ``date_from``: Jan 1 of the current year; with ``date_to``: today
* ``1W``, ``2D``, ``3D``, ``5D``, ``15D``, ``30D``, … — rolling window: ``N`` + ``D`` (days) or ``W`` (weeks = ``N``×7 days). On ``date_from``: start = today − span; on ``date_to``: end = today
"""
from __future__ import annotations

import datetime
import re
from typing import Any, Literal, Optional

_REL_TOKEN = re.compile(
    r"^(TODAY|NOW|CURRENT_DATE|CURRENTDATE)"
    r"(?:(?P<sign>[+-])(?P<num>\d+)(?:D(?:AYS?)?)?)?$",
    re.IGNORECASE,
)

_ROLLING = re.compile(r"^(\d+)(D|W)$", re.IGNORECASE)

BoundKind = Optional[Literal["from", "to"]]


def resolve_gateway_date_bound(
    value: Any,
    *,
    bound: BoundKind = None,
) -> Optional[datetime.date]:
    """
    Turn API input into a :class:`datetime.date` or ``None``.

    ``bound`` is ``\"from\"`` or ``\"to\"`` when resolving ``date_from`` / ``date_to`` so
    tokens like ``YTD`` and ``5D`` can mean start vs end of the window.

    Raises :class:`ValueError` if the string cannot be interpreted.
    """
    if value is None:
        return None
    if isinstance(value, datetime.datetime):
        return value.date()
    if isinstance(value, datetime.date):
        return value
    s = str(value).strip()
    if not s:
        return None
    # Support YYYYMMDD format
    if len(s) == 8 and s.isdigit():
        return s
    
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        try:
            return datetime.date.fromisoformat(s[:10])
        except ValueError:
            pass
    compact = "".join(s.split()).upper()

    if compact == "TDY":
        return datetime.date.today()

    if compact == "YTD":
        today = datetime.date.today()
        if bound == "to":
            return today
        return datetime.date(today.year, 1, 1)

    m_roll = _ROLLING.match(compact)
    if m_roll:
        n = int(m_roll.group(1))
        unit = m_roll.group(2).upper()
        span_days = n if unit == "D" else n * 7
        today = datetime.date.today()
        if bound == "to":
            return today
        return today - datetime.timedelta(days=span_days)

    m = _REL_TOKEN.match(compact)
    if m:
        if m.group("sign") is None:
            return datetime.date.today()
        n = int(m.group("num"))
        sign = m.group("sign")
        delta = datetime.timedelta(days=n)
        if sign == "-":
            return datetime.date.today() - delta
        return datetime.date.today() + delta
    raise ValueError(
        f"Invalid date bound {value!r}; use YYYY-MM-DD, TDY, YTD, 1W, 5D, 30D, TODAY, "
        "or e.g. TODAY-5"
    )


def resolve_optional_date_pair(
    date_from: Any,
    date_to: Any,
) -> tuple[Optional[datetime.date], Optional[datetime.date]]:
    """Resolve both bounds; either may be ``None``."""
    return (
        resolve_gateway_date_bound(date_from, bound="from"),
        resolve_gateway_date_bound(date_to, bound="to"),
    )
