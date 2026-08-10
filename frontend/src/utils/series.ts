// import { TimeGranularity } from "../pages/dashboard/ActionCenter/Chart/ListOfCharts/type";
// import ensureIsArray from "./ensureIsArray";

// export type DataRecordValue = number | string | boolean | Date | null;
// export interface DataRecord {
//   [key: string]: DataRecordValue;
// }

// interface NumberFormatter {
//   (value: number | null | undefined): string;
// }

// interface TimeFormatter {
//   (value: Date | number | null | undefined): string;
// }

// export enum GenericDataType {
//   NUMERIC = 0,
//   STRING = 1,
//   TEMPORAL = 2,
//   BOOLEAN = 3,
// }

// export const NULL_STRING = '<NULL>';

// export function extractGroupbyLabel({
//   datum = {},
//   groupby,
//   numberFormatter,
//   timeFormatter,
//   coltypeMapping = {},
// }: {
//   datum?: DataRecord;
//   groupby?: string[] | null;
//   numberFormatter?: NumberFormatter;
//   timeFormatter?: TimeFormatter;
//   coltypeMapping?: Record<string, GenericDataType>;
// }): string {
//   return ensureIsArray(groupby)
//     .map(val =>
//       formatSeriesName(datum[val], {
//         numberFormatter,
//         timeFormatter,
//         ...(coltypeMapping[val] && { coltype: coltypeMapping[val] }),
//       }),
//     )
//     .join(', ');
// }


// export function formatSeriesName(
//   name: DataRecordValue | undefined,
//   {
//     numberFormatter,
//     timeFormatter,
//     coltype,
//   }: {
//     numberFormatter?: NumberFormatter;
//     timeFormatter?: TimeFormatter;
//     coltype?: GenericDataType;
//   } = {},
// ): string {
//   if (name === undefined || name === null) {
//     return NULL_STRING;
//   }
//   if (typeof name === 'boolean') {
//     return name.toString();
//   }
//   if (name instanceof Date || coltype === GenericDataType.TEMPORAL) {
//     const d = name instanceof Date ? name : new Date(name);

//     return timeFormatter ? timeFormatter(d) : d.toISOString();
//   }
//   if (typeof name === 'number') {
//     return numberFormatter ? numberFormatter(name) : name.toString();
//   }
//   return name;
// }


// // export function getTimeFormatter(
// //   formatId?: string,
// //   granularity?: TimeGranularity,
// // ) {
// //   if (granularity) {
// //     const formatString = formatId || TimeFormatsForGranularity[granularity];
// //     const timeRangeFormatter = getTimeRangeFormatter(formatString);

// //     return new TimeFormatter({
// //       id: [formatString, granularity].join('/'),
// //       formatFunc: (value: Date) =>
// //         timeRangeFormatter.format(
// //           createTimeRangeFromGranularity(
// //             value,
// //             granularity,
// //             timeRangeFormatter.useLocalTime,
// //           ),
// //         ),
// //       useLocalTime: timeRangeFormatter.useLocalTime,
// //     });
// //   }

// //   return getInstance().get(formatId);
// // }