
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';

import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { Input } from "@/@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip";
import { X, ArrowLeft, RefreshCw, Search, XCircle, Download } from 'lucide-react';
import { toast } from "sonner";
import { apiClient } from '@/services/apiClient';
import ReusableFilterBar from '@/pages/component/Governance/VTS Analytics/ReusableFilterBar';
import useAuthStore from '@/store/authStore';

const KFactor: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const userBu = user?.bu;
  const isLpgUser = Array.isArray(userBu) && userBu.includes('LPG');
  const isTasUser = Array.isArray(userBu) && userBu.includes('TAS');
  const hasUserBu = isLpgUser || isTasUser;

  const sessionZones = Array.isArray(user?.zone) ? user?.zone : [];
  const sessionSapIds = Array.isArray(user?.sap_id) ? user?.sap_id : [];
  // If the session doesn't provide zone/sap_id, keep previous behavior:
  // only populate/select SAP IDs after user selects a Zone.
  const shouldLoadSapOnZoneChange = sessionZones.length === 0 && sessionSapIds.length === 0;

  // Filter state
  const [selectedBu, setSelectedBu] = useState(isLpgUser ? 'LPG' : isTasUser ? 'TAS' : 'TAS');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<string | null>(null);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<string | null>('15D');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Toggle between table and form view
  const [showForm, setShowForm] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  // Debounce hook for search
  const useDebounce = <T,>(value: T, delay: number): T => {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);

    return debouncedValue;
  };

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // API response data state
  const [allKFactorData, setAllKFactorData] = useState([]);
  const [loadingAllData, setLoadingAllData] = useState(false);
  const [downloadingCertificateId, setDownloadingCertificateId] = useState<number | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [refreshCounter, setRefreshCounter] = useState(0);
  // Form state
  const [formData, setFormData] = useState({
    sap_id: "",
    location_name: "",
    zone: "",
    bcu_number: "",
    mfm_number: "",
    equipment_name: "",
    device_type: "",
    present_k_factor: "",
    past_k_factor: "",
    remarks: "",
    actual_w_and_m_seal_date: "",
    next_due_date: "",
    certificate_files: [] as File[],
  });

  // File upload state
  // Mirrors `formData.certificate_files` indices (only image types have a preview; others are null)
  const [imagePreviews, setImagePreviews] = useState<Array<string | null>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const tableElementRef = useRef<HTMLTableElement>(null);
  const isSyncingScrollRef = useRef(false);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);

  // Dropdown data state (fetched from API)
  const [zones, setZones] = useState([]);
  const [locations, setLocations] = useState([]);
  const [bcuNumbers, setBcuNumbers] = useState([]);
  const [mfmNumbers, setMfmNumbers] = useState([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);
  const [loadingDeviceTypeOptions, setLoadingDeviceTypeOptions] = useState(false);

  // Handle input change
  const handleInputChange = (field: string, value: string | File | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (8MB limit)
      if (file.size > 8 * 1024 * 1024) {
        toast.error("File size must be less than 8MB");
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        toast.error("Only JPG, PNG, and PDF files are allowed");
        return;
      }

      const nextIndex = formData.certificate_files.length;

      setFormData((prev) => ({
        ...prev,
        certificate_files: [...prev.certificate_files, file],
      }));

      // Create preview for images (keep placeholders so indexes match)
      if (file.type.startsWith('image/')) {
        setImagePreviews((prev) => [...prev, null]);
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = ev.target?.result as string | undefined;
          setImagePreviews((prev) => {
            const next = [...prev];
            next[nextIndex] = result ?? null;
            return next;
          });
        };
        reader.readAsDataURL(file);
      } else {
        setImagePreviews((prev) => [...prev, null]);
      }

      toast.success("File selected successfully!");
    }
  };

  // Helper function to convert time filter to SQL query
  const getTimeFilterQuery = (filter: string | null): string => {
    if (!filter) return "";

    const timeFilterMap: { [key: string]: string } = {
      t: "created_at::DATE = CURRENT_DATE",
      "1d": "created_at::DATE = CURRENT_DATE - INTERVAL '1 DAY'",
      "1w": "created_at::DATE >= CURRENT_DATE - INTERVAL '7 DAY'",
      "15d": "created_at::DATE >= CURRENT_DATE - INTERVAL '15 DAY'",
      "1m": "created_at::DATE >= CURRENT_DATE - INTERVAL '1 MONTH'",
      "3m": "created_at::DATE >= CURRENT_DATE - INTERVAL '3 MONTH'",
      // Uppercase variants
      "TDY": "created_at::DATE = CURRENT_DATE",
      "YDY": "created_at::DATE = CURRENT_DATE - INTERVAL '1 DAY'",
      "1W": "created_at::DATE >= CURRENT_DATE - INTERVAL '7 DAY'",
      "15D": "created_at::DATE >= CURRENT_DATE - INTERVAL '15 DAY'",
      "1M": "created_at::DATE >= CURRENT_DATE - INTERVAL '1 MONTH'",
      "3M": "created_at::DATE >= CURRENT_DATE - INTERVAL '3 MONTH'",
    };

    return timeFilterMap[filter] || "";
  };

  // Build query string with filters
  const buildQuery = useCallback((): string => {
    let query = "";

    // Add zone filter if selected
    if (selectedZone) {
      query += `zone='${selectedZone}'`;
    }

    // Add sap_id (location_name) filter if selected
    if (selectedPlant) {
      if (query) query += " AND ";
      query += `sap_id='${selectedPlant}'`;
    }

    // Add time filter if selected
    if (selectedTimeFilter) {
      const timeFilterQuery = getTimeFilterQuery(selectedTimeFilter);
      if (timeFilterQuery) {
        if (query) query += " AND ";
        query += timeFilterQuery;
      }
    }

    return query;
  }, [selectedZone, selectedPlant, selectedTimeFilter]);

  // Filter handlers
  const onTimeFilterChange = (filter: string | null) => {
    setSelectedTimeFilter(filter);
  };

  const handleRefresh = () => {
    setSelectedBu(isLpgUser ? 'LPG' : isTasUser ? 'TAS' : 'TAS');
    setSelectedZone(null);
    setSelectedPlant(null);
    setSelectedTimeFilter('15D');
    setCurrentPage(0);
    setRefreshKey(prev => prev + 1);
    setIsRefreshing(true);
    // Data will be fetched automatically by useEffect when states change
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  // Handle remove a single uploaded file (by index)
  const handleRemoveImage = (removeIndex: number) => {
    setImagePreviews((prev) => prev.filter((_, idx) => idx !== removeIndex));
    setFormData((prev) => {
      const nextFiles = prev.certificate_files.filter((_, idx) => idx !== removeIndex);

      // Keep the underlying file input in sync (so subsequent uploads don't get weird).
      // Note: DataTransfer is supported in modern browsers.
      if (fileInputRef.current) {
        try {
          const dt = new DataTransfer();
          nextFiles.forEach((file) => dt.items.add(file));
          fileInputRef.current.files = dt.files;
        } catch {
          // Fallback: clearing the input still keeps our React state correct.
          fileInputRef.current.value = '';
        }
      }

      return { ...prev, certificate_files: nextFiles };
    });
  };

  // Form validation
  const isFormValid = () => {
    return (
      formData.sap_id.trim() &&
      formData.location_name.trim() &&
      formData.zone.trim() &&
      formData.bcu_number.trim() &&
      formData.mfm_number.trim() &&
      formData.equipment_name.trim() &&
      formData.device_type.trim() &&
      formData.actual_w_and_m_seal_date.trim() &&
      formData.next_due_date.trim() &&
      formData.certificate_files.length > 0
    );
  };

  // Handle form submit
  const handleSubmit = async () => {
    // Validate certificate file is required
    if (!formData.certificate_files.length) {
      toast.error("Please upload a certificate file");
      return;
    }

    // if (!isFormValid()) {
    //   toast.error("Please fill in all required fields");
    //   return;
    // }

    try {
      // Build query parameters from form data
      const queryParamsObj: any = {
        sap_id: formData.sap_id,
        location_name: formData.location_name,
        zone: formData.zone,
        bcu_number: formData.bcu_number,
        mfm_number: formData.mfm_number,
        equipment_name: formData.equipment_name,
        device_type: formData.device_type,
        present_k_factor: formData.present_k_factor,
        past_k_factor: formData.past_k_factor,
        remarks: formData.remarks,
        actual_w_and_m_seal_date: formData.actual_w_and_m_seal_date,
        next_due_date: formData.next_due_date,
      };

      // Add certificate parameter (required)
      if (formData.certificate_files?.[0]?.name) {
        // Keep query param for backward compatibility (main payload is multipart)
        queryParamsObj.certificate_file = formData.certificate_files[0].name;
      }

      const queryParams = new URLSearchParams(queryParamsObj);

      // Create FormData for the file upload (required)
      const formDataPayload = new FormData();
      // Backend expects:
      // - `certificate_files`: uploaded file(s)
      // - `certificate`: string array containing the file name(s)
      // (match the multipart form fields from the API docs)
      formData.certificate_files.forEach((file) => {
        formDataPayload.append('certificate_files', file);
      });
      formData.certificate_files.forEach((file) => {
        formDataPayload.append('certificate', file.name);
      });

      const response = await apiClient.post(
        `/api/tassealdateform/tas_seal_date_form_create?${queryParams.toString()}`,
        formDataPayload,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('API Response:', response.data);
      toast.success('K-Factor form submitted successfully!');

      // Reset form after successful submission
      handleReset();

      // Refresh data and return to table view
      await fetchAllKFactorData(0, itemsPerPage);
      setShowForm(false);

    } catch (error) {
      console.error('API Error:', error);
      toast.error('Failed to submit K-Factor form. Please try again.');
    }
  };

  // Handle form reset
  const handleReset = () => {
    setFormData({
      sap_id: "",
      location_name: "",
      zone: "",
      bcu_number: "",
      mfm_number: "",
      equipment_name: "",
      device_type: "",
      present_k_factor: "",
      past_k_factor: "",
      remarks: "",
      actual_w_and_m_seal_date: "",
      next_due_date: "",
      certificate_files: [],
    });
    setImagePreviews([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Also reset dropdown data
    setLocations([]);
    setBcuNumbers([]);
    setMfmNumbers([]);
    // Refetch all dropdown data to show all zones
    fetchDropdownData();
  };

  const handleCancel = () => {
    // Clear all form fields without refetching dropdowns/APIs.
    setFormData({
      sap_id: "",
      location_name: "",
      zone: "",
      bcu_number: "",
      mfm_number: "",
      equipment_name: "",
      device_type: "",
      present_k_factor: "",
      past_k_factor: "",
      remarks: "",
      actual_w_and_m_seal_date: "",
      next_due_date: "",
      certificate_files: [],
    });
    setImagePreviews([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setZones([]);
    setLocations([]);
    setBcuNumbers([]);
    setMfmNumbers([]);
    setShowForm(false);
  };

  // Handle certificate download (reuse same approach as AdminModuleDash)
  const handleDocumentDownload = async (row: any) => {
    const id = row?.id;
    const filePath = row?.certificate;

    if (!id || !filePath || downloadingCertificateId) return;

    setDownloadingCertificateId(id);
    try {
      const response = await apiClient.post(
        "/api/noticesvts/download_notice",
        { id, file_path: filePath },
        { responseType: "blob" }
      );

      const blobUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");
      const filename = filePath.split("/").pop() || `certificate_${id}.png`;
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Certificate downloaded successfully.");
    } catch (error) {
      console.error("Error downloading certificate:", error);
      toast.error("Failed to download certificate.");
    } finally {
      setDownloadingCertificateId(null);
    }
  };
 
  const fetchZonesFromLocationMaster = useCallback(async () => {
    try {
      const buForLocationApi = selectedBu === 'SOD' ? 'TAS' : selectedBu;
      const payload = {
        bu: buForLocationApi || 'TAS',
        zone: '',
        plant: '',
        location_onboard: true,
      };
      const response = await apiClient.post('/api/locationmaster/get_dist_loc_details', payload);
      const data = response?.data?.data;
      if (response?.data?.status === true && data) {
        if (data.zone) {
          const sortedZones = [...data.zone]
            .filter(
              (z: any) =>
                (z.name && String(z.name).trim() !== '') ||
                (z.id != null && String(z.id).trim() !== '')
            )
            .sort((a: any, b: any) =>
              (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
            )
            .map((z: any) => ({
              id: z.id != null && String(z.id).trim() !== '' ? String(z.id) : String(z.name),
              name: z.name || String(z.id ?? ''),
            }));
          setZones(sortedZones);
        } else {
          setZones([]);
        }

        if (data.sap_id) {
          const sortedLocations = [...data.sap_id]
            .filter((item: any) => item.id != null && String(item.id).trim() !== '')
            .sort((a: any, b: any) =>
              (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
            )
            .map((item: any) => ({
              id: String(item.id).trim(),
              name:
                item.name != null && String(item.name).trim() !== ''
                  ? String(item.name).trim()
                  : String(item.id),
            }));
          setLocations(sortedLocations);
        } else {
          setLocations([]);
        }
      } else {
        setZones([]);
        setLocations([]);
      }
    } catch (error) {
      console.error('Error fetching zones from location master:', error);
      setZones([]);
      setLocations([]);
    }
  }, [selectedBu]);

  const sapIdsFetchInFlightRef = useRef(false);
  const sapIdsFetchZoneRef = useRef<string | null>(null);
  const fetchSapIdsForZone = useCallback(async (zoneId: string) => {
    if (!zoneId) {
      setLocations([]);
      return [];
    }

    // Prevent duplicate calls when the user action triggers twice quickly
    // (same zone + request already in-flight).
    if (sapIdsFetchInFlightRef.current && sapIdsFetchZoneRef.current === zoneId) {
      return [];
    }

    sapIdsFetchInFlightRef.current = true;
    sapIdsFetchZoneRef.current = zoneId;
    try {
      const buForLocationApi = selectedBu === 'SOD' ? 'TAS' : selectedBu;
      const payload = {
        bu: buForLocationApi || 'TAS',
        zone: zoneId,
        plant: '',
        location_onboard: true,
      };
      const response = await apiClient.post('/api/locationmaster/get_dist_loc_details', payload);
      if (response?.data?.status === true && response.data.data?.sap_id) {
        const sortedLocations = [...response.data.data.sap_id]
          .filter((item: any) => item.id != null && String(item.id).trim() !== '')
          .sort((a: any, b: any) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
          )
          .map((item: any) => ({
            id: String(item.id).trim(),
            name:
              item.name != null && String(item.name).trim() !== ''
                ? String(item.name).trim()
                : String(item.id),
          }));
        setLocations(sortedLocations);
        return sortedLocations;
      } else {
        setLocations([]);
        return [];
      }
    } catch (error) {
      console.error('Error fetching SAP IDs from location master:', error);
      setLocations([]);
      return [];
    }
    finally {
      sapIdsFetchInFlightRef.current = false;
    }
  }, [selectedBu]);

  // Fetch all SAP IDs independent of zone (some users have SAPs that may not appear under a specific zone)
  const fetchAllSapIdsFromLocationMaster = useCallback(async () => {
    try {
      const buForLocationApi = selectedBu === 'SOD' ? 'TAS' : selectedBu;
      const payload = {
        bu: buForLocationApi || 'TAS',
        zone: '',
        plant: '',
        location_onboard: true,
      };

      const response = await apiClient.post('/api/locationmaster/get_dist_loc_details', payload);
      if (response?.data?.status === true && response.data.data?.sap_id) {
        const sortedLocations = [...response.data.data.sap_id]
          .filter((item: any) => item.id != null && String(item.id).trim() !== '')
          .sort((a: any, b: any) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
          )
          .map((item: any) => ({
            id: String(item.id).trim(),
            name:
              item.name != null && String(item.name).trim() !== ''
                ? String(item.name).trim()
                : String(item.id),
          }));
        setLocations(sortedLocations);
        return sortedLocations;
      }

      setLocations([]);
      return [];
    } catch (error) {
      console.error('Error fetching all SAP IDs from location master:', error);
      setLocations([]);
      return [];
    }
  }, [selectedBu]);

  const fetchDropdownData = async (filters: {
    specific_zone?: string[];
    specific_sap_id?: string[];
    specific_mfm_number?: string[];
    specific_bcu_number?: string[];
  } = {}) => {
    try {
      setLoadingDropdowns(true);
      console.log('Fetching dropdown data with filters:', filters);

      const isFullDropdownFetch =
        !filters.specific_zone?.length &&
        !filters.specific_sap_id?.length &&
        !filters.specific_mfm_number?.length &&
        !filters.specific_bcu_number?.length;

      if (isFullDropdownFetch) {
        await fetchZonesFromLocationMaster();
        setBcuNumbers([]);
        setMfmNumbers([]);
        return;
      }

      if (filters.specific_zone?.length && !filters.specific_sap_id?.length) {
        await fetchSapIdsForZone(filters.specific_zone[0]);
      }
  
      // Build query parameters
      const params = new URLSearchParams();
      
      if (filters.specific_zone?.length) {
        filters.specific_zone.forEach(zone => params.append('specific_zone', zone));
      }
      if (filters.specific_sap_id?.length) {
        filters.specific_sap_id.forEach(sapId => params.append('specific_sap_id', sapId));
      }
      if (filters.specific_mfm_number?.length) {
        filters.specific_mfm_number.forEach(mfm => params.append('specific_mfm_number', mfm));
      }
      if (filters.specific_bcu_number?.length) {
        filters.specific_bcu_number.forEach(bcu => params.append('specific_bcu_number', bcu));
      }
  
      const queryString = params.toString();
      const url = `/api/tassealdateform/get_filtered_mfm_data${queryString ? `?${queryString}` : ''}`;
      
      console.log('API URL:', url);
      // const response = await apiClient.post(url);
      // console.log('API response:', response.data);
      return;
  
      // if (false) {
        // Update dropdowns based on available data in response (SAP/location from location master only)
      //   const data: any = {};
  
      //   if (data.bcu_number) {
      //     const sortedBcuNumbers = [...data.bcu_number]
      //       .filter(item => item.id && item.id.trim() !== '')
      //       .sort((a: any, b: any) =>
      //         a.id.localeCompare(b.id, undefined, { sensitivity: 'base' })
      //       )
      //       .map(item => ({ id: item.id, name: item.id }));
      //     console.log('Setting BCU numbers:', sortedBcuNumbers);
      //     setBcuNumbers(sortedBcuNumbers);
      //   }
      //   if (data.mfm_number) {
      //     const sortedMfmNumbers = [...data.mfm_number]
      //       .filter(item => item.id && item.id.trim() !== '')
      //       .sort((a: any, b: any) =>
      //         a.id.localeCompare(b.id, undefined, { sensitivity: 'base' })
      //       )
      //       .map(item => ({ id: item.id, name: item.id }));
      //     console.log('Setting MFM numbers:', sortedMfmNumbers);
      //     setMfmNumbers(sortedMfmNumbers);
      //   }
      // }
    } catch (error) {
      console.error('Error fetching dropdown data:', error);
      // toast.error('Failed to load dropdown data');
    } finally {
      setLoadingDropdowns(false);
    }
  };

  const fetchDeviceTypeData = useCallback(
    async (deviceType: string, sapId: string, locationName: string) => {
      if (!deviceType || !sapId || !locationName) return;
      try {
        setLoadingDeviceTypeOptions(true);
        const payload = {
          sap_id: sapId,
          location_name: locationName,
          device_type: deviceType,
        };
        const response = await apiClient.post('/api/tassealdateform/get_filtered_mfm_data', payload);
        const data = response?.data?.data || response?.data || {};

        const parseIdOptions = (source: any) => {
          if (Array.isArray(source)) {
            return source
              .filter((item: any) => item?.id && String(item.id).trim() !== '')
              .sort((a: any, b: any) =>
                String(a.id).localeCompare(String(b.id), undefined, { sensitivity: 'base' })
              )
              .map((item: any) => ({ id: String(item.id), name: String(item.id) }));
          }
          return [];
        };

        if (deviceType === 'MFM') {
          const sortedMfmNumbers = parseIdOptions(
            Array.isArray(data) ? data : data.mfm_number
          );
          setMfmNumbers(sortedMfmNumbers);
        }

        if (deviceType === 'BCU') {
          const sortedBcuNumbers = parseIdOptions(
            Array.isArray(data) ? data : data.bcu_number
          );
          setBcuNumbers(sortedBcuNumbers);
        }
      } catch (error) {
        console.error('Error fetching device type data:', error);
      } finally {
        setLoadingDeviceTypeOptions(false);
      }
    },
    []
  );
  
  // Fetch all K-Factor data
  const fetchAllKFactorData = useCallback(async (page = currentPage, limit = itemsPerPage) => {
    console.log('fetchAllKFactorData called with page:', page, 'limit:', limit);
    setLoadingAllData(true);
    try {
      const params: any = {
        skip: page,
        limit: limit,
      };

      // Build query string with date, zone, and sap_id filters
      const query = buildQuery();
      if (query) {
        params.q = query;
      }

      // Add search_text parameter if search query is not empty
      if (debouncedSearchQuery.trim()) {
        params.search_text = debouncedSearchQuery;
      }

      console.log('API params:', params);

      const response = await apiClient.get('/api/tassealdateform', { params });
      console.log('All K-Factor Data:', response.data);

      // Handle different response structures
      const rows = response.data?.data;
      const total = response.data?.total || response.data?.count || rows?.length || 0;

      if (response.data && response.data.data) {
        setAllKFactorData(Array.isArray(response.data.data) ? response.data.data : []);
      } else if (Array.isArray(response.data)) {
        setAllKFactorData(response.data);
      } else {
        setAllKFactorData([]);
      }

      setTotalItems(typeof total === "number" ? total : 0);
    } catch (error) {
      console.error('Error fetching K-Factor data:', error);
      // toast.error('Failed to load K-Factor data');
      setAllKFactorData([]);
      setTotalItems(0);
    } finally {
      setLoadingAllData(false);
    }
  }, [currentPage, itemsPerPage, buildQuery, debouncedSearchQuery]);

  // Initial data load and refetch when filters change
  useEffect(() => {
    console.log('Fetching data with filters - page:', currentPage, 'zone:', selectedZone, 'plant:', selectedPlant, 'timeFilter:', selectedTimeFilter, 'searchQuery:', debouncedSearchQuery);
    fetchAllKFactorData(currentPage, itemsPerPage);
  }, [currentPage, itemsPerPage, selectedZone, selectedPlant, selectedTimeFilter, debouncedSearchQuery, fetchAllKFactorData]);

  // Fetch initial dropdown data on component mount (zones from location master when BU is known)
  useEffect(() => {
    fetchDropdownData();
  }, [selectedBu]);

  // Refetch all dropdown data when form is opened to show all zones
  useEffect(() => {
    if (showForm) {
      console.log('Form opened, refetching all dropdown data');
      // Refetch all dropdown data without filters to show all zones,
      // but avoid reloading if already present (prevents duplicate API calls)
      if (zones.length === 0 || locations.length === 0) {
        fetchDropdownData();
      }
    }
  }, [showForm]);

  // Autofill zone + sap_id from session when the form opens
  const didAutofillFromSessionRef = useRef(false);
  const pendingLocationNameFromSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!showForm) {
      didAutofillFromSessionRef.current = false;
      pendingLocationNameFromSessionRef.current = null;
      return;
    }
    if (!user) return;
    if (didAutofillFromSessionRef.current) return;
    didAutofillFromSessionRef.current = true;

    const userZones = Array.isArray(user.zone) ? user.zone : [];
    const userSapIds = Array.isArray(user.sap_id) ? user.sap_id : [];
    const sapIdValue = userSapIds.length ? String(userSapIds[0]) : "";

    if (!sapIdValue) return;

    const zoneValue = userZones.length ? String(userZones[0]) : "";

    // Prefill values (the Selects will render once dropdown options load)
    setFormData((prev) => ({
      ...prev,
      zone: zoneValue,
      sap_id: sapIdValue,
      location_name: "",
      bcu_number: "",
      mfm_number: "",
    }));
    pendingLocationNameFromSessionRef.current = sapIdValue;
  }, [showForm, user]);

  // Set location_name once locations list is available (no extra API call)
  useEffect(() => {
    if (!showForm) return;
    const pendingSapId = pendingLocationNameFromSessionRef.current;
    if (!pendingSapId) return;
    if (!locations.length) return;

    const match = locations.find((loc: any) => String(loc.id) === String(pendingSapId));
    if (match) {
      setFormData((prev) => ({
        ...prev,
        location_name: match.name ? match.name : "",
      }));
      pendingLocationNameFromSessionRef.current = null;
    }
  }, [showForm, locations]);

  // Refetch dropdown data when refresh is triggered
  useEffect(() => {
    if (refreshCounter > 0) {
      console.log('Refresh triggered, refetching dropdown data');
      // Clear form data and dropdown selections
      setFormData({
        sap_id: "",
        location_name: "",
        zone: "",
        bcu_number: "",
        mfm_number: "",
        equipment_name: "",
        device_type: "",
        present_k_factor: "",
        past_k_factor: "",
        remarks: "",
        actual_w_and_m_seal_date: "",
        next_due_date: "",
        certificate_files: [],
      });
      setLocations([]);
      setBcuNumbers([]);
      setMfmNumbers([]);
      pendingLocationNameFromSessionRef.current = null;
      setImagePreviews([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Refetch dropdown data
      fetchDropdownData();
    }
  }, [refreshCounter]);

  // Pagination functions
  const handlePageChange = (page: number) => {
    const maxPage = Math.max(0, Math.ceil(totalItems / itemsPerPage) - 1);
    const validPage = Math.max(0, Math.min(page, maxPage));
    setCurrentPage(validPage);
  };

  const handleItemsPerPageChange = (num: number) => {
    setItemsPerPage(num);
    setCurrentPage(0);
  };

  useEffect(() => {
    if (showForm) return;

    const updateScrollWidth = () => {
      const tableWidth = tableElementRef.current?.scrollWidth ?? 0;
      const containerWidth = tableScrollRef.current?.clientWidth ?? 0;
      setTableScrollWidth(Math.max(tableWidth, containerWidth));
    };

    updateScrollWidth();
    window.addEventListener('resize', updateScrollWidth);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateScrollWidth);
      if (tableElementRef.current) resizeObserver.observe(tableElementRef.current);
      if (tableScrollRef.current) resizeObserver.observe(tableScrollRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateScrollWidth);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [showForm, allKFactorData, itemsPerPage, loadingAllData]);

  const syncScrollFromTable = () => {
    if (isSyncingScrollRef.current) return;
    if (!tableScrollRef.current || !bottomScrollRef.current) return;
    isSyncingScrollRef.current = true;
    bottomScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  };

  const syncScrollFromBottom = () => {
    if (isSyncingScrollRef.current) return;
    if (!tableScrollRef.current || !bottomScrollRef.current) return;
    isSyncingScrollRef.current = true;
    tableScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  };

  return (
    <div className="bg-gray-100 p-2 space-y-2">
      <div className="bg-white p-2 !mt-0 rounded-xl shadow-sm border border-gray-100 mb-2">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bay Caliberation Dashboard</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* <Button
              onClick={() => {
                setRefreshCounter(prev => prev + 1);
              }}
              disabled={loadingAllData}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loadingAllData ? 'animate-spin' : ''}`} />
           
            </Button> */}
              <ReusableFilterBar
            key={refreshKey}
            refreshKey={refreshKey}
            selectedBu={selectedBu}
            onBuChange={setSelectedBu}
            selectedZone={selectedZone}
            onZoneChange={setSelectedZone}
            selectedPlant={selectedPlant}
            onPlantChange={setSelectedPlant}
            timeFilter={selectedTimeFilter}
            onTimeFilterChange={onTimeFilterChange}
            onRefresh={handleRefresh}
            isLoading={isRefreshing}
            hideBuSelect={true}
            // disableBuSelect={hasUserBu}
          />
          
          </div>
        </div>
      </div>
    
        {!showForm && (
          <div className="p-1">
            <div className="space-y-3 bg-white p-1">
              <div className="flex items-center justify-between mb-1 mt-1 gap-3">
                  <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by Zone, SAP ID, Location, Device Type, MFM/BCU Number..."
                        className="block w-full pl-10 pr-10 py-1.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center hover:bg-gray-100 rounded-r-lg transition-colors"
                        >
                          <XCircle className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                        </button>
                      )}
                  </div>
                  <button
                    type="button"
                      className="inline-flex items-center px-4 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
                      onClick={() => setShowForm(true)}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add K-Factor
                  </button>
              </div>
           
              <div className="border border-gray-200 overflow-hidden shadow-md bg-white rounded-lg">
                <div
                  ref={tableScrollRef}
                  onScroll={syncScrollFromTable}
                  className="overflow-x-auto overflow-y-auto max-h-[600px] relative kfactor-table-scroll"
                  // Keep the horizontal scrollbar space reserved and visible.
                  // (Helps when using macOS overlay scrollbars.)
                  style={{ scrollbarGutter: 'stable' }}
                >
                  <table ref={tableElementRef} className="w-max min-w-full divide-y divide-gray-200 relative">
                    <thead className="sticky top-0 z-10 bg-gradient-to-r from-blue-500 to-blue-600">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Zone
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          SAP ID
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Location Name
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Device Type
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          MFM Number
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          BCU Number
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Present K Factor
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Past K Factor
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Actual W&M Seal Date
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Next Due Date
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Certificate File
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                          Remarks
                        </th>
                      </tr>
                    </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {loadingAllData ? (
                      <tr>
                        <td
                          colSpan={12}
                          className="text-center py-4 text-xs text-gray-500 font-medium"
                        >
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                            <span>Loading K-Factor data...</span>
                          </div>
                        </td>
                      </tr>
                    ) : allKFactorData.length > 0 ? (
                      allKFactorData.map((item: any, index: number) => (
                        <tr key={item.id || index} className="hover:bg-blue-50">
                          <td className="px-2 py-2 text-xs text-gray-700 border-b whitespace-nowrap">{item.zone || '-'}</td>
                          <td className="px-2 py-2 text-xs whitespace-nowrap text-gray-700 border-b">{item.sap_id || '-'}</td>
                          <td className="px-2 py-2 text-xs whitespace-nowrap text-gray-700 border-b">{item.location_name || '-'}</td>
                          <td className="px-2 py-2 text-xs text-gray-700 border-b whitespace-nowrap">{item.device_type || '-'}</td>
                          <td className="px-2 py-2 text-xs text-gray-700 border-b whitespace-nowrap">{item.mfm_number || '-'}</td>
                          <td className="px-2 py-2 text-xs text-gray-700 border-b whitespace-nowrap">{item.bcu_number || '-'}</td>
                          <td className="px-2 py-2 text-xs text-gray-700 border-b whitespace-nowrap">{item.present_k_factor || '-'}</td>
                          <td className="px-2 py-2 text-xs text-gray-700 border-b whitespace-nowrap">{item.past_k_factor || '-'}</td>
                          <td className="px-2 py-2 text-xs text-gray-700 border-b whitespace-nowrap">{item.actual_w_and_m_seal_date ? new Date(item.actual_w_and_m_seal_date).toLocaleDateString() : '-'}</td>
                          <td className="px-2 py-2 text-xs text-gray-700 border-b whitespace-nowrap">{item.next_due_date ? new Date(item.next_due_date).toLocaleDateString() : '-'}</td>
                          <td className="px-2 py-2 text-xs text-gray-700 border-b whitespace-nowrap">
                            {item.certificate && item.id ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => handleDocumentDownload(item)}
                                      disabled={downloadingCertificateId === item.id}
                                      aria-label="Download certificate"
                                      className="text-blue-600 hover:text-blue-800 underline inline-flex items-center justify-center leading-none h-6 w-6 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                      {downloadingCertificateId === item.id ? (
                                        <>
                                          <RefreshCw className="h-3 w-3 animate-spin" />
                                        </>
                                      ) : (
                                        <>
                                          <Download className="h-3.5 w-3.5" />
                                        </>
                                      )}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Click to download certificate</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-2 py-2 text-xs text-gray-700 border-b whitespace-nowrap">{item.remarks || '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={12}
                          className="text-center py-4 text-xs text-blue-600"
                        >
                          No K-Factor data found.
                        </td>
                      </tr>
                    )}
                    </tbody>
                  </table>
                </div>
                <div
                  ref={bottomScrollRef}
                  onScroll={syncScrollFromBottom}
                  className="kfactor-bottom-scrollbar overflow-x-scroll overflow-y-hidden"
                >
                  <div style={{ width: `${tableScrollWidth}px`, height: '1px' }} />
                </div>
                <style>{`
                  .kfactor-bottom-scrollbar {
                    height: 6px;
                    background: transparent !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    scrollbar-width: auto !important;
                    scrollbar-color: rgba(140, 140, 140, 0.9) transparent !important;
                  }
                  .kfactor-bottom-scrollbar::-webkit-scrollbar {
                    height: 6px !important;
                    display: block !important;
                  }
                  .kfactor-bottom-scrollbar::-webkit-scrollbar-track {
                    background: transparent !important;
                  }
                  .kfactor-bottom-scrollbar:hover::-webkit-scrollbar-track {
                    background: transparent !important;
                  }
                  .kfactor-bottom-scrollbar::-webkit-scrollbar-thumb {
                    background: #9ca3af !important;
                    border-radius: 9999px !important;
                  }
                  .kfactor-bottom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #6b7280 !important;
                  }
                  .kfactor-bottom-scrollbar::-webkit-scrollbar-corner {
                    background: transparent !important;
                  }
                `}</style>

                <div className="!mt-0 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-1.5 border-t border-gray-300 flex items-center justify-between mt-4 shadow-sm">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">Show</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                        className="px-2 py-1 text-sm border-2 border-gray-300 bg-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors font-medium"
                      >
                        {[5, 10, 25, 50, 100].map((num) => (
                          <option key={num} value={num}>
                            {num}
                          </option>
                        ))}
                      </select>
                      <span className="text-sm font-medium text-gray-700">entries</span>
                    </div>
                    <div className="text-sm font-medium text-gray-700 bg-white px-2 py-1 border border-gray-200 shadow-sm">
                      Showing{" "}
                      <span className="font-bold text-gray-900">{totalItems > 0 ? currentPage * itemsPerPage + 1 : 0}</span> to{" "}
                      <span className="font-bold text-gray-900">{Math.min((currentPage + 1) * itemsPerPage, totalItems)}</span> of{" "}
                      <span className="font-bold text-gray-900">{totalItems}</span> entries
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 0}
                      className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, Math.ceil(totalItems / itemsPerPage)) }, (_, i) => {
                        let pageNum: number;
                        const totalPages = Math.ceil(totalItems / itemsPerPage);

                        if (totalPages <= 5) {
                          pageNum = i;
                        } else if (currentPage <= 2) {
                          pageNum = i;
                        } else if (currentPage >= totalPages - 3) {
                          pageNum = totalPages - 5 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`px-3 py-1 text-sm font-medium transition-colors ${currentPage === pageNum
                              ? "bg-blue-500 text-white"
                              : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-blue-400"
                              }`}
                          >
                            {pageNum + 1}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= Math.ceil(totalItems / itemsPerPage) - 1}
                      className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 hover:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
        </div>
        )}

        {/* Show form when showForm is true */}
        {showForm && (
          <Card>
          {/* <CardHeader>
            <CardTitle>Equipment Details</CardTitle>
          </CardHeader> */}
          <CardContent className="p-6">
            {/* Row 1: SAP ID, Location Name, Zone */}
            <div className="grid grid-cols-1 md:grid-cols-3 mb-6 gap-6">
            <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Zone<span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.zone}
                  onValueChange={(value) => {
                    handleInputChange("zone", value);
                    // Reset dependent fields when zone changes
                    handleInputChange("sap_id", "");
                    handleInputChange("location_name", "");
                    handleInputChange("bcu_number", "");
                    handleInputChange("mfm_number", "");
                    pendingLocationNameFromSessionRef.current = null;
                    if (value && shouldLoadSapOnZoneChange) {
                      // Session doesn't have zone/sap_id -> restore previous behavior:
                      // load SAP IDs based on selected zone only.
                      setLocations([]);
                      fetchSapIdsForZone(value);
                    }
                  }}
                  disabled={loadingDropdowns && zones.length === 0}
                >
                  <SelectTrigger className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700">
                    {loadingDropdowns && zones.length === 0 ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                        <span className="text-gray-500">Loading zones...</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Select Zone" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {loadingDropdowns && zones.length === 0 ? (
                      <SelectItem value="loading" disabled>
                        Loading zones...
                      </SelectItem>
                    ) : zones.length > 0 ? (
                      zones.map((zone: any) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-data" disabled>
                        No zones available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  SAP ID<span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.sap_id}
                  onValueChange={(value) => {
                    const selectedLocation = locations.find(
                      (loc: any) => String(loc.id) === String(value)
                    );
                    handleInputChange("sap_id", value);
                    handleInputChange(
                      "location_name",
                      selectedLocation ? selectedLocation.name : ""
                    );
                    // Reset dependent fields when SAP ID changes
                    handleInputChange("bcu_number", "");
                    handleInputChange("mfm_number", "");
                    pendingLocationNameFromSessionRef.current = null;
                  }}
                  disabled={loadingDropdowns || (shouldLoadSapOnZoneChange && !formData.zone)}
                >
                  <SelectTrigger className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700">
                    {loadingDropdowns ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                        <span className="text-gray-500">Loading SAP IDs...</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Select SAP ID" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {loadingDropdowns ? (
                      <SelectItem value="loading" disabled>
                        Loading SAP IDs...
                      </SelectItem>
                    ) : shouldLoadSapOnZoneChange && !formData.zone ? (
                      <SelectItem value="select-zone" disabled>
                        Select a zone first
                      </SelectItem>
                    ) : locations.length > 0 ? (
                      locations.map((location: any) => (
                        <SelectItem key={location.id} value={String(location.id)}>
                          {location.id}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-data" disabled>
                        No SAP IDs available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Location Name<span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={formData.location_name}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 bg-gray-50"
                  placeholder="Location name will be auto-populated"
                />
              </div>
    
            </div>
          <div className="grid grid-cols-1 md:grid-cols-3 mb-6 gap-6">
            <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Device Type<span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.device_type}
                  onValueChange={(value) => {
                    handleInputChange("device_type", value);
                    // Reset BCU and MFM numbers when device type changes
                    handleInputChange("bcu_number", "");
                    handleInputChange("mfm_number", "");
                    setBcuNumbers([]);
                    setMfmNumbers([]);

                    if (value && formData.sap_id && formData.location_name) {
                      fetchDeviceTypeData(value, formData.sap_id, formData.location_name);
                    }
                  }}
                >
                  <SelectTrigger className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700">
                    <SelectValue placeholder="Select Device Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MFM">MFM</SelectItem>
                    <SelectItem value="BCU">BCU</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.device_type === "BCU" && (
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    BCU Number<span className="text-red-500">*</span>
                  </label>
                  {!loadingDeviceTypeOptions && bcuNumbers.length === 0 ? (
                    <Input
                      type="text"
                      value={formData.bcu_number}
                      disabled={!formData.sap_id || !formData.location_name}
                      onChange={(e) => handleInputChange("bcu_number", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                      placeholder="Enter BCU Number"
                    />
                  ) : (
                    <Select
                      value={formData.bcu_number}
                      onValueChange={(value) => {
                        handleInputChange("bcu_number", value);
                        // No need to fetch MFM numbers when BCU is selected
                      }}
                      disabled={loadingDeviceTypeOptions || !formData.sap_id || !formData.location_name}
                    >
                      <SelectTrigger className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700">
                        {loadingDeviceTypeOptions && formData.location_name ? (
                          <div className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                            <span className="text-gray-500">Loading BCU numbers...</span>
                          </div>
                        ) : (
                          <SelectValue placeholder="Select BCU Number" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {loadingDeviceTypeOptions ? (
                          <SelectItem value="loading" disabled>
                            Loading BCU numbers...
                          </SelectItem>
                        ) : bcuNumbers.length > 0 ? (
                          bcuNumbers.map((bcu: any) => (
                            <SelectItem key={bcu.id} value={bcu.id}>
                              {bcu.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-data" disabled>
                            No BCU numbers available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {formData.device_type === "MFM" && (
                <div>
                  <label className="block text-sm text-gray-700 mb-2">
                    MFM Number<span className="text-red-500">*</span>
                  </label>
                  {!loadingDeviceTypeOptions && mfmNumbers.length === 0 ? (
                    <Input
                      type="text"
                      value={formData.mfm_number}
                      disabled={!formData.sap_id || !formData.location_name}
                      onChange={(e) => handleInputChange("mfm_number", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                      placeholder="Enter MFM Number"
                    />
                  ) : (
                    <Select
                      value={formData.mfm_number}
                      onValueChange={(value) => {
                        handleInputChange("mfm_number", value);
                      }}
                      disabled={loadingDeviceTypeOptions || !formData.sap_id || !formData.location_name}
                    >
                      <SelectTrigger className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700">
                        {loadingDeviceTypeOptions && formData.location_name ? (
                          <div className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                            <span className="text-gray-500">Loading MFM numbers...</span>
                          </div>
                        ) : (
                          <SelectValue placeholder="Select MFM Number" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {loadingDeviceTypeOptions ? (
                          <SelectItem value="loading" disabled>
                            Loading MFM numbers...
                          </SelectItem>
                        ) : mfmNumbers.length > 0 ? (
                          mfmNumbers.map((mfm: any) => (
                            <SelectItem key={mfm.id} value={mfm.id}>
                              {mfm.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-data" disabled>
                            No MFM numbers available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Present K Factor
                </label>
                <Input
                  type="text"
                  value={formData.present_k_factor}
                  onChange={(e) => handleInputChange("present_k_factor", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                  placeholder="Enter Present K Factor"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Past K Factor
                </label>
                <Input
                  type="text"
                  value={formData.past_k_factor}
                  onChange={(e) => handleInputChange("past_k_factor", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                  placeholder="Enter Past K Factor"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">
                  Remarks
                </label>
                <Input
                  type="text"
                  value={formData.remarks}
                  onChange={(e) => handleInputChange("remarks", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                  placeholder="Enter Remarks"
                />
              </div>
           
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">
                      Actual W&M Seal Date<span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={formData.actual_w_and_m_seal_date}
                      onChange={(e) => handleInputChange("actual_w_and_m_seal_date", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">
                      Next Due Date<span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={formData.next_due_date}
                      onChange={(e) => handleInputChange("next_due_date", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                    />
                  </div>
                  <div>
              <label className="block text-sm text-gray-700 mb-2">
                Certificate File<span className="text-red-500">*</span> (Max 8MB)
              </label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                onChange={handleFileChange}
              />

              {imagePreviews.some((p) => p) && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {imagePreviews.map((preview, idx) =>
                    preview ? (
                      <div
                        key={idx}
                        className="border border-gray-300 rounded-lg p-2 bg-gray-50 relative flex-shrink-0"
                      >
                        <button
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg transition-colors z-10"
                          type="button"
                          aria-label="Remove image"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <img
                          src={preview}
                          alt="Certificate preview"
                          className="w-[180px] sm:w-[220px] max-h-64 h-auto rounded object-contain"
                        />
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-4 border-t">
           
              <Button
                onClick={handleCancel}
                variant="outline"
                className="px-6 py-2"
              >
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
              >
                Submit
              </Button>
            </div>
            
          </CardContent>
        </Card>
        )}
      </div>
    // </div>
  );
};

export default KFactor;

