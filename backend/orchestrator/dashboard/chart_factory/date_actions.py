import asyncio
from orchestrator.dashboard.chart_factory.date_parser import *
from marshmallow.validate import ValidationError
from orchestrator.dashboard.chart_factory.time_range_exceptions import (
    TimeDeltaAmbiguousError,
    TimeRangeAmbiguousError,
    TimeRangeParseFailError,
)

async def time_range(**kwargs):
    """Get actually time range from human-readable string or datetime expression."""
    time_ranges = kwargs["text"]
    try:
        if isinstance(time_ranges, str):
            time_ranges = [{"timeRange": time_ranges}]

        rv = []
        for time_range in time_ranges:
            since, until = get_since_until(
                time_range=time_range["timeRange"],
                time_shift=time_range.get("shift"),
            )
            rv.append(
                {
                    "since": since.isoformat() if since else "",
                    "until": until.isoformat() if until else "",
                    "timeRange": time_range["timeRange"],
                    "shift": time_range.get("shift"),
                }
            )
        return {"result": rv[0]}
    except (ValueError, TimeRangeParseFailError, TimeRangeAmbiguousError) as error:
        error_msg = {"message": _("Unexpected time range: %(error)s", error=error)}
        return error_msg


if __name__ == "__main__":
    data = {
        "text": '''previous calendar quarter'''
    }
    resp = asyncio.run(time_range(**data))
    print(resp)
