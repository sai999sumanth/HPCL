import React from 'react';
import { cn } from '../../../@/lib/utils';

interface SpinnerProps {
  className?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ className }) => {
  return (
    <div
      className={cn(
        'h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]',
        className
      )}
      role="status"
    >
      <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
        Loading...
      </span>
    </div>
  );
};

export default Spinner;