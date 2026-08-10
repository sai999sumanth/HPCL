import React, { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/@/components/ui/sheet";
import { X, Download } from "lucide-react";
import { initialEdges } from "./edges";

// Derive equipment type classification from the actual flow chart edges
const deriveTypeFromEdges = () => {
  const gantryIds: string[] = [];
  const safetyIds: string[] = [];
  const processIds: string[] = [];

  // Nodes directly connected FROM LRC (not via safety/process group) = GANTRY
  // Nodes connected FROM safety-group = SAFETY
  // Nodes connected FROM process-group = PROCESS
  const lrcSources = ["lrca", "lrcb", "ups"];
  const groupTargets = ["safety-group", "process-group"];

  initialEdges.forEach((edge) => {
    // Safety group children
    if (edge.source === "safety-group" && !groupTargets.includes(edge.target)) {
      if (!safetyIds.includes(edge.target)) safetyIds.push(edge.target);
    }
    // Process group children
    if (edge.source === "process-group" && !groupTargets.includes(edge.target)) {
      if (!processIds.includes(edge.target)) processIds.push(edge.target);
    }
    // Direct LRC connections (not to groups) = Gantry
    if (lrcSources.includes(edge.source) && !groupTargets.includes(edge.target) && edge.target !== "gantry_bcu" && edge.target !== "mfm") {
      // skip, handled below
    }
  });

  // gantry_bcu and mfm connect directly from LRC
  initialEdges.forEach((edge) => {
    if (
      lrcSources.includes(edge.source) &&
      !groupTargets.includes(edge.target) &&
      !safetyIds.includes(edge.target) &&
      !processIds.includes(edge.target) &&
      !lrcSources.includes(edge.target)
    ) {
      if (!gantryIds.includes(edge.target)) gantryIds.push(edge.target);
    }
  });

  return { gantryIds, safetyIds, processIds };
};

const { gantryIds: GANTRY_IDS, safetyIds: SAFETY_IDS, processIds: PROCESS_IDS } = deriveTypeFromEdges();

interface EquipmentItem {
  id: string;
  name: string;
  status?: string | null;
  total?: number;
  faulty?: number;
  faulty_device_names?: any;
  maintanance?: number;
  maintenance_device_names?: any;
}

interface AutomationTableDetailProps {
  open: boolean;
  onClose: () => void;
  data: EquipmentItem[];
}

const getEquipmentType = (id: string): string => {
  if (GANTRY_IDS.includes(id)) return "GANTRY";
  if (SAFETY_IDS.includes(id)) return "SAFETY";
  if (PROCESS_IDS.includes(id)) return "PROCESS";
  // Items not in any flow group - classify by naming convention
  const lower = id.toLowerCase();
  if (lower.includes("gantry")) return "GANTRY";
  if (lower.includes("rimseal") || lower.includes("safety") || lower.includes("esd") || lower.includes("air") || lower.includes("compressor")) return "SAFETY";
  return "PROCESS";
};

const AutomationTableDetail: React.FC<AutomationTableDetailProps> = ({
  open,
  onClose,
  data,
}) => {
  // Filter only equipment items (those with a "total" field)
  const equipmentItems = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.filter((item) => typeof item.total === "number");
  }, [data]);

  // Group by type
  const grouped = useMemo(() => {
    const groups: Record<string, EquipmentItem[]> = {
      GANTRY: [],
      PROCESS: [],
      SAFETY: [],
    };

    equipmentItems.forEach((item) => {
      const type = getEquipmentType(item.id);
      groups[type].push(item);
    });

    return groups;
  }, [equipmentItems]);

  // Compute totals per group
  const groupTotals = useMemo(() => {
    const totals: Record<string, { total: number; faultyMaintenance: number }> = {};
    Object.entries(grouped).forEach(([type, items]) => {
      totals[type] = items.reduce(
        (acc, item) => ({
          total: acc.total + (item.total || 0),
          faultyMaintenance: acc.faultyMaintenance + (item.faulty || 0) + (item.maintanance || 0),
        }),
        { total: 0, faultyMaintenance: 0 }
      );
    });
    return totals;
  }, [grouped]);

  // Compute grand totals
  const grandTotals = useMemo(() => {
    return Object.values(groupTotals).reduce(
      (acc, typeTotal) => ({
        total: acc.total + typeTotal.total,
        faultyMaintenance: acc.faultyMaintenance + typeTotal.faultyMaintenance,
      }),
      { total: 0, faultyMaintenance: 0 }
    );
  }, [groupTotals]);

  // Download as CSV
  const handleDownload = () => {
    const headers = ["TYPE", "NAME OF EQUIPMENT", "CONNECTED DEVICE COUNT", "DEVICE IN FAULT/MAINTENANCE"];
    const rows: string[][] = [];

    const typeOrder = ["GANTRY", "PROCESS", "SAFETY"];
    typeOrder.forEach((type) => {
      const items = grouped[type];
      if (items.length === 0) return;
      items.forEach((item) => {
        rows.push([
          type,
          item.name,
          String(item.total || 0),
          String((item.faulty || 0) + (item.maintanance || 0)),
        ]);
      });
      // Add subtotal row
      rows.push([
        "",
        "",
        String(groupTotals[type]?.total || 0),
        String(groupTotals[type]?.faultyMaintenance || 0),
      ]);
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "equipment_details.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const typeOrder = ["GANTRY", "PROCESS", "SAFETY"];

  return (
    <>
    
      <Sheet open={open} onOpenChange={(val) => !val && onClose()}>
        
        <SheetContent
          side="right"
          className="w-[550px] sm:max-w-[550px] overflow-y-auto p-0"
        >
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-gray-200 sticky top-0 bg-white z-10">
            <div className="flex items-center justify-between ">
              <SheetTitle className="text-md font-semibold -mt-2 flex items-center gap-2">
              {/* <button
                  onClick={onClose}
                  className="bg-white rounded-full p-1 shadow-lg hover:bg-gray-100 transition-colors  -ml-5 border-2 border-gray-300"
                  title="Close"
                >
                  <X className="w-4 h-4 text-gray-800" />
                </button> */}
                Equipment Details
              </SheetTitle>
              <div className="flex items-center gap-2 -mt-5">
                <button
                  onClick={handleDownload}
                  className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                  title="Download CSV"
                >
                  <Download className="w-4 h-4 text-gray-600" />
                </button>
                {/* <button
                  onClick={onClose}
                  className="bg-white rounded-full p-1 shadow-lg hover:bg-gray-100 transition-colors border-2 border-gray-300"
                  title="Close"
                >
                  <X className="w-4 h-4 text-gray-800" />
                </button> */}
              </div>
            </div>
            {/* <SheetDescription className="text-xs text-gray-500 -pt-2">
              List of equipment grouped by type
            </SheetDescription> */}
          </SheetHeader>

          <div className="px-2 pt-1 pb-4">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-gray-100 z-10 text-xs">
                  <tr>
                  <th className="border border-gray-300 px-3 py-1 text-left font-semibold text-gray-700 w-[80px]">
                    TYPE
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-left font-semibold text-gray-700">
                    NAME OF EQUIPMENT
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-center font-semibold text-gray-700 w-[120px]">
                    CONNECTED DEVICE COUNT
                  </th>
                  <th className="border border-gray-300 px-3 py-1 text-center font-semibold text-gray-700 w-[120px]">
                    DEVICE IN FAULT/MAINTENANCE
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {typeOrder.map((type, typeIdx) => {
                  const items = grouped[type];
                  if (items.length === 0) return null;
                  const totals = groupTotals[type];

                  return (
                    <React.Fragment key={type}>
                      {/* Equipment rows */}
                      {items.map((item, index) => (
                        <tr key={item.id} className={`hover:bg-blue-50 transition-colors ${index === 0 ? 'bg-gray-50' : ''}`}>
                          <td className="border border-gray-300 px-3 py-1 font-semibold text-gray-800">
                            {index === 0 ? type : ''}
                          </td>
                          <td className="border border-gray-300 px-3 py-1 text-gray-700">
                            {item.name}
                          </td>
                          <td className="border border-gray-300 px-3 py-1 text-center text-gray-700">
                            {item.total || 0}
                          </td>
                          <td className="border border-gray-300 px-3 py-1 text-center text-gray-700">
                            {(item.faulty || 0) + (item.maintanance || 0)}
                          </td>
                        </tr>
                      ))}

                      {/* Subtotal row */}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="border border-gray-300 px-3 py-1">Total</td>
                        <td className="border border-gray-300 px-3 py-1"></td>
                        <td className="border border-gray-300 px-3 py-1 text-center text-gray-800">
                          {totals.total}
                        </td>
                        <td className="border border-gray-300 px-3 py-1 text-center text-gray-800">
                          {totals.faultyMaintenance}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}

                {/* Grand Total row */}
                <tr className="bg-blue-50 font-bold border-t-2 border-gray-400">
                  <td className="border border-gray-300 px-3 py-2 text-gray-900" colSpan={2}>
                    GRAND TOTAL
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-center text-gray-900">
                    {grandTotals.total}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-center text-gray-900">
                    {grandTotals.faultyMaintenance}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </SheetContent>
      </Sheet>

      {/* Floating close button - only show when sheet is open */}
      {open && (
        <div className="fixed right-[550px] top-2 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100 transition-colors border-2 border-gray-300 z-[200]">
          <button
            onClick={onClose}
            className="bg-white rounded-full p-1 shadow-lg hover:bg-gray-100 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-800" />
          </button>
        </div>
      )}

    </>
  );
};

export default AutomationTableDetail;
