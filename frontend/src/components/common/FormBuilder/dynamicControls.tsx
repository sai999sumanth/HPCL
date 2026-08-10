import React, { useState, useEffect } from "react";
import { Checkbox } from "../../../@/components/ui/checkbox";
import { Input } from "../../../@/components/ui/input";
import { Label } from "../../../@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "../../../@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../@/components/ui/select";
import { Switch } from "../../../@/components/ui/switch";
import axios from "axios";
import { Skeleton } from "../../../@/components/ui/skeleton";
import MultipleSelector, {
  Option,
} from "../../../@/components/ui/multi-select";

// Import Redux actions
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../../redux/store";
import { fetchDropdownData } from "../../../redux/features/dropdownSlice";
import { setEachFormValue } from "../../../redux/features/eachFormValue";
import { apiClient } from "@/services/apiClient";
interface FormField {
  name: string;
  label: string;
  type: "text" | "select" | "radio" | "checkbox" | "switch" | "multi-select";
  placeholder?: string;
  key: string;
  api: string;
  required_keys?: string[];
  params: {
    method: string;
    query: Record<string, string>;
    request_body: {
      name: string;
      action: string;
      params: {
        creds: Record<string, unknown>;
        data: {
          connection_name: string;
          schema_name: string;
        };
      };
    };
    parameters: string;
  };
  display_value: string;
  callback?: boolean;
  validators: {
    required: boolean;
  };
  options: {
    value: string;
    label: string;
    display_name?: string;
    id?: string;
  }[];
  visible: boolean;
  depends_on?: string[];
  ifDepends?: {
    dependKeys: string[];
    dependValues: string[];
    condition: "equal" | "notEqual";
  };
  maxSelected?: number;
}

interface DynamicFormProps {
  children: FormField[];
  onFormDataChange?: (formData: any) => void;
  initialData?: any;
  formValues?: any;
}

