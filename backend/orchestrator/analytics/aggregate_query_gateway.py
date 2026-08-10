"""
Generic SQL aggregation / filtered-read gateway for queries against a primary table,
optionally joined to other tables.

Table name, column names, group keys, filters, date bounds, aggregates, and join specs
come from caller input. Identifiers (table, columns, aliases) must match a strict pattern
to limit SQL injection risk; values are passed as bound-style literals only. SQL identifiers
are emitted as PostgreSQL double-quoted names so mixed-case tables and columns match the database.

Execution uses :meth:`urdhva_base.postgresmodel.BasePostgresModel.get_aggr_data`.
"""
from __future__ import annotations

import datetime
import ast
import re
import typing

import urdhva_base.postgresmodel as urdhva_pg

_SAFE_IDENT = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def _sql_quote_ident(segment: str) -> str:
    """PostgreSQL delimited identifier; preserves case. ``segment`` must already be validated."""
    return '"' + segment.replace('"', '""') + '"'


def _validate_date_trunc_inner(inner: str) -> None:
    """``date_trunc`` second arg: ``column``, ``alias.column``, optionally ``::type``."""
    s = inner.strip()
    m = re.match(
        r"^(.+?)(\s*::\s*[a-zA-Z][a-zA-Z0-9_]*)?$",
        s,
        re.IGNORECASE | re.DOTALL,
    )
    if not m:
        raise ValueError(f"Invalid date_trunc inner expression {inner!r}")
    base = m.group(1).strip()
    try:
        _column_ref(base, kind="date_trunc column")
    except ValueError as e:
        raise ValueError(
            f"Invalid date_trunc column in {inner!r}: {e}"
        ) from e

_AGG_FUNCS = frozenset({"sum", "avg", "min", "max", "count"})
# Arithmetic on validated column refs only (``alias.col * alias.col``); see :func:`_emit_agg_arithmetic_sql`.
_AGG_FUNCS_EXPR = frozenset({"sum_expr", "round_sum"})

# Each entry: plain column/expression string, or ``(expression, output_alias)`` for SELECT AS …
GroupByEntry = typing.Union[str, typing.Tuple[str, str]]


def _ident(name: str, *, kind: str = "identifier") -> str:
    if not name or not _SAFE_IDENT.match(name):
        raise ValueError(
            f"Invalid {kind} {name!r}; use ASCII letters, digits, underscore; "
            "must start with letter or underscore."
        )
    return name


def _column_ref(name: str, *, kind: str = "column") -> str:
    """
    Bare identifier or ``alias.column`` (each segment validated), as PostgreSQL
    double-quoted identifiers so mixed-case names match the database.
    """
    s = name.strip()
    if not s:
        raise ValueError(f"Invalid {kind}: empty")
    if "." in s:
        left, right = s.split(".", 1)
        return (
            f"{_sql_quote_ident(_ident(left.strip(), kind=f'{kind} qualifier'))}."
            f"{_sql_quote_ident(_ident(right.strip(), kind=f'{kind} name'))}"
        )
    return _sql_quote_ident(_ident(s, kind=kind))


def _quoted_date_trunc_inner_sql(inner: str) -> str:
    """Second argument to ``date_trunc`` with quoted column / cast, e.g. ``\"m\".\"d\"::date``."""
    s = inner.strip()
    m = re.match(
        r"^(.+?)(\s*::\s*[a-zA-Z][a-zA-Z0-9_]*)?$",
        s,
        re.IGNORECASE | re.DOTALL,
    )
    if not m:
        raise ValueError(f"Invalid date_trunc inner expression {inner!r}")
    base = m.group(1).strip()
    type_suffix = m.group(2) or ""
    return _column_ref(base, kind="date_trunc column") + type_suffix


_JOIN_KIND_SQL = {
    "INNER": "INNER",
    "LEFT": "LEFT",
    "RIGHT": "RIGHT",
    "FULL": "FULL OUTER",
}


