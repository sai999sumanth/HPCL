import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Eye, Download, Edit, Database, ChevronUp, ChevronDown, Maximize2, Check, Copy } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import axios from 'axios';
import { Toaster,toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../../../@/components/ui/sheet";
import { Button } from "../../../@/components/ui/button";
import { Input } from "../../../@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../@/components/ui/select";
import { Textarea } from "../../../@/components/ui/textarea";
import { Skeleton } from "../../../@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from '../../../@/components/ui/card';
import { text } from 'stream/consumers';
import { apiClient } from '@/services/apiClient';


const fileTypes = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-excel': 'excel',
  'text/csv': 'csv',
  'text/plain': 'text'
};

const fileIcons = {
  excel: 'https://www.svgrepo.com/show/373589/excel.svg',
  csv: 'https://www.svgrepo.com/show/375309/csv-document.svg',
  xls: 'https://www.svgrepo.com/show/375311/excel-document.svg',
  txt: 'https://www.svgrepo.com/show/375297/txt-document.svg'
};


interface SourceConfig { 
  source_name: string;
  file_name: string;
  display_name: string;
    load_type: string;
  delimiter: string;
  connection_id: string;
    db_name: string;
  sheet_name: string;
  schema_name: string;
  comments: string;
  list_of_query: Array<any>; 
  filters: string;
  version_number: number;
  version_details: Record<string, any>;
  id?: number;
}

