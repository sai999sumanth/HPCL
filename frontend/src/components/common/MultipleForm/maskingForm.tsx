import { useFormContext } from "react-hook-form";
import { RegisterOptions } from "react-hook-form";
import { FormProvider, useForm } from "react-hook-form";
import { ErrorMessage } from "@hookform/error-message";
import { Input } from "../../../@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../@/components/ui/select";
import { Label } from "../../../@/components/ui/label";
import { FC, forwardRef } from "react";
import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../../redux/store";
import { Button } from "../../../@/components/ui/button";


export type ControlType = "text" | "select" | "number" | "password" | "checkbox" | "multi-select";

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
  config?: RegisterOptions;
  placeholder?: string;
  dependsKey?: string;
  dependsValue?: string[];
}

interface FormProps {
  fields: DynamicFieldData[];
  maskingForm: (data: any) => void;
}

interface MaskingProps {
  maskingData: {
    maskingForm: (data: any) => void; // Explicitly define the structure
  };
  sourceNode: any;
}

export const DynamicControl = React.forwardRef((props: DynamicFieldData, ref: any) => {
  const { register, setValue, watch } = useFormContext();

  const {
    fieldName,
    inputType,
    defaultValue,
    options,
    config,
    placeholder,
    dependsKey,
    dependsValue
  } = props;

  // Watch for the value of the dependent field (dependsKey)
  const dependsKeyValue = watch(dependsKey);

  // Determine whether to display the field
  const shouldDisplay =
    !dependsKey ||        // No dependsKey, so always display
    (dependsKey &&        // dependsKey exists, so check if its value matches dependsValue
     (!dependsValue || dependsValue.length === 0) || // No specific dependsValue, so display
     dependsValue.includes(dependsKeyValue)); // If value matches, display

  if (!shouldDisplay) return null; // Don't render the field if conditions aren't met

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
    case "password":
      return (
        <Input
          type="password"
          className="w-full"
          {...register(fieldName, config)}
          defaultValue={defaultValue}
          placeholder={placeholder}
        />
      );
    case "select": {
      return (
        <Select defaultValue={defaultValue} {...register(fieldName, config)} onValueChange={(value) => setValue(fieldName, value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
          {options.map((o, index) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
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
    default:
      return <input type="text" />;
  }
});

export const Form: FC<FormProps> = ({fields, maskingForm}) => {
  const defaultValues = fields.reduce((acc, field) => {
    acc[field.fieldName] = field.defaultValue || ""; // Set empty string if no defaultValue is defined
    return acc;
  }, {} as Record<string, any>);

  const formMethods = useForm({defaultValues});
  const {
    handleSubmit,
    formState: { isSubmitting, errors },
    watch,
    reset
  } = formMethods;

  const dynamicRef = React.useRef(null);

  function onSubmit(data) {
    // Here you would typically send the data to an API or perform some action
    maskingForm(data);
  }

  // Function to reset the form to its initial state (or pass custom values)
  const handleReset = () => {
    reset(defaultValues); // Reset to defaultValues
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormProvider {...formMethods}>
        <div className="grid grid-cols-3 gap-4">
          {fields.map((d, i) => {
            const dependsKeyValue = watch(d.dependsKey);
            const shouldDisplay =
              !d.dependsKey ||        // No dependsKey, so always display
              (d.dependsKey &&        // dependsKey exists, so check if its value matches dependsValue
               (!d.dependsValue || d.dependsValue.length === 0) || // No specific dependsValue, so display
               d.dependsValue.includes(dependsKeyValue)); // If value matches, display

            return shouldDisplay ? (
              <div key={i} className="col-span-1">
                <Label htmlFor={d.fieldName}>{d.label}</Label>
                <DynamicControl {...d} ref={dynamicRef} defaultValue={d.defaultValue || ""} />
                <ErrorMessage errors={errors} name={d.fieldName} />
              </div>
            ) : null;
          })}
        </div>
      </FormProvider>
      <div className="mt-3">
        <Button variant="outline" className="custom-btn-bg text-white hover:text-white" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting" : "Submit"}
        </Button>

        <Button variant="outline" type="button" onClick={handleReset}>
          Reset
        </Button>
      </div>
    </form>
  );
};


export const MaskingForm: FC<MaskingProps> = ({ maskingData, sourceNode }) => {
  const reduxFormdata = useSelector((state: RootState) => state.formdata);
  const dropdownData = useSelector((state: RootState) => state.dropdown);

  const fields: DynamicFieldData[] = [
    {
      fieldName: "input_field",
      inputType: "select",
      label: "Input field",
      options: dropdownData[reduxFormdata[0]?.label]?.column_name || dropdownData[sourceNode?.data?.label]?.columns || [],
      placeholder: "Select input field",
      defaultValue: ""
    },
    {
      fieldName: "output_field",
      inputType: "select",
      label: "Output field",
      options: dropdownData[reduxFormdata[0]?.label]?.column_name || dropdownData[sourceNode?.data?.label]?.columns || [],
      placeholder: "Select output field",
      defaultValue: ""
    },
    {
      fieldName: "masking_tech",
      inputType: "select",
      label: "Masking tech",
      options: [
        { label: "Masking", value: "masking" },
        { label: "Encryption", value: "encrypt" },
        { label: "Decryption", value: "decrypt" },
        { label: "Faker", value: "faker" },
        { label: "Prefix", value: "prefix" },
        { label: "Suffix", value: "suffix" },
      ],
      placeholder: "Select masking tech",
      defaultValue: ""
    },
    {
      fieldName: "masking_char",
      inputType: "text",
      label: "Masking char",
      placeholder: "Enter masking char",
      defaultValue: "",
      dependsKey: "masking_tech",
      dependsValue: ["masking", "prefix", "suffix"]
    },
    {
      fieldName: "masking_type",
      inputType: "select",
      label: "Masking type",
      options: [
        { label: "String", value: "string" },
        { label: "Number", value: "number" },
        { label: "Znumber", value: "znumber" },
        { label: "Email", value: "email" },
      ],
      placeholder: "Select masking type",
      defaultValue: "",
      dependsKey: "masking_tech",
      dependsValue: ["masking"]
    },
    {
      fieldName: "algorithm",
      inputType: "select",
      label: "Algorithm",
      options: [{ label: "AES", value: "AES" }],
      placeholder: "Select algorithm",
      defaultValue: "",
      dependsKey: "masking_tech",
      dependsValue: ["encrypt", "decrypt"]
    },
    {
      fieldName: "secret_key",
      inputType: "password",
      label: "Secret key",
      placeholder: "Enter secret key",
      defaultValue: "",
      dependsKey: "masking_tech",
      dependsValue: ["encrypt", "decrypt"]
    },
    {
      fieldName: "key_format",
      inputType: "select",
      label: "Key format",
      options: [
        { label: "hex", value: "Hex" },
        { label: "base64", value: "base64" },
      ],
      placeholder: "Select key format",
      defaultValue: "",
      dependsKey: "masking_tech",
      dependsValue: ["encrypt", "decrypt"]
    },
    {
      fieldName: "faker_type",
      inputType: "select",
      label: "Faker type",
      options: [
        { label: "First Name", value: "first_name" },
        { label: "Last Name", value: "last_name" },
        { label: "Name", value: "name" },
        { label: "Email", value: "email" },
        { label: "Phone Number", value: "phone_number" },
        { label: "URL", value: "url" },
        { label: "Mac Address", value: "mac_address" },
        { label: "IPv4", value: "ipv4" },
        { label: "IPv6", value: "ipv6" },
      ],
      placeholder: "Select faker type",
      defaultValue: "",
      dependsKey: "masking_tech",
      dependsValue: ["faker"]
    }
  ];

  return (
    <>
      <Form fields={fields} maskingForm={maskingData?.maskingForm}/>
    </>
  )
}