def _group_by_item(raw: str) -> str:
    """
    ``GROUP BY`` entry: either a plain column identifier or a small set of safe
    PostgreSQL expressions (no user-controlled raw SQL beyond validated patterns).
    Identifiers are emitted double-quoted for case-sensitive matching.
    """
    s = raw.strip()
    if _SAFE_IDENT.match(s):
        return _sql_quote_ident(s)

    # date_trunc('precision', column) or date_trunc('precision', column::type)
    m = re.match(
        r"^\s*date_trunc\s*\(\s*'([^']*)'\s*,\s*(.+?)\s*\)\s*$",
        s,
        re.IGNORECASE | re.DOTALL,
    )
    if m:
        inner = m.group(2).strip()
        try:
            _validate_date_trunc_inner(inner)
        except ValueError as e:
            raise ValueError(
                f"Invalid date_trunc in GROUP BY {raw!r}: {e}"
            ) from e
        precision = m.group(1)
        qi = _quoted_date_trunc_inner_sql(inner)
        return f"date_trunc('{precision}', {qi})"

    # column::type (e.g. conn_date::date or m.conn_date::date)
    cm = re.match(
        r"^\s*(.+?)\s*::\s*([a-zA-Z][a-zA-Z0-9_]*)\s*$",
        s,
        re.IGNORECASE | re.DOTALL,
    )
    if cm:
        try:
            qcol = _column_ref(cm.group(1).strip(), kind="GROUP BY cast column")
        except ValueError as e:
            raise ValueError(f"Invalid GROUP BY cast expression {raw!r}: {e}") from e
        typ = cm.group(2)
        return f"{qcol}::{typ}"

    # alias.column (joined tables); must run after date_trunc / :: so those are not misparsed
    if "." in s:
        try:
            return _column_ref(s, kind="GROUP BY column")
        except ValueError:
            pass

    raise ValueError(
        f"Invalid GROUP BY entry {raw!r}; use a column name, alias.column, or a supported expression such as "
        "date_trunc('month', conn_date) or conn_date::date."
    )


def _parse_group_by_entries(
    group_by: typing.Sequence[GroupByEntry],
) -> typing.Tuple[typing.List[str], typing.List[typing.Optional[str]]]:
    """
    Returns validated expressions for ``GROUP BY`` and optional output aliases for ``SELECT``.

    * A string ``\"col\"`` → expression ``col``, no ``AS`` (PostgreSQL uses column name as label).
    * A pair ``(\"date_trunc('month', d)\", \"month\")`` → same expression in ``GROUP BY``,
      and ``… AS month`` in ``SELECT``.
    """
    exprs: typing.List[str] = []
    out_aliases: typing.List[typing.Optional[str]] = []
    for i, item in enumerate(group_by):
        if isinstance(item, str):
            exprs.append(_group_by_item(item))
            out_aliases.append(None)
        elif isinstance(item, (tuple, list)) and len(item) == 2:
            raw_expr, raw_alias = item[0], item[1]
            if not isinstance(raw_expr, str) or not isinstance(raw_alias, str):
                raise ValueError(
                    f"group_by[{i}] must be a string or (expression, alias) with two strings; "
                    f"got {item!r}"
                )
            exprs.append(_group_by_item(raw_expr))
            out_aliases.append(_ident(raw_alias.strip(), kind="GROUP BY output alias"))
        else:
            raise ValueError(
                f"group_by[{i}] must be a string or a (expression, alias) pair; got {item!r}"
            )
    return exprs, out_aliases


def _qualified_table(name: str) -> str:
    """``"table"`` or ``"schema"."table"`` — each segment validated and double-quoted."""
    parts = name.split(".")
    if len(parts) > 2:
        raise ValueError("Table must be `name` or `schema.name`.")
    return ".".join(_sql_quote_ident(_ident(p, kind="table segment")) for p in parts)


