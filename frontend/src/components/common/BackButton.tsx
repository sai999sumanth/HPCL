import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BackButton = ({ 
  iconSize = 24, 
  iconColor = '#0047AB',
  className = ''
}) => {
  const navigate = useNavigate();

  const handleBackClick = () => {
    navigate(-1);
  };

  return (
    <button
      onClick={handleBackClick}
      className={`p-1 rounded-lg bg-transparent text-gray-700 hover:bg-gray-100 shadow-none transition-colors duration-200 ${className}`}
      aria-label="Go back"
    >
      <ArrowLeft 
        size={iconSize} 
        color={iconColor}
      />
    </button>
  );
};

export default BackButton;