import React from 'react';
import { cn } from '@/@/lib/utils';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string;
  icon?: React.ReactNode;
}

const ActionButton: React.FC<ActionButtonProps> = ({ className, text, icon, ...props }) => {
  return (
    <button
      className={cn(
        'flex items-center justify-center rounded-md font-semibold shadow-sm transition-transform transform hover:scale-105',
        className
      )}
      {...props}
    >
      {icon}
      {text && <span>{text}</span>}
    </button>
  );
};

export default ActionButton;
