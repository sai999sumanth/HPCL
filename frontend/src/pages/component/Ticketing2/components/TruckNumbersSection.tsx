import React from "react";
import { SectionWrapper } from "./ticket-form-components";

interface TruckNumbersSectionProps {
  linkedRows?: any[];
  initialData?: any;
}

export const TruckNumbersSection: React.FC<TruckNumbersSectionProps> = ({
  linkedRows,
  initialData,
}) => {
  // Get truck/vehicle data: linked_rows (full row objects) or truck_no (array of strings) from initialData
  const linkedRowsData = linkedRows || initialData?.linked_rows || [];
  const truckNoStrings = Array.isArray(initialData?.truck_no) ? initialData.truck_no.filter(Boolean) : [];
  const orderIdStrings = Array.isArray(initialData?.order_id) ? initialData.order_id.filter(Boolean) : [];

  const truckData = linkedRowsData.length > 0
    ? linkedRowsData
    : [
        ...truckNoStrings.map((num: string) => ({ vehicle_number: num, truck_no: num })),
        ...orderIdStrings.map((id: string) => ({ order_id: id, order_no: id })),
      ];

  // If no truck data found, don't render the section
  if (truckData.length === 0) {
    return null;
  }

  // Extract truck/order information; preserve existing truck precedence and
  // fall back to order number for PM Orders rows.
  const truckInfo = truckData
    .map((row: any, index: number) => {
      // Row may be object (from linked_rows) or we built { vehicle_number, truck_no } from truck_no array
      const truckNumber = row.trucknumber || row.truck_number || row.truck_no || row.vehicle_number || row.vehicle_no;
      const orderNumber = row.order_id || row.order_no || row.order_number || row.pm_order_no;
      const ttNumber = row.tt_number;
      const tripName = row.trip_name;
      const tripId = row.trip_id;
      const transporterCode = row.transporter_code;
      const transporterName = row.transporter_name;

      // Create a display identifier
      let displayId = truckNumber || ttNumber || tripName || tripId || orderNumber || `Item ${index + 1}`;

      // Create additional info
      let additionalInfo = [];
      if (transporterCode) additionalInfo.push(`Transporter: ${transporterCode}`);
      if (transporterName) additionalInfo.push(`Name: ${transporterName}`);
      if (tripId && tripId !== displayId) additionalInfo.push(`Trip ID: ${tripId}`);
      if (orderNumber && orderNumber !== displayId) additionalInfo.push(`Order: ${orderNumber}`);

      return {
        displayId,
        additionalInfo: additionalInfo.join(' • '),
        raw: row,
        hasRealId: !!(truckNumber || ttNumber || tripName || tripId || orderNumber),
      };
    })
    .filter((t: { hasRealId: boolean }) => t.hasRealId);

  if (truckInfo.length === 0) return null;

  return (
    <SectionWrapper title={` Vehicle/Order numbers (${truckInfo.length})`} className="mb-2 pt-1 pb-1">
      <div className="space-y-1.5">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Selected when creating this ticket
        </p>
        <div className="flex flex-wrap gap-1.5 w-full">
          {truckInfo.map((truck, index: number) => (
            <div
              key={index}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600"
            >
              <span className="text-slate-500 dark:text-slate-400 text-xs" aria-hidden>🚛</span>
              <span className="text-base font-medium text-slate-700 dark:text-slate-200">
                {truck.displayId}
              </span>
              {truck.additionalInfo && (
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]" title={truck.additionalInfo}>
                  • {truck.additionalInfo}
                </span>
              )}
            </div>
          ))}
        </div>
        {/* <div className="text-xs text-slate-500 dark:text-slate-400">
          {truckInfo.length} vehicle{truckInfo.length !== 1 ? "s" : ""}
        </div> */}
      </div>
    </SectionWrapper>
  );
};
