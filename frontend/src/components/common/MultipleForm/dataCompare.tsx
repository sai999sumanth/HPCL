import React, { useEffect, useState } from 'react';
import { Button } from "../../../@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../@/components/ui/select";
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../redux/store';
import MultipleSelector from '../../../@/components/ui/multi-select';
import { setEachFormValue } from '../../../redux/features/eachFormValue';

interface AddFormProps {
  edges: any;
  nodes: any;
  targetNodeData: any;
  filterGen: (formRows: any) => void;
}

const DynamicFormField = ({ field, value, onChange, options }) => {
  switch (field.type) {
    case 'select':
      return (
        <div className="flex flex-col">
          <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">{field.label}</label>
          <Select value={value} onValueChange={(newValue) => onChange(field.name, newValue)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options && options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case 'multi-select':
      return (
        <div className="flex flex-col">
          <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">{field.label}</label>
          <MultipleSelector
            className='w-[300px]'
            options={options}
            triggerSearchOnFocus
            onChange={(selected) => onChange(field.name, selected)}
            placeholder="Select columns..."
            maxSelected={3}
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

const DataCompare: React.FC<AddFormProps> = ({ nodes, edges, targetNodeData, filterGen }) => {
  const [formRows, setFormRows] = useState({
    left_key: '',
    right_key: '',
    validation_col: []
  });
  const dispatch = useDispatch();
  const dropdownData = useSelector((state: RootState) => state.dropdown);
  const reduxFormdata = useSelector((state: RootState) => state.formdata);

  const formConfigForDataCompare = {
    fields: [
      {
        type: 'select',
        name: 'left_key',
        label: 'Right key column',
        options: dropdownData[reduxFormdata[0]?.label]?.column_name || [],
        placeholder: 'Select right key column'
      },
      {
        type: 'select',
        name: 'right_key',
        label: 'Left key column',
        options: dropdownData[reduxFormdata[1]?.label]?.column_name || [],
        placeholder: 'Select left key column'
      },
      {
        type: 'multi-select',
        name: 'validation_col',
        label: 'Validation Column',
        options: dropdownData[reduxFormdata[0]?.label]?.column_name || [],
        placeholder: 'Select validation column'
      }
    ]
  };

  const handleFieldChange = (fieldName, value) => {
    setFormRows(prevState => ({ ...prevState, [fieldName]: value }));
    dispatch(setEachFormValue({label: targetNodeData?.label, key: fieldName, value: formRows}));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // console.log('Form submitted:', formRows);
    filterGen(formRows);
  };

  return (
    <form onSubmit={handleSubmit} className="h-64 p-1 overflow-y-auto space-y-4">
      <div className="flex items-center space-x-2">   
        {formConfigForDataCompare.fields.map((field) => (
          <DynamicFormField
            key={field.name}
            field={field}
            value={formRows[field.name]}
            onChange={handleFieldChange}
            options={field.options}
          />
        ))}
      </div>
      
      <div className="flex space-x-2">
        <Button type="button" variant="outline">Cancel</Button>
        <Button type="submit" variant="outline">Submit</Button>
      </div>
    </form>
  );
};

export default DataCompare;