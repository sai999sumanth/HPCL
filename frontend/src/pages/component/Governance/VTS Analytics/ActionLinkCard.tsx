import React from 'react';
import { cn } from '@/@/lib/utils';
import { ArrowRight } from 'lucide-react';

interface ActionLinkCardProps {
  text: string;
  subtitle: string;
  className?: string;
  onClick?: () => void;
}

const ActionLinkCard: React.FC<ActionLinkCardProps> = ({ text, subtitle, className, onClick }) => {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "bg-white rounded-lg p-3 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 border border-gray-200 h-full w-full flex flex-col items-center justify-center text-center",
        className
      )}
    >
      <div className="flex items-center text-blue-600 font-semibold text-sm">
        <span>{text}</span>
        <ArrowRight className="h-4 w-4 ml-1" />
      </div>
      <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
    </button>
  );
};

export default ActionLinkCard;
