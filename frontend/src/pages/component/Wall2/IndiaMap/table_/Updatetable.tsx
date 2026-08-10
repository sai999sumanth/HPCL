import React from 'react';
import { Search, X, Save, Trash2, Plus, RefreshCw, Download } from 'lucide-react';
import axios from 'axios';
import { apiClient } from '@/services/apiClient';
import { toast } from 'sonner';

// Define base interface with common fields
interface BaseFormData {
  unique_id: string;
  sap_id: string;
  sbu: string;
  zone: string;
  state: string;
  district: string;
  city: string;
  address: string;
  region: string;
  company: string;
  location_name: string;
  name: string;
  latitude: number;
  longitude: number;
  filename: string;
  updated_by: string;
  [key: string]: string | number; // Index signature for dynamic access
}

// Extend base interface for each data type
interface SODFormData extends BaseFormData {
  type: string;
  region_ppac: string;
  ms: number;
  sko: number;
  hsd: number;
  total: number;
  mode_of_receipt: string;
}

interface LubesFormData extends BaseFormData {
  base_oil_tankages: number;
  landline: string;
  status: string;
}

interface AviationFormData extends BaseFormData {
  operation_status: string;
  tankage: number;
  mode: string;
  pincode: string;
  status: string;
}

interface LPGFormData extends BaseFormData {
  installed_bottling_capacity: number;
  operating_bottling_capacity: number;
  ccoe_tankage: number;
  time_of_commissioning: string;
  mode: string;
  supply: string;
}

// Union type for all form data
type FormData = SODFormData | LubesFormData | AviationFormData | LPGFormData;

interface UpdateDataTableProps {
  showUpdateDialog: boolean;
  setShowUpdateDialog: (val: boolean) => void;
  filteredUpdateData: any[];
  updateTableData: any[];
  setUpdateTableData: React.Dispatch<React.SetStateAction<any[]>>;
  updateSearchTerm: string;
  setUpdateSearchTerm: (term: string) => void;
  isLoadingUpdate: boolean;
  editingRowId: string | null;
  setEditingRowId: (id: string | null) => void;
  editedRow: Record<string, any>;
  setEditedRow: (row: Record<string, any>) => void;
  handleEditClick: (row: any) => void;
  handleEditInputChange: (key: string, value: string) => void;
  handleSaveEdit: () => void;
  handleCancelEdit: () => void;
  handleBulkDelete: () => void;
  handleAddNewRecord: () => void;
  handleRefresh?: () => void;
  selectedSbu: any;
  dataType?: 'sod' | 'lubes' | 'aviation' | 'lpg';
}

