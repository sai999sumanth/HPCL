import React from 'react';
import { AlertData } from './types';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../../@/components/ui/sheet";

interface AlertDetailsSidebarProps {
  alert: AlertData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AlertDetailsSidebar: React.FC<AlertDetailsSidebarProps> = ({
  alert,
  open,
  onOpenChange
}) => {
  if (!alert) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const DetailItem = ({ label, value, className = "" }: { label: string; value: string | number; className?: string }) => (
    <div className="space-y-1.5">
      <h3 className="text-sm font-medium text-gray-500">{label}</h3>
      <p className={`text-base ${className}`}>{value}</p>
    </div>
  );

  const SeverityBadge = ({ severity }: { severity: string }) => {
    const colors = {
      Critical: 'bg-red-100 text-red-800',
      High: 'bg-orange-100 text-orange-800',
      Medium: 'bg-yellow-100 text-yellow-800',
      Low: 'bg-green-100 text-green-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-sm ${colors[severity as keyof typeof colors]}`}>
        {severity}
      </span>
    );

  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Alert Details</SheetTitle>
          <SheetDescription>
            Alert ID: {alert.unique_id}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          <DetailItem label="Location" value={alert.location_name} />
          
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium text-gray-500">Severity</h3>
            <SeverityBadge severity={alert.severity} />
          </div>

          <DetailItem label="Status" value={alert.alert_status} />
          <DetailItem label="State" value={alert.alert_state} />
          <DetailItem label="Created At" value={formatDate(alert.created_at)} />
          <DetailItem label="Updated At" value={formatDate(alert.updated_at)} />
          
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium text-gray-500">Location Details</h3>
            <p className="text-base">
              {[alert.district, alert.city, alert.state].filter(Boolean).join(", ")}
            </p>
          </div>

          <DetailItem label="Zone" value={alert.zone} />
          <DetailItem label="Region" value={alert.region} />
          <DetailItem label="Business Unit" value={alert.bu} />
          
          {alert.device_msg && (
            <DetailItem label="Device Message" value={alert.device_msg} />
          )}
          
          {alert.assigned_to && (
            <DetailItem label="Assigned To" value={alert.assigned_to} />
          )}
          
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium text-gray-500">Additional Information</h3>
            <div className="space-y-2">
              <p>SAP ID: {alert.sap_id}</p>
              <p>External ID: {alert.external_id}</p>
              {alert.device_id && <p>Device ID: {alert.device_id}</p>}
              {alert.device_type && <p>Device Type: {alert.device_type}</p>}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};