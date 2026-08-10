import * as XLSX from "xlsx";
import type { ColDef, ColGroupDef } from "ag-grid-community";

type GridCol = ColDef | ColGroupDef;

interface ExportRow {
  group: string;
  param: string;
  _span?: number;
  _isLastInGroup?: boolean;
  [key: string]: unknown;
}

interface PlantColumn {
  plantName: string;
  cars: { header: string; field: string }[];
}

function parsePlantColumns(colDefs: GridCol[]): PlantColumn[] {
  const plants: PlantColumn[] = [];
  for (const col of colDefs) {
    if (!("children" in col) || !col.children?.length) continue;
    const cars = col.children
      .filter((child): child is ColDef => "field" in child && !!child.field)
      .map((child) => ({
        header: String(child.headerName ?? ""),
        field: String(child.field),
      }));
    if (cars.length > 0) {
      plants.push({ plantName: String(col.headerName ?? ""), cars });
    }
  }
  return plants;
}

function formatExcelValue(val: unknown): string | number {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "number") {
    if (val === 0) return 0;
    return Number.isInteger(val) ? val : parseFloat(val.toFixed(2));
  }
  return String(val);
}

export function downloadConsolidatedReportExcel(
  colDefs: GridCol[],
  rowData: ExportRow[],
  fromDate: string,
  toDate: string
): void {
  const plants = parsePlantColumns(colDefs);
  const totalCols = 2 + plants.reduce((sum, plant) => sum + plant.cars.length, 0);

  const headerRow0: string[] = Array(totalCols).fill("");
  const headerRow1: string[] = Array(totalCols).fill("");

  headerRow0[0] = "Group";
  headerRow0[1] = "Parameters";

  let col = 2;
  for (const plant of plants) {
    headerRow0[col] = plant.plantName;
    for (const car of plant.cars) {
      headerRow1[col] = car.header;
      col += 1;
    }
  }

  const dataRows = rowData.map((row) => {
    const line: (string | number)[] = [
      row.group ? String(row.group) : "",
      String(row.param ?? ""),
    ];
    for (const plant of plants) {
      for (const car of plant.cars) {
        line.push(formatExcelValue(row[car.field]));
      }
    }
    return line;
  });

  const sheetData = [headerRow0, headerRow1, ...dataRows];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
  ];

  let plantCol = 2;
  for (const plant of plants) {
    if (plant.cars.length > 1) {
      merges.push({
        s: { r: 0, c: plantCol },
        e: { r: 0, c: plantCol + plant.cars.length - 1 },
      });
    }
    plantCol += plant.cars.length;
  }

  const dataStartRow = 2;
  rowData.forEach((row, rowIdx) => {
    const span = row._span ?? 1;
    if (row.group && span > 1) {
      merges.push({
        s: { r: dataStartRow + rowIdx, c: 0 },
        e: { r: dataStartRow + rowIdx + span - 1, c: 0 },
      });
    }
  });

  worksheet["!merges"] = merges;

  worksheet["!cols"] = [
    { wch: 24 },
    { wch: 30 },
    ...Array(totalCols - 2).fill({ wch: 14 }),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "ConsolidatedReport");

  const rangeLabel = fromDate === toDate ? fromDate : `${fromDate}_to_${toDate}`;
  XLSX.writeFile(workbook, `Consolidated_Plant_Report_${rangeLabel}.xlsx`);
}