const MasterData = () => {
  const [files, setFiles] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeFile, setActiveFile] = useState(null);
  const [columnDefs, setColumnDefs] = useState([]);
  const [rowData, setRowData] = useState([]);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isQueryDialogOpen, setIsQueryDialogOpen] = useState(false);
  const skeletons = Array.from({ length: 20 });

  const [formData, setFormData] = useState<SourceConfig>({ 
    source_name: '',
    file_name: '',
    display_name: '',
    load_type: '',
    delimiter: '',
    connection_id:'',
    db_name: '',
    sheet_name:'',
    schema_name: '',
    comments:'',
    list_of_query:[],
    filters:'',
    version_number:0,
    version_details:{},
  });
  const [sheetNames, setSheetNames] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [loading,setLoading] = useState(true);

  useEffect(() => {
    fetchMasterData();
  }, []);

  const fetchMasterData = async () => {  
    try {         
      setLoading(true); 
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const response = await apiClient.get('/api/masterdata');
      setFiles(response.data.data);
      toast.success('Master Data fetched suceesfully'); 
      setLoading(false) ;
    } catch (error) {  
      console.error('Error fetching master data:', error);
      toast.error('Failed to fetch Master Data');
    }
  };

  const onDrop = async (acceptedFiles) => { //on drop for file dropping
    console.log(acceptedFiles);
    const file = acceptedFiles[0];
    if (!file) {
      toast.error('No file selected');
      return;
    } 
    setUploadedFile(file);
    try { 
      // Prepare FormData object
      const formData = new FormData();
      formData.append('file', file);
      if (isEditMode && editId) { 
        formData.append('unique_id', editId);
      }
      // Upload the file using fetch API

      const uploadResponse = await apiClient.post('/api/uploadMasterData', formData);

      const responseData = uploadResponse.data;
      if (responseData.status) { 
        toast.success('File uploaded successfully');  
         // Check if the file is an Excel file (based on file extension)
        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (fileExtension === 'xlsx' || fileExtension === 'xls') { 
          const sheetFormData = new FormData();
          sheetFormData.append('file', file);
          // Get sheet names by sending a request to another endpoint
          const sheetNameResponse = await apiClient.post('/api/getSheetName', sheetFormData);
          const sheetResponseData = sheetNameResponse.data;
          if (sheetResponseData.status) {            
            setSheetNames(sheetResponseData.data);
          } else {         
            toast.error('Failed to retrieve sheet names');
          }
        }
        // Set the form data
        setFormData((prevData) => ({ 
          ...prevData,
          file_name: file.name,
          load_type: fileTypes[file.type] || 'text',
        }));
        // Open the form dialog
        setIsFormDialogOpen(true);
      } else {
        toast.error('Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt']
    }
  });

  const handleInputChange = (e) => { 
    const { name, value } = e.target;
    setFormData(prevData => ({ ...prevData, [name]: value }));
  };

  const handleSubmit = async (e) => {  
    console.log('formData',formData);
    e.preventDefault();
    try {
      if (isEditMode) {    
        await apiClient.put(`/api/masterdata`, formData);
        toast.success('Master data updated successfully');
      } else { 
        await apiClient.post('/api/masterdata', formData);
        toast.success('Master data created successfully');
      }
      setIsFormDialogOpen(false);
      fetchMasterData();
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Failed to submit form');
    }
  };

  const handleQuerySubmit = async (e) => {
    setIsQueryDialogOpen(false);
  }

  const handleEdit = async (file) => { 
    setIsEditMode(true);
    setEditId(file.id);
    setFormData({ 
      id:file.id,
      source_name: file.source_name,
      file_name: file.file_name,
      display_name: file.display_name,
      load_type: file.load_type,
      delimiter: file.delimiter,
      sheet_name:file.sheet_name,
      filters: '',
      comments:file.comments,
      connection_id:'',
      db_name: '',
      schema_name: '',
      list_of_query:[],
      version_number:0,
      version_details:{}
    });
    setIsFormDialogOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await apiClient.delete(`/api/masterdata/${id}`);
      toast.success('File deleted successfully');
      fetchMasterData();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete file');
    }
  };

  const handleDownload = async (id: number) => {
    try {
      const response = await apiClient.post('/api/downloadMasterData', { id });
  
      if (!response.data || !response.data.data) {
        throw new Error('File path not found');
      }
  
      const filePath = response.data.data;
  
      const link = document.createElement('a');
      link.href = `https://react.datafusion.algofusiontech.com${filePath}`; 
      link.download = filePath.split('/').pop(); 
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  
      toast.success('File downloaded successfully');
      
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };
  

  const viewFile = async (file) => {

    try {      
      const response = await apiClient.post('/api/getMasterFileData', {
        id: file.id,
        previous_version: file.version_number 
      });

      if (response.data && response.data.status) {

        const fileData = response.data.data;
        const rowData = fileData.map(row => ({ ...row }));

        setActiveFile(file);
        setColumnDefs(Object.keys(rowData[0]).map(field => ({ field })));
        setRowData(rowData); 
        setIsOpen(true);
        toast.success('File data feteched Successfully')

      } else {
        throw new Error('Invalid response');
      }
    } catch (error) {
      console.error('Error viewing file:', error);
      toast.error('Failed to view file');
    }
  };

  const handleQuery = () => {
    setIsQueryDialogOpen(true);
  };

  const SkeletonCard = () => (
    <div className="bg-white rounded-lg shadow-md p-4 flex flex-col items-center" >
      <Skeleton className="w-16 h-16 rounded mb-2" />
      <Skeleton className="w-24 h-3 rounded mb-2" />
      <Skeleton className="w-32 h-3 rounded mb-4" />
      <div className="flex space-x-2" >
        <Skeleton className="w-5 h-5 rounded" />
        <Skeleton className="w-5 h-5 rounded" />
        <Skeleton className="w-5 h-5 rounded" />
        <Skeleton className="w-5 h-5 rounded" />
        <Skeleton className="w-5 h-5 rounded" />
      </div>
    </div>
  );

  const [expandedItems, setExpandedItems] = useState({});
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [copied, setCopied] = useState(false);

  // Sample data - replace with your actual queries
  const queries = [
    { 
      id: 1, 
      text: "SELECT * FROM very_long_table_name WHERE complex_condition = true AND another_condition IN (SELECT nested_value FROM another_table WHERE date BETWEEN '2024-01-01' AND '2024-12-31') GROUP BY category HAVING count(*) > 100 ORDER BY timestamp DESC" 
    },
  ];

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const openFullScreen = (query) => {
    setSelectedQuery(query);
    setIsFullScreen(true);
  };

  const copyToClipboard = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  return (
    <>
      <div className="bg-gray-100 p-6 ">
        <Toaster richColors position="top-right" />
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
        >
          <input {...getInputProps()} />
          {isDragActive ? (
            <p className="text-blue-500">Drop the files here ...</p>
          ) : (
            <p className="text-gray-500">
              Drag 'n' drop Excel, CSV, or text files here, or click to select
              files
            </p>
          )}
        </div>

        <div className="bg-gray-100 max-h-[420px] p-6 overflow-scroll ">
          {loading ? (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 ">
              {skeletons.map((_, index) => (
                <SkeletonCard key={index} />
              ))}{" "}
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 ">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="bg-white rounded-lg shadow-md p-4 flex flex-col items-center"
                >
                  <img
                    src={fileIcons[file.load_type]}
                    alt={file.load_type}
                    className="w-16 h-16 mb-2"
                  />
                  <p className="text-sm font-medium text-gray-900 truncate max-w-full">
                    {file.display_name}
                  </p>
                  <p className="text-xs text-gray-500">{file.file_name}</p>
                  <div className="mt-4 flex space-x-2">
                    <button
                      onClick={() => viewFile(file)}
                      className="text-violet-500 hover:text-blue-600"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDownload(file.id)}
                      className="text-violet-500 hover:text-blue-600"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleEdit(file)}
                      className="text-violet-500 hover:text-blue-600"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleQuery()}
                      className="text-violet-500 hover:text-blue-600"
                    >
                      <Database className="w-5 h-5" />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-violet-500 hover:text-red-500 hover:bg-red-100"
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently
                            delete the file.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(file.id)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetContent className="w-[90vw] sm:max-w-[900px] lg:max-w-[1200px] xl:max-w-[1400px] rounded-tl-3xl">
            <SheetHeader>
              <SheetTitle className="flex items-center">
                {activeFile && activeFile.file_name}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-6 h-[calc(100%-4rem)] overflow-x-auto">
              <div className="ag-theme-alpine w-full h-full">
                <AgGridReact
                  columnDefs={columnDefs}
                  rowData={rowData}
                  domLayout="normal"
                  headerHeight={40}
                  rowHeight={40}
                />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? "Edit Master Data" : "Create Master Data"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="file_name" className="text-right">
                    File Name
                  </label>
                  <Input
                    id="file_name"
                    name="file_name"
                    value={formData.file_name}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="display_name" className="text-right">
                    Display Name
                  </label>
                  <Input
                    id="display_name"
                    name="display_name"
                    value={formData.display_name}
                    onChange={handleInputChange}
                    className="col-span-3"
                  />
                </div>
                {isEditMode && (
                  <>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="display_name" className="text-right ">
                        Replace File
                      </label>
                      <Input
                        type="file"
                        className="col-span-3 "
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            onDrop([file]);
                          }
                        }}
                        accept=".xlsx,.xls,.csv,.txt"
                      />
                    </div>
                  </>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="source_name" className="text-right">
                    Source Name
                  </label>
                  <Input
                    id="source_name"
                    name="source_name"
                    value={formData.source_name}
                    onChange={handleInputChange}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="load_type" className="text-right">
                    Load Type
                  </label>
                  <Select
                    name="load_type"
                    value={formData.load_type}
                    onValueChange={(value) =>
                      setFormData((prevData) => ({
                        ...prevData,
                        load_type: value,
                      }))
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select load type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excel">Excel</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.load_type === "excel" && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="sheet_name" className="text-right">
                      Sheet Name
                    </label>
                    <Select
                      name="sheet_name"
                      value={formData.sheet_name}
                      onValueChange={(value) =>
                        setFormData((prevData) => ({
                          ...prevData,
                          sheet_name: value,
                        }))
                      }
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select sheet name" />
                      </SelectTrigger>
                      <SelectContent>
                        {sheetNames.map((sheetName) => (
                          <SelectItem key={sheetName} value={sheetName}>
                            {sheetName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(formData.load_type === "csv" ||
                  formData.load_type === "text") && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <label htmlFor="delimiter" className="text-right">
                      Delimiter
                    </label>
                    <Select
                      name="delimiter"
                      value={formData.delimiter}
                      onValueChange={(value) =>
                        setFormData((prevData) => ({
                          ...prevData,
                          delimiter: value,
                        }))
                      }
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select delimiter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="|">Pipe (|)</SelectItem>
                        <SelectItem value=",">Comma (,)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="comments" className="text-right">
                    Comments
                  </label>
                  <Textarea
                    id="comments"
                    name="comments"
                    onChange={handleInputChange}
                    className="col-span-3"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  className="bg-violet-500 hover:bg-violet-600"
                >
                  {isEditMode ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isQueryDialogOpen} onOpenChange={setIsQueryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connection Details</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleQuerySubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="db_type" className="text-right">
                    Database type
                  </label>
                  <Select
                    name="load_type"
                    value=""
                    onValueChange={(value) =>
                      setFormData((prevData) => ({
                        ...prevData,
                        db_type: value,
                      }))
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select a database type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="postgresql">PostgreSQl</SelectItem>
                      <SelectItem value="elasticSearch">
                        Elastic Search
                      </SelectItem>
                      <SelectItem value="redis">Redis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="connection" className="text-right">
                    Connection
                  </label>
                  <Select
                    name="connection"
                    onValueChange={(value) =>
                      setFormData((prevData) => ({
                        ...prevData,
                        connection: value,
                      }))
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select Connection" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="smartrecondev">
                        smartrecondev
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="database" className="text-right">
                    Database
                  </label>
                  <Select
                    name="database"
                    value=""
                    onValueChange={(value) =>
                      setFormData((prevData) => ({
                        ...prevData,
                        database: value,
                      }))
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select database" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">public</SelectItem>
                    </SelectContent>
                  </Select>{" "}
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <label htmlFor="schema" className="text-right" >
                    Schema
                  </label>
                  <Select
                    name="schema"
                    value=""
                    onValueChange={(value) =>
                      setFormData((prevData) => ({ 
                        ...prevData,
                        schema: value,
                      }))
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select schema" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excel">Employee details</SelectItem>
                      <SelectItem value="schema1">schema1</SelectItem>
                      <SelectItem value="schema2">schema2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  className="bg-violet-500 hover:bg-violet-600"
                >
                  Generate query
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* <Card className='mt-5'>
      <CardContent className="p-0">
        <div className="bg-white">
          <ul className="list-none p-0 m-0">
            <li className="flex items-center py-3 px-2 border rounded-lg border-gray-100 flex-wrap" >
              <div className="text-gray-900 w-full md:w-2/3">
                <code className="bg-gray-100 px-1 py-0.5 rounded">No Query Found</code>
              </div>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card> */}

      <Card className="mt-5">
        <CardContent className="p-0">
          <div className="bg-white">
            <ul className="list-none p-0 m-0">
              {queries.map((query) => (
                <li
                  key={query.id}
                  className="flex items-start py-3 px-2 border-t border-gray-200 flex-wrap"
                >
                  <div className="w-full">
                    <div className="flex items-center justify-between">
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => toggleExpand(query.id)}
                      >
                        <code
                          className={`bg-gray-100 px-2 py-1 rounded ${
                            !expandedItems[query.id] ? "line-clamp-1" : ""
                          }`}
                        >
                          {query.text}
                        </code>
                      </div>
                      <div className="flex items-center ml-2">
                        <button
                          onClick={() => copyToClipboard(selectedQuery?.text)}
                          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                          aria-label="Copy to clipboard"
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                        <button
                          onClick={() => openFullScreen(query)}
                          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                          aria-label="View Full Screen"
                        >
                          <Maximize2 className="h-4 w-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => toggleExpand(query.id)}
                          className="p-1 hover:bg-gray-100 rounded-full transition-colors ml-1"
                          aria-label={
                            expandedItems[query.id] ? "Collapse" : "Expand"
                          }
                        >
                          {expandedItems[query.id] ? (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isFullScreen} onOpenChange={setIsFullScreen}>
        <DialogContent className="max-w-[70vw] w-full max-h-[60vh] h-full">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center">
              Query Details
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto p-4">
            <pre className="bg-gray-100 p-4 rounded-lg whitespace-pre-wrap break-all" >
              <code>{selectedQuery?.text}</code>
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MasterData;