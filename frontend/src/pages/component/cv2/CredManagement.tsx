import React, { useState, useEffect } from 'react';
import { getLoadCreds, getAllCredentials, deleteCredential, createCredential, updateCredential, getCredential } from './api';
import { Button } from "../../../@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "../../../@/components/ui/card"
import CredForm from './CredForm';
import CredTable from './CredTable';
import { Toaster,toast } from 'sonner';
import images from './images';
import { Skeleton } from "../../../@/components/ui/skeleton";


const CredManagement = () => {
  
  const [formSchema, setFormSchema] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingCredential, setEditingCredential] = useState(null);

  const fetchCredentials = async () => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 3500));
      const credsData = await getAllCredentials();
      setCredentials(credsData.data || []);
      toast.success("Credentials loaded successfully.")
    } catch (error) {
      console.error('Error fetching credentials:', error);
      toast.error("Failed to load credentials. Please try again.")
    }
  };

  useEffect(() => {
    const fetchData = async () => { 
      setLoading(true);
      try {
        await new Promise((resolve) => setTimeout(resolve, 3500));
        const [schemaData, credsData] = await Promise.all([
          getLoadCreds(),
          getAllCredentials()
        ]);
        toast.success('Creds Loaded Successfully');
        setFormSchema(schemaData.data[0]);
        setCredentials(credsData.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load data. Please try again.');
        toast.error("Failed to load data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleAdd = () => {
    setShowForm(true);
    setSelectedOption({category:"Notification",name:"Email"});
    setEditingCredential(null);
  };

  const handleEdit = async (credential) => {  
    setShowForm(true);
    setSelectedOption({
      category: credential.cred_model,
      name: credential.cred_type,
      id: credential.id
    });
    try {
      const credentialDetails = await getCredential(credential.id);
      console.log("Credential details from API:", credentialDetails);
      setEditingCredential(credentialDetails);
    } catch (error) {
      console.error('Error fetching credential details:', error);
      toast.error('Failed to fetch credential details. Please try again.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteCredential(id);
      await fetchCredentials();
      toast.success("Credential deleted successfully.");
    } catch (error) {
      console.error('Error deleting credential:', error);
      toast.success("Failed to delete credential. Please try again.");
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedOption(null);
    setEditingCredential(null);
  };

  const handleFormSubmit = async (formData) => {
    console.log("formdata",formData);
    try {
      let response;
      if (selectedOption?.id) {
        const updateData = {
          record_id: 0,
          name: formData.name,
          cred_model: selectedOption.category,
        //cred_type: selectedOption.name.toLowerCase().replace(/\s/g, ''),
        cred_type: selectedOption.name,
        tags: [],
          organization_id: 1,
          connection_id: editingCredential.id,
          credentials: {
            host: formData.host,
            port: formData.port,
            access_key: "",
            secret_key: "string",
            user_name: formData.username,
            password: formData.password,
            fingerprint: "",
            tenancy: "",
            key_file: "",
            key_content: "",
            client_id: "",
            client_secret: "string",
            tenant_id: "",
            private_pass: "string",
            private_key_pass: "string",
            source_path: formData.source_path || "",
            dest_path: formData.destination_path || "",
            api_key: "string",
            database_name: formData.database || "",
            region: "",
            security_token: formData.security_token || "",
            dns: "",
            sid: formData.sid,
            service_name: formData.service_name,
            is_ssh_tunnel: formData.is_ssh_tunnel,
            ssh_tunnel: formData.ssh_tunnel ? { 
              host: formData.ssh_tunnel.host, 
              port: formData.ssh_tunnel.port, 
              password: formData.ssh_tunnel.password, 
              user_name: formData.ssh_tunnel.user_name, 
              private_key: "", 
            } : {},            
            other_details: {},
          },
        };
        response = await updateCredential(updateData);
      } else {
        const createData = {
          record_id: 0,
          name: formData.name,
          cred_model: selectedOption.category,
        //cred_type: selectedOption.name.toLowerCase().replace(/\s/g, ''),
          cred_type: selectedOption.name,
          tags: [],
          organization_id: 1,
          credentials: {
            host: formData.host,
            port: formData.port,
            access_key: "",
            secret_key: "string",
            user_name: formData.username,
            password: formData.password,
            fingerprint: "",
            tenancy: "",
            key_file: "",
            key_content: "",
            client_id: "",
            client_secret: "string",
            tenant_id: "",
            private_pass: "string",
            private_key_pass: "string",
            source_path: formData.source_path || "",
            dest_path: formData.destination_path || "",
            api_key: "string",
            database_name: formData.database || "",
            region: "",
            security_token: formData.security_token || "",
            dns: "",
            sid: formData.sid,
            service_name: formData.service_name,
            is_ssh_tunnel: formData.is_ssh_tunnel,
            ssh_tunnel: formData.ssh_tunnel ? { 
              host: formData.ssh_tunnel.host, 
              port: formData.ssh_tunnel.port, 
              password: formData.ssh_tunnel.password, 
              user_name: formData.ssh_tunnel.user_name, 
              private_key: "", 
            } : {},            
            other_details: {},
          },
        };
        response = await createCredential(createData);
      }
      setCredentials((prevCreds) => {
        const index = prevCreds.findIndex((cred) => cred.id === response.id);
        if (index !== -1) {
          return [
            ...prevCreds.slice(0, index),
            response,
            ...prevCreds.slice(index + 1),
          ];
        } else {
          return [...prevCreds, response];
        }
      });
      await fetchCredentials();
      setShowForm(false);
      setEditingCredential(null);

      toast.success(`Credential ${
        selectedOption?.id ? "updated" : "created"
      } successfully.`);
    } catch (error) {
      console.error("Error submitting credential:", error);
      toast.error(`Failed to ${
        selectedOption?.id ? "update" : "create"
      } credential. Please try again.`);
    }
  };

  if (loading) return <div>      
    <Skeleton className="h-10 mt-5 ml-5 w-32" />
    <div className=" rounded-lg overflow-hidden">
      <div className='mt-5'>
        <div className="grid grid-cols-5 gap-4 px-4 py-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
        <div className="bg-white">
        {[...Array(5)].map((_, index) => (
          <div 
            key={index}
            className="grid grid-cols-5 gap-4 px-4 py-3"
          >
            <Skeleton className="h-4 w-28"/>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
            <div className="flex space-x-2 ml-3">
              <Skeleton className="h-3 w-3 rounded-md" /> 
              <Skeleton className="h-3 w-3 rounded-md" /> 
              <Skeleton className="h-3 w-3 rounded-md" /> 

            </div>
          </div>
        ))}
      </div>
    </div>
  </div>

  if (error) return <div>No Data</div>;

  const getIconForCredType = (credType: string) => {
    if (images[credType]) {
      return images[credType];
    }
    const iconKey = `${credType}-icon`;
    return images[iconKey] || null;
  };

  const renderSidebar = () => {
    if (!formSchema) return null;

    return Object.entries(formSchema).map(([category, categoryData]: any) => (
      <div key={category} className="mb-4">
        <h3 className="text-lg font-semibold mb-2 capitalize">{category}</h3>
        {categoryData.map((item, index) =>
          Object.keys(item).map((option) => (
            <Button
              key={`${category}-${option}-${index}`}
              variant={selectedOption?.name === option ? "default" : "ghost"}
              className={`w-full justify-start text-left mb-1 ${
                selectedOption?.name === option
                  ? "bg-violet-600 text-violet-100 hover:bg-violet-600"
                  : "text-gray-700 hover:text-violet-500"
              }`}
              onClick={() => setSelectedOption({ category, name: option })}
            >
              <img
                src={getIconForCredType(option)}
                alt={option}
                className="w-6 h-6 mr-2"
              />
              {option}
            </Button>
          ))
        )}
      </div>
    ));
  };

  return (
    <>
      <Toaster richColors position="top-right" />

      <div className="bg-white min-h-screen">
        {!showForm ? (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <Button
                onClick={handleAdd}
                className="bg-violet-500 hover:bg-violet-800"
              >
                + Add Source
              </Button>
            </div>
            <CredTable
              credentials={credentials}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </div>
        ) : (
          <div className="flex h-screen">
            <div className="w-1/5 bg-white border-r border-gray-200 p-4 overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">Sources</h2>
              {renderSidebar()}
            </div>
            <div className="w-4/5 p-2 pt-0 overflow-y-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>
                      {selectedOption
                        ? `${selectedOption.name} Configuration`
                        : "Create Source"}
                    </span>
                    <Button onClick={handleFormClose} variant="outline">
                      ← Back
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {formSchema && selectedOption && (
                    <CredForm
                      key={selectedOption.id}
                      selectedOption={selectedOption}
                      formSchema={formSchema}
                      onSubmit={handleFormSubmit}
                      initialData={editingCredential || {}}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CredManagement;