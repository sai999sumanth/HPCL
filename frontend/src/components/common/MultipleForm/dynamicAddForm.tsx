import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from "../../../@/components/ui/button";
import { Input } from "../../../@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../@/components/ui/select";
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../redux/store';
import axios from 'axios';
import { apiClient } from '@/services/apiClient';

interface AddFormProps {
  edges: any;
  nodes: any;
  tableData: any;
  targetNodeData: any;
  filterGen: (formRows: any) => void;
  initialData: any;
}

// JSON configuration for the form
const formConfig = {
  fields: [
    {
      type: 'select',
      name: 'column_name',
      label: 'Column name',
      options: []
    },
    {
      type: 'select',
      name: 'condition',
      label: 'Condition',
      options: [
        { value: 'equals', label: 'Equals (=)' },
        { value: 'contains', label: 'Contains' },
        { value: 'startsWith', label: 'Starts with' }
      ]
    },
    {
      type: 'input',
      name: 'filter_value',
      label: 'Value',
      placeholder: 'Type string value'
    }
  ]
};


const DynamicFormField = ({ field, value, onChange, options }) => {

  const onOpenChange = (name, value) => {
    if (name === 'Source') {
      field.options = [{value: 'a', label: 'a'}, {value: 'b', label: 'b'}];
    } else if (field.label === 'Target') {
      field.options = [{value: 'c', label: 'c'}, {value: 'd', label: 'd'}];
    }
  }

  switch (field.type) {
    case 'select':
      return (
        <Select value={value} onOpenChange={() => onOpenChange(field.label, '')} onValueChange={(value) => onChange(field.name, value)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={field.label} />
          </SelectTrigger>
          <SelectContent>
            {options && options.length > 0 && options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'input':
      return (
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder={field.placeholder}
          className="w-[200px]"
        />
      );
    default:
      return null;
  }
};

const DynamicAddForm: React.FC<AddFormProps> = ({ nodes, edges, targetNodeData, filterGen, initialData }) => {
  // const [connectedNodes, setConnectedNodes] = useState<any[]>([]);
  const [columnOptions, setColumnOptions] = useState([]);
  const tableData = useSelector((state: RootState) => state.tabledata);
  const dropdownData = useSelector((state: RootState) => state.dropdown);
  const dispatch = useDispatch();
  let connectedNodes: any = useRef([]);

  let [formRows, setFormRows] = useState([
    formConfig.fields.reduce((acc, field) => ({ ...acc, [field.name]: '' }), {})
  ]);

  useEffect(() => {
    if (targetNodeData) {
      const findCurrentNode = nodes.filter(node => node['data'].label === targetNodeData.label);
      const connected = findCurrentNode.map(currentEdge => 
        edges.find(edge => edge.target === currentEdge.id)
      ).filter(Boolean);
      const findConnectedSource = connected.map(edge => 
        nodes.find(node => node.id === edge.source)
      );
      connectedNodes = findConnectedSource;
    } else {
      initialData ? initialData : null;
    }
  }, [targetNodeData, edges, nodes, connectedNodes]);

  useEffect(() => {
    // console.log("dropdownData", dropdownData);
    if (connectedNodes.length > 0) {
      connectedNodes.map( async node => {
        try {
          let params = {
            "name": "testing flow",
            "task_name": node.data.label
          };
          const response = await apiClient.post("/api/read_task_details", params);
          console.log('Config Fetched:', response.data);

          const options = Object.keys(response?.data?.data[node.data.label][0]).map(key => ({
            value: key,
            label: key
          }));
          setColumnOptions(options);
        } catch (error) {
          
        }
      })
    }
  }, [connectedNodes, tableData]);

  const handleAddRow = () => {
    setFormRows([...formRows, formConfig.fields.reduce((acc, field) => ({ ...acc, [field.name]: '' }), {})]);
  };

  const handleRemoveRow = (index) => {
    const newFormRows = [...formRows];
    newFormRows.splice(index, 1);
    setFormRows(newFormRows);
  };

  const handleFieldChange = (index, fieldName, value) => {
    const newFormRows = [...formRows];
    newFormRows[index][fieldName] = value;
    setFormRows(newFormRows);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formRows);
    filterGen(formRows);
    // Here you would typically send the data to an API or perform some action
  };

  return (
    <form onSubmit={handleSubmit} className="h-64 p-1 overflow-y-auto space-y-4">
      {formRows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex items-center space-x-2">   
          { (targetNodeData?.label.includes('Filter') || initialData?.label.includes('Filter')) && formConfig.fields.map((field) => (
            <DynamicFormField
              key={field.name}
              field={field}
              value={row[field.name]}
              onChange={(name, value) => handleFieldChange(rowIndex, name, value)}
              options={field.name === 'column_name' ? columnOptions : field.options}
            />
          ))}
          <Button type="button" className="p-1 h-6" variant="destructive" onClick={() => handleRemoveRow(rowIndex)}>
            <IconTrash size={16} stroke={1.5} />
          </Button>
        </div>
      ))}
      
      <div className="flex space-x-2">
        <Button type="button" onClick={handleAddRow} variant="outline">
          <IconPlus size={16} stroke={1.5} />
        </Button>
        <Button type="submit" variant="outline">Submit</Button>
      </div>
    </form>
  );
};

export default DynamicAddForm;