_INTERVAL_FOR_NOW = re.compile(
    r"^\s*(\d+)\s*(day|days|d|week|weeks|w|hour|hours|h|minute|minutes|min|m)\s*$",
    re.IGNORECASE,
)


def _interval_body_for_now_minus(spec: str) -> str:
    """
    Validate a short interval spec and return the inner string for ``INTERVAL '…'``
    in ``column > NOW() - INTERVAL '…'``.
    """
    m = _INTERVAL_FOR_NOW.match(spec.strip())
    if not m:
        raise ValueError(
            f"Invalid rolling interval {spec!r}; use e.g. '3d', '3 days', '1w', '2 hours'"
        )
    n = int(m.group(1))
    if n < 0 or n > 1_000_000:
        raise ValueError("rolling interval amount must be between 0 and 1000000")
    u = m.group(2).lower()
    if u in ("d", "day", "days"):
        return f"{n} days"
    if u in ("w", "week", "weeks"):
        return f"{n} weeks"
    if u in ("h", "hour", "hours"):
        return f"{n} hours"
    if u in ("m", "min", "minute", "minutes"):
        return f"{n} minutes"
    raise ValueError(f"Invalid interval unit in {spec!r}")


def _sql_literal(val: typing.Any) -> str:
    if val is None:
        raise ValueError("Filter values must not be None; omit the key instead.")
    if isinstance(val, (datetime.date, datetime.datetime)):
        return f"'{val.isoformat()}'"
    if isinstance(val, str):
        return "'" + val.replace("'", "''") + "'"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, int):
        return str(val)
    if isinstance(val, float):
        return repr(val)
    raise TypeError(f"Unsupported filter value type: {type(val)}")


def _emit_agg_arithmetic_sql(expr: str) -> str:
    """
    Build SQL for a safe arithmetic expression: only ``+ - * / ( )``, numeric literals,
    and column refs validated via :func:`_column_ref`.
    """
    s = "".join(expr.split())
    if not s:
        raise ValueError("Aggregate expression is empty")
    out: typing.List[str] = []
    i = 0
    n = len(s)
    while i < n:
        ch = s[i]
        if ch in "+-*/()":
            out.append(ch)
            i += 1
            continue
        m = re.match(r"\d+(?:\.\d+)?", s[i:])
        if m:
            out.append(m.group(0))
            i += len(m.group(0))
            continue
        m = re.match(
            r"[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*",
            s[i:],
        )
        if m:
            tok = m.group(0)
            out.append(_column_ref(tok, kind="aggregate expression"))
            i += len(tok)
            continue
        raise ValueError(
            f"Invalid aggregate expression {expr!r} at position {i}; "
            "use only digits, + - * / ( ), and qualified column names."
        )
    return "".join(out)


def _agg_expression(fn: str, column: str) -> str:
    fn_l = fn.lower()
    if fn_l not in _AGG_FUNCS:
        raise ValueError(f"Unsupported aggregate {fn!r}; use {_AGG_FUNCS}.")
    if fn_l == "count" and column.strip() == "*":
        return "COUNT(*)"
    cref = _column_ref(column.strip(), kind="aggregate column")
    if fn_l == "count":
        return f"COUNT({cref})"
    return f"{fn_l.upper()}({cref})"


def _agg_expression_dispatch(
    fn: str,
    column: str,
    *,
    round_scale: typing.Optional[int] = None,
) -> str:
    """``sum`` / ``count`` / … on one column, or ``sum_expr`` / ``round_sum`` on a validated expression."""
    fn_l = fn.lower()
    if fn_l in _AGG_FUNCS_EXPR:
        inner_sql = _emit_agg_arithmetic_sql(column)
        if fn_l == "sum_expr":
            return f"SUM({inner_sql})"
        if fn_l == "round_sum":
            dec = 0 if round_scale is None else int(round_scale)
            if dec < 0 or dec > 20:
                raise ValueError("round_sum decimal places must be between 0 and 20")
            return f"ROUND(SUM({inner_sql}), {dec})"
    return _agg_expression(fn, column)


