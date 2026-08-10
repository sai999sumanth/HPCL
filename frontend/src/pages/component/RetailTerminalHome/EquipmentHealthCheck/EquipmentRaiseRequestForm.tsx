import React from "react";
import { Card, CardContent, CardFooter } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { Loader2, Plus, Trash2, X } from "lucide-react";

export interface FilterFormData {
  sap_id: string;
  location_name: string;
  device_category: string;
  device_type: string;
  selecting_areas: string;
  zone: string;
  vendor_name: string;
  equipment_name: string;
  device_id: string;
  severity: string;
  user_remarks: string;
  faulty_date: string;
  certificate_file: File | null;
}

export interface EquipmentRaiseRequestFormProps {
  filterFormData: FilterFormData;
  setFilterFormData: React.Dispatch<React.SetStateAction<FilterFormData>>;
  handleInputChange: (field: string, value: string | File | null) => void;
  areaOptions: string[];
  equipmentOptions: string[];
  vendorMailRows: any[];
  loadingVendorMails: boolean;
  selectedVendorRowId: string;
  setSelectedVendorRowId: (id: string) => void;
  deviceIdOptions: string[];
  loadingDeviceIds: boolean;
  handleOpenAddAlertSheet: () => void;
  selectedAlertRows: any[];
  setSelectedAlertRows: React.Dispatch<React.SetStateAction<any[]>>;
  imagePreview: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveImage: () => void;
  handleSearchEquipment: () => void;
  isFormValid: () => boolean;
  setShowForm: (show: boolean) => void;
  formatDateTimeIst: (raw: unknown, empty?: string) => string;
}

