import React, { useEffect, useState, useCallback } from 'react';
import { Button } from "../../../@/components/ui/button";
import { Input } from "../../../@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../@/components/ui/select";
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../redux/store';
import { setSourceColumn } from '../../../redux/features/connectionSlice';
import { setEachFormValue } from '../../../redux/features/eachFormValue';
import { Card, CardContent } from '../../../@/components/ui/card';
import { GripVertical, Plus, Save, Trash2, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../@/components/ui/tabs';

interface AddFormProps {
  edges: any;
  nodes: any;
  tableData: any;
  targetNodeData: any;
  filterGen: (formRows: any) => void;
}

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

const CustomFilters = () => {
  const [filters, setFilters] = useState([
    { id: 1, column: '', condition: '', value: '', operator: 'AND' }
  ]);

  const columnOptions = [
    { value: 'date', label: 'Date' },
    { value: 'status', label: 'Status' },
    { value: 'amount', label: 'Amount' },
    { value: 'category', label: 'Category' }
  ];

  const conditionOptions = [
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' }
  ];

  const operatorOptions = [
    { value: 'AND', label: 'AND' },
    { value: 'OR', label: 'OR' }
  ];

  const addFilter = () => {
    const newFilter = {
      id: filters.length + 1,
      column: '',
      condition: '',
      value: '',
      operator: 'AND'
    };
    setFilters([...filters, newFilter]);
  };

  const removeFilter = (id) => {
    if (filters.length > 1) {
      setFilters(filters.filter(filter => filter.id !== id));
    }
  };

  const updateFilter = (id, field, value) => {
    setFilters(filters.map(filter => 
      filter.id === id ? { ...filter, [field]: value } : filter
    ));
  };

  const handleSave = () => {
    // Here you can implement the save logic
    console.log('Saving filters:', filters);
  };

  return (
    <Card className="w-full max-w-6xl p-4">
      <CardContent className="p-0">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium">Custom Filters</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={addFilter}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Filter
              </Button>
            </div>
            <Button 
              variant="default"
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="w-4 h-4 mr-1" />
              Save Filters
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {filters.map((filter, index) => (
              <div key={filter.id} className="flex items-center gap-2 w-full">
                <Select
                  value={filter.column}
                  onValueChange={(value) => updateFilter(filter.id, 'column', value)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Select Column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columnOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filter.condition}
                  onValueChange={(value) => updateFilter(filter.id, 'condition', value)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Condition" />
                  </SelectTrigger>
                  <SelectContent>
                    {conditionOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  placeholder="Value"
                  className="w-36"
                  value={filter.value}
                  onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                />

                {/* {index < filters.length - 1 && ( */}
                  <Select
                    value={filter.operator}
                    onValueChange={(value) => updateFilter(filter.id, 'operator', value)}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue placeholder="Operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {operatorOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                {/* )} */}

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFilter(filter.id)}
                  className="text-red-500 hover:text-red-700"
                  disabled={filters.length === 1}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const CustomVlookup: React.FC<AddFormProps> = ({ nodes, edges, targetNodeData, filterGen }) => {
  const [connectedNodes, setConnectedNodes] = useState<any[]>([]);
  const [columnOptions, setColumnOptions] = useState([]);
  const tableData = useSelector((state: RootState) => state.tabledata);
  const [selectedSource, setSelectedSource] = useState<any>({});
  const [selectedTarget, setSelectedTarget] = useState<any>({});
  const dispatch = useDispatch();

  const sourceNode: any = useSelector((state: RootState) => state.connection.sourceNode);
  const dropdownData = useSelector((state: RootState) => state.dropdown);
  const reduxFormdata = useSelector((state: RootState) => state.formdata);

  // let options = reduxFormdata.map(node => {
  //   return options.push({ value: node?.formValues?.source, label: node?.formValues?.source });
  // })

  // console.log("reduxFormdata", reduxFormdata);
  // console.log("dropdownData", dropdownData);
  // console.log("sourceNode", sourceNode);
  // JSON configuration for the form
  const formConfigForVlookup = {
    fields: [
      {
        type: 'select',
        name: 'source',
        label: 'Source',
        options: reduxFormdata.map(node => ({ value: node.formValues.source, label: node.formValues.source }))
      },
      {
        type: 'select',
        name: 'target',
        label: 'Target',
        options: reduxFormdata.map(node => ({ value: node.formValues.source, label: node.formValues.source }))
      },
      {
        type: 'select',
        name: 'dataFields',
        label: 'Source Column',
        options: dropdownData[selectedSource?.label]?.column_name,
        placeholder: 'Select source column'
      },
      {
        type: 'select',
        name: 'lookupFields',
        label: 'Target Column',
        options: dropdownData[selectedTarget?.label]?.column_name,
        placeholder: 'Select target column'
      }
    ]
  };

  let [formRows, setFormRows] = useState([
    formConfigForVlookup.fields.reduce((acc, field) => ({ ...acc, [field.name]: '' }), {})
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
      setConnectedNodes(findConnectedSource);
    }
  }, [targetNodeData, edges, nodes]);

  useEffect(() => {
    if (connectedNodes.length > 0 && tableData[connectedNodes[0].data.label]) {
      const options = Object.keys(tableData[connectedNodes[0].data.label][0]).map(key => ({
        value: key,
        label: key
      }));
      setColumnOptions(options);
    }
  }, [connectedNodes, tableData]);

  const handleAddRow = () => {
    setFormRows([...formRows, formConfigForVlookup.fields.reduce((acc, field) => ({ ...acc, [field.name]: '' }), {})]);
  };

  const handleRemoveRow = (index) => {
    const newFormRows = [...formRows];
    newFormRows.splice(index, 1);
    setFormRows(newFormRows);
  };

  const handleFieldChange = (index, fieldName, value) => {
    if(fieldName === 'source') {
      let opt = reduxFormdata.filter(node => (value === node?.formValues?.source))
      setSelectedSource(opt[0]);
      dispatch(setSourceColumn(value));
    } else if(fieldName === 'target') {
      let opt = reduxFormdata.filter(node => (value === node?.formValues?.source))
      setSelectedTarget(opt[0]);
    }
    const newFormRows = [...formRows];
    newFormRows[index][fieldName] = value;
    setFormRows(newFormRows);
    setTimeout(() => {
      dispatch(setEachFormValue({label: targetNodeData?.label, key: fieldName, value: value}));
    }, 100);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formRows);
    filterGen(formRows);
    // Here you would typically send the data to an API or perform some action
  };

  return (
    <>
      <Tabs defaultValue="normal" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="normal">Normal Lookup</TabsTrigger>
          <TabsTrigger value="advanced">Advanced Lookup</TabsTrigger>
        </TabsList>
        <TabsContent value="normal">
          <form
            onSubmit={handleSubmit}
            className="h-64 p-1 overflow-y-auto space-y-4"
          >
            {formRows.map((row, rowIndex) => (
              <div key={rowIndex} className="flex items-center space-x-2">
                {formConfigForVlookup.fields.map((field) => (
                  <DynamicFormField
                    key={field.name}
                    field={field}
                    value={row[field.name]}
                    onChange={(name, value) =>
                      handleFieldChange(rowIndex, name, value)
                    }
                    options={
                      field.name === "Source Column"
                        ? columnOptions
                        : field.options
                    }
                  />
                ))}
                <Button
                  type="button"
                  className="p-1 h-6"
                  variant="destructive"
                  onClick={() => handleRemoveRow(rowIndex)}
                >
                  <IconTrash size={16} stroke={1.5} />
                </Button>
              </div>
            ))}

            <div className="flex space-x-2">
              <Button type="button" onClick={handleAddRow} variant="outline">
                <IconPlus size={16} stroke={1.5} />
              </Button>
              <Button type="submit" variant="outline">
                Submit
              </Button>
            </div>
          </form>
        </TabsContent>
        <TabsContent value="advanced">
          <CustomFilters />
        </TabsContent>
      </Tabs>
    </>
  );
};

export default CustomVlookup;
