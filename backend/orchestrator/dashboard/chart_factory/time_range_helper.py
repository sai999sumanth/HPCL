from enum import Enum
LRU_CACHE_MAX_SIZE=256
NO_TIME_RANGE="No filter"
class InstantTimeComparison(Enum):
    YEAR='y'
    MONTH='m'
    WEEK='w'
    INHERITED='r'

    def __str__(self):
        return self.value