export const EquipmentRaiseRequestForm: React.FC<EquipmentRaiseRequestFormProps> = ({
  filterFormData,
  setFilterFormData,
  handleInputChange,
  areaOptions,
  equipmentOptions,
  vendorMailRows,
  loadingVendorMails,
  selectedVendorRowId,
  setSelectedVendorRowId,
  deviceIdOptions,
  loadingDeviceIds,
  handleOpenAddAlertSheet,
  selectedAlertRows,
  setSelectedAlertRows,
  imagePreview,
  fileInputRef,
  handleFileChange,
  handleRemoveImage,
  handleSearchEquipment,
  isFormValid,
  setShowForm,
  formatDateTimeIst,
}) => {
  return (
    <div>
      <Card className="shadow-md px-2 py-4">
        <CardContent className="p-4 min-h-[300px] py-4">

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 mb-5 gap-6">
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                SAP ID<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={filterFormData.sap_id}
                onChange={(e) => handleInputChange("sap_id", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 bg-white cursor-not-allowed"
                placeholder="Enter SAP ID"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Location Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={filterFormData.location_name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 bg-white cursor-not-allowed"
                placeholder="Enter Name"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Zone<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={filterFormData.zone}
                onChange={(e) => handleInputChange("zone", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 bg-white cursor-not-allowed"
                placeholder="Enter Zone"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-2">
                Vendor Name
                {vendorMailRows.length > 1 && (
                  <span className="text-red-500 ml-0.5" aria-hidden>
                    *
                  </span>
                )}
              </label>
              {loadingVendorMails ? (
                <div className="flex h-10 items-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 text-xs text-gray-500">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" />
                  Loading vendors…
                </div>
              ) : vendorMailRows.length > 1 ? (
                <Select
                  value={selectedVendorRowId}
                  onValueChange={(idxStr) => {
                    setSelectedVendorRowId(idxStr);
                    const idx = Number.parseInt(idxStr, 10);
                    const row = Number.isFinite(idx) ? vendorMailRows[idx] : undefined;
                    const vn = row ? String(row.vendor_name ?? "").trim() : "";
                    setFilterFormData((prev) => ({ ...prev, vendor_name: vn }));
                  }}
                >
                  <SelectTrigger className="w-full text-sm text-gray-700">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendorMailRows.map((row, i) => {
                      const vn = String(row.vendor_name ?? "").trim() || "—";
                      return (
                        <SelectItem key={`vendor-opt-${i}`} value={String(i)}>
                          {vn}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : (
                <input
                  type="text"
                  value={filterFormData.vendor_name}
                  onChange={(e) => handleInputChange("vendor_name", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 bg-white cursor-not-allowed"
                  placeholder={
                    vendorMailRows.length === 0
                      ? "No vendor mapping found"
                      : "Vendor name"
                  }
                  disabled
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-5 items-end">
            <div className="min-w-0 flex flex-col">
              <label className="block text-sm text-gray-700 mb-2">
                Device Category<span className="text-red-500">*</span>
              </label>
              <Select
                value={filterFormData.device_type}
                onValueChange={(value) => handleInputChange("device_type", value)}
              >
                <SelectTrigger className="h-10 w-full text-sm text-gray-700 border border-gray-300 rounded-md bg-white">
                  <SelectValue placeholder="Select Device Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TAS process">TAS process</SelectItem>
                  <SelectItem value="TAS Safety">TAS Safety</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex flex-col">
              <label className="block text-sm text-gray-700 mb-2">
                Selecting Areas<span className="text-red-500">*</span>
              </label>
              <Select
                value={filterFormData.selecting_areas}
                onValueChange={(value) => handleInputChange("selecting_areas", value)}
              >
                <SelectTrigger className="h-10 w-full text-sm text-gray-700 border border-gray-300 rounded-md bg-white">
                  <SelectValue placeholder="Select Areas" />
                </SelectTrigger>
                <SelectContent>
                  {areaOptions.map((area) => (
                    <SelectItem key={area} value={area}>
                      {area}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex flex-col">
              <label className="block text-sm text-gray-700 mb-2">
                Equipment Name<span className="text-red-500">*</span>
              </label>
              <Select
                value={filterFormData.equipment_name}
                onValueChange={(value) => handleInputChange("equipment_name", value)}
                disabled={equipmentOptions.length === 0}
              >
                <SelectTrigger className="h-10 w-full text-sm text-gray-700 border border-gray-300 rounded-md bg-white">
                  <SelectValue placeholder="Select Equipment Name" />
                </SelectTrigger>
                <SelectContent>
                  {equipmentOptions.map((eq) => (
                    <SelectItem key={eq} value={eq}>
                      {eq}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 flex flex-col">
              <label className="block text-sm text-gray-700 mb-2">
                Device ID
              </label>
              {loadingDeviceIds ? (
                <div className="flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 text-xs text-gray-500">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" />
                  Loading device IDs…
                </div>
              ) : (
                <Select
                  value={filterFormData.device_id || undefined}
                  onValueChange={(v) => handleInputChange("device_id", v)}
                  disabled={
                    !String(filterFormData.sap_id ?? "").trim() ||
                    !String(filterFormData.equipment_name ?? "").trim() ||
                    deviceIdOptions.length === 0
                  }
                >
                  <SelectTrigger className="h-10 w-full text-sm text-gray-700 border border-gray-300 rounded-md bg-white">
                    <SelectValue
                      placeholder={
                        !String(filterFormData.sap_id ?? "").trim() || !String(filterFormData.equipment_name ?? "").trim()
                          ? "Select SAP & equipment first"
                          : deviceIdOptions.length === 0
                            ? "No device IDs found"
                            : "Select Device ID"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {deviceIdOptions.map((id) => (
                      <SelectItem key={id} value={id}>
                        {id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-5 items-end">
            <div className="min-w-0 flex flex-col">
              <label className="block text-sm text-gray-700 mb-2">
                Add Alert
              </label>
              <button
                type="button"
                onClick={handleOpenAddAlertSheet}
                className="h-10 w-full inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-blue-600 bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 shrink-0" />
                Add Alert
              </button>
            </div>
            <div className="min-w-0 flex flex-col">
              <label className="block text-sm text-gray-700 mb-2">
                Remarks<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={filterFormData.user_remarks}
                onChange={(e) => handleInputChange("user_remarks", e.target.value)}
                className="h-10 w-full px-3 border border-gray-300 rounded-md text-sm text-gray-700 bg-white"
                placeholder="Enter Remarks"
              />
            </div>
            <div className="min-w-0 flex flex-col">
              <label className="block text-sm text-gray-700 mb-2">
                Faulty Date<span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={filterFormData.faulty_date}
                onChange={(e) => handleInputChange("faulty_date", e.target.value)}
                className="h-10 w-full px-3 border border-gray-300 rounded-md text-sm text-gray-700 bg-white"
              />
            </div>
            <div className="min-w-0 flex flex-col">
              <label className="block text-sm text-gray-700 mb-2">
                Upload Certificate
                <span className="ml-1.5 font-normal text-[10px] text-gray-500 sm:text-[11px]">
                  (Max 8MB · JPG, PNG, PDF)
                </span>
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                className="h-10 w-full cursor-pointer rounded-md border border-gray-300 bg-white px-2 text-xs text-gray-700 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1.5 file:text-xs"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {selectedAlertRows.length > 0 && (
            <div className="mb-5 border border-gray-200 rounded-lg overflow-hidden bg-white">
              <span className="text-xs font-semibold text-gray-800 tracking-wide">
                Alerts ({selectedAlertRows.length})
              </span>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="border-b border-gray-200 px-2 py-2 font-medium">ID</th>
                      <th className="border-b border-gray-200 px-2 py-2 font-medium">Location</th>
                      <th className="border-b border-gray-200 px-2 py-2 font-medium">Alert</th>
                      <th className="border-b border-gray-200 px-2 py-2 font-medium">Device Name</th>
                      <th className="border-b border-gray-200 px-2 py-2 font-medium">Alert ID</th>
                      <th className="border-b border-gray-200 px-2 py-2 font-medium">Created At</th>
                      <th className="border-b border-gray-200 px-2 py-2 font-medium">Updated At</th>
                      <th className="border-b border-gray-200 px-2 py-2 font-medium w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAlertRows.map((row: any, idx: number) => {
                      const rowKey = String(
                        row?.unique_id ?? row?.alert_id ?? row?.id ?? `idx-${idx}`
                      );
                      return (
                        <tr key={`linked-alert-${rowKey}-${idx}`} className="border-b border-gray-100 hover:bg-gray-50/80">
                          <td className="px-2 py-2 text-gray-700 whitespace-nowrap">
                            {row?.id ?? row?.sap_id ?? "—"}
                          </td>
                          <td className="px-2 py-2 text-gray-700 max-w-[140px] truncate" title={row?.location_name}>
                            {row?.location_name ?? "—"}
                          </td>
                          <td className="px-2 py-2 text-gray-700 max-w-[200px] truncate" title={row?.interlock_name}>
                            {row?.interlock_name ?? "—"}
                          </td>
                          <td className="px-2 py-2 text-gray-700 max-w-[160px] truncate" title={row?.device_name}>
                            {row?.device_name ?? "—"}
                          </td>
                          <td className="px-2 py-2 text-blue-600 max-w-[180px] truncate font-mono text-[11px]" title={row?.unique_id}>
                            {row?.unique_id ?? "—"}
                          </td>
                          <td className="px-2 py-2 text-gray-600 whitespace-nowrap">
                            {row?.created_at ? formatDateTimeIst(row.created_at) : "—"}
                          </td>
                          <td className="px-2 py-2 text-gray-600 whitespace-nowrap">
                            {row?.updated_at ? formatDateTimeIst(row.updated_at) : "—"}
                          </td>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedAlertRows((prev) =>
                                  prev.filter(
                                    (r: any) =>
                                      String(r?.unique_id ?? r?.alert_id ?? r?.id ?? "") !== rowKey
                                  )
                                )
                              }
                              className="p-1.5 rounded text-red-600 hover:bg-red-50"
                              aria-label="Remove alert"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {imagePreview && (
            <div className="mb-5">
              <div className="border border-gray-300 rounded-lg p-2 bg-gray-50 inline-block relative">
                <button
                  onClick={handleRemoveImage}
                  className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg transition-colors z-10"
                  type="button"
                  aria-label="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
                <img
                  src={imagePreview}
                  alt="Certificate preview"
                  className="max-w-full h-auto max-h-64 rounded"
                  style={{ maxWidth: "300px" }}
                />
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="border-t flex justify-end py-3 px-3">
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              className="px-6 py-2 rounded text-white bg-blue-500 hover:bg-blue-600"
              onClick={handleSearchEquipment}
              disabled={!isFormValid()}
            >
              Submit
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};
