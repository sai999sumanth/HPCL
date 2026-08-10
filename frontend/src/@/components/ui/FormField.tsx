import React from 'react';
import { cn } from '@/@/lib/utils';

interface FormFieldProps {
  label: string;
  className?: string;
  children: React.ReactNode;
}

const FormField: React.FC<FormFieldProps> = ({ label, className, children }) => {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div>
        {children}
      </div>
    </div>
  );
};

export default FormField;
