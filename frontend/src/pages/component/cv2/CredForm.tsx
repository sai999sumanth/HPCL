
import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Input } from "../../../@/components/ui/input"
import { Label } from "../../../@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../@/components/ui/select"
import { Checkbox } from "../../../@/components/ui/checkbox"
import { Switch } from "../../../@/components/ui/switch"
import { Button } from "../../../@/components/ui/button"
import { toast } from 'sonner';
import { apiClient } from '@/services/apiClient';

const CredForm = ({ selectedOption, formSchema, onSubmit, initialData = {} }) => {
  const { control, handleSubmit, watch, reset } = useForm();

  const fieldMapping = {
    name: 'name',
    host: 'credentials.host',
    port: 'credentials.port',
    username: 'credentials.user_name',
    password: 'credentials.password',
    database: 'credentials.database_name',
    db_type: 'cred_type',
    is_active: 'credentials.is_active',
    is_ssh_tunnel: 'credentials.is_ssh_tunnel',
    'ssh_tunnel.host': 'credentials.ssh_tunnel.host',
    'ssh_tunnel.port': 'credentials.ssh_tunnel.port',
    'ssh_tunnel.user_name': 'credentials.ssh_tunnel.user_name',
    'ssh_tunnel.password': 'credentials.ssh_tunnel.password',
    'ssh_tunnel.private_key': 'credentials.ssh_tunnel.private_key',
  };

  useEffect(() => {
    const mappedData = {};
    Object.entries(fieldMapping).forEach(([formField, dataField]) => {
      const value = dataField.split('.').reduce((obj, key) => obj && obj[key], initialData);
      if (value !== undefined) {
        mappedData[formField] = value;
      }
    });
    reset(mappedData);
  }, [initialData, reset]);

  const uploadFile = async (file) => {
    try { 
      // Prepare FormData object
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post('/api/uploadSourceData', formData);
      const data = await response.data;
      console.log(data);
      if (data.status) {
        toast.success('File uploaded successfully');
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    }
  }

  if (!selectedOption || !formSchema) return null;

  const fields = formSchema[selectedOption.category]?.find(item => item[selectedOption.name])?.[selectedOption.name] || [];
  const isSSHTunnel = watch('is_ssh_tunnel');

  const renderField = (field) => {
    if (field.depends_on && field.depends_on.includes('is_ssh_tunnel') && !isSSHTunnel) {
      return null;
    }

    switch (field.type) {
      case 'text':
      case 'password':
      case 'number':
      case 'secret':
        return (
          <div key={field.name} className="grid w-full items-center gap-1.5">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Controller
              name={field.name}
              control={control}
              defaultValue=""
              render={({ field: { onChange, value } }) => (
                <Input 
                  type={field.type === 'secret' ? 'password' : field.type} 
                  onChange={onChange} 
                  value={value} 
                  placeholder={field.placeholder} 
                />
              )}
            />
          </div>
        );
      case 'select':
        return (
          <div key={field.name} className="grid w-full items-center gap-1.5">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Controller
              name={field.name}
              control={control}
              defaultValue=""
              render={({ field: { onChange, value } }) => (
                <Select onValueChange={onChange} value={value}>
                  <SelectTrigger>
                    <SelectValue placeholder={field.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        );
      case 'checkbox':
      case 'switch':
        return (
          <div key={field.name} className="flex items-center mt-7 mb-8 space-x-2">
            <Controller
              name={field.name}
              control={control}
              defaultValue={false}
              render={({ field: { onChange, value } }) => (
                field.type === 'checkbox' ? 
                  <Checkbox checked={value} onCheckedChange={onChange} id={field.name} /> :
                  <Switch checked={value} onCheckedChange={onChange} id={field.name} />
              )}
            />
            <Label htmlFor={field.name}>{field.label}</Label>
          </div>
        );
      case 'upload':
        return (
          <div key={field.name} className="grid w-full items-center gap-1.5">
            <Label htmlFor={field.name}>{field.label}</Label>
            <Controller
              name={field.name}
              control={control}
              defaultValue=""
              render={({ field: { onChange } }) => (
                <Input 
                  type="file" 
                  // onChange={(e) => onChange(e.target.files[0])}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    onChange(file);  // Update the form field with the file
                    if (file) {
                      uploadFile(file);  // Call API after selecting a file
                    }
                  }}
                  placeholder={field.placeholder} 
                  accept='.csv/.xlsx/.xls/.json/.txt' 
                />
              )}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const renderFields = () => {
    const mainFields = fields.filter(field => !field.depends_on || !field.depends_on.includes('is_ssh_tunnel'));
    const sshFields = fields.filter(field => field.depends_on && field.depends_on.includes('is_ssh_tunnel'));

    return (
      <>
        <div className="grid grid-cols-3 gap-4">
          {mainFields.map((field, index) => (
            <div key={field.name} className={index % 3 === 2 ? "col-span-1" : "col-span-1"}>
              {renderField(field)}
            </div>
          ))}
        </div>
        {isSSHTunnel && (
          <div className="mt-8">
            <div className="grid grid-cols-3 gap-4">
              {sshFields.map((field, index) => (
                <div key={field.name} className={index % 3 === 2 ? "col-span-1" : "col-span-1"}>
                  {renderField(field)}
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {renderFields()}
      <div className="flex justify-end mt-6" >
        <Button
          type="submit"
          className="bg-violet-500 hover:bg-violet-600 text-white"
        >
          {selectedOption.id ? "Update" : "Create"} Source
        </Button>
      </div>
    </form>
  );
};

export default CredForm;