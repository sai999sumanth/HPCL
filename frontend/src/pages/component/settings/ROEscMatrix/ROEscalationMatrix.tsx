import React, { useState, useCallback, useEffect } from 'react';
import { Check, ChevronsUpDown, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/@/components/ui/alert-dialog";
import { Button } from "@/@/components/ui/button";
import { Input } from "@/@/components/ui/input";
import { Label } from "@/@/components/ui/label";
import { Switch } from "@/@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/@/components/ui/command";
import { Loader2 } from "lucide-react";
import { apiClient } from '@/services/apiClient';

const formatForDisplay = (value) => {
  if (!value) return '';

  // Convert backend format to display format
  const displayMap = {
    'daily': 'Days',
    'weekly': 'Weeks',
    'monthly': 'Months',
    'hourly': 'Hours'
  };

  return displayMap[value] || value;
};

const formatForBackend = (value) => {
  if (!value) return '';

  // Convert display format to backend format
  const backendMap = {
    'Days': 'daily',
    'Weeks': 'weekly',
    'Months': 'monthly',
    'Hours': 'hourly'
  };

  return backendMap[value] || value;
};

const FilterDropdown = ({ label, options = [], value, onChange, isLoading, formatValue = true }) => {
  const [open, setOpen] = useState(false);
  const selectedValue = value || '';

  // Format the displayed value if needed
  const displayValue = selectedValue
    ? (formatValue ? formatForDisplay(selectedValue) : selectedValue)
    : `Select ${label}...`;
  return (
    <div className="flex flex-col gap-1 mt-2">
      <label className="text-xs text-gray-600">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full h-10 justify-between text-sm">
            {displayValue}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : options.length === 0 ? (
            <div className="text-[10px] py-2 text-center text-gray-500">
              No {label} found.
            </div>
          ) : (
            <Command>
              <CommandInput placeholder={`Search ${label.toLowerCase()}...`} className="h-9" />
              <CommandList>
                <CommandGroup>
                  {options.map((option) => {
                    // Compare the backend value with the stored value
                    const optionBackendValue = formatValue ? formatForBackend(option) : option;
                    const isSelected = selectedValue === optionBackendValue;

                    return (
                      <CommandItem
                        key={option}
                        value={option}
                        onSelect={() => {
                          // When selecting, store the backend value
                          const newValue = isSelected ? '' : (formatValue ? formatForBackend(option) : option);
                          onChange(newValue);
                          setOpen(false);
                        }}
                        className="text-sm flex items-center gap-2"
                      >
                        <div className="w-4 h-4 flex items-center justify-center">
                          {isSelected && <Check className="h-4 w-4" />}
                        </div>
                        {option}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

const ROEscalationMatrix = () => {
  const [searchText, setSearchText] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const initialFormData = {
    id: '',
    enable: false,
    record_id: '',
    interlock: '',
    threshold: '',
    threshold_value: '',
    monthly_quota: '',
    sales_officer_quota: '',
    sales_officer_instance: '',
    regional_manager_quota: '',
    regional_manager_instance: '',
    zonal_head_quota: '',
    zonal_head_instance: '',
  };

  const [formData, setFormData] = useState(initialFormData);
  const [dropdownOptions, setDropdownOptions] = useState({
    sales_area: [],
  });
  const [loading, setLoading] = useState({
    interlock: false
  });

  // Fetch data function
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const skip = currentPage * pageSize;
      let queryParams: any = {
        skip: skip,
        limit: pageSize,
        search_text: searchText ? `${encodeURIComponent(searchText)}` : ''
      };
      console.log(queryParams);
      const response = await apiClient.get(`/api/romasterdata`, { params: queryParams });
      
      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseData = response.data;
      setData(responseData.data || []);
      setTotalItems(responseData.total || 0);
    } catch (error) {
      console.error('Error fetching data:', error);
      setData([]);
      setTotalItems(0);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on component mount and when dependencies change
  useEffect(() => {
    fetchData();
  }, [currentPage, pageSize, searchText]);

  const handleEdit = useCallback(async (user) => {
    try {
      const response = await apiClient.get(`/api/romasterdata/${user.id}`);
      
      if (!response.status) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const userData = response.data;

      setFormData({
        id: userData.id || '',
        record_id: userData.record_id || '',
        enable: userData.status || false,
        interlock: userData.interlock || '',
        monthly_quota: userData.monthly_quota || '',
        threshold: userData.threshold || '',
        threshold_value: userData.threshold_value || '',
        sales_officer_quota: userData.sales_officer_quota || '',
        sales_officer_instance: userData.sales_officer_instance || '',
        regional_manager_quota: userData.regional_manager_quota || '',
        regional_manager_instance: userData.regional_manager_instance || '',
        zonal_head_quota: userData.zonal_head_quota || '',
        zonal_head_instance: userData.zonal_head_instance || '',
      });

      setSelectedUser(user);
      setEditDialogOpen(true);
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  }, []);

  const handleDelete = (user) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Sanitize formData
    const payload = {
      record_id: String(formData.id || ''),
      interlock: String(formData.interlock || ''),
      threshold: String(formData.threshold || ''),
      threshold_value: Number(formData.threshold_value) || 0,
      monthly_quota: String(formData.monthly_quota || ''),
      sales_officer_quota: Number(formData.sales_officer_quota) || 0,
      sales_officer_instance: Number(formData.sales_officer_instance) || 0,
      regional_manager_quota: Number(formData.regional_manager_quota) || 0,
      regional_manager_instance: Number(formData.regional_manager_instance) || 0,
      zonal_head_quota: Number(formData.zonal_head_quota) || 0,
      zonal_head_instance: Number(formData.zonal_head_instance) || 0
    };

    try {
      const response = await apiClient.post('/api/romasterdata/update_ro_master_data', payload);

      if (response.status) {
        setEditDialogOpen(false);
        fetchData(); // Refresh data after update
      } else {
        console.error("API Error Response:", response.statusText);
      }
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  // Pagination handlers
  const handleNextPage = () => {
    if ((currentPage + 1) * pageSize < totalItems) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = currentPage * pageSize + 1;
  const endItem = Math.min((currentPage + 1) * pageSize, totalItems);

  return (
    <div className="px-0 sm:px-0 py-1 space-y-2">
      {/* Responsive Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h1 className="text-lg sm:text-xl font-bold">
          RetailOutlet Automation Escalation Matrix
        </h1>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2">
          <Input
            placeholder="Search escalation..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setCurrentPage(0); // Reset to first page when searching
            }}
            className="w-full sm:w-64 h-9 text-sm"
          />
        </div>
      </div>

      {/* Responsive Table Container */}
      <div className="w-full overflow-hidden border rounded-md">
        <div className="overflow-x-auto">
          <div className="h-[500px] sm:h-[600px] lg:h-[620px] overflow-y-auto">
            <table className="w-full border border-gray-300 border-collapse" style={{ minWidth: '900px' }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-[rgba(7,82,140,0.98)] text-white border-b border-gray-300">
                  <th rowSpan={2} className="p-1 sm:p-2 text-xs sm:text-sm text-center min-w-[80px] border-r border-gray-300">
                    Interlock
                  </th>
                  <th rowSpan={2} className="p-1 sm:p-2 text-xs sm:text-sm text-center min-w-[60px] border-r border-gray-300">
                    Quota
                  </th>
                  <th colSpan={2} className="p-1 sm:p-2 text-xs sm:text-sm text-center min-w-[120px] border-r border-gray-300">
                    Threshold
                  </th>
                  <th colSpan={2} className="p-1 sm:p-2 text-xs sm:text-sm text-center min-w-[120px] border-r border-gray-300">
                    Sales Officer
                  </th>
                  <th colSpan={2} className="p-1 sm:p-2 text-xs sm:text-sm text-center min-w-[120px] border-r border-gray-300">
                    Regional Manager
                  </th>
                  <th colSpan={2} className="p-1 sm:p-2 text-xs sm:text-sm text-center min-w-[120px] border-r border-gray-300">
                    Zonal Head
                  </th>
                  <th rowSpan={2} className="p-1 sm:p-2 text-xs sm:text-sm text-center min-w-[80px] sticky right-0 bg-[rgba(7,82,140,0.98)] border-l border-gray-300">
                    Actions
                  </th>
                </tr>
                <tr className="bg-[rgba(7,82,140,0.98)] text-white border-b border-gray-300">
                  <th className="p-1 sm:p-2 text-xs sm:text-sm text-center min-w-[70px] border-r border-gray-300">Limit</th>
                  <th className="p-1 sm:p-2 text-xs sm:text-sm text-center min-w-[50px] border-r border-gray-300">Value</th>
                  <th className="p-1 sm:p-2 text-xs sm:text-sm text-center min-w-[50px] border-r border-gray-300">Quota</th>
                  <th className="p-1 sm:p-2 text-xs sm:text-sm text-center min-w-[60px] border-r border-gray-300">Instance</th>
                  <th className="p-1 sm:p-2 text-xs sm:text-sm text-center min-w-[50px] border-r border-gray-300">Quota</th>
                  <th className="p-1 sm:p-2 text-xs sm:text-sm text-center min-w-[60px] border-r border-gray-300">Instance</th>
                  <th className="p-1 sm:p-2 text-xs sm:text-sm text-center min-w-[50px] border-r border-gray-300">Quota</th>
                  <th className="p-1 sm:p-2 text-xs sm:text-sm text-center min-w-[60px] border-r border-gray-300">Instance</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={11} className="p-4 text-center border-t border-gray-300">
                      <div className="flex justify-center items-center">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        Loading data...
                      </div>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-4 text-center border-t border-gray-300">No data found</td>
                  </tr>
                ) : (
                  data.map((row, index) => (
                    <tr
                      key={row.id}
                      className={`
                        ${index % 2 === 0 ? 'bg-white' : 'bg-[rgb(252,252,252)]'}
                        hover:bg-[rgba(9,122,209,0.1)] border-t border-gray-200
                      `}
                    >
                      <td className="p-1 sm:p-2 text-xs sm:text-sm text-center border-r border-gray-200">
                        {row.interlock}
                      </td>
                      <td className="p-1 sm:p-2 text-xs sm:text-sm text-center border-r border-gray-200">
                        {formatForDisplay(row.monthly_quota)}
                      </td>
                      <td className="p-1 sm:p-2 text-xs sm:text-sm text-center border-r border-gray-200">
                        {formatForDisplay(row.threshold)}
                      </td>
                      <td className="p-1 sm:p-2 text-xs sm:text-sm text-center border-r border-gray-200">
                        {row.threshold_value}
                      </td>
                      <td className="p-1 sm:p-2 text-xs sm:text-sm text-center border-r border-gray-200">
                        {row.sales_officer_quota}
                      </td>
                      <td className="p-1 sm:p-2 text-xs sm:text-sm text-center border-r border-gray-200">
                        {row.sales_officer_instance}
                      </td>
                      <td className="p-1 sm:p-2 text-xs sm:text-sm text-center border-r border-gray-200">
                        {row.regional_manager_quota}
                      </td>
                      <td className="p-1 sm:p-2 text-xs sm:text-sm text-center border-r border-gray-200">
                        {row.regional_manager_instance}
                      </td>
                      <td className="p-1 sm:p-2 text-xs sm:text-sm text-center border-r border-gray-200">
                        {row.zonal_head_quota}
                      </td>
                      <td className="p-1 sm:p-2 text-xs sm:text-sm text-center border-r border-gray-200">
                        {row.zonal_head_instance}
                      </td>
                      <td className="p-1 sm:p-2 text-xs sm:text-sm text-center sticky right-0 bg-white border-l border-gray-300">
                        <div className="flex gap-1 sm:gap-2 justify-center">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(row)}>
                            <Edit className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                          </Button>
                          <Button variant="ghost" disabled size="icon" onClick={() => handleDelete(row)}>
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Responsive Pagination */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
        <div className="text-xs sm:text-sm text-gray-600 order-2 sm:order-1">
          Showing {totalItems > 0 ? startItem : 0} to {endItem} of {totalItems} entries
        </div>
        <div className="flex items-center gap-2 order-1 sm:order-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage === 0}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs sm:text-sm font-medium px-2">
            {currentPage + 1} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages - 1}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Responsive Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl p-4 sm:p-6 bg-white">
          <DialogHeader className="flex flex-col items-center pb-4">
            <DialogTitle className="text-lg sm:text-xl font-bold text-gray-800 text-center">
              Interlock - By Pass ( {formData.interlock} )
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
            {/* Threshold & Monthly Quota Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="flex flex-col gap-2">
                <FilterDropdown
                  label="Threshold Type"
                  options={['Days', 'Weeks', 'Months']}
                  value={formData.threshold}
                  onChange={(value) => setFormData({ ...formData, threshold: value })}
                  isLoading={loading.interlock}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs sm:text-sm font-medium text-gray-600">Threshold Value</label>
                <Input
                  type="number"
                  min={0}
                  value={formData.threshold_value || ''}
                  onChange={(e) => setFormData({ ...formData, threshold_value: e.target.value })}
                  className="h-10"
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1">
                <FilterDropdown
                  label="Quota"
                  options={['Hours', 'Days', 'Weeks', 'Months']}
                  value={formData.monthly_quota}
                  onChange={(value) => setFormData({ ...formData, monthly_quota: value })}
                  isLoading={loading.interlock}
                />
              </div>
            </div>

            {/* Escalation Matrix */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-6">
              {/* Desktop Layout */}
              <div className="hidden sm:block">
                <div className="grid grid-cols-3 gap-4 lg:gap-6 items-end mb-4">
                  <div className="font-bold text-gray-800"></div>
                  <div className="font-bold text-gray-800 text-center">
                    <span className="capitalize">{formData.monthly_quota}</span> Quota
                  </div>
                  <div className="font-bold text-gray-800 text-center">Instance</div>
                </div>

                {['sales_officer', 'regional_manager', 'zonal_head'].map((role) => (
                  <div key={role} className="grid grid-cols-3 gap-4 lg:gap-6 items-center mb-4">
                    <div className="capitalize text-sm font-bold text-gray-700">
                      {role.replace('_', ' ')}
                    </div>
                    <Input
                      type="number"
                      className="text-center h-10"
                      value={formData[`${role}_quota`] || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, [`${role}_quota`]: e.target.value })
                      }
                    />
                    <Input
                      type="number"
                      className="text-center h-10"
                      value={formData[`${role}_instance`] || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, [`${role}_instance`]: e.target.value })
                      }
                    />
                  </div>
                ))}
              </div>

              {/* Mobile Layout */}
              <div className="sm:hidden space-y-6">
                <div className="text-center font-bold text-gray-800 mb-4">
                  <span className="capitalize">{formData.monthly_quota}</span> Quota & Instance Configuration
                </div>

                {['sales_officer', 'regional_manager', 'zonal_head'].map((role) => (
                  <div key={role} className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="capitalize text-sm font-bold text-gray-700 mb-3 text-center">
                      {role.replace('_', ' ')}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Quota</label>
                        <Input
                          type="number"
                          className="text-center h-10"
                          value={formData[`${role}_quota`] || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, [`${role}_quota`]: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Instance</label>
                        <Input
                          type="number"
                          className="text-center h-10"
                          value={formData[`${role}_instance`] || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, [`${role}_instance`]: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 transition duration-200 shadow-md"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              escalation matrix entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ROEscalationMatrix;