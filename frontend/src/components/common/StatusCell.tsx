import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface StatusCellProps {
  value: string;
  data: any;
  handleStatusUpdate: (id: string, status: string) => void;
}

type StatusType = 'Completed' | 'Draft' | 'Published';

const StatusCell: React.FC<StatusCellProps> = ({ value, data, handleStatusUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<'top' | 'bottom'>('bottom');
  const [currentStatus, setCurrentStatus] = useState<StatusType>(
    (value as StatusType) || "Draft"
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const statusConfig = {
    Published: 'bg-green-50 text-green-700',
    Draft: 'bg-gray-50 text-gray-700',
    Completed: 'bg-blue-50 text-blue-700'
  };

  // Sort status options alphabetically
  const sortedStatusOptions = Object.keys(statusConfig).sort() as StatusType[];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const calculateDropdownPosition = () => {
    if (buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;
      const dropdownHeight = 120;

      setDropdownPosition(spaceBelow < dropdownHeight && spaceAbove > spaceBelow ? 'top' : 'bottom');
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    calculateDropdownPosition();
    setIsOpen(!isOpen);
  };

  const handleStatusChange = (newStatus: StatusType) => {
    if (newStatus !== currentStatus && data.id) {
      handleStatusUpdate(data.id.toString(), newStatus);
      // Don't set currentStatus here - let it update via the value prop change
    }
    setIsOpen(false);
  };

  return (
    <div className="relative flex items-center h-full z-[100]" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={handleClick}
        className={`
          inline-flex items-center justify-between
          px-3 py-1.5 rounded-full
          w-28 h-8
          text-sm font-medium
          transition-colors duration-150 ease-in-out
          ${statusConfig[currentStatus as keyof typeof statusConfig]}
          hover:opacity-80
          focus:outline-none focus:ring-0
        `}
      >
        <span className="truncate">{currentStatus}</span>
        <ChevronDown 
          className={`
            w-4 h-4 ml-1
            transition-transform duration-150
            ${isOpen ? 'rotate-180' : ''}
          `}
        />
      </button>

      {isOpen && (
        <div 
          className={`
            absolute ${dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}
            left-0 w-28 rounded-lg shadow-lg bg-white
            overflow-hidden z-[9999]
          `}
        >
          <div className="py-1">
            {sortedStatusOptions.map((status) => (
              <button
                key={status}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange(status);
                }}
                className={`
                  w-full px-3 py-2
                  text-sm text-left
                  flex items-center justify-between
                  hover:bg-gray-50
                  transition-colors duration-150
                  ${status === currentStatus ? 'font-medium' : ''}
                  ${status === currentStatus ? statusConfig[status as keyof typeof statusConfig] : ''}
                `}
              >
                <span className="truncate">{status}</span>
                {status === currentStatus && (
                  <Check className="w-4 h-4 ml-2 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Modified getFilterGroups function to sort entries
// const getFilterGroups = (type: 'status' | 'group', counts: any) => {
//   let entries = Object.entries(counts[type]);
  
//   // Sort all entries alphabetically
//   entries = entries.sort(([nameA], [nameB]) => {
//     // For group type, ensure Uncategorized is at the end
//     if (type === 'group') {
//       if (nameA === 'Uncategorized') return 1;
//       if (nameB === 'Uncategorized') return -1;
//     }
//     return nameA.localeCompare(nameB);
//   });

//   return entries.map(([name, count]) => ({
//     name,
//     count
//   }));
// };

const getFilterGroups = (type: 'status' | 'group',counts: any) => {
  let entries = Object.entries(counts[type]);
  
  // Sort entries alphabetically for both status and group
  entries = entries.sort(([nameA], [nameB]) => {
    // Special handling for group type
    if (type === 'group') {
      // console.log(nameA, nameB);
      // Handle empty group names as Uncategorized
      if (nameA === '' || !nameA) return 1;
      if (nameB === '' || !nameB) return -1;
      if (nameA === 'Uncategorized') return 1;
      if (nameB === 'Uncategorized') return -1;
    }
    return nameA.localeCompare(nameB);
  });

  // Combine empty and 'Uncategorized' counts for group type
  if (type === 'group') {
    let uncategorizedCount = 0;
    entries = entries.filter(([name, count]) => {
      if (!name || name === '' || name === 'Uncategorized') {
        uncategorizedCount += count as number;
        return false;
      }
      return true;
    });
    if (uncategorizedCount > 0) {
      entries.push(['Uncategorized', uncategorizedCount]);
    }
  }

  return entries
    
    .map(([name, count]) => ({
      name,
      count
    }));
};

const getStatusColumn = (handleStatusUpdate: (id: string, status: string) => void) => ({
  field: 'dashboard_status',
  headerName: 'Status',
  flex: 1,
  width: 150,
  cellClass: '!overflow-visible !p-2',
  filter: 'agTextColumnFilter',
  cellRenderer: (params: any) => (
    <StatusCell
      value={params.value || "Draft"}
      data={params.data}
      handleStatusUpdate={handleStatusUpdate}
    />
  ),
});

export { StatusCell, getStatusColumn, getFilterGroups };