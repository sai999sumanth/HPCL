// DryoutContext.tsx
import { useGlobalVisibility } from '@/store/VisibilityProvider';
import { useOutletStats } from '@/store/usOutletStats';
import { useSODStore } from '@/store/useFilterStore';
import { useOutletStore } from '@/store/useOutletStore';
import React, { createContext, useContext, useState, ReactNode } from 'react';

/** Derive bu_type from URL: sodTerminal/sodSupplychain → 4 APIs (sod), retailOutlet/SupplyChain → 3 APIs (ro). */
function getBuTypeFromPathname(pathname: string): 'sod' | 'ro' | null {
  if (pathname.includes('sodTerminal') && pathname.includes('sodSupplychain')) return 'sod';
  if (pathname.includes('retailOutlet') && pathname.includes('SupplyChain')) return 'ro';
  return null;
}

// Types for the stats/data
interface OutletStats {
  // Add the specific stats properties you expect
  [key: string]: any;
}

interface OutletData {
  // Add the specific data properties you expect
  [key: string]: any;
}

interface DryoutItem {
  name: string;
  count: string;
  color: string;
}

interface SelectedDryout {
  name: string;
  index: number;
}

interface DryoutContextType {
  selectedDryout: SelectedDryout | null;
  setSelectedDryout: React.Dispatch<React.SetStateAction<SelectedDryout | null>>;
  dryoutData: DryoutItem[];
  setDryoutData: React.Dispatch<React.SetStateAction<DryoutItem[]>>;
  handleDryoutSelection: (name: string, index: number, type?, skipApiCalls?: boolean) => Promise<void>;
  bigNumbers: OutletStats | null;
  isLoading: boolean;
  error: Error | null;
}

interface DryoutProviderProps {
  children: ReactNode;
}

const DryoutContext = createContext<DryoutContextType | undefined>(undefined);

export const DryoutProvider: React.FC<DryoutProviderProps> = ({ children }) => {
  const [selectedDryout, setSelectedDryout] = useState<SelectedDryout | null>(null);
  const [dryoutData, setDryoutData] = useState<DryoutItem[]>([]);
  const [bigNumbers, setBigNumbers] = useState<OutletStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { chartData, topData, bottomData, roleLength, fetchOutletData, fetchDryOutCount } = useOutletStore();
  const { 
    fetchOutletStats, 
    fetchInitialStepsStats, 
    fetchTarAnalysisStats,
    fetchCarryFwdIndentStats,
    fetchPendingCarryFwdIndentStats,
    fetchDealerTruckCountStats,
    setBuType,
  } = useOutletStats();
  const { sodZoneName, sodPlantName, sodProductName, sodCustomerName, retailProductName, retailZoneName, retailCustomerName, retailRegionName, retailAreaName, categoryValue, progressRate, getAllStoredData, setComponentContext, } = useSODStore();
  const { visibleItems, toggle } = useGlobalVisibility();

  const handleDryoutSelection = async (name: string, index: number, type?, skipApiCalls = false) => {
    setIsLoading(true);
    setError(null);
    const filterParams = getAllStoredData();
    console.log("nadmafaf", name);
    // console.log("filterParams prod", filterParams);
    setSelectedDryout({ name, index });
    // visibleItems['Indent Not Raised'] = false;
    Object.keys(visibleItems).map((key) => {
      visibleItems[key] = false;
    })
    
    // Skip API calls if flag is set (e.g., during reset)
    if (skipApiCalls) {
      setIsLoading(false);
      return;
    }
    
    try {
      let params: any = {};
      if(type === 'firstTime') {
        params = {
          type: 'filterByIndent',
          filters: {
            dryout: { serial: null }, // progressRate },
            categoryValue: categoryValue,
            sodZoneName: [],
            sodPlantName: [],
            sodCustomerName: [],
            sodProductName: ["2811000", "2812000", "2822000"], // filterParams?.sodProductName,
            retailProductName:["2811000", "2812000", "2822000"],
            retailZoneName: [],
            retailCustomerName: [],
            retailRegionName: [],
            retailAreaName: [],
            dryout_in_days: { serial: index +1 }
          }  
        }
      } else {
        params = {
          type: 'filterByIndent',
          filters: {
            dryout: { serial: null }, // progressRate },
            categoryValue: categoryValue,
            sodZoneName: sodZoneName,
            sodPlantName: sodPlantName,
            sodCustomerName: sodCustomerName,
            retailProductName: retailProductName,
            sodProductName: sodProductName, // filterParams?.sodProductName,
            retailZoneName: retailZoneName,
            retailCustomerName: retailCustomerName,
            retailRegionName: retailRegionName,
            retailAreaName: retailAreaName,
            dryout_in_days: { serial: index +1 }
          }  
        }
      }
      // STRICT: Use URL (window.location - DryoutProvider is outside Router). sodTerminal/sodSupplychain → 4 APIs; retailOutlet/SupplyChain → all RO APIs in one go.
      const buTypeFromUrl = getBuTypeFromPathname(typeof window !== 'undefined' ? window.location.pathname : '');
      if (buTypeFromUrl) setBuType?.(buTypeFromUrl);
      const baseParams = {
        ...params,
        filters: { ...params.filters, dryout: { serial: null } }
      };
      if (buTypeFromUrl === 'sod') {
        // SOD: load all APIs in one go (same as RO - no sequential awaits, no double load)
        await Promise.all([
          fetchOutletData(params),
          fetchDryOutCount(params),
          fetchInitialStepsStats(baseParams),
          fetchCarryFwdIndentStats(baseParams),
          fetchPendingCarryFwdIndentStats(baseParams),
          fetchDealerTruckCountStats(baseParams),
        ]);
      } else if (buTypeFromUrl === 'ro') {
        // RO: load all APIs in one go (no sequential awaits, no double load)
        await Promise.all([
          fetchOutletData(params),
          fetchDryOutCount(params),
          fetchInitialStepsStats(baseParams),
          fetchTarAnalysisStats(baseParams),
          fetchOutletStats(params),
        ]);
      } else {
        await fetchOutletData(params);
        await fetchDryOutCount(params);
      }
    } catch (error) {
      console.error('Error fetching dryout data:', error);
      setError(error instanceof Error ? error : new Error('An error occurred'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DryoutContext.Provider 
      value={{ 
        selectedDryout,
        setSelectedDryout,
        dryoutData,
        setDryoutData,
        handleDryoutSelection,
        bigNumbers,
        isLoading,
        error
      }}
    >
      {children}
    </DryoutContext.Provider>
  );
};

// Custom hook to use the dryout context
export const useDryout = (): DryoutContextType => {
  const context = useContext(DryoutContext);
  if (!context) {
    throw new Error('useDryout must be used within a DryoutProvider');
  }
  return context;
};