def _parse_join_entries(
    joins: typing.Optional[typing.Sequence[str]],
) -> typing.List[typing.Tuple[str, str, str, str, str]]:
    """
    Each entry is ``ast.literal_eval`` to a 5-tuple:
    ``(join_kind, joined_table, join_alias, on_left, on_right)``.

    * ``join_kind`` — ``INNER``, ``LEFT``, ``RIGHT``, or ``FULL`` (``FULL`` → ``FULL OUTER JOIN``).
    * ``joined_table`` — ``schema.table`` or ``table`` (validated).
    * ``join_alias`` — SQL alias for the joined table.
    * ``on_left`` / ``on_right`` — columns or ``alias.column`` (validated).
    """
    if not joins:
        return []
    out: typing.List[typing.Tuple[str, str, str, str, str]] = []
    seen_aliases: typing.Set[str] = set()
    for i, item in enumerate(joins):
        t = ast.literal_eval(item)
        if not isinstance(t, (tuple, list)) or len(t) != 5:
            raise ValueError(
                f"joins[{i}] must be a 5-tuple "
                "(join_kind, joined_table, join_alias, on_left, on_right); "
                f"got {item!r}"
            )
        kind_s, jtable, jalias, on_left, on_right = t
        if not all(isinstance(x, str) for x in (kind_s, jtable, jalias, on_left, on_right)):
            raise ValueError(f"joins[{i}] must contain only strings; got {item!r}")
        kind_u = kind_s.strip().upper()
        if kind_u not in _JOIN_KIND_SQL:
            raise ValueError(
                f"joins[{i}] join_kind must be one of {sorted(_JOIN_KIND_SQL)}; got {kind_s!r}"
            )
        sql_kind = _JOIN_KIND_SQL[kind_u]
        tbl = _qualified_table(jtable.strip())
        ja = _ident(jalias.strip(), kind="JOIN alias")
        if ja in seen_aliases:
            raise ValueError(f"joins[{i}] reuses JOIN alias {ja!r}; each join must use a unique alias.")
        seen_aliases.add(ja)
        left_on = _column_ref(on_left, kind="JOIN ON left")
        right_on = _column_ref(on_right, kind="JOIN ON right")
        out.append((sql_kind, tbl, ja, left_on, right_on))
    return out


def _build_where(
    filters: typing.Optional[typing.Mapping[str, typing.Any]],
    date_column: typing.Optional[str],
    date_from: typing.Optional[datetime.date],
    date_to: typing.Optional[datetime.date],
    date_after_now_interval: typing.Optional[str] = None,
    date_before_now_interval: typing.Optional[str] = None,
) -> typing.List[str]:
    parts: typing.List[str] = []
    if filters:
        for key, val in filters.items():
            c = _column_ref(key, kind="filter column")
            if isinstance(val, dict):
                operator = str(val.get("operator", "")).lower()
                value = val.get("value")

                if operator == "like":
                    parts.append(f"{c} LIKE {_sql_literal(value)}")

                elif operator == "ilike":
                    parts.append(f"{c} ILIKE {_sql_literal(value)}")

                else:
                    raise ValueError(f"Unsupported filter operator: {operator}")

            elif isinstance(val, (list, tuple, set)):
                if not val:
                    parts.append("FALSE")
                    continue

                inner = ", ".join(_sql_literal(x) for x in val)
                parts.append(f"{c} IN ({inner})")

            else:
                parts.append(f"{c} = {_sql_literal(val)}")
    dc_for_dates: typing.Optional[str] = None

    if date_after_now_interval is not None and str(date_after_now_interval).strip():
        if not date_column or not str(date_column).strip():
            raise ValueError(
                "date_column is required when date_after_now_interval is set."
            )
        body = _interval_body_for_now_minus(str(date_after_now_interval))
        dc_for_dates = _column_ref(str(date_column).strip(), kind="date column")
        parts.append(f"{dc_for_dates} > (NOW() - INTERVAL '{body}')")

    if date_before_now_interval is not None and str(date_before_now_interval).strip():
        if not date_column or not str(date_column).strip():
            raise ValueError(
                "date_column is required when date_before_now_interval is set."
            )
        body = _interval_body_for_now_minus(str(date_before_now_interval))
        dc_b = dc_for_dates or _column_ref(str(date_column).strip(), kind="date column")
        dc_for_dates = dc_b
        parts.append(f"{dc_b} < (NOW() - INTERVAL '{body}')")

    if date_from is not None or date_to is not None:
        if not date_column or not str(date_column).strip():
            raise ValueError("date_column is required when date_from or date_to is set.")
        dc = dc_for_dates or _column_ref(str(date_column).strip(), kind="date column")
        if date_from is not None:
            parts.append(f"{dc} >= {_sql_literal(date_from)}")
        if date_to is not None:
            parts.append(f"{dc} <= {_sql_literal(date_to)}")
    return parts


