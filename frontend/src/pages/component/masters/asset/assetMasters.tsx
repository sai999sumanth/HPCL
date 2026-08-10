// AssetMaster.tsx
import React from 'react';
import { ReusableTable } from '../../../../components/common/Reusable/ReusableTable';
import { Badge } from "../../../../@/components/ui/badge";
import { toast } from "../../../../@/components/hooks/use-toast";
import { TableColumn } from '../../../../components/common/Reusable/ReusableTable';

interface AssetData {
    id: string,
    sapid: string,
    siteName: string,
    tankDetails: string,
    raVendor: string,
    region: string,
    state: string,
    city: string,
    status: string
}

const assetMasterData: AssetData[] = [
    {
        id: "101000",
        sapid: "101000",
        siteName: "VIKHROLI AUTOMOBILES",
        tankDetails: "(5)",
        raVendor: "AGS",
        region: "West",
        state: "Maharashtra",
        city: "Mumbai",
        status: "active"
      },
      {
        id: "101001",
        sapid: "101001",
        siteName: "MALAD FUEL STATION",
        tankDetails: "(4)",
        raVendor: "BGS",
        region: "West",
        state: "Maharashtra",
        city: "Mumbai",
        status: "active"
      },
      {
        id: "101002",
        sapid: "101002",
        siteName: "DELHI HIGHWAY SERVICES",
        tankDetails: "(6)",
        raVendor: "CGS",
        region: "North",
        state: "Delhi",
        city: "Delhi",
        status: "active"
      },
      {
        id: "101003",
        sapid: "101003",
        siteName: "BANGALORE FUEL POINT",
        tankDetails: "(3)",
        raVendor: "AGS",
        region: "South",
        state: "Karnataka",
        city: "Bangalore",
        status: "inactive"
      },
      {
        id: "101004",
        sapid: "101004",
        siteName: "KOLKATA PETRO STATION",
        tankDetails: "(4)",
        raVendor: "BGS",
        region: "East",
        state: "West Bengal",
        city: "Kolkata",
        status: "active"
      },
      {
        id: "101005",
        sapid: "101005",
        siteName: "CHENNAI FUEL CENTER",
        tankDetails: "(5)",
        raVendor: "CGS",
        region: "South",
        state: "Tamil Nadu",
        city: "Chennai",
        status: "active"
      },
      {
        id: "101006",
        sapid: "101006",
        siteName: "HYDERABAD ENERGY STATION",
        tankDetails: "(4)",
        raVendor: "AGS",
        region: "South",
        state: "Telangana",
        city: "Hyderabad",
        status: "active"
      },
      {
        id: "101007",
        sapid: "101007",
        siteName: "PUNE PETROLEUM POINT",
        tankDetails: "(3)",
        raVendor: "BGS",
        region: "West",
        state: "Maharashtra",
        city: "Pune",
        status: "active"
      },
      {
        id: "101008",
        sapid: "101008",
        siteName: "AHMEDABAD FUEL HUB",
        tankDetails: "(5)",
        raVendor: "CGS",
        region: "West",
        state: "Gujarat",
        city: "Ahmedabad",
        status: "active"
      },
      {
        id: "101009",
        sapid: "101009",
        siteName: "LUCKNOW PETROLEUM CENTER",
        tankDetails: "(4)",
        raVendor: "AGS",
        region: "North",
        state: "Uttar Pradesh",
        city: "Lucknow",
        status: "inactive"
      },
      {
        id: "101010",
        sapid: "101010",
        siteName: "JAIPUR FUEL ZONE",
        tankDetails: "(3)",
        raVendor: "BGS",
        region: "North",
        state: "Rajasthan",
        city: "Jaipur",
        status: "active"
      },
      {
        id: "101011",
        sapid: "101011",
        siteName: "BHOPAL ENERGY POINT",
        tankDetails: "(4)",
        raVendor: "CGS",
        region: "Central",
        state: "Madhya Pradesh",
        city: "Bhopal",
        status: "active"
      },
      {
        id: "101012",
        sapid: "101012",
        siteName: "KOCHI FUEL STATION",
        tankDetails: "(5)",
        raVendor: "AGS",
        region: "South",
        state: "Kerala",
        city: "Kochi",
        status: "inactive"
      },
      {
        id: "101013",
        sapid: "101013",
        siteName: "GUWAHATI PETROL POINT",
        tankDetails: "(3)",
        raVendor: "BGS",
        region: "Northeast",
        state: "Assam",
        city: "Guwahati",
        status: "active"
      },
      {
        id: "101014",
        sapid: "101014",
        siteName: "CHANDIGARH FUEL CENTER",
        tankDetails: "(4)",
        raVendor: "CGS",
        region: "North",
        state: "Punjab",
        city: "Chandigarh",
        status: "inactive"
      }
];

