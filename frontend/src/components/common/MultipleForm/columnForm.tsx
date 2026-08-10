import React, { FC } from "react";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSelector } from "react-redux";
import { RootState } from "../../../redux/store";
import { Input } from "../../../@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../@/components/ui/select";
import { Checkbox } from "../../../@/components/ui/checkbox";
import { Label } from "../../../@/components/ui/label";
import { Button } from "../../../@/components/ui/button";
import { ErrorMessage } from "@hookform/error-message";
import { z } from "zod";

export type ControlType =
  | "text"
  | "select"
  | "number"
  | "checkbox"
  | "multi-select";

export interface SelectOption {
  label: string;
  value: string;
}

export interface DynamicFieldData {
  label: string;
  inputType: ControlType;
  fieldName: string;
  defaultValue: any;
  options?: SelectOption[];
  config?: any;
  placeholder?: string;
  dependsKey?: string;
  dependsValue?: string[] | boolean;
  value?: boolean;
}

interface ColumFormProps {
  nodeLabel: string;
  formData: (data) => void;
}

const DynamicControl = React.forwardRef((props: DynamicFieldData, ref: any) => {
  const { register, setValue, watch } = useFormContext();

  const {
    fieldName,
    inputType,
    defaultValue,
    value,
    options,
    config,
    placeholder,
    dependsKey,
    dependsValue,
  } = props;

  const watchedValue = dependsKey ? watch(dependsKey) : null;

  if (dependsKey && watchedValue !== dependsValue) {
    return null;
  }

  switch (inputType) {
    case "text":
      return (
        <Input
          type="text"
          className="w-full"
          {...register(fieldName, config)}
          defaultValue={defaultValue}
          placeholder={placeholder}
        />
      );
    case "select":
      return (
        <Select
          defaultValue={defaultValue}
          onValueChange={(value) => setValue(fieldName, value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options?.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "number":
      return (
        <Input
          type="number"
          className="w-full"
          {...register(fieldName, config)}
          defaultValue={defaultValue}
          placeholder={placeholder}
        />
      );
    case "checkbox":
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            className="custom-btn-bg"
            {...register(fieldName)}
            id={fieldName}
            defaultChecked={defaultValue}
            onCheckedChange={(checked) => setValue(fieldName, checked)}
          />
        </div>
      );
    case "multi-select":
      // Implement multi-select logic here
      return <div>Multi-select not implemented</div>;
    default:
      return <Input type="text" />;
  }
});

const createAddColumnSchema = (columnOptions: SelectOption[]) => {

  return z
    .object({
      column_name: z.string().min(1, "Column name is required"),
      text_first_box: z.boolean(),
      value: z.string().optional(),
      type: z.string().optional(),
    })
    .refine(
      (data) => {
        if (data.text_first_box) {
          return data.type !== undefined && data.type !== "";
        } else {
          return data.value !== undefined && data.value !== "";
        }
      },
      {
        message:
          "Either 'value' or 'type' must be provided based on the checkbox",
        path: ["value", "type"],
      }
    );
};

const createDropColumnSchema = (columnOptions: SelectOption[]) => {
  return z.object({
    columnToDrop: z.string().min(1, "Column to drop is required"),
  });
};

const createDropDuplicatesSchema = (columnOptions: SelectOption[]) => {
  return z.object({
    columnsToCheck: z
      .array(z.string())
      .min(1, "Select at least one column to check for duplicates"),
    keepColumn: z.string().min(1, "Select a column to keep"),
  });
};

const formFields = {
  AddColumn: [
    {
      fieldName: "column_name",
      label: "Column Name",
      inputType: "text" as ControlType,
      defaultValue: "",
      placeholder: "Enter column name",
    },
    {
      fieldName: "text_first_box",
      label: "Select value from column",
      inputType: "checkbox" as ControlType,
      defaultValue: false,
    },
    {
      fieldName: "value",
      label: "Column Value",
      inputType: "text" as ControlType,
      defaultValue: "",
      placeholder: "Enter rule name",
    },
    {
      fieldName: "value",
      label: "Choose Column For Value",
      inputType: "select" as ControlType,
      options: [],
      defaultValue: "",
      placeholder: "Select a column",
    },
  ],
  DropColumn: [
    {
      fieldName: "columnToDrop",
      label: "Column to Drop",
      inputType: "select" as ControlType,
      options: [],
      defaultValue: "",
      placeholder: "Select column to drop",
    },
  ],
  DropDuplicates: [
    {
      fieldName: "columnsToCheck",
      label: "Columns to Check for Duplicates",
      inputType: "select" as ControlType,
      options: [],
      defaultValue: "",
      placeholder: "Select a column",
    },
    {
      fieldName: "keepColumn",
      label: "Select a Column to Keep",
      inputType: "select" as ControlType,
      options: [],
      defaultValue: "",
      placeholder: "Select a column",
    },
  ],
};

export const DynamicColumnForm: FC<ColumFormProps> = ({
  nodeLabel,
  formData,
}) => {
  const reduxFormdata = useSelector((state: RootState) => state.formdata);
  const dropdownData = useSelector((state: RootState) => state.dropdown);


  const columnOptions = dropdownData[reduxFormdata[0]?.label]?.column_name || [];

  let schema;
  switch (nodeLabel) {
    case "AddColumn":
      schema = createAddColumnSchema(columnOptions);
      break;
    case "DropColumn":
      schema = createDropColumnSchema(columnOptions);
      break;
    case "DropDuplicates":
      schema = createDropDuplicatesSchema(columnOptions);
      break;
    default:
      schema = z.object({});
  }

  const formMethods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      column_name: "",
      text_first_box: false,
      value: "",
      type: "new_column",
      columnToDrop: "",
      columnsToCheck: [],
      keepColumn: "",
    },
  });

  const {
    handleSubmit,
    formState: { isSubmitting, errors },
    watch,
  } = formMethods;

  const textFirstBox = watch("text_first_box");

  let fields = formFields[nodeLabel].map((field) => {
    if (field.inputType === "select" || field.inputType === "multi-select") {
      return { ...field, options: columnOptions };
    }
    return field;
  });

  if (nodeLabel === "AddColumn") {
    fields = fields.filter((field) => {
      if (field.fieldName === "value" && textFirstBox) {
        return false;
      }
      if (field.fieldName === "type" && !textFirstBox) {
        return false;
      }
      return true;
    });
  }

  const onSubmit = (data: any) => {
    // console.log("Form Submitted Data:", data);
    formData(data);
  };

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <h2 className="text-lg font-semibold">{nodeLabel}</h2>
        <div className="grid grid-cols-2 gap-4">
          {fields.map((field) => (
            <div key={field.fieldName} className="space-y-2">
              <Label htmlFor={field.fieldName}>{field.label}</Label>
              <DynamicControl {...field} />
              <ErrorMessage
                errors={errors}
                name={field.fieldName}
                as={<p className="text-red-500" />}
              />
            </div>
          ))}
        </div>
        <Button type="submit" className="custom-bg" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      </form>
    </FormProvider>
  );
};

export default DynamicColumnForm;