def _order_clause(
    order_by: typing.Optional[typing.Sequence[typing.Tuple[str, str]]],
    known_aliases: typing.Set[str],
) -> str:
    if not order_by:
        return ""
    bits: typing.List[str] = []
    for col, direction in order_by:
        d = direction.strip().upper()
        if d not in ("ASC", "DESC"):
            raise ValueError(f"ORDER BY direction must be ASC or DESC, got {direction!r}")
        if col in known_aliases:
            bits.append(f"{_sql_quote_ident(_ident(col, kind='alias'))} {d}")
        else:
            bits.append(f"{_column_ref(col, kind='ORDER BY column')} {d}")
    return " ORDER BY " + ", ".join(bits)


def _normalize_optional_str(val: typing.Optional[str]) -> typing.Optional[str]:
    """Treat blank strings as unset (API layers often use ``Field(\"\")`` defaults)."""
    if val is None:
        return None
    if isinstance(val, str) and not val.strip():
        return None
    return val


def _normalize_joins_input(joins: typing.Any) -> typing.Optional[typing.Sequence[str]]:
    """
    Coerce ``joins`` from API payloads: ``None``/blank, a single string, or a list of
    join-spec strings (each parsed with ``ast.literal_eval`` in :func:`_parse_join_entries`).
    """
    if joins is None:
        return None
    if isinstance(joins, str):
        s = joins.strip()
        return [s] if s else None
    if isinstance(joins, (list, tuple)):
        out = [str(x) for x in joins if x is not None and str(x).strip()]
        return out if out else None
    return None


def _from_clause(
    tsql: str,
    base_table_alias: typing.Optional[str],
    join_rows: typing.List[typing.Tuple[str, str, str, str, str]],
) -> str:
    """``FROM`` primary table (optional alias) plus validated ``JOIN`` fragments."""
    if base_table_alias:
        ba = _ident(base_table_alias.strip(), kind="base table alias")
        base = f"{tsql} AS {_sql_quote_ident(ba)}"
    else:
        base = tsql
    if not join_rows:
        return f"FROM {base}"
    parts = [f"FROM {base}"]
    for sql_kind, tbl, ja, left_on, right_on in join_rows:
        parts.append(
            f"{sql_kind} JOIN {tbl} AS {_sql_quote_ident(ja)} ON {left_on} = {right_on}"
        )
    return " ".join(parts)


