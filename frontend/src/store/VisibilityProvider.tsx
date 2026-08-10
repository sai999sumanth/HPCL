import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define types
type VisibilityState = {
  [key: string]: boolean;
};

type GlobalStoreContextType = {
  visibleItems: VisibilityState;
  show: (id: string) => void;
  hide: (id: string) => void;
  toggle: (id: string) => void;
};

// Create context with initial type
const GlobalStore = createContext<GlobalStoreContextType | undefined>(undefined);

// Define provider props type
interface GlobalStoreProviderProps {
  children: ReactNode;
}

// Define ShowHide props type
interface ShowHideProps {
  id: string;
  children: ReactNode;
}

// Provider component
export const GlobalStoreProvider: React.FC<GlobalStoreProviderProps> = ({ children }) => {
  const [visibleItems, setVisibleItems] = useState<VisibilityState>({});

  const show = (id: string) => setVisibleItems(prev => ({ ...prev, [id]: true }));
  const hide = (id: string) => setVisibleItems(prev => ({ ...prev, [id]: false }));
  const toggle = (id: string) => setVisibleItems(prev => ({ ...prev, [id]: !prev[id] }));
  
  return (
    <GlobalStore.Provider value={{ visibleItems, show, hide, toggle }}>
      {children}
    </GlobalStore.Provider>
  );
};

// Hook with type safety
export const useGlobalVisibility = (): GlobalStoreContextType => {
  const context = useContext(GlobalStore);
  if (context === undefined) {
    throw new Error('useGlobalVisibility must be used within a GlobalStoreProvider');
  }
  return context;
};

// Component with type safety
export const ShowHide: React.FC<ShowHideProps> = ({ id, children }) => {
  const { visibleItems, toggle } = useGlobalVisibility();
  
  return (
    <>
      <div className={visibleItems[id] ? 'block' : 'hidden'}>
        {children}
      </div>
      <button 
        onClick={() => toggle(id)}
        className="px-3 py-1 bg-blue-500 text-white rounded"
      >
        {visibleItems[id] ? 'Hide' : 'Show'}
      </button>
    </>
  );
};