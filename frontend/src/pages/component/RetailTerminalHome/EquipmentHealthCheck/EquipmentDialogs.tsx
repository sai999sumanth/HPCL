import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/@/components/ui/dialog";
import { Button } from "@/@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/@/components/ui/radio-group";
import { Label } from "@/@/components/ui/label";
import { CheckCircle, Info, Wrench, X } from "lucide-react";

/* ── History Dialog ─────────────────────────────────────────────────────── */

export interface EquipmentHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  historyDialogItem: Record<string, unknown> | null;
  setHistoryDialogItem: (item: Record<string, unknown> | null) => void;
  normalizeFaultyHistory: (raw: unknown) => Array<Record<string, unknown>>;
  sortFaultyHistoryEntriesNewestFirst: (
    entries: Array<Record<string, unknown>>
  ) => Array<Record<string, unknown>>;
  formatFaultyHistoryDateTime: (raw: unknown) => string;
  faultyHistoryStatusPillClass: (status: string) => string;
  displayStatusLabel: (status: string) => string;
}

export const EquipmentHistoryDialog: React.FC<EquipmentHistoryDialogProps> = ({
  open,
  onOpenChange,
  historyDialogItem,
  setHistoryDialogItem,
  normalizeFaultyHistory,
  sortFaultyHistoryEntriesNewestFirst,
  formatFaultyHistoryDateTime,
  faultyHistoryStatusPillClass,
  displayStatusLabel,
}) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setHistoryDialogItem(null);
      }}
    >
      <DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0 space-y-1">
          <DialogTitle className="text-lg font-semibold text-gray-900">Request history</DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            {historyDialogItem
              ? `SR ${String((historyDialogItem as { tas_faulty_unique_id?: unknown }).tas_faulty_unique_id ?? "").trim() || "—"} · ${String((historyDialogItem as { equipment_name?: unknown }).equipment_name ?? "").trim() || "Equipment"}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 pt-4 flex-1 min-h-0 overflow-auto">
          {historyDialogItem &&
            (() => {
              const entries = sortFaultyHistoryEntriesNewestFirst(
                normalizeFaultyHistory(
                  (historyDialogItem as { faulty_history?: unknown }).faulty_history
                )
              );
              if (entries.length === 0) {
                return (
                  <p className="text-gray-500 text-sm py-8 text-center border border-gray-200 rounded-lg bg-gray-50/50">
                    No history recorded for this request.
                  </p>
                );
              }
              return (
                <div className="rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-sm border-collapse table-fixed">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left font-semibold text-gray-700 px-3 py-3 text-xs uppercase tracking-wide w-[140px]">
                          User name
                        </th>
                        <th className="text-left font-semibold text-gray-700 px-3 py-3 text-xs uppercase tracking-wide min-w-[220px]">
                          Role
                        </th>
                        <th className="text-left font-semibold text-gray-700 px-3 py-3 text-xs uppercase tracking-wide w-[100px]">
                          Status
                        </th>
                        <th className="text-left font-semibold text-gray-700 px-3 py-3 text-xs uppercase tracking-wide min-w-[160px]">
                          Remarks
                        </th>
                        <th className="text-left font-semibold text-gray-700 px-3 py-3 text-xs uppercase tracking-wide whitespace-nowrap w-[200px]">
                          Updated at
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {entries.map((entry, i) => {
                        const userNameRaw = entry.user_name ?? entry.userName;
                        const userName =
                          userNameRaw != null && String(userNameRaw).trim() !== ""
                            ? String(userNameRaw)
                            : "-";
                        const roleRaw = entry.role ?? entry.roles;
                        const remarksRaw = entry.remarks ?? entry.remark;
                        const remarks =
                          remarksRaw != null && String(remarksRaw).trim() !== ""
                            ? String(remarksRaw)
                            : "-";
                        const statusRaw = entry.status;
                        const statusStr =
                          statusRaw != null && String(statusRaw).trim() !== ""
                            ? String(statusRaw)
                            : "-";
                        const updatedAt = formatFaultyHistoryDateTime(
                          entry.updated_at ?? entry.updatedAt ?? entry.created_at
                        );
                        return (
                          <tr key={i} className="align-top hover:bg-gray-50/80">
                            <td className="px-3 py-3 text-gray-900 text-xs font-mono break-all">
                              {userName}
                            </td>
                            <td className="px-3 py-3 text-xs">
                              {roleRaw == null ||
                              (Array.isArray(roleRaw) && roleRaw.length === 0) ||
                              (typeof roleRaw === "string" && roleRaw.trim() === "") ? (
                                <span className="text-gray-400">-</span>
                              ) : Array.isArray(roleRaw) ? (
                                <div className="flex flex-wrap gap-1">
                                  {roleRaw.map((r, j) => (
                                    <span
                                      key={j}
                                      className="inline-flex rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-900"
                                    >
                                      {String(r)}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-800">{String(roleRaw)}</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {statusStr === "-" ? (
                                <span className="text-gray-400 text-xs">-</span>
                              ) : (
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${faultyHistoryStatusPillClass(statusStr)}`}
                                >
                                  {displayStatusLabel(statusStr)}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-gray-800 text-xs leading-relaxed whitespace-pre-wrap break-words">
                              {remarks}
                            </td>
                            <td className="px-3 py-3 text-gray-700 text-xs whitespace-nowrap">
                              {updatedAt}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ── Action Dialog ──────────────────────────────────────────────────────── */