async def query_aggregate_gateway(
    *,
    table: str,
    base_table_alias: typing.Optional[str] = None,
    joins: typing.Optional[typing.Sequence[str]] = None,
    group_by: typing.Optional[typing.Sequence[GroupByEntry]] = None,
    filters: typing.Optional[typing.Mapping[str, typing.Any]] = None,
    date_column: typing.Optional[str] = None,
    date_from: typing.Optional[datetime.date] = None,
    date_to: typing.Optional[datetime.date] = None,
    date_after_now_interval: typing.Optional[str] = None,
    date_before_now_interval: typing.Optional[str] = None,
    aggregations: typing.Optional[list] = None,
    detail_fields: typing.Optional[list] = None,
    order_by: typing.Optional[list] = None,
    limit: int = 1000,
    skip: int = 0,
) -> typing.Mapping[str, typing.Any]:
    """
    Run a ``SELECT`` with optional joins, filters, date range, grouping, and aggregates.
    All structure is driven by arguments.

    **Parameters**

    * ``table`` — Primary physical table name, or ``schema.table`` (each segment validated).
    * ``base_table_alias`` — Optional SQL alias for ``table`` (recommended when using ``joins``).
    * ``joins`` — Optional list of strings, each ``ast.literal_eval`` to a 5-tuple:
      ``(join_kind, joined_table, join_alias, on_left, on_right)``. Kinds: ``INNER``,
      ``LEFT``, ``RIGHT``, ``FULL``. Example:
      ``'("LEFT", "public.locations", "loc", "m.plant_id", "loc.id")'`` with
      ``base_table_alias="m"``.
    * ``group_by`` — Dimensions for ``GROUP BY``. Each item is either a string (column or
      safe expression as in :func:`_group_by_item`) or a ``(expression, output_alias)``
      tuple so the result column is labeled (e.g. ``(\"date_trunc('month', conn_date)\", \"month\")``).
    * ``filters`` — Equality or ``IN`` list: ``{"col": "x"}`` or ``{"col": ["a","b"]}``.
    * ``date_column`` — Column used with ``date_from`` / ``date_to`` (inclusive) and/or
      ``date_after_now_interval`` / ``date_before_now_interval``. Required when any of those are set.
    * ``date_from`` / ``date_to`` — Inclusive bounds; optional (static dates).
    * ``date_after_now_interval`` — If set (e.g. ``\"3d\"``), adds
      ``\"column\" > (NOW() - INTERVAL '3 days')``.
    * ``date_before_now_interval`` — If set, adds
      ``\"column\" < (NOW() - INTERVAL '…')`` (strictly older than that rolling instant).
      Same interval syntax as ``date_after_now_interval``. Combined with ``AND`` when both are set.
    * Rolling interval bounds are evaluated at query time in PostgreSQL and compose with
      ``date_from`` / ``date_to`` via ``AND``.
    * ``aggregations`` — each item is ``ast.literal_eval`` to a 3-tuple
      ``(output_alias, aggregate_fn, column)`` or, for rounded sums of an expression, a 4-tuple
      ``(output_alias, "round_sum", arithmetic_expression, scale)``.
      * ``aggregate_fn`` is ``sum|avg|min|max|count``; use ``("n", "count", "*")`` for ``COUNT(*)``.
      * ``sum_expr`` — ``SUM`` of a validated arithmetic expression (only column refs, ``*+-/()``).
      * ``round_sum`` — ``ROUND(SUM(expr), scale)``; ``scale`` is an integer 0–20 (default 0 if omitted).
    * ``detail_fields`` — When not using aggregates, optional column list; default ``*``.
    * ``order_by`` — ``[(column_or_alias, "asc"|"desc"), ...]``.
    * ``limit`` / ``skip`` — Passed to ``get_aggr_data`` (offset = ``limit * skip``).

    **Modes**

    1. Detail: no ``group_by`` and no ``aggregations`` — filtered row scan.
    2. Global aggregates: ``aggregations`` without ``group_by`` — no ``GROUP BY``.
    3. Grouped: both ``group_by`` and ``aggregations`` — ``GROUP BY`` the dimensions.

    **Returns**

    ``{"data", "count", "total"}`` as from ``get_aggr_data``.
    """
    base_table_alias = _normalize_optional_str(base_table_alias)
    joins = _normalize_joins_input(joins)
    tsql = _qualified_table(table)
    join_rows = _parse_join_entries(joins)
    seen_join_aliases = {ja for _k, _t, ja, _l, _r in join_rows}
    if base_table_alias:
        ba = _ident(base_table_alias.strip(), kind="base table alias")
        if ba in seen_join_aliases:
            raise ValueError(
                f"base_table_alias {ba!r} conflicts with a JOIN alias; use a distinct alias."
            )
    date_after_now_interval = _normalize_optional_str(date_after_now_interval)
    date_before_now_interval = _normalize_optional_str(date_before_now_interval)
    where_parts = _build_where(
        filters,
        date_column,
        date_from,
        date_to,
        date_after_now_interval=date_after_now_interval,
        date_before_now_interval=date_before_now_interval,
    )
    where_sql = (" WHERE " + " AND ".join(where_parts)) if where_parts else ""
    from_sql = _from_clause(tsql, base_table_alias, join_rows)

    gb_list: typing.List[str] = []
    gb_out_aliases: typing.List[typing.Optional[str]] = []
    if group_by:
        gb_list, gb_out_aliases = _parse_group_by_entries(group_by)
        if not gb_list:
            raise ValueError("group_by must list at least one column when provided.")

    has_group = bool(gb_list)
    has_agg = bool(aggregations)

    if has_group and not has_agg:
        raise ValueError(
            "When group_by is set, aggregations must also be set. "
            "For raw rows, omit group_by and use filters only."
        )

    alias_names: typing.Set[str] = set()

    if has_agg:
        if aggregations is None:
            raise ValueError("aggregations is required when using aggregates.")
        select_parts: typing.List[str] = []
        for expr, gb_alias in zip(gb_list, gb_out_aliases):
            if gb_alias:
                if gb_alias in alias_names:
                    raise ValueError(f"Duplicate output alias {gb_alias!r} (group_by vs aggregates)")
                alias_names.add(gb_alias)
                select_parts.append(f"{expr} AS {_sql_quote_ident(gb_alias)}")
            else:
                select_parts.append(expr)
        for raw_agg in aggregations:
            t = ast.literal_eval(raw_agg) if isinstance(raw_agg, str) else raw_agg
            if not isinstance(t, (list, tuple)):
                raise ValueError(f"aggregations entry must be a tuple or list; got {raw_agg!r}")
            round_scale: typing.Optional[int] = None
            if len(t) == 3:
                alias, fn, col = t[0], t[1], t[2]
            elif len(t) == 4:
                alias, fn, col, scale_raw = t[0], t[1], t[2], t[3]
                if str(fn).lower() != "round_sum":
                    raise ValueError(
                        "4-element aggregations are only valid as "
                        "(alias, 'round_sum', expression, scale)"
                    )
                round_scale = int(scale_raw)
            else:
                raise ValueError(
                    "aggregations entries must be (alias, fn, column) or "
                    "(alias, 'round_sum', expression, scale)"
                )
            a = _ident(str(alias).strip(), kind="aggregate alias")
            if a in alias_names:
                raise ValueError(f"Duplicate aggregate alias {a!r}")
            alias_names.add(a)
            col_s = col if isinstance(col, str) else str(col)
            expr = _agg_expression_dispatch(
                str(fn).strip(), col_s, round_scale=round_scale
            )
            select_parts.append(f"{expr} AS {_sql_quote_ident(a)}")
        group_sql = f" GROUP BY {', '.join(gb_list)}" if has_group else ""
        sql = f"SELECT {', '.join(select_parts)} {from_sql}{where_sql}{group_sql}"
    else:
        if detail_fields:
            fields_sql = ", ".join(_column_ref(f, kind="detail field") for f in detail_fields)
        else:
            fields_sql = "*"
        sql = f"SELECT {fields_sql} {from_sql}{where_sql}"

    order_by_parsed: typing.List[typing.Tuple[str, str]] = []
    if order_by:
        order_by_parsed = [ast.literal_eval(item) for item in order_by]
    sql += _order_clause(order_by_parsed, alias_names)

    return await urdhva_pg.BasePostgresModel.get_aggr_data(
        sql,
        limit=limit,
        skip=skip,
        skip_total=True,
    )
