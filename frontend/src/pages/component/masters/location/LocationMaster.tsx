import React from 'react';
import { ReusableTable } from '../../../../components/common/Reusable/ReusableTable';
import { Badge } from "../../../../@/components/ui/badge";
import { toast } from "../../../../@/components/hooks/use-toast";
import { TableColumn } from '../../../../components/common/Reusable/ReusableTable';
import { LocationMasterService, LocationData } from './locationmasterservice';

export function LocationMaster() {
  const [locations, setLocations] = React.useState<LocationData[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [totalRows, setTotalRows] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [pageIndex, setPageIndex] = React.useState(0);

  React.useEffect(() => {
    fetchLocations();
  }, [pageSize, pageIndex]);

  const fetchLocations = async () => { 
    try {
      setIsLoading(true);
      const response = await LocationMasterService.getAllLocations({
        limit: pageSize,
        skip: pageIndex * pageSize
      });
      setLocations(response.data);
      setTotalRows(response.total);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch locations",
      });
      console.error('Error fetching locations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const columns: TableColumn<LocationData>[] = [
    {
      header: "Type",
      accessorKey: "type",
      cell: ({ row }) => (        
        <Badge variant="secondary">
          {row.original.type}
        </Badge>
      ),
      width: 20
    },
    {
      header: "SAP Code",
      accessorKey: "sapCode",
      cell: ({ row }) => (        
        <Badge variant="secondary">
          {row.original.sapCode}
        </Badge>
      ),
      enableSorting: true,
      width: 20
    },
    {
      header: "Name",
      accessorKey: "name",
      enableSorting: true,
      width: 20
    },
    {
      header: "Address",
      accessorKey: "address",
      cell: ({ row }) => ( 
        <div className="max-w-[300px] text-wrap" title={row.original.address}>
          {row.original.address}
        </div>
      ),
      width: 600
    },
    {
      header: "City",
      accessorKey: "city",
      enableSorting: true,
      width: 20
    },
    {
      header: "State",
      accessorKey: "state",
      enableSorting: true,
      width: 20
    },
    {
      header: "Region",
      accessorKey: "region",
      cell: ({ row }) => (
        <Badge variant="outline" className="bg-slate-100">
          {row.original.region}
        </Badge>
      ),
      enableSorting: true,
      width: 20
    },
    {
      header: "Territory",
      accessorKey: "territory",
      enableSorting: true
    },
    {
      header: "Lat/Long",
      accessorKey: "latLong",
      cell: ({ row }) => (
        <div className="text-sm font-mono">
          {row.original.latLong}
        </div>
      )
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => (
        <Badge 
          variant={row.original.status === 'active' ? 'default' : 'destructive'}
        >
          {row.original.status}
        </Badge>
      ),
      enableSorting: true
    }
  ];

  const handleEdit = async (record: LocationData) => {
    try {
      setIsLoading(true);
      await LocationMasterService.updateLocation(record.id, record);
      await fetchLocations();
      toast({
        title: "Success",
        description: `Location ${record.name} edited successfully`,
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

  const handleDelete = async (record: LocationData) => {
    try {
      setIsLoading(true);
      await LocationMasterService.deleteLocation(record.id);
      await fetchLocations();
      toast({
        title: "Success",
        description: `Location ${record.name} deleted successfully`,
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

  const handleUploadCsv = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv';
    
    fileInput.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          setIsLoading(true);
          const formData = new FormData();
          formData.append('upload_file', file);
          
          const result = await LocationMasterService.uploadCsv(formData);
          
          if (result.success) {
            await fetchLocations();
            toast({
              title: "Success",
              description: result.message,
            });
          } else {
            throw new Error('Upload failed');
          }
        } catch (error) {
          console.error('Upload error:', error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to upload CSV",
          });
        } finally {
          setIsLoading(false);
        }
      }
    };
  
    fileInput.click();
  };

  const handleDownloadCsv = async () => {
    try {
      setIsLoading(true);
      const response = await LocationMasterService.downloadCsv();
      
      const blob = new Blob([response.data], { 
        type: 'text/csv'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Location_Master.csv';
      document.body.appendChild(link);
      link.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      
      toast({
        title: "Success",
        description: "CSV downloaded successfully",
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to download CSV",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setIsLoading(true);
      const template = await LocationMasterService.downloadTemplate();
      
      const blob = new Blob([template], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'locations-template.csv';
      document.body.appendChild(link);
      link.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      
      toast({
        title: "Success",
        description: "Template downloaded successfully",
      });
    } catch (error) {
      console.error('Template download error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to download template",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-1 pt-0">
      <ReusableTable
        data={locations}
        columns={columns}
        searchField="name"
        onEdit={handleEdit}
        onDelete={handleDelete}
        onUploadCsv={handleUploadCsv}
        onDownloadCsv={handleDownloadCsv}
        onDownloadTemplate={handleDownloadTemplate}
        pagination={{
          pageIndex,
          pageSize,
          totalRows,
          onPageChange: setPageIndex,
          onPageSizeChange: setPageSize,
        }}
        isLoading={isLoading}
      />
    </div>
  );
}

LocationMaster.displayName = "LocationMaster";