const DynamicForm: React.FC<DynamicFormProps> = ({
  children,
  onFormDataChange,
  initialData,
  formValues,
}: any) => {
  const [formData, setFormData] = useState<any>(initialData);
  const [formValuesData, setFormValuesData] = useState<any>({});
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [loadingFields, setLoadingFields] = useState<Record<string, boolean>>({});

  const dispatch = useDispatch();
  const dropdownData = useSelector((state: RootState) => state.dropdown);
  const reduxFormdata = useSelector((state: RootState) => state.formdata);
  const sourceNode: any = useSelector((state: RootState) => state.connection.sourceNode);
  const fetchNodeFromApi = useSelector((state: RootState) => state.fetchNodeFromApi);

  useEffect(() => {
    // console.log("formValues", formValues);
    // console.log("reduxData from dynamic", reduxFormdata);
    // console.log("fetchNodeFromApi", fetchNodeFromApi);
    // Fetch form fields from the provided JSON data
    if (reduxFormdata.length > 0) {
      reduxFormdata.forEach((node) => {
        if (node.label === initialData?.label) {
          setFormFields(node.formValues ? node.formData['parameters'] : children);
        } else {
          setFormFields(children);
        }
      });
    } else {
      setFormFields(children);
    }
  }, [reduxFormdata, children, initialData]);

  useEffect(() => {
    // Set the initial form data
    // console.log("initialData", initialData);
    setFormData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (onFormDataChange) {
      onFormDataChange(formData);
    }
  }, [formData, onFormDataChange]);

  useEffect(() => {
    if(initialData?.formValues && Object.keys(initialData?.formValues).length > 0) {
      let fFields = formFields.length > 0 ? formFields : initialData.formData.parameters;
      
      fFields && fFields.length > 0 ? fFields.forEach((field) => {
        if (field.type === 'select' || field.type === 'multi-select') {
          fetchApiDataForField(field, initialData.formValues[field.key]);
        }
      }) : []; 
    } else {
      // setFormFields([]);
      setFormFields(initialData.formData.parameters);
    }
  }, [formValues]);

  const handleFieldChange = (field: FormField, value: any) => {
    // const updatedFormData = { ...formData, [field.key]: value };
    const updatedFormValues = { ...formValuesData, [field.key]: value };
    setFormValuesData(updatedFormValues);
    // setFormData(updatedFormData);
    onFormDataChange(updatedFormValues);
    dispatch(setEachFormValue({label: formData?.label, key: field.key, value: value}));

    // Handle dependent fields
    formFields.forEach((dependentField) => {
      if (dependentField.depends_on?.includes(field.key)) {
        fetchApiDataForField(dependentField, updatedFormValues);
      }
    });
  };

  function checkAndMakeApiCall(data: Record<string, any>) {
    // Check all keys inside the data object
    const isValid = Object.values(data).every(value => {
      // Check if the value is a string, and if so, ensure it's not empty or whitespace
      return typeof value === 'string' ? value.trim() !== '' : value !== undefined && value !== null;
    });
  
    if (isValid) {
      // Proceed with the API call
      return true;
    } else {
      // console.log("All fields inside the 'data' object must be filled.");
    }
  }

  const fetchApiDataForField = async (field: FormField, currentFormData: any) => {
    if (!field.api) return;
    // console.log("fetching api data for currentFormData", currentFormData);
    setLoadingFields((prev) => ({ ...prev, [field.key]: true }));
    try {
      let apiParams = field.params;
      // Update request params for dependent fields
      if (field.depends_on && field.depends_on.length > 0) {
        apiParams = {
          ...apiParams,
          request_body: {
            ...apiParams.request_body,
            params: {
              ...apiParams?.request_body?.params,
              data: {
                ...apiParams?.request_body?.params?.data,
                ...Object.keys(apiParams?.request_body?.params?.data)
                .reduce((acc, key) => ({
                  ...acc,
                  [key]: initialData?.formValues?.[key] ? initialData?.formValues[key] : currentFormData[key] // currentFormData[key] ? currentFormData[key],
                }), {}),
              },
            },
          },
        };
      }

      // 
      if(!checkAndMakeApiCall(apiParams?.request_body?.params?.data ? apiParams?.request_body?.params?.data : {})) return;

      let params = new URLSearchParams(Object.keys(apiParams?.query).length > 0 ? apiParams.query : {
        name: apiParams.request_body.name,
        action: apiParams.request_body.action,
        model: initialData?.formData?.section
      });

      const response = await apiClient.post(`/api${field.api}`, {
        params: params,
        data: apiParams?.request_body?.params,
      });

      const fetchedOptions = response.data?.["data"].map((item: any) => ({
        value: item?.id || item?.name || item ,
        label: item[field.display_value] || item?.name || item,
      }));

      // Dispatch action to store data in Redux
      dispatch(fetchDropdownData({
        label: initialData?.label, 
        key: field.key, 
        data: fetchedOptions 
      }));

      updateFieldOptions(field, fetchedOptions);
    } catch (error) {
      // console.error(`Error fetching data for field ${field.label}:`, error);
    } finally {
      setLoadingFields((prev) => ({ ...prev, [field.key]: false }));
    }
  };

  const updateFieldOptions = (field: FormField, options: any[]) => {
    setFormFields((prevFields) =>
      prevFields.map((f) =>
        f.key === field.key ? { ...f, options } : f
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission
    // Validate form data and perform any necessary actions
    const invalidFields = formFields.filter((field) => {
      return (
        field.validators.required &&
        (!formData[field.key] ||
          (Array.isArray(formData[field.key]) &&
            formData[field.key].length === 0))
      );
    });

    if (invalidFields.length > 0) {
      // setAlertMessage(
      //   `Please fill in the following required fields: ${invalidFields
      //     .map((f) => f.label)
      //     .join(", ")}`
      // );
      // setShowAlert(true);
    } else {
      // console.log("Form data:", formData);
      // Perform further actions with the form data
    } 
  };

  const renderField = (field: FormField) => {
    if (!field.visible) return null;
    const isLoading = loadingFields[field.key] && field.options && field.options.length === 0;

    const fieldValue = formValuesData[field.key] || formData?.formValues?.[field.key] || "";
    // const fieldOptions = dropdownData[field.key] || field.options;
    const fieldOptions = dropdownData[formData.label]?.[field.key]?.length > 0 ? dropdownData[formData.label]?.[field.key] : field.options;

    switch (field.type) {
      case "text":
        return (
          <div className="mb-4">
            <Label htmlFor={field.key}>{field.label}</Label>
            <Input
              id={field.key}
              placeholder={field.placeholder}
              value={fieldValue}
              onChange={(e) => handleFieldChange(field, e.target.value)}
            />
          </div>
        );
      case "select":
        return (
          <div className="mb-4">
            <Label htmlFor={field.key}>{field.label}</Label>
            <Select
              value={fieldValue}
              onOpenChange={() => {
                if (fieldOptions.length === 0) {
                  fetchApiDataForField(field, formData);
                }
              }}
              onValueChange={(value) => handleFieldChange(field, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {isLoading
                  ? Array.from({ length: 3 }).map((_, index) => (
                      <SelectItem key={`loading-${index}`} value={`loading-${index}`}>
                        <Skeleton className="h-4 w-[300px]" />
                      </SelectItem>
                    ))
                  : fieldOptions && fieldOptions.map((option, index) => (
                      <SelectItem
                        key={`${option?.value || option?.id || index}`}
                        value={
                          typeof option?.value === "number"
                            ? JSON.stringify(option?.value)
                            : option?.value || option?.id || `option-${index}`
                        }
                      >
                        {option?.label || option?.display_name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
        );
      case "radio":
        return (
          <div className="mb-4">
            <Label>{field.label}</Label>
            <RadioGroup
              onValueChange={(value) => handleFieldChange(field, value)}
            >
              {field.options.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={option.value}
                    id={`${field.key}-${option.value}`}
                  />
                  <Label htmlFor={`${field.key}-${option.value}`}>
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
      case "checkbox":
        return (
          <div className="mb-4">
            <Checkbox
              checked={formData[field.key] || false}
              onCheckedChange={(e) => handleFieldChange(field, e)}
              id={field.key}
            >
              {field.label}
            </Checkbox>
            <label
              htmlFor={field.key}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Accept terms and conditions
            </label>
          </div>
        );
      case "switch":
        return (
          <div className="mb-4">
            <Label htmlFor={field.key}>{field.label}</Label>
            <Switch
              id={field.key}
              checked={formData[field.key] || false}
              onCheckedChange={(checked) => handleFieldChange(field, checked)}
            />
          </div>
        );
      case "multi-select":
        return (
          <div className="mb-4">
            <Label htmlFor={field.key}>{field.label}</Label>
            <MultipleSelector
              value={Array.isArray(fieldValue) ? fieldValue : []}
              options={fieldOptions}
              onSearch={async (value: string): Promise<Option[]> => {
                if (fieldOptions.length === 0) {
                  await fetchApiDataForField(field, formData);
                }
                const options = dropdownData[formData.label]?.[field.key] || [];
                return options.filter((option: Option) => 
                  option.label.toLowerCase().includes(value.toLowerCase())
                );
              }}
              triggerSearchOnFocus
              // maxSelected={field.maxSelected || 3}
              onChange={(selected) => handleFieldChange(field, selected)}
              placeholder={field.placeholder || "Select options..."}
              emptyIndicator={
                <p className="text-center text-lg leading-10 text-gray-600 dark:text-gray-400">
                  no results found.
                </p>
              }
            />
          </div>
        );
      default:
        return null;
    }
  };

  const renderFieldsInGrid = () => {
    return (
      <div className="grid grid-cols-2 gap-4">
        {formFields?.map((field, index) => (
          <div key={`${field.key}-${index}`} className={index % 2 === 0 && index === formFields.length - 1 ? "col-span-2" : ""}>
            {renderField(field)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-1">
      <form onSubmit={handleSubmit}>
        {renderFieldsInGrid()}
      </form>
    </div>
  );
};

export default DynamicForm;