export interface EquipmentActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItem: Record<string, unknown> | null;
  userIsTasVendor: boolean;
  helpDeskPositiveUiLabel: string;
  actionType: string;
  setActionType: (v: string) => void;
  justification: string;
  setJustification: (v: string) => void;
  handleDialogSubmit: () => void;
}

export const EquipmentActionDialog: React.FC<EquipmentActionDialogProps> = ({
  open,
  onOpenChange,
  selectedItem,
  userIsTasVendor,
  helpDeskPositiveUiLabel,
  actionType,
  setActionType,
  justification,
  setJustification,
  handleDialogSubmit,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-blue-600 rounded">
                <Wrench className="h-4 w-4 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-gray-900">
                  Help Desk Action
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500 mt-0.5">
                  {userIsTasVendor
                    ? "Provide justification for marking this request as Resolved ."
                    : "Provide justification for marking this equipment."}
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-4">
          {selectedItem && (
            <div className="space-y-3">
              {/* Equipment Details */}
              <div className="bg-gray-50 border border-gray-200 rounded p-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Info className="h-3.5 w-3.5 text-blue-600" />
                  <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wide">Equipment Details</h4>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-[10px] mb-0.5">SAP ID</span>
                    <span className="text-gray-900 font-mono font-semibold">{String(selectedItem.sap_id || "N/A")}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-[10px] mb-0.5">Device Type</span>
                    <span className="text-gray-900 font-semibold">{String(selectedItem.device_type || "N/A")}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-gray-500 text-[10px] mb-0.5">Equipment Name</span>
                    <span className="text-gray-900 font-semibold truncate">{String(selectedItem.equipment_name || "N/A")}</span>
                  </div>
                </div>
              </div>

              {/* Action Type Radio Buttons */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">
                  Action Type <span className="text-red-500">*</span>
                </label>
                <RadioGroup
                  value={userIsTasVendor ? "resolved" : actionType}
                  onValueChange={(v) => {
                    if (!userIsTasVendor) setActionType(v);
                  }}
                  className="flex flex-wrap gap-4"
                >
                  {userIsTasVendor ? (
                    <div className="flex items-center space-x-1.5">
                      <RadioGroupItem value="resolved" id="resolved" className="h-3.5 w-3.5" />
                      <Label htmlFor="resolved" className="text-xs font-medium text-gray-700 cursor-pointer">
                        {helpDeskPositiveUiLabel}
                      </Label>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1.5">
                      <RadioGroupItem value="rejection" id="rejection" className="h-3.5 w-3.5" />
                      <Label htmlFor="rejection" className="text-xs font-medium text-gray-700 cursor-pointer">
                        Reopen
                      </Label>
                    </div>
                  )}
                </RadioGroup>
              </div>

              {/* Remark */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700 flex items-center gap-1">
                  Remark <span className="text-red-500">*</span>
                  <span className="text-[10px] font-normal text-gray-500">(Required)</span>
                </label>
                <div className="relative">
                  <textarea
                    value={justification}
                    onChange={(e) => {
                      if (e.target.value.length <= 500) setJustification(e.target.value);
                    }}
                    rows={3}
                    className="w-full px-2.5 py-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none bg-white"
                    placeholder={
                      userIsTasVendor || actionType === "resolved"
                        ? `Please provide justification for marking this equipment as ${helpDeskPositiveUiLabel}...`
                        : "Please provide justification for marking this equipment as Reopen..."
                    }
                  />
                  <div className="absolute bottom-2 right-2 text-[10px] text-gray-400">
                    {justification.length}/500
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-between gap-2 pt-3 mt-3 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="px-4 py-1.5 text-xs bg-white border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
            >
              Cancel Action
            </Button>
            <Button
              type="button"
              onClick={handleDialogSubmit}
              disabled={!justification.trim()}
              className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-1.5 font-medium"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Submit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
