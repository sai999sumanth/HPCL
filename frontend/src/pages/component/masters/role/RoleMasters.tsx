// RoleMaster.tsx
import React from 'react';
import { ReusableTable } from '../../../../components/common/Reusable/ReusableTable';
import { Badge } from "../../../../@/components/ui/badge";
import { toast } from "../../../../@/components/hooks/use-toast";
import { TableColumn } from '../../../../components/common/Reusable/ReusableTable';
import { RoleMasterService, RoleData } from './roleapiservice';

export function RoleMaster() {
  const [roles, setRoles] = React.useState<RoleData[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [totalRows, setTotalRows] = React.useState(0);
  const [pageIndex, setPageIndex] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);

  React.useEffect(() => {
    fetchRoles();
  }, [pageIndex, pageSize]);

  const fetchRoles = async () => {
    try {
      setIsLoading(true);
      const response = await RoleMasterService.getAllRoles({
        limit: pageSize,
        skip: pageIndex * pageSize
      });
      setRoles(response.data);
      setTotalRows(response.total || 0);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch roles",
      });
      console.error('Error fetching roles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const columns: TableColumn<RoleData>[] = [
    {
      header: "SAP code",
      accessorKey: "sapCode",
      cell: ({ row }) => (        
        <Badge variant="secondary">
          {row.original.sapCode}
        </Badge>
      ),
      enableSorting: true,
      width: 120
    },
    {
      header: "Name",
      accessorKey: "name",
      enableSorting: true,
      width: 150
    },
    { 
      header: "Email",
      accessorKey: "email",
      enableSorting: true,
      cell: ({ row }) => ( 
        <div className="text-wrap" title={row.original.email}>
          {row.original.email}
        </div>
      ),
      enableFiltering: true,
      width: 200
    },
    {
      header: "Phone",
      accessorKey: "phone",
      width: 130
    },
    {
      header: "Position",
      accessorKey: "position",
      enableFiltering: true,
      width: 150
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
      width: 130
    },
    {
      header: "State",
      accessorKey: "state",
      enableSorting: true,
      width: 130
    },
    {
      header: "City",
      accessorKey: "city",
      enableSorting: true,
      width: 130
    },
    {
      header: "Territory",
      accessorKey: "territory",
      enableSorting: true,
      width: 130
    },
    {
      header: "Site Name",
      accessorKey: "siteName",
      width: 150
    },
    {
      header: "Escalation level",
      accessorKey: "escalationLevel",
      cell: ({ row }) => (  
        <Badge variant="secondary">
          {row.original.escalationLevel}
        </Badge>
      ),
      width: 140
    }
  ];

  const handleEdit = async (record: RoleData) => {
    try { 
      setIsLoading(true);
      await RoleMasterService.updateRole(record.id, record);
      await fetchRoles();
      toast({
        title: "Success",
        description: `Role ${record.name} edited successfully`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to edit role",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (record: RoleData) => {
    try {
      setIsLoading(true);
      await RoleMasterService.deleteRole(record.id);
      await fetchRoles();
      toast({
        title: "Success",
        description: `Role ${record.name} deleted successfully`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete role",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPageIndex(newPage);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPageIndex(0); // Reset to first page when changing page size
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
          
          const result = await RoleMasterService.uploadCsv(formData);
          
          if (result.success) {
            await fetchRoles();
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
      const response = await RoleMasterService.downloadCsv();
      
      const blob = new Blob([response.data], { 
        type: 'text/csv'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Role_Master.csv';
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
      const template = await RoleMasterService.downloadTemplate();
      
      const blob = new Blob([template], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'roles-template.csv';
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
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
        data={roles}
        columns={columns}
        searchField="email"
        onEdit={handleEdit}
        onDelete={handleDelete}
        onUploadCsv={handleUploadCsv}
        onDownloadCsv={handleDownloadCsv}
        onDownloadTemplate={handleDownloadTemplate}
        isLoading={isLoading}
        pagination={{
          pageIndex,
          pageSize,
          totalRows,
          onPageChange: handlePageChange,
          onPageSizeChange: handlePageSizeChange
        }}
      />
    </div>
  );
}

RoleMaster.displayName = "RoleMaster";