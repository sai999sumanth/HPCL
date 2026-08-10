import React, { useEffect, useRef } from 'react';

interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ 
  checked = false, 
  indeterminate = false,
  onCheckedChange, 
  disabled = false,
  ...props 
}) => {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onCheckedChange?.(e.target.checked);
  };

  return (
    <input
      ref={checkboxRef}
      type="checkbox"
      checked={checked}
      onChange={handleChange}
      disabled={disabled}
      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      {...props}
    />
  );
};
