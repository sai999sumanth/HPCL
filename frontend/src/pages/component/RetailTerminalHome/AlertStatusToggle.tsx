import React from 'react';

interface AlertStatusToggleProps {
  status: string;
  onToggle: () => void;
}

const AlertStatusToggle: React.FC<AlertStatusToggleProps> = ({ status, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className={`px-3 py-1.5 rounded-md font-medium text-sm flex items-center ${
        status === 'Open'
          ? 'bg-green-100 text-green-800 hover:bg-green-200'
          : 'bg-red-100 text-red-800 hover:bg-red-200'
      }`}
    >
      <span className={`w-2 h-2 rounded-full mr-2 ${
        status === 'Open' ? 'bg-green-500' : 'bg-red-500'
      }`}></span>
      {status}
    </button>
  );
};

export default AlertStatusToggle;