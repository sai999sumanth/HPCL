import React, { useState, useEffect } from 'react';
import { 
  X, Building, MapPin, User, Phone, Loader2, AlertTriangle, Users
} from 'lucide-react';
import { apiClient } from '@/services/apiClient';
import useAuthStore from '@/store/authStore';
import FormField from '@/@/components/ui/FormField';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/@/components/ui/select';

// --- Prop and State Interfaces ---

interface RetailServiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormData {
  violationType: string;
  deviceType: string;
  deviceNumber: string;
  action: string;
  category: string;
  reason: string;
  remarks: string;
}

// --- API Response Interfaces ---

interface AlertDetails {
  dealer_id: string;
  plant_id: string;
  plant_name: string;
  dealer_name: string;
  zone: string;
  city: string;
  state: string;
  region: string;
  person_in_charge: string;
  contact: string;
}

// This now represents the shape of the API response for dropdowns
interface FormOptions {
  violation_type: string[];
  device_type: string[];
  device_number: (string | number)[];
  actions: Record<string, string>;
  category: Record<string, string>;
  rca_reason: string[];
}

// The API response is the FormOptions with an optional details object
type ApiResponse = FormOptions & {
  details?: AlertDetails;
};

// --- Component ---

const RetailServiceRequestModal: React.FC<RetailServiceRequestModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const currentUser = useAuthStore((state) => state.user);

  const [formData, setFormData] = useState<FormData>({
    violationType: '',
    deviceType: '',
    deviceNumber: '',
    action: '',
    category: '',
    reason: '',
    remarks: ''
  });

  useEffect(() => {
    if (isOpen) {
      // Reset form and errors on open
      setFormData({
        violationType: '', deviceType: '', deviceNumber: '',
        action: '', category: '', reason: '', remarks: ''
      });
      setSubmitError(null);
      setIsSubmitting(false);

      const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await apiClient.post<ApiResponse>('/api/rointerlockdisable/get_service_request_raise_details', {});
          setApiData(response.data);
        } catch (err) {
          setError('Failed to fetch alert details. Please check the console for more information and try again.');
          console.error("API Error fetching alert details:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFormChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    // Ensure sap_id is a string to prevent validation errors
    const sapId = String(currentUser?.sap_id || '');

    const payload = {
      location_id: sapId,
      sap_id: sapId,
      location_type: 'RO',
      violation_type: formData.violationType, // Corrected typo from 'voilation_type'
      device_name: formData.deviceType,
      device_id: formData.deviceNumber,
      action_type: formData.action,
      category: formData.category,
      reason: formData.reason,
      remarks: formData.remarks,
    };

    try {
      const response = await apiClient.post('/api/rointerlockdisable/submit_service_request', payload);
      console.log('Submission successful:', response.data);
      // In a real app, you might show a success toast here
      onClose(); // Close modal on success
    } catch (err) {
      console.error('Submission failed:', err);
      setSubmitError('Failed to submit the request. Please try again.');
      // In a real app, you might show an error toast here
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const details = apiData?.details;
  const options = apiData;

  const renderContent = () => {
    if (loading && !details) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading Alert Details...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          {/* <AlertTriangle className="h-12 w-12 text-red-500 mb-4" /> */}
          <p className="text-gray-600 mt-2">No Data</p>
          <button
            onClick={onClose}
            className="mt-6 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
          >
            Close
          </button>
        </div>
      );
    }

    const displayDetails = {
      dealer_id: details?.dealer_id || currentUser?.employee_id,
      plant_id: details?.plant_id || currentUser?.sap_id,
      dealer_name: details?.dealer_name || currentUser?.first_name,
      zone: details?.zone || currentUser?.zone,
      state: details?.state || currentUser?.state,
      region: details?.region || currentUser?.region,
      contact: details?.contact || currentUser?.email,
    };
    
    const formFields = [
        { label: 'Violation Type', field: 'violationType', options: options?.violation_type },
        { label: 'Device Type', field: 'deviceType', options: options?.device_type },
        { label: 'Device Number', field: 'deviceNumber', options: options?.device_number },
        { label: 'Action', field: 'action', options: options?.actions ? Object.values(options.actions) : [] },
        { label: 'Category', field: 'category', options: options?.category ? Object.values(options.category) : [] },
        { label: 'Reason', field: 'reason', options: options?.rca_reason },
    ];

    return (
      <>
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="px-6 py-4 border-b bg-white sticky top-0 z-10">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-lg font-medium text-gray-900">Raise Service Request</h2>
                <div className="text-sm text-gray-600 mb-4 mt-2">
                  Dealer ID: {displayDetails.dealer_id || 'N/A'} | Plant ID: {displayDetails.plant_id || 'N/A'} | Plant Name: ...
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors ml-4">
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Information Grid */}
          <div className="px-6 py-4 border-b bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3"><Building className="h-4 w-4 text-blue-500" /><span className="text-sm text-gray-600">Dealer Name:</span><span className="text-sm text-gray-900">{displayDetails.dealer_name || '...'}</span></div>
                <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-orange-500" /><span className="text-sm text-gray-600">Zone:</span><span className="text-sm text-gray-900">{displayDetails.zone || '...'}</span></div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3"><MapPin className="h-4 w-4 text-green-500" /><span className="text-sm text-gray-600">City & State:</span><span className="text-sm text-gray-900">{displayDetails.state || '...'}</span></div>
                <div className="flex items-center gap-3"><User className="h-4 w-4 text-red-500" /><span className="text-sm text-gray-600">Person in Charge:</span><span className="text-sm text-gray-900">...</span></div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3"><Users className="h-4 w-4 text-purple-500" /><span className="text-sm text-gray-600">Region:</span><span className="text-sm text-gray-900">{displayDetails.region || '...'}</span></div>
                <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-cyan-500" /><span className="text-sm text-gray-600">Contact:</span><span className="text-sm text-gray-900">{displayDetails.contact || '...'}</span></div>
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="px-6 py-4 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {formFields.map(({ label, field, options: fieldOptions }) => (
                <FormField label={label} key={field}>
                  <Select
                    value={formData[field as keyof FormData]}
                    onValueChange={(value) => handleFormChange(field as keyof FormData, value)}
                    disabled={!fieldOptions || fieldOptions.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldOptions?.map(opt => <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
              ))}
              <FormField label="Remarks" className="lg:col-span-3">
                <textarea
                  value={formData.remarks}
                  onChange={(e) => handleFormChange('remarks', e.target.value)}
                  rows={3}
                  placeholder="Enter remarks..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </FormField>
            </div>
             {submitError && <p className="text-red-500 text-sm mt-4">{submitError}</p>}
          </div>
        </div>
        
        {/* Footer with Submit Button */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
            <button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg disabled:bg-blue-400 disabled:cursor-not-allowed inline-flex items-center"
            >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
        </div>
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {renderContent()}
      </div>
    </div>
  );
};

export default RetailServiceRequestModal;
