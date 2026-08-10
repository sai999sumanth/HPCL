import { Building2, MapPin, Fuel, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { StatusBadge } from "./StatusBadge";

interface StationDetailsProps {
  name: string;
  sapId: string;
  zone: string;
  state: string;
  indentStatus: string;
  indent_raised_date: string;
}

export function FuelStationCard({ name, sapId, zone, state, indentStatus, indent_raised_date }: StationDetailsProps) {
  return (
    <Card className="w-full transition-all hover:shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold">
          <div className="flex items-center gap-2">
            <Fuel className="h-6 w-6 text-primary" />
            {name}
          </div>
        </CardTitle>
        <StatusBadge status={indentStatus} />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">SAP ID:</span>
            <span className="font-medium text-sm">{sapId}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground nowrap">Indent Raised:</span>
            <span className="font-medium text-sm">{indent_raised_date}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Location:</span>
            <span className="font-medium text-sm">{zone}, {state}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}