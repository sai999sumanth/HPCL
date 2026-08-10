import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../../@/components/ui/card';
import { ReusableTable, TableColumn } from '../../../components/common/Reusable/ReusableTable';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Button } from "../../../@/components/ui/button";
import { Textarea } from "../../../@/components/ui/textarea";
import { Badge } from "../../../@/components/ui/badge";
import axios from 'axios';
import { AlertHistoryDialog } from './AlertHistoryDialog';
import { apiClient } from '@/services/apiClient';



interface ROAlertsTableProps {
  query?: string;
}

interface PaginationResponse {
  data: any[];
  total: number;
}

interface ActionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (message: string) => void;
  actionType: string;
}

const ActionDialog: React.FC<ActionDialogProps> = ({ isOpen, onClose, onSubmit, actionType }) => {
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    onSubmit(message);
    setMessage('');
    onClose();
  };

  const getDialogTitle = (type: string) => { 
    switch (type) { 
      case 'Justification':
        return 'Justify Alert';
      case 'Rejected':
        return 'Reject Alert';
      case 'Approved':
        return 'Approve Alert';
      case 'Override':
        return 'Override Alert';
      case 'interLockOk':
        return 'Interlock Alert';
      case 'Message':
        return 'Add Message';
      case 'excApprovalTimeExp':
        return 'Exception Approval Time Expired';
      default:
        return `${type} Alert`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{getDialogTitle(actionType)}</DialogTitle>
          <DialogDescription>
            Add a message for this {actionType.toLowerCase()} action
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Textarea
            placeholder="Enter your message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[100px]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className=" text-blue-500" onClick={handleSubmit}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const AlertActionTable: React.FC<ROAlertsTableProps> = ({ query }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    actionType: '',
    alertId: null as string | number | null
  });
  const [historyDialogState, setHistoryDialogState] = useState({
    isOpen: false,
    alertId: null as string | number | null
  });

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const skip = currentPage;
      const response = await apiClient.get<PaginationResponse>('/api/alerts', {
        params: {
          q: query,
          skip,
          limit: pageSize
        }
      });
      setData(response.data.data);
      setTotalItems(response.data.total);
      setError(null);
    } catch (err) {
      setError('Failed to fetch alerts');
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (actionType: string, alertId: string | number) => {
    setDialogState({
      isOpen: true,
      actionType,
      alertId
    });
  };

  const handleViewHistory = (alertId: string | number) => {
    setHistoryDialogState({
      isOpen: true,
      alertId
    });
  };

  const submitAction = async (actionType: string, alertId: string | number, message: string = '') => {
    try {
      const payload = {
        action_type: actionType,
        alert_id: alertId.toString(),
        action_msg: message,
        days: 0,
        justification_type: actionType,
        event_tags: {
          is_atr_uploaded: false,
          is_maintenance_exception: false,
          is_revocation: false,
          no_exception: false,
          is_approved: false,
          is_exc_approval_time_exp: false
        }
      };
      await apiClient.post('/api/alerts/alert_action', payload);
      await fetchAlerts();
    } catch (error) {
      console.error('Error performing alert action:', error);
      setError('Failed to perform action');
    }
  };

  const handleDialogSubmit = (message: string) => {
    if (dialogState.alertId) {
      submitAction(dialogState.actionType, dialogState.alertId, message);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [currentPage, pageSize, query]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return 'bg-red-100 text-red-800';
      case 'High':
        return 'bg-orange-100 text-orange-800';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const columns: TableColumn<any>[] = [
    {
      header: "LOCATION ID",
      accessorKey: "sap_id",
      enableSorting: true,
      width: 100
    },
    {
      header: "Alert ID",
      accessorKey: "unique_id",
      enableSorting: true,
      width: 200,
      cell: ({ row }) => (
        <span className="text-blue-600 hover:text-blue-800">
          {row.original.unique_id}
        </span>
      )
    },
    {
      header: "Location",
      accessorKey: "city",
      enableSorting: true,
      width: 150
    },
    {
      header: "Severity",
      accessorKey: "severity",
      enableSorting: true,
      width: 130,
      cell: ({ row }) => (
        <div className={`px-2 py-1 rounded-full text-center ${getSeverityColor(row.original.severity)}`}>
          {row.original.severity}
        </div>
      )
    },
    // {
    //   header: "Status",
    //   accessorKey: "alert_status",
    //   enableSorting: true,
    //   width: 130,
    //   cell: ({ row }) => (
    //     <Badge 
    //       variant="outline" 
    //       className={
    //         row.original.alert_status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' :
    //         row.original.alert_status === 'Pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
    //         'bg-gray-50 text-gray-700 border-gray-200'
    //       }
    //     >
    //       {row.original.alert_status}
    //     </Badge>
    //   )
    // },
    {
      header: "State",
      accessorKey: "indent_status",
      enableSorting: true,
      width: 120
    },
    {
      header: "Created At",
      accessorKey: "created_at",
      enableSorting: true,
      width: 200,
      cell: ({ row }) => new Date(row.original.created_at).toLocaleString()
    },
    {
      header: "Actions",
      accessorKey: "actions",
      width: 150,
      cell: ({ row }) => (
        <div className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleViewHistory(row.original.id)}>
                View Alert History
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleActionClick("Justification", row.original.id)}>
                Justify
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleActionClick("Rejected", row.original.id)}>
                Reject
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleActionClick("Approved", row.original.id)}>
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleActionClick("Override", row.original.id)}>
                Override
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleActionClick("interLockOk", row.original.id)}>
                Interlock
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleActionClick("Message", row.original.id)}>
                Message
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleActionClick("excApprovalTimeExp", row.original.id)}>
                Exc Approval Time Exp
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    }
  ];

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="p-6 text-center text-gray-500">
          No Data Available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent>
        <div className="mt-6">
          <ReusableTable
            data={data}
            columns={columns}
            searchField="unique_id"
            isLoading={loading}
            pagination={{
              pageIndex: currentPage,
              pageSize: pageSize,
              totalRows: totalItems,
              onPageChange: setCurrentPage,
              onPageSizeChange: (newPageSize) => {
                setPageSize(newPageSize);
                setCurrentPage(0);
              }
            }}
            onRefresh={fetchAlerts}
          />
        </div>

        <ActionDialog
          isOpen={dialogState.isOpen}
          onClose={() => setDialogState(prev => ({ ...prev, isOpen: false }))}
          onSubmit={handleDialogSubmit}
          actionType={dialogState.actionType}
        />

        <AlertHistoryDialog
          isOpen={historyDialogState.isOpen}
          onClose={() => setHistoryDialogState({ isOpen: false, alertId: null })}
          alertId={historyDialogState.alertId} onSubmitSuccess={undefined} onRequestDocumentUpload={undefined} />
      </CardContent>
    </Card>
  );
};