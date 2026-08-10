import { Box, Check } from 'lucide-react';
import { cn } from '@/@/lib/utils';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useToast } from '@/@/components/hooks/use-toast';
import type { WorkflowStep as WorkflowStepType } from '@/types/dryoutCount';
import axios from 'axios';
import { useOutletStats } from '@/store/usOutletStats';
import { useOutletStore } from '@/store/useOutletStore';
import { SECTION_STYLES } from '@/@/lib/constants';
import { useGlobalVisibility } from '@/store/VisibilityProvider';
import { useDryout } from '@/providers/DryoutProvider';
import { useSODStore } from '@/store/useFilterStore';

function getBuTypeFromPathname(pathname: string): 'sod' | 'ro' | null {
  if (pathname.includes('sodTerminal') && pathname.includes('sodSupplychain')) return 'sod';
  if (pathname.includes('retailOutlet') && pathname.includes('SupplyChain')) return 'ro';
  return null;
}

// Import Dialog components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/@/components/ui/dialog";

// Import TableDialog component
import TableDialog from './TableDailog';
import { apiClient } from '@/services/apiClient';

interface WorkflowStepProps { 
  step: WorkflowStepType;
}

export function WorkflowStep({ step }: WorkflowStepProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogData, setDialogData] = useState([]);
  const [dialogTitle, setDialogTitle] = useState("");
  
  const { toast } = useToast();
  const { fetchOutletData, fetchDryOutCount } = useOutletStore();
  const location = useLocation();
  const bu_type = getBuTypeFromPathname(location.pathname);
  const {
    fetchOutletStats,
    fetchTarAnalysisStats,
    fetchInitialStepsStats,
    fetchCarryFwdIndentStats,
    fetchPendingCarryFwdIndentStats,
    fetchDealerTruckCountStats,
  } = useOutletStats();
  const styles = SECTION_STYLES[step.group as keyof typeof SECTION_STYLES];
  const { visibleItems, toggle } = useGlobalVisibility();
  const { selectedDryout, dryoutData, error } = useDryout();
  const {  
    sodZoneName, 
    sodPlantName, 
    sodProductName, 
    sodCustomerName, 
    retailZoneName, 
    retailCustomerName, 
    retailRegionName, 
    retailAreaName, 
    categoryValue, 
    SODHandleChange, 
  } = useSODStore();
  const carryFwdTypes = [
    'Carry Fwd Indent',
    'DryOut Carry Fwd Indent',
    'CATA Carry Fwd Indent',
    'Pending Carry Fwd Indent'
  ];

  const fetchDryoutGroupData = async (action) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/api/indentdryout/generate_dryout_group_data', {
        action: action
      });
      
      if (response.data) {
        setDialogData(response.data);
                // Set dialog title based on action type
                let title = "Data";
                if (action === 'carry_fwd_indent') title = 'Carry Forward Indent';
                else if (action === 'dryout_analysis') title = 'Dryout Analysis';
                else if (action === 'pending_carry_fwd_indent') title = 'Pending Carry Forward Indent';
                else if (action === 'dealer_truck_count') title = 'Dealer Truck Count';
                setDialogTitle(title);
        // setDialogTitle(action === 'carry_fwd_indent' ? 'Carry Forward Indent' : 'Dryout Analysis');
        setShowDialog(true);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch data. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isRetailClickableStep = (workflowStep: WorkflowStepType) =>
    workflowStep.group === 'not_raised' ||
    workflowStep.group === 'pending' ||
    ((workflowStep.group === 'indent' || workflowStep.group === 'dryout_analysis') && workflowStep.section === 'Indent Not Raised');

  const handleClick = async (step: WorkflowStepType) => {
    // For retail supply chain, only selected workflow boxes should be clickable
    if (
      bu_type === 'ro' &&
      !isRetailClickableStep(step)
    ) {
      return false;
    }
    switch (step.group) {
      case 'wip':
      case 'delivered':
      case 'tt_available':
        return false;
      // SOD only: carry_fwd_indent, pending_carry_fwd_indent, dealer_truck_count (never call tar_analysis/dry_out_analysis for SOD)
      case 'carry_fwd_indent':
      case 'pending_carry_fwd_indent':
      case 'dealer_truck_count':
        if (bu_type !== 'sod') return false;
        fetchDryoutGroupData(step.group);
        return;
      // RO only: dryout_analysis, tar_analysis (never call carry_fwd/pending/dealer_truck for RO)
      case 'dryout_analysis':
      case 'tar_analysis':
        if (bu_type !== 'ro') return false;
        fetchDryoutGroupData(step.group);
        return;
    }
    
    setIsLoading(true);
    Object.keys(visibleItems).map((key) => {
      if(key !== step.section) {
        visibleItems[key] = false
      }
    })
    
    if (step.group !== 'dryout_analysis' && step.group !== 'tar_analysis' && step.group !== 'carry_fwd_indent' && step.group !== 'pending_carry_fwd_indent' && step.group !== 'dealer_truck_count' && step.section === 'Indent Not Raised') {
      toggle(step.section);
    } else if(step.section === 'Indent On Hold') {
      toggle(step.section)
    }
    
    let data = {
      type: 'filterByIndent',
      filters: {
        categoryValue: categoryValue,
        dryout: { serial: step.serial },
        dryout_in_days: { serial: selectedDryout?.index +1 },
        sodZoneName: sodZoneName,
        sodPlantName: sodPlantName,
        sodCustomerName: sodCustomerName,
        sodProductName: sodProductName,
        retailZoneName: retailZoneName,
        retailCustomerName: retailCustomerName,
        retailRegionName: retailRegionName,
        retailAreaName: retailAreaName,
      }
    }
    
    if(!visibleItems[step.section]) {
      SODHandleChange(step.serial, 'progressRate');
      try {
        await fetchOutletData(data);
        await fetchDryOutCount(data);
      } catch (error) {
        console.error('Error:', error.message);
      } finally {
        setIsLoading(false);
      }
    } else {
      SODHandleChange(null, 'progressRate');
      try {
        await fetchOutletData({
          type: 'filterByIndent',
          filters: {
            categoryValue: categoryValue,
            dryout: { serial: null },
            dryout_in_days: { serial: selectedDryout?.index +1 },
            sodZoneName: sodZoneName,
            sodPlantName: sodPlantName,
            sodCustomerName: sodCustomerName,
            sodProductName: sodProductName,
            retailZoneName: retailZoneName,
            retailCustomerName: retailCustomerName,
            retailRegionName: retailRegionName,
            retailAreaName: retailAreaName,
          },
        });
        await fetchDryOutCount({
          type: 'filterByIndent',
          filters: {
            categoryValue: categoryValue,
            dryout: { serial: null },
            dryout_in_days: { serial: selectedDryout?.index +1 },
            sodZoneName: sodZoneName,
            sodPlantName: sodPlantName,
            sodCustomerName: sodCustomerName,
            sodProductName: sodProductName,
            retailZoneName: retailZoneName,
            retailCustomerName: retailCustomerName,
            retailRegionName: retailRegionName,
            retailAreaName: retailAreaName,
          }
        });
        // Do not call vice versa: SOD = only initial_steps + carry_fwd + pending + dealer_truck; RO = only initial_steps + tar_analysis + dry_out_analysis
        const baseFilters = {
          categoryValue,
          dryout: { serial: null },
          dryout_in_days: { serial: selectedDryout?.index + 1 },
          sodZoneName,
          sodPlantName,
          sodCustomerName,
          sodProductName,
          retailZoneName,
          retailCustomerName,
          retailRegionName,
          retailAreaName,
        };
        if (bu_type === 'sod') {
          await Promise.all([
            fetchInitialStepsStats({ type: 'filterByIndent', filters: baseFilters }),
            fetchCarryFwdIndentStats({ type: 'filterByIndent', filters: baseFilters }),
            fetchPendingCarryFwdIndentStats({ type: 'filterByIndent', filters: baseFilters }),
            fetchDealerTruckCountStats({ type: 'filterByIndent', filters: baseFilters }),
          ]);
        } else if (bu_type === 'ro') {
          await Promise.all([
            fetchInitialStepsStats({ type: 'filterByIndent', filters: baseFilters }),
            fetchTarAnalysisStats({ type: 'filterByIndent', filters: baseFilters }),
            fetchOutletStats({ type: 'filterByIndent', filters: baseFilters }),
          ]);
        }
      } catch (error) {
        console.error('Error:', error.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const shouldShowTick = (section) => {
    return visibleItems[section] && !carryFwdTypes.includes(section);
  };

  const isClickableStep = bu_type === 'ro'
    ? isRetailClickableStep(step)
    : (step.group !== 'wip' && step.group !== 'delivered' && step.group !== 'tt_available');

  const shouldAttachClick = bu_type === 'ro'
    ? isRetailClickableStep(step)
    : true;

  return ( 
    <>
      <div
        onClick={shouldAttachClick ? () => handleClick(step) : undefined}
        className={cn(
          "rounded-lg border shadow-sm transition-all p-2 h-full",
          isClickableStep ? "cursor-pointer" : "",
          isLoading && "opacity-70 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between mb-0">
          <h3 className="text-xs font-medium text-gray-800 truncate">{step.section}</h3>
          {shouldShowTick(step.section || step.group) && (
            <span className={cn("px-1 py-0 text-xs rounded-full", styles.badge)}>
              <Check className="w-4 h-4" />
            </span>
          )}
        </div>
        <div className="flex items-center text-gray-500 text-xs">
          <Box className={cn("w-3 h-3 mr-1", isLoading && "animate-spin")} />
          <span className="text-base font-bold">{isLoading ? 'Loading...' : step.value}</span>
        </div>
      </div>

      {/* Dialog for showing carry_fwd_indent or dryout_analysis data */}
      {showDialog && ( 
        <TableDialog 
          isOpen={showDialog} 
          onClose={() => setShowDialog(false)} 
          data={dialogData} 
          title={dialogTitle}
        />
      )}
    </>
  );
}
