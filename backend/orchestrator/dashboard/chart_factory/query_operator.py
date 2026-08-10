from enum import Enum


class FilterOperator(str, Enum):
    """
    Operators used filter controls
    Returns: String Operator
    """

    EQUALS = "="
    NOT_EQUALS = "!="
    GREATER_THAN = ">"
    LESS_THAN = "<"
    GREATER_THAN_OR_EQUALS = ">="
    LESS_THAN_OR_EQUALS = "<="
    LIKE = "LIKE"
    ILIKE = "ILIKE"
    IS_NULL = "IS NULL"
    IS_NOT_NULL = "IS NOT NULL"
    IN = "IN"
    NOT_IN = "NOT IN"
    IS_TRUE = "IS TRUE"
    IS_FALSE = "IS FALSE"
    TEMPORAL_RANGE = "TEMPORAL_RANGE"


class FilterStringOperator(str, Enum):
    """
    Operators used filter controls
    Returns: String Operator
    """

    EQUALS = "EQUALS"
    NOT_EQUALS = "NOT_EQUALS"
    GREATER_THAN = "GREATER_THAN"
    LESS_THAN = "LESS_THAN"
    GREATER_THAN_OR_EQUALS = "GREATER_THAN_OR_EQUALS"
    LESS_THAN_OR_EQUALS = "LESS_THAN_OR_EQUALS"
    LIKE = "LIKE"
    ILIKE = "ILIKE"
    IS_NULL = "IS_NULL"
    IS_NOT_NULL = "IS_NOT_NULL"
    IN = "IN"
    NOT_IN = "NOT_IN"
    IS_TRUE = "IS_TRUE"
    IS_FALSE = "IS_FALSE"
    TEMPORAL_RANGE = "TEMPORAL_RANGE"


class AggregationOperator(str, Enum):
    """
    Operators used filter controls
    Returns: String Operator
    """

    SUM = "sum"
    AVG = "avg"
    MAX = "max"
    MIN = "min"
    COUNT = "count"


class JoinOperator(str, Enum):
    """
    Operators used filter controls
    Returns: String Operator
    """

    inner = "INNER JOIN"
    full = "FULL JOIN"
    right = "RIGHT JOIN"
    left = "LEFT JOIN"