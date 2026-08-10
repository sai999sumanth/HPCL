import { RegisterOptions } from "react-hook-form";
export interface ParamsType {
  method: "get" | "post" | "put" | "delete";
  query: {
    q: string;
  };
  request_body: object;
  parameters: string;
}

export interface Options {
  label: string;
  value: string;
}

export interface DependsOnTypes{
  dependKeys: Array<string>,
  dependValues: Array<string>,
  condition: 'equal' | 'not_equal' | 'contains' 
}
export interface Validators{
    required?: boolean;
    min_length?: number;
    max_length?: number;
    min?: number;
    max?: number;
    email?: boolean;
    pattern?: any;
}
export interface FormElementTypes {
  name: string;
  label: string;
  type: string;
  placeholder: string;
  key: string;
  api: string;
  defaultValue: string | number | readonly string[] | undefined
  params: ParamsType;
  display_value: string;
  callback: boolean;
  dependsOn: boolean;
  ifDepends: DependsOnTypes; 
  validators: Validators;
  options: any;
  visible: boolean;
}