const UpdateDataTable: React.FC<UpdateDataTableProps> = ({
  showUpdateDialog,
  setShowUpdateDialog,
  filteredUpdateData,
  updateTableData,
  setUpdateTableData,
  updateSearchTerm,
  setUpdateSearchTerm,
  isLoadingUpdate,
  editingRowId,
  setEditingRowId,
  editedRow,
  setEditedRow,
  handleEditClick,
  handleEditInputChange,
  handleSaveEdit,
  handleCancelEdit,
  handleBulkDelete,
  handleAddNewRecord,
  handleRefresh,
  selectedSbu,
  dataType,
}) => {
  if (!showUpdateDialog) return null;

  const [showAddForm, setShowAddForm] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);

  // Determine dataType from selectedSbu if not provided
  const getDataTypeFromSbu = (sbu: string): 'sod' | 'lubes' | 'aviation' | 'lpg' => {
    if (!sbu) return 'sod'; // fallback

    const sbuLower = sbu.toLowerCase();
    switch (sbuLower) {
      case 'lpg':
        return 'lpg';
      case 'lubes':
        return 'lubes';
      case 'aviation':
        return 'aviation';
      case 'sod':
      default:
        return 'sod';
    }
  };

  // Use dataType prop if provided, otherwise derive from selectedSbu
  const effectiveDataType = dataType || getDataTypeFromSbu(selectedSbu);

  // Dynamic form structures based on data type
  const getInitialFormData = (): FormData => {
    const baseFields: BaseFormData = {
      unique_id: "",
      sap_id: "",
      sbu: selectedSbu || "",
      zone: "",
      state: "",
      district: "",
      city: "",
      address: "",
      region: "",
      company: "",
      location_name: "",
      name: "",
      latitude: 0,
      longitude: 0,
      filename: "",
      updated_by: ""
    };

    switch (effectiveDataType) {
      case 'sod':
        return {
          ...baseFields,
          type: "",
          region_ppac: "",
          ms: 0,
          sko: 0,
          hsd: 0,
          total: 0,
          mode_of_receipt: "",
        } as SODFormData;
      case 'lubes':
        return {
          ...baseFields,
          base_oil_tankages: 0,
          landline: "",
          status: "",
        } as LubesFormData;
      case 'aviation':
        return {
          ...baseFields,
          operation_status: "",
          tankage: 0,
          mode: "",
          pincode: "",
          status: "",
        } as AviationFormData;
      case 'lpg':
        return {
          ...baseFields,
          installed_bottling_capacity: 0,
          operating_bottling_capacity: 0,
          ccoe_tankage: 0,
          time_of_commissioning: "",
          mode: "",
          supply: "",
        } as LPGFormData;
      default:
        return baseFields as SODFormData;
    }
  };

  const [newRecordData, setNewRecordData] = React.useState<FormData>(getInitialFormData());

  // Reset form data when dataType changes
  React.useEffect(() => {
    setNewRecordData(getInitialFormData());
  }, [effectiveDataType, selectedSbu]);

  const getApiEndpoint = () => {
    const endpoints = {
      'sod': '/api/sodinfra/add_sod_data',
      'lubes': '/api/lubesinfra/add_lubes_data',
      'aviation': '/api/aviationinfra/add_aviation_data',
      'lpg': '/api/lpginfra/add_lpg_data'
    };

    const endpoint = endpoints[effectiveDataType];
    console.log(`Using API endpoint for ${effectiveDataType}:`, endpoint);
    return endpoint;
  };

  // Add function to get download endpoint based on data type
  const getDownloadEndpoint = () => {
    const endpoints = {
      'sod': '/api/sodinfra/get_download_data',
      'lubes': '/api/sodinfra/get_download_data',
      'aviation': '/api/sodinfra/get_download_data',
      'lpg': '/api/sodinfra/get_download_data'
    };

    return endpoints[effectiveDataType];
  };

  const getPayloadKey = () => {
    const keys = {
      'sod': 'sod_data',
      'lubes': 'lubes_data',
      'aviation': 'aviation_data',
      'lpg': 'lpg_data'
    };

    return keys[effectiveDataType];
  };

  const getDataTypeName = () => {
    const names = {
      'sod': 'SOD',
      'lubes': 'Lubes',
      'aviation': 'Aviation',
      'lpg': 'LPG'
    };

    return names[effectiveDataType];
  };

  // console.log("selectedSbu", selectedSbu);

  // Fixed handleDownload function to use dynamic endpoint
  const handleDownload = async () => {
    try {
      const res = await apiClient.post(
        getDownloadEndpoint(),
        { sbu: selectedSbu || '' },
        { responseType: 'blob' }
      );

      // Extract filename from Content-Disposition
      const contentDisposition = res.headers['content-disposition'];
      let filename = 'update_data.xlsx';

      if (contentDisposition && contentDisposition.includes('filename=')) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) {
          filename = decodeURIComponent(match[1]);
        }
      }

      // Create blob URL and download
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download data');
    }
  };

  const handleAddButtonClick = () => {
    setShowAddForm(true);
  };

  // Fixed handleFormInputChange with proper typing
  const handleFormInputChange = (field: string, value: string | number) => {
    setNewRecordData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreateRecord = async () => {
    try {
      setIsCreating(true);

      // Get the correct API endpoint and payload key based on effectiveDataType
      const endpoint = getApiEndpoint();
      const payloadKey = getPayloadKey();

      const payload = {
        [payloadKey]: newRecordData
      };

      console.log(`Creating ${effectiveDataType.toUpperCase()} record:`, {
        endpoint,
        payloadKey,
        payload
      });

      const response = await apiClient.post(endpoint, payload);
      console.log('Create response:', response.data);

      // Reset form and close
      setNewRecordData(getInitialFormData());
      setShowAddForm(false);
      toast(`${getDataTypeName()} record created successfully!`);

      // Refresh the table data if refresh function is provided
      if (handleRefresh) {
        handleRefresh();
      }

    }
    catch (err) {
      console.error(`Failed to create ${effectiveDataType} record:`, err);

      // More detailed error message
      if (axios.isAxiosError(err)) {
        const errorMsg = err.response?.data?.message || err.message;
        alert(`Failed to create ${getDataTypeName()} record: ${errorMsg}`);
      } else {
        alert(`Failed to create ${getDataTypeName()} record`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setNewRecordData(getInitialFormData());
  };

  return (
    <div className="fixed inset-0 z-50  w-full h-full bg-[#1a1a2e] flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-700/60 pb-4 flex-shrink-0 px-6 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-600/20 to-blue-700/20 rounded-xl border border-blue-500/30">
              <RefreshCw className="w-5 h-5 text-blue-400" />
            </div>
            <div className='text-white'>
              <p className="font-bold text-xl">Update {getDataTypeName()} Data Management
                <p className="text-sm text-slate-400 mt-1">
                  Total {filteredUpdateData.length} records available 
                </p>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative w-80">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search records..."
                value={updateSearchTerm}
                onChange={(e) => setUpdateSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800/70 border border-slate-600/60 rounded-lg text-white placeholder-slate-400 text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all duration-200"
              />
              {updateSearchTerm && (
                <button
                  onClick={() => setUpdateSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400  hover:text-slate-200 transition-colors duration-200"
                >
                  <X className=" h-4 w-4" />
                </button>
              )}
            </div>

            {/* Close */}
            <button
              onClick={() => {
                setShowUpdateDialog(false);
                setEditingRowId(null);
                setEditedRow({});
                setUpdateSearchTerm('');
                setShowAddForm(false);
              }}
              className="p-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg transition-all duration-200"
            >
              <X className="w-5 h-5 text-red-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between py-3 px-6 bg-slate-800/40 border-b border-slate-700/40 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-slate-200">Table Actions</h3>
          <div className="flex items-center gap-2">
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isLoadingUpdate || !handleRefresh}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-md hover:shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingUpdate ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-md hover:shadow-indigo-500/25"
              title={`Download ${getDataTypeName()} Data${selectedSbu ? ` for ${selectedSbu}` : ''}`}
            >
              <Download className="w-3 h-3" />
              Download
            </button>

            <button
              onClick={() => {
                if (editingRowId) handleSaveEdit();
                else toast('Please select a row to edit first');
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-md hover:shadow-emerald-500/25"
              title="Save Changes"
            >
              <Save className="w-3 h-3" />
              Save
            </button>

            <button
              onClick={() => {
                if (editingRowId) handleCancelEdit();
                else toast('No active edit session to cancel');
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-md"
              title="Cancel Edit"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>

            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-md hover:shadow-red-500/25"
              title="Delete Selected"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>

            <button
              onClick={handleAddButtonClick}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-md hover:shadow-blue-500/25"
              title={`Add New ${getDataTypeName()} Record`}
            >
              <Plus className="w-3 h-3" />
              Add 
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            {editingRowId ? 'Editing mode active' : 'Click a row to edit'}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Data Type:</span>
            <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
              {getDataTypeName()}
            </span>
          </div>
          <div className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 animate-pulse"></div>
        </div>
      </div>

      {/* Elegant Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md           z-[10000] flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-700/60 shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            
            {/* Elegant Header */}
            <div className="relative bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-blue-600/10 p-6 border-b border-slate-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-xl border border-blue-500/30 shadow-lg">
                    <Plus className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                      Add New {getDataTypeName()} Record
                    </p>
                   
                  </div>
                </div>
               <button
  onClick={handleCancelAdd}
  className="p-2 rounded-xl transition-all duration-200 
             bg-gradient-to-r from-blue-600 to-purple-600 
             hover:from-blue-700 hover:to-purple-700
             group text-white"
>
  <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-200" />
</button>

              </div>
              
              {/* Animated progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-60"></div>
            </div>

            {/* Form Content with organized sections */}
            <div className="flex-1 overflow-y-auto p-6">
              
              {/* Basic Information Section */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-700/30">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <p className="text-lg font-semibold text-slate-200">Basic Information</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['sap_id', 'name', 'company'].map((field) => (
                    <div key={field} className="group">
                      <label className="block text-sm font-medium text-slate-300 mb-2 group-focus-within:text-blue-400 transition-colors duration-200">
                        {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        <span className="text-red-400 ml-1">*</span>
                      </label>
                      <input
                        type="text"
                        value={newRecordData[field] || ''}
                        onChange={(e) => handleFormInputChange(field, e.target.value)}
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/70 focus:bg-slate-800/70 transition-all duration-300 hover:border-slate-500/70 hover:shadow-lg hover:shadow-blue-500/5"
                        placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Location Section */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-700/30">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <p className="text-lg font-semibold text-slate-200">Location Details</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(newRecordData)
                    .filter(([field]) => ['sbu', 'zone', 'state', 'district', 'city', 'region', 'location_name'].includes(field))
                    .map(([field, value]) => (
                      <div key={field} className="group">
                        <label className="block text-sm font-medium text-slate-300 mb-2 group-focus-within:text-green-400 transition-colors duration-200">
                          {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          {field === 'sbu' && (
                            <span className="ml-2 text-xs bg-slate-600/50 text-slate-400 px-2 py-0.5 rounded-full">
                              pre-filled
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={newRecordData[field] || ''}
                          onChange={(e) => handleFormInputChange(field, e.target.value)}
                          disabled={field === 'sbu' && selectedSbu}
                          className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500/50 focus:border-green-400/70 focus:bg-slate-800/70 transition-all duration-300 hover:border-slate-500/70 hover:shadow-lg hover:shadow-green-500/5 disabled:opacity-60 disabled:cursor-not-allowed"
                          placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                        />
                      </div>
                    ))}
                </div>
                
                {/* Address - Full width */}
                <div className="mt-4 group">
                  <label className="block text-sm font-medium text-slate-300 mb-2 group-focus-within:text-green-400 transition-colors duration-200">
                    Address
                  </label>
                  <textarea
                    value={newRecordData.address || ''}
                    onChange={(e) => handleFormInputChange('address', e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500/50 focus:border-green-400/70 focus:bg-slate-800/70 transition-all duration-300 hover:border-slate-500/70 hover:shadow-lg hover:shadow-green-500/5 resize-none"
                    placeholder="Enter complete address"
                  />
                </div>
              </div>

              {/* Coordinates Section */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-700/30">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <p className="text-lg font-semibold text-slate-200">Geographic Coordinates</p>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="group">
                    <label className="block text-sm font-medium text-slate-300 mb-2 group-focus-within:text-purple-400 transition-colors duration-200">
                      Latitude
                    </label>
                    <input
                      type="number"
                      value={newRecordData.latitude || 0}
                      onChange={(e) => handleFormInputChange('latitude', parseFloat(e.target.value) || 0)}
                      step="0.000001"
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/70 focus:bg-slate-800/70 transition-all duration-300 hover:border-slate-500/70 hover:shadow-lg hover:shadow-purple-500/5"
                      placeholder="0.000000"
                    />
                  </div>
                  <div className="group">
                    <label className="block text-sm font-medium text-slate-300 mb-2 group-focus-within:text-purple-400 transition-colors duration-200">
                      Longitude
                    </label>
                    <input
                      type="number"
                      value={newRecordData.longitude || 0}
                      onChange={(e) => handleFormInputChange('longitude', parseFloat(e.target.value) || 0)}
                      step="0.000001"
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/70 focus:bg-slate-800/70 transition-all duration-300 hover:border-slate-500/70 hover:shadow-lg hover:shadow-purple-500/5"
                      placeholder="0.000000"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Data Type Specific Section */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-700/30">
                  <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  <p className="text-lg font-semibold text-slate-200">{getDataTypeName()} Specific Data</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(newRecordData)
                    .filter(([field]) => !['unique_id', 'sap_id', 'name', 'company', 'sbu', 'zone', 'state', 'district', 'city', 'region', 'location_name', 'address', 'latitude', 'longitude', 'filename', 'updated_by'].includes(field))
                    .map(([field, value]) => {
                      const isNumberField = typeof value === 'number';
                      
                      return (
                        <div key={field} className="group">
                          <label className="block text-sm font-medium text-slate-300 mb-2 group-focus-within:text-orange-400 transition-colors duration-200">
                            {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            {isNumberField && field !== 'latitude' && field !== 'longitude' && (
                              <span className="text-xs text-slate-500 ml-1">
                                {['ms', 'sko', 'hsd', 'total', 'tankage', 'base_oil_tankages', 'ccoe_tankage'].includes(field) ? '(KL)' : 
                                 ['installed_bottling_capacity', 'operating_bottling_capacity'].includes(field) ? '(TMTPA)' : ''}
                              </span>
                            )}
                          </label>
                          <input
                            type={isNumberField ? "number" : "text"}
                            value={newRecordData[field] || ''}
                            onChange={(e) => {
                              const val = isNumberField 
                                ? (parseFloat(e.target.value) || 0)
                                : e.target.value;
                              handleFormInputChange(field, val);
                            }}
                            className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-orange-500/50 focus:border-orange-400/70 focus:bg-slate-800/70 transition-all duration-300 hover:border-slate-500/70 hover:shadow-lg hover:shadow-orange-500/5"
                            placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                            step={isNumberField ? '1' : undefined}
                          />
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Meta Information */}
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-700/30">
                  <div className="w-2 h-2 rounded-full bg-slate-500"></div>
                  <p className="text-lg font-semibold text-slate-200">Additional Information</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {['filename', 'updated_by'].map((field) => (
                    <div key={field} className="group">
                      <label className="block text-sm font-medium text-slate-300 mb-2 group-focus-within:text-slate-400 transition-colors duration-200">
                        {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                      <input
                        type="text"
                        value={newRecordData[field] || ''}
                        onChange={(e) => handleFormInputChange(field, e.target.value)}
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-400 focus:ring-2 focus:ring-slate-500/50 focus:border-slate-400/70 focus:bg-slate-800/70 transition-all duration-300 hover:border-slate-500/70 hover:shadow-lg hover:shadow-slate-500/5"
                        placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Elegant Footer */}
            <div className="flex items-center justify-between p-6 border-t border-slate-700/50 bg-slate-800/20">
              <div className="flex items-center gap-2 text-sm text-slate-400">
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancelAdd}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700  hover:bg-slate-600/50 border border-slate-600/50 hover:border-slate-500/70 text-slate-200 hover:text-white rounded-xl transition-all duration-200 font-medium"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRecord}
                  disabled={isCreating}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 transform hover:scale-105 active:scale-95"
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Creating ...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Create {getDataTypeName()} Record
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table Container with Scrollbar */}
      <div className="flex-1 overflow-hidden">
       
          <div className="h-full w-full overflow-auto">
            {/* Table with scrollbar */}
            <div className="h-full overflow-y-auto">
              <table className="w-full min-w-full table-auto">
                <thead className="bg-slate-700/60 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-center border-b border-slate-600/50 bg-slate-700/80 w-12">
                      <input
                        type="checkbox"
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setUpdateTableData(prev =>
                            prev.map(row => ({ ...row, selected: checked }))
                          );
                        }}
                        className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-500 rounded focus:ring-blue-500 focus:ring-2"
                      />
                    </th>
                    {filteredUpdateData[0] && Object.keys(filteredUpdateData[0])
                      .filter(col => col !== 'selected')
                      .map(col => (
                        <th
                          key={col}
                          className="px-4 py-3 text-left text-sm font-semibold text-slate-200 capitalize border-b border-slate-600/50 whitespace-nowrap bg-slate-700/80"
                        >
                          {col.replace(/_/g, ' ')}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="bg-slate-800/20">
                  {filteredUpdateData.map((row, i) => {
                    const rowId = row.id || i.toString();
                    const isEditing = editingRowId === rowId;

                    return (
                      <tr
                        key={rowId}
                        onClick={() => !isEditing && handleEditClick(row)}
                        className={`border-b border-slate-700/20 transition-all duration-200 cursor-pointer ${isEditing ? 'bg-blue-500/10 border-blue-400/30' : 'hover:bg-slate-700/30'
                          }`}
                      >
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected || false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setUpdateTableData(prev =>
                                prev.map(r =>
                                  r.id === rowId ? { ...r, selected: checked } : r
                                )
                              );
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-500 rounded focus:ring-blue-500 focus:ring-2"
                          />
                        </td>
                        {Object.entries(row)
                          .filter(([col]) => col !== 'selected')
                          .map(([col, value], j) => (
                            <td key={j} className="px-4 py-3 text-sm text-slate-300">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editedRow[col] || ''}
                                  onChange={(e) => handleEditInputChange(col, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-3 py-2 bg-slate-700/70 border border-slate-600/60 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 transition-all duration-200"
                                />
                              ) : (
                                <span className="block truncate">
                                  {value !== null && value !== undefined ? String(value) : '-'}
                                </span>
                              )}
                            </td>
                          ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredUpdateData.length === 0 && updateTableData.length > 0 && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center bg-slate-800/50 p-12 rounded-2xl border border-slate-700/50">
                    <Search className="h-16 w-16 text-slate-400 mx-auto mb-6" />
                    <p className="text-slate-300 text-xl font-medium">No results found</p>
                    <p className="text-slate-400 text-base mt-3">No records match "{updateSearchTerm}"</p>
                    <button
                      onClick={() => setUpdateSearchTerm('')}
                      className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-base rounded-lg transition-colors duration-200"
                    >
                      Clear search
                    </button>
                  </div>
                </div>
              )}

              {updateTableData.length === 0 && !isLoadingUpdate && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center bg-slate-800/50 p-12 rounded-2xl border border-slate-700/50">
                    <RefreshCw className="h-16 w-16 text-slate-400 mx-auto mb-6" />
                    <p className="text-slate-300 text-xl font-medium">No {getDataTypeName()} data available</p>
                    <p className="text-slate-400 text-base mt-3">Try refreshing or check your connection</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        
      </div>
    </div>
  );
};

export default UpdateDataTable;
