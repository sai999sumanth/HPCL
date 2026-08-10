from marshmallow.validate import ValidationError

class TimeRangeAmbiguousError(ValidationError):
    """
    Time range is ambiguous error.
    """

    def __init__(self, human_readable: str) -> None:
        super().__init__(
            _(
                "Time string is ambiguous."
                " Please specify [%(human_readable)s ago]"
                " or [%(human_readable)s later].",
                human_readable=human_readable,
            ),
            field_name="time_range",
        )


class TimeDeltaAmbiguousError(ValidationError):
    """
    Time delta is ambiguous error.
    """

    def __init__(self, human_readable: str) -> None:
        super().__init__(
            _(
                "Time delta is ambiguous."
                " Please specify [%(human_readable)s ago]"
                " or [%(human_readable)s later].",
                human_readable=human_readable,
            ),
            field_name="time_range",
        )

class TimeRangeParseFailError(ValidationError):
    def __init__(self, human_readable: str) -> None:
        super().__init__(
            _(
                "Cannot parse time string [%(human_readable)s]",
                human_readable=human_readable,
            ),
            field_name="time_range",
        )
