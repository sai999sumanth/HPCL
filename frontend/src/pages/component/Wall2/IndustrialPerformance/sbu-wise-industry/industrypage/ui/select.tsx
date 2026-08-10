import { cn } from "@/@/lib/utils";
import * as React from "react"

// A mock Select component that wraps a native <select> element.
// It's updated to handle the `onValueChange` prop, which is a common pattern in component libraries
// and is used in your SbuWisePerformanceControls component.
const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { onValueChange?: (value: string) => void }
>(({ className, children, onValueChange, ...props }, ref) => {
  
  // This handler translates the native `onChange` event into the `onValueChange` callback.
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (onValueChange) {
      onValueChange(event.target.value);
    }
    // Also call the original onChange if it was passed, for completeness.
    if (props.onChange) {
      props.onChange(event);
    }
  };

  return (
    <select
      className={cn("border border-gray-300 rounded-md p-2", className)}
      ref={ref}
      onChange={handleChange}
      {...props}
    >
      {children}
    </select>
  );
});
Select.displayName = "Select";

// A mock SelectItem that wraps a native <option> element.
const SelectItem = React.forwardRef<
  HTMLOptionElement,
  React.OptionHTMLAttributes<HTMLOptionElement>
>(({ className, ...props }, ref) => (
  <option ref={ref} className={cn("", className)} {...props} />
));
SelectItem.displayName = "SelectItem";

// The following components are placeholders to prevent import errors.
// With the corrected structure in SbuWisePerformanceControls, they are no longer used there,
// but we keep them in case other parts of the app import them.
const SelectValue = () => null; 
const SelectContent = ({ children }) => <>{children}</>;
const SelectTrigger = ({ children }) => <>{children}</>;

export { Select, SelectValue, SelectContent, SelectItem, SelectTrigger };