export function AssetMaster() {

  const [assets, setAssets] = React.useState<AssetData[]>(assetMasterData);
  const [isLoading, setIsLoading] = React.useState(false);

  const StatusChip: React.FC<{ status: string | boolean }> = ({ status }) => {

    const getStatusColor = (status: string | boolean) => {

      if (typeof status === 'boolean') {
        return status ? 'bg-green-500 text-white' : 'bg-red-500 text-white';
      }

      switch (status.toLowerCase()) {
        case 'completed':
        case 'success':
        case 'active':
          return 'bg-green-500 text-white';
        case 'running':
          return 'bg-blue-500 text-white';
        case 'failed':
        case 'inactive':
          return 'bg-red-500 text-white';
        default:
          return 'bg-blue-300 text-white';
      }

    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
        {typeof status === 'boolean' ? (status ? 'Success' : 'Failed') : status}
      </span>
    );
  };

  const columns: TableColumn<AssetData>[] = [
    {
      header: "SAP ID",
      accessorKey: "sapid",
      cell: ({ row }) => (        
        <Badge variant="secondary">
          {row.original.sapid}
        </Badge>
      ),
      width:100
    },
    {
      header: "Site Name",
      accessorKey: "siteName",
      enableSorting: true,
      width:300
    },
    {
        header: "Tank Details",
        accessorKey: "tankDetails",
        cell: ({ row }) => (
          <StatusChip status={row.original.tankDetails} />
        ),
        width:120
      },
      {
        header: "RA Vendor",
        accessorKey: "raVendor",
        width:100
      },
      {
        header: "Region",
        accessorKey: "region",
        cell: ({ row }) => (
          <Badge variant="outline" className="bg-slate-100">
            {row.original.region}
          </Badge>
        ),
        width:150
      },
    {
      header: "City",
      accessorKey: "city",
      enableSorting: true,
      width:100
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => (
<StatusChip status={row.original.status} />
      ),
      enableSorting: true
    }
  ];

  // In a real application, these would make API calls
  const handleEdit = async (record: AssetData) => {
    try { 
      setIsLoading(true);
      // API call would go here
      console.log("Editing location:", record);
      toast({
        title: "Success",
        description: `Location ${record.siteName} edited successfully`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to edit location",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (record: AssetData) => {
    try {
      setIsLoading(true);
      // API call would go here
      setAssets(assets.filter(loc => loc.id !== record.id));
      toast({
        title: "Success",
        description: `Location ${record.siteName} deleted successfully`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete location",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadCsv = async () => {
    try {
      setIsLoading(true);
      // API call would go here
      console.log("Uploading CSV:");
      toast({
        title: "Success",
        description: "CSV uploaded successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to upload CSV",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadCsv = async () => {
    try {
      setIsLoading(true);
      // API call would go here
      console.log("Downloading CSV");
      toast({
        title: "Success",
        description: "CSV downloaded successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to download CSV",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <ReusableTable
        data={assets}
        columns={columns}
        searchField="siteName"
        onEdit={handleEdit}
        onDelete={handleDelete}
        onUploadCsv={handleUploadCsv}
        onDownloadCsv={handleDownloadCsv}
      />
    </div>
  );
}

// Optional: Add prop types for better type checking
AssetMaster.displayName = "AssetMaster";