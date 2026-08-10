import { create } from 'zustand';

interface SelectedDryout {
  name: string;
  index: number;
}

interface SODState {
  // Add a component identifier
  activeComponent: string | null;
  
  // Original state fields
  sodZoneName: string[];
  sodPlantName: string[];
  sodProductName: string[];
  sodCustomerName: string[];
  retailZoneName: string[];
  retailCustomerName: string[];
  retailRegionName: string[];
  retailAreaName: string[];
  retailProductName: string[];
  selectedDryout: SelectedDryout | null;  // Updated to object type
  progressRate: number;
  categoryValue: string[];
  isCategoryEnabled: boolean;
  isLoadingstoreData: boolean;
  
  // Methods
  SODHandleChange: (event: any, name?: string) => void;
  getAllStoredData: () => {
    sodZoneName: string[];
    sodPlantName: string[];
    sodProductName: string[];
    sodCustomerName: string[];
    retailZoneName: string[];
    retailCustomerName: string[];
    retailRegionName: string[];
    retailAreaName: string[];
    retailProductName: string[];
    selectedDryout: SelectedDryout | null;  // Updated to object type
    progressRate: number;
    categoryValue: string[];
    isCategoryEnabled: boolean;
  };
  resetStoredData: () => void;
  resetSODData: () => void;
  resetRetailData: () => void;
  
  // New methods to set component context
  setComponentContext: (component: string) => void;
}

export const useSODStore = create<SODState>((set, get) => ({
  // Add component identifier
  activeComponent: null,
  
  // Original state fields
  sodZoneName: [],
  sodPlantName: [],
  sodProductName: [],
  sodCustomerName: [],
  retailZoneName: [],
  retailCustomerName: [],
  retailRegionName: [],
  retailAreaName: [],
  retailProductName: [],
  selectedDryout: null,  // Updated to null initial value
  progressRate: null,
  categoryValue: null,
  isCategoryEnabled: false,
  isLoadingstoreData: false,


  // Add a method to set the component context
  setComponentContext: (component) => {
    // Set the active component and reset appropriate data
    if (component === 'SOD') {
      set({
        activeComponent: component,
        // Reset retail-specific fields
        retailZoneName: [],
        retailCustomerName: [],
        retailRegionName: [],
        retailAreaName: [],
      });
    } else if (component === 'RETAIL') {
      set({
        activeComponent: component,
        // Reset SOD-specific fields
        sodZoneName: [],
        sodPlantName: [],
        // Keep default products for SOD
        sodProductName: [],
        sodCustomerName: [],
      });
    }
    
    // Reset shared fields
    // set({
    //   selectedDryout: null,
    //   progressRate: null,
    //   categoryValue: null,
    //   isCategoryEnabled: false
    // });
  },

  // Original handler for changes
  SODHandleChange: (event: any, name?: string) => {
    const value = event;

    // If this is a special component context change
    if (name === 'componentType') {
      get().setComponentContext(value); // ← sets new context
      return;
    }
    
    switch (name) {
      case 'zoneName':
        set({ sodZoneName: value });
        break;
      case 'plantName':
        set({ sodPlantName: value });
        break;
      case 'productName':
        set({ sodProductName: value });
        break;
      case 'customerName':
        set({ retailCustomerName: value });
        break;
      case 'regionName':
        set({ retailRegionName: value });
        break;
      case 'areaName':
        set({ retailAreaName: value });
        break;
      case 'retailProductName':
        set({ retailProductName: value })
        break;
      case 'selectedDryout':
        // Handle the object structure properly
        set({ selectedDryout: value });
        break;
      case 'progressRate':
        set({ progressRate: value });
        break;
      case 'categoryValue':
        set({ categoryValue: value });
        break;
      case 'isCategoryEnabled':
        set({ isCategoryEnabled: value });
        break;
      default:
        break;
    }

    if (name === 'componentType') {
      const isSOD = value === 'SOD';
      
      set((state) => ({
        activeComponent: value,
        // Reset based on component type
        ...(isSOD
          ? {
              retailZoneName: [],
              retailCustomerName: [],
              retailRegionName: [],
              retailAreaName: [],
            }
          : {
              sodZoneName: [],
              sodPlantName: [],
              sodProductName: [],
              sodCustomerName: [],
            }),
    
        // Reset shared fields
        selectedDryout: null,
        progressRate: null,
        categoryValue: null,
        isCategoryEnabled: false,
      }));
    
      return;
    }
  },

  // Get all stored data
  getAllStoredData: () => {
    const state = get();
    const component = state.activeComponent;

    const baseData = {
      sodZoneName: state.sodZoneName,
      sodPlantName: state.sodPlantName,
      sodProductName: state.sodProductName,
      sodCustomerName: state.sodCustomerName,
      retailZoneName: state.retailZoneName,
      retailCustomerName: state.retailCustomerName,
      retailRegionName: state.retailRegionName,
      retailAreaName: state.retailAreaName,
      retailProductName: state.retailProductName,
      selectedDryout: state.selectedDryout,
      progressRate: state.progressRate,
      categoryValue: state.categoryValue,
      isCategoryEnabled: state.isCategoryEnabled
    };
    
    // If component context is set, only return relevant fields
    // if (component === 'SOD') {
    //   return {
    //     ...baseData,
    //     retailZoneName: [],
    //     retailCustomerName: [],
    //     retailRegionName: [],
    //     retailAreaName: []
    //   };
    // } else if (component === 'RETAIL') {
    //   return {
    //     ...baseData,
    //     sodZoneName: [],
    //     sodPlantName: [],
    //     sodProductName: [],
    //     sodCustomerName: []
    //   };
    // }
    
    return baseData;
  },
  
  // Reset all stored data
  resetStoredData: () => {
    set({
      sodZoneName: [],
      sodPlantName: [],
      sodProductName: [],
      sodCustomerName: [],
      retailZoneName: [],
      retailCustomerName: [],
      retailRegionName: [],
      retailAreaName: [],
      selectedDryout: null,
      progressRate: null,
      categoryValue: null,
      isCategoryEnabled: false
    });
  },

  // Reset SOD data
  resetSODData: () => {
    set({
      sodZoneName: [],
      sodPlantName: [],
      sodProductName: [],
      sodCustomerName: [],
      selectedDryout: null,
      progressRate: null,
      categoryValue: null,
      isCategoryEnabled: false
    });
  },
  
  // Reset retail data
  resetRetailData: () => {
    set({
      retailZoneName: [],
      retailCustomerName: [],
      retailRegionName: [],
      retailAreaName: [],
      selectedDryout: null,
      progressRate: null,
      categoryValue: null,
      isCategoryEnabled: false
    });
  }
}));