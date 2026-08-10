import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { AlertRecord } from '../types';
import { apiClient } from '@/services/apiClient';
import { toast } from 'sonner';

interface UnblockConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedData: AlertRecord[];
  actionType?: 'unblock' | 'approve';
  onSuccess?: () => void;
}

export const UnblockConfirmationModal: React.FC<UnblockConfirmationModalProps> = ({
  isOpen,
  onClose,
  selectedData,
  actionType = 'unblock',
  onSuccess,
}) => {
  const [confirmationText, setConfirmationText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setConfirmationText('');
    }
  }, [isOpen]);

  const pivotSummary = useMemo(() => {
    if (!selectedData || selectedData.length === 0) {
      return { instances: [], violations: [], data: {} };
    }

    // Get unique instances and sort them numerically
    const instances = [...new Set(selectedData.map(r => r.instance_status || 'N/A'))]
      .sort((a, b) => {
          const numA = parseInt(a.match(/\d+/)?.[0] || '0');
          const numB = parseInt(b.match(/\d+/)?.[0] || '0');
          return numA - numB;
      });

    // Group counts by violation and instance
    const data: { [violation: string]: { [instance: string]: number } } = {};
    selectedData.forEach(record => {
        const violation = record.violation_type || 'N/A';
        const instance = record.instance_status || 'N/A';
        if (!data[violation]) data[violation] = {};
        data[violation][instance] = (data[violation][instance] || 0) + 1;
    });

    // Get unique violations and sort them
    const violations = Object.keys(data).sort();

    return { instances, violations, data };
  }, [selectedData]);

  const { instances, violations, data: pivotData } = pivotSummary;

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const alert_ids = selectedData.map(d => String(d.id));
      const payload = { alert_ids };
      
      // Call appropriate API based on action type
      const endpoint = actionType === 'unblock' 
        ? '/api/alerts/bulk_send_to_unblock'
        : '/api/alerts/bulk_send_to_approve';
      
      const response = await apiClient.post(endpoint, payload);
      
      if (response.data) {
        // Extract message from API response
        // Response format: [true, "message"] or { message: "..." }
        let message = '';
        if (Array.isArray(response.data) && response.data.length > 1) {
          // Format: [true, "message"]
          message = response.data[1];
        } else if (response.data.message) {
          // Format: { message: "..." }
          message = response.data.message;
        }
        
        // Show success toast with API message
        const defaultMessage = actionType === 'unblock' 
          ? `Successfully unblocked ${alert_ids.length} alert(s)`
          : `Successfully approved ${alert_ids.length} alert(s)`;
        
        toast.success(message || defaultMessage);
        onClose();
        
        // Trigger refresh callback if provided
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error) {
      console.error(`Error ${actionType}ing records:`, error);
      toast.error(
        actionType === 'unblock'
          ? 'Failed to unblock alerts. Please try again.'
          : 'Failed to approve alerts. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isConfirmDisabled = confirmationText.toLowerCase() !== 'continue' || isSubmitting;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {actionType === 'unblock' ? 'Confirm Unblock Action' : 'Confirm Approve Action'}
          </DialogTitle>
          <DialogDescription>
            You are about to {actionType === 'unblock' ? 'unblock' : 'approve'} {selectedData.length} alert(s). Please review the summary below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-[400px] overflow-auto pr-4 border rounded-md">
          <table className="w-full text-sm text-center">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b">
                <th className="text-left p-2 font-medium whitespace-nowrap">Violation Type</th>
                {instances.map(instance => (
                    <th key={instance} className="p-2 font-medium">{instance}</th>
                ))}
                <th className="p-2 font-medium bg-gray-100">Total</th>
              </tr>
            </thead>
            <tbody>
              {violations.length > 0 ? (
                violations.map(violation => {
                    const rowTotal = instances.reduce((sum, instance) => sum + (pivotData[violation][instance] || 0), 0);
                    return (
                        <tr key={violation} className="border-b last:border-b-0 hover:bg-gray-50">
                            <td className="text-left p-2 whitespace-nowrap">{violation}</td>
                            {instances.map(instance => (
                                <td key={instance} className="p-2">
                                    {pivotData[violation][instance] || 0}
                                </td>
                            ))}
                            <td className="p-2 font-semibold bg-gray-50">{rowTotal}</td>
                        </tr>
                    );
                })
              ) : (
                <tr>
                  <td colSpan={instances.length + 2} className="text-center p-4 text-gray-500">No records selected.</td>
                </tr>
              )}
            </tbody>
            {violations.length > 0 && (
                <tfoot className="sticky bottom-0 bg-gray-100 font-semibold">
                    <tr className="border-t-2 border-gray-300">
                        <td className="text-left p-2">Total</td>
                        {instances.map(instance => {
                            const colTotal = violations.reduce((sum, violation) => sum + (pivotData[violation][instance] || 0), 0);
                            return (
                                <td key={instance} className="p-2">{colTotal}</td>
                            );
                        })}
                        <td className="p-2 bg-gray-200">{selectedData.length}</td>
                    </tr>
                </tfoot>
            )}
          </table>
        </div>

        <div className="space-y-2 pt-4">
          <label htmlFor="confirmation" className="text-sm font-medium text-gray-700">
            To confirm this action, please type "continue" below.
          </label>
          <Input
            id="confirmation"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder="continue"
            className="w-full"
          />
        </div>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </DialogClose>
          <Button 
            onClick={handleConfirm} 
            disabled={isConfirmDisabled}
            className={actionType === 'unblock' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}
          >
            {isSubmitting 
              ? (actionType === 'unblock' ? 'Unblocking...' : 'Approving...')
              : (actionType === 'unblock' ? 'Confirm Unblock' : 'Confirm Approve')
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
