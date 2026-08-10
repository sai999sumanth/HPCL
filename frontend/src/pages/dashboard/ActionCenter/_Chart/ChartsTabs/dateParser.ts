import { CustomRangeDecodeType, CustomRangeType, DateTimeGrainType, DateTimeModeType, MIDNIGHT, SEPARATOR, SEVEN_DAYS_AGO } from "./dataUtils";
import moment, { Moment } from "moment";

const iso8601 = String.raw`\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:(?:[+-]\d\d:\d\d)|Z)?`;
const datetimeConstant = String.raw`(?:TODAY|NOW)`;
const DATETIME_CONSTANT = ['now', 'today'];
const grainValue = String.raw`[+-]?[1-9][0-9]*`;
const grain = String.raw`YEAR|QUARTER|MONTH|WEEK|DAY|HOUR|MINUTE|SECOND`;
const CUSTOM_RANGE_EXPRESSION = RegExp(
  String.raw`^DATEADD\(DATETIME\("(${iso8601}|${datetimeConstant})"\),\s(${grainValue}),\s(${grain})\)$`,
  'i',
);

const SPECIFIC_MODE = ['specific', 'today', 'now'];
export const MOMENT_FORMAT = 'YYYY-MM-DD[T]HH:mm:ss';
const defaultCustomRange: CustomRangeType = {
  sinceDatetime: SEVEN_DAYS_AGO,
  sinceMode: 'relative',
  sinceGrain: 'day',
  sinceGrainValue: -7,
  untilDatetime: MIDNIGHT,
  untilMode: 'specific',
  untilGrain: 'day',
  untilGrainValue: 7,
  anchorMode: 'now',
  anchorValue: 'now',
};

export const dttmToMoment = (dttm: string): Moment => {
  if (dttm === 'now') {
    return moment().utc().startOf('second');
  }
  if (dttm === 'today') {
    return moment().utc().startOf('day');
  }
  return moment(dttm);
};

export const dttmToString = (dttm: string): string =>
  dttmToMoment(dttm).format(MOMENT_FORMAT);

export const ISO8601_AND_CONSTANT = RegExp(
  String.raw`^${iso8601}$|^${datetimeConstant}$`,
  'i',
);

export const customTimeRangeDecode = (
  timeRange: string,
): CustomRangeDecodeType => {
  const splitDateRange = timeRange.split(SEPARATOR);

  if (splitDateRange.length === 2) {
    const [since, until] = splitDateRange;

    // specific : specific
    if (ISO8601_AND_CONSTANT.test(since) && ISO8601_AND_CONSTANT.test(until)) {
      const sinceMode = (
        DATETIME_CONSTANT.includes(since) ? since : 'specific'
      ) as DateTimeModeType;
      const untilMode = (
        DATETIME_CONSTANT.includes(until) ? until : 'specific'
      ) as DateTimeModeType;
      return {
        customRange: {
          ...defaultCustomRange,
          sinceDatetime: since,
          untilDatetime: until,
          sinceMode,
          untilMode,
        },
        matchedFlag: true,
      };
    }

    // relative : specific
    const sinceCapturedGroup = since.match(CUSTOM_RANGE_EXPRESSION);
    if (
      sinceCapturedGroup &&
      ISO8601_AND_CONSTANT.test(until) &&
      since.includes(until)
    ) {
      const [dttm, grainValue, grain] = sinceCapturedGroup.slice(1);
      const untilMode = (
        DATETIME_CONSTANT.includes(until) ? until : 'specific'
      ) as DateTimeModeType;
      return {
        customRange: {
          ...defaultCustomRange,
          sinceGrain: grain as DateTimeGrainType,
          sinceGrainValue: parseInt(grainValue, 10),
          sinceDatetime: dttm,
          untilDatetime: dttm,
          sinceMode: 'relative',
          untilMode,
        },
        matchedFlag: true,
      };
    }

    // specific : relative
    const untilCapturedGroup = until.match(CUSTOM_RANGE_EXPRESSION);
    if (
      ISO8601_AND_CONSTANT.test(since) &&
      untilCapturedGroup &&
      until.includes(since)
    ) {
      const [dttm, grainValue, grain] = [...untilCapturedGroup.slice(1)];
      const sinceMode = (
        DATETIME_CONSTANT.includes(since) ? since : 'specific'
      ) as DateTimeModeType;
      return {
        customRange: {
          ...defaultCustomRange,
          untilGrain: grain as DateTimeGrainType,
          untilGrainValue: parseInt(grainValue, 10),
          sinceDatetime: dttm,
          untilDatetime: dttm,
          untilMode: 'relative',
          sinceMode,
        },
        matchedFlag: true,
      };
    }

    // relative : relative
    if (sinceCapturedGroup && untilCapturedGroup) {
      const [sinceDttm, sinceGrainValue, sinceGrain] = [
        ...sinceCapturedGroup.slice(1),
      ];
      const [untileDttm, untilGrainValue, untilGrain] = [
        ...untilCapturedGroup.slice(1),
      ];
      if (sinceDttm === untileDttm) {
        return {
          customRange: {
            ...defaultCustomRange,
            sinceGrain: sinceGrain as DateTimeGrainType,
            sinceGrainValue: parseInt(sinceGrainValue, 10),
            sinceDatetime: sinceDttm,
            untilGrain: untilGrain as DateTimeGrainType,
            untilGrainValue: parseInt(untilGrainValue, 10),
            untilDatetime: untileDttm,
            anchorValue: sinceDttm,
            sinceMode: 'relative',
            untilMode: 'relative',
            anchorMode: sinceDttm === 'now' ? 'now' : 'specific',
          },
          matchedFlag: true,
        };
      }
    }
  }

  return {
    customRange: defaultCustomRange,
    matchedFlag: false,
  };
};

export const customTimeRangeEncode = (customRange: CustomRangeType): string => {
  const {
    sinceDatetime,
    sinceMode,
    sinceGrain,
    sinceGrainValue,
    untilDatetime,
    untilMode,
    untilGrain,
    untilGrainValue,
    anchorValue,
  } = { ...customRange };
  // specific : specific
  if (SPECIFIC_MODE.includes(sinceMode) && SPECIFIC_MODE.includes(untilMode)) {
    const since =
      sinceMode === 'specific' ? dttmToString(sinceDatetime) : sinceMode;
    const until =
      untilMode === 'specific' ? dttmToString(untilDatetime) : untilMode;
    return `${since} : ${until}`;
  }

  // specific : relative
  if (SPECIFIC_MODE.includes(sinceMode) && untilMode === 'relative') {
    const since =
      sinceMode === 'specific' ? dttmToString(sinceDatetime) : sinceMode;
    const until = `DATEADD(DATETIME("${since}"), ${untilGrainValue}, ${untilGrain})`;
    return `${since} : ${until}`;
  }

  // relative : specific
  if (sinceMode === 'relative' && SPECIFIC_MODE.includes(untilMode)) {
    const until =
      untilMode === 'specific' ? dttmToString(untilDatetime) : untilMode;
    const since = `DATEADD(DATETIME("${until}"), ${-Math.abs(
      sinceGrainValue,
    )}, ${sinceGrain})`;
    return `${since} : ${until}`;
  }

  // relative : relative
  const since = `DATEADD(DATETIME("${anchorValue}"), ${-Math.abs(
    sinceGrainValue,
  )}, ${sinceGrain})`;
  const until = `DATEADD(DATETIME("${anchorValue}"), ${untilGrainValue}, ${untilGrain})`;
  return `${since} : ${until}`;
};