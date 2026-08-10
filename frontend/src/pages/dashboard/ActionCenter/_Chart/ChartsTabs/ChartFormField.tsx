// ChartFormField.tsx
import React from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../../../../../@/components/ui/select';
import { Filter, Metric } from '../../../../../types/chartTabs';

interface FormField {
  key: string;
  type: string;
  label: string;
  placeholder?: string;
  options?: string[];
}

interface DroppedItem {
  id: string;
  name: string;
  type?: string;
  aggregate?: string;
  label?: string;
}

interface ChartFormFieldProps {
    field: FormField;
    formData: { [key: string]: any };
    handleFormChange: (key: string, value: any, openPopover?: boolean) => void;
    SingleDropZone: React.FC<{
      onDrop: (item: DroppedItem) => void;
      item: DroppedItem | null;
      onRemove: () => void;
      placeholder: string;
      field: FormField;
      acceptTypes: string[];
    }>;
    MultipleDropZone: React.FC<{
      onDrop: (item: DroppedItem) => void;
      items: DroppedItem[];
      onRemove: (key: string, id: string) => void;
      placeholder: string;
      field: FormField;
      acceptTypes: string[];
    }>;
    chartMetric: Metric | null;
    setChartMetric: (metric: Metric | null) => void;
    filters: Filter[];
    rowLimit: number;  // Add this line
    timeGrain: string; // Add this line
  }
  
const ChartFormField: React.FC<ChartFormFieldProps> = ({
  field,
  formData,
  handleFormChange,
  SingleDropZone,
  chartMetric,
  setChartMetric,
  filters,
  MultipleDropZone
}) => {
  switch (field.type) {
    case "select":
      return (
        <Select
          value={formData[field.key] || ""}
          onValueChange={(value) => handleFormChange(field.key, value)}
        >
          <SelectTrigger className="w-full bg-white">
            <SelectValue
              placeholder={field.placeholder || `Select ${field.label}`}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{field.label}</SelectLabel>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      );

    case "drag_and_drop_or_select_single":
      if (field.key === "metric" && chartMetric) {
        return SingleDropZone ? (
          <SingleDropZone
            onDrop={(item: DroppedItem) => {
              handleFormChange("metric", item);
              if (setChartMetric) {
                setChartMetric({
                  expression_type: "SIMPLE",
                  column: {
                    column_name: item.name,
                    type: item.type || "UNKNOWN",
                  },
                  aggregate: item.aggregate || "",
                  label: item.label || item.name,
                });
              }
            }}
            item={{
              id: chartMetric.column.column_name,
              name: chartMetric.label,
              type: chartMetric.column.type,
            }}
            onRemove={() => {
              handleFormChange("metric", null);
              if (setChartMetric) {
                setChartMetric(null);
              }
            }}
            placeholder={field.placeholder || "Drop item here"}
            field={field}
            acceptTypes={["METRIC", "COLUMN"]}
          />
        ) : null;
      } else {
        return SingleDropZone ? (
          <SingleDropZone
            onDrop={(item) => handleFormChange(field.key, item)}
            item={formData[field.key] || null}
            onRemove={() => {
              handleFormChange(field.key, null);
              if (field.key === "metric" && setChartMetric) {
                setChartMetric(null);
              }
            }}
            placeholder={field.placeholder || "Drop item here"}
            field={field}
            acceptTypes={["METRIC", "COLUMN"]}
          />
        ) : null;
      }

    case "drag_and_drop_or_select_multiple":
      
      return MultipleDropZone ? (
        <MultipleDropZone
          onDrop={(item) =>
            handleFormChange(
              field.key,
              [...(field.key === "filters" ? filters || [] : (formData[field.key] || [])), item]
    
            )
          }
          items={field.key === "filters" ? filters || [] : (formData[field.key] || [])}
          onRemove={(key: string, id: string) =>
            field.key === "filters"
              ? handleFormChange("filters", id)
              : handleFormChange(
                  field.key,
                  (formData[field.key] || []).filter(
                    (item: DroppedItem) => item.id !== id
                  )
                )
          }
          placeholder={field.placeholder || "Drop items here"}
          field={field}
          acceptTypes={["METRIC", "COLUMN"]}
        />
      ) : null;

    case "checkbox":
      return (
        <div className="items-top flex space-x-2">
          <input
            type="checkbox"
            id={field.key}
            checked={formData[field.key] || false}
            onChange={(e) => handleFormChange(field.key, e.target.checked)}
            className="form-checkbox h-4 w-5 text-blue-600"
          />
          <div className="grid gap-1.5 leading-none">
            <label
              htmlFor={field.key}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            />
          </div>
        </div>
      );

    default:
      return (
        <input
          type="text"
          value={formData[field.key] || ""}
          onChange={(e) => handleFormChange(field.key, e.target.value)}
          placeholder={field.placeholder}
          className="w-full p-2 border rounded"
        />
      );
  }
};

export default ChartFormField;