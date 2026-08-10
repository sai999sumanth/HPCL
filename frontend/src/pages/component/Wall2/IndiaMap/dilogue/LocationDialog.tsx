import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../../../../src/@/components/ui/dialog";
import { MapPin, Activity, TrendingUp, Database, Factory, Loader2, Users, Phone, X, Award, UserRoundCheck, Calendar, Weight, Building } from "lucide-react";
import axios from 'axios';
import { apiClient } from "@/services/apiClient";

export interface LocationData {
  [key: string]: string | number | boolean | null;
  name: string;
}

export interface SalesOfficer {
    id: string;
    name: string;
    designation?: string;
    phone?: string;
    email?: string;
    location?: string;
    sbu?: string;
    zone?: string;
    state?: string;
    district?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    sap_id?: string;
    contact_number?: string;
    novex_role?: string[];
    [key:string]: any;
}

interface LocationDialogProps {
  selectedLocation: LocationData | null;
  onClose: () => void;
}

const excludedKeys = ["latitude", "longitude", "color_code", "name"];

const formatLabel = (label: string) =>
  label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// API function for sales data using axios
const fetchLocationData = async (sapId: string | number | null, sbu: string | number | null) => {
  if (!sapId) {
    throw new Error("SAP ID is required");
  }
  const payload = { 
    filters: [{ key: "sap_id", cond: "=", value: String(sapId) }], 
    drill_state: "", 
    cross_filters: [], 
    limit: 0, 
    time_grain: "" 
  };
  
  const response = await apiClient.post('/api/sodinfra/get_sales_infra', payload, {
    headers: { 
      'Content-Type': 'application/json', 
      'Accept': 'application/json' 
    } 
  });
  
  return response.data;
};

// API function for plant officers
const fetchOfficersData = async (sapId: string | number | null, sbu: string | number | null) => {
    if (!sapId || !sbu) {
        throw new Error("SAP ID and SBU are required to fetch officers.");
    }
    const payload = { sbu, sap_id: String(sapId) };
    const response = await apiClient.post('/api/sodinfra/get_sales_officer_infra', payload);
    return response.data?.data || [];
};

const LocationDialog: React.FC<LocationDialogProps> = ({
  selectedLocation,
  onClose,
}) => {
  const [componentView, setComponentView] = useState<'dialog' | 'officersPage' | 'salesPage'>('dialog');
  const [salesData, setSalesData] = useState<any>(null);
  const [officersData, setOfficersData] = useState<SalesOfficer[]>([]);
  
  const [loadingView, setLoadingView] = useState<'sales' | 'plant' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedLocation) {
      setComponentView('dialog');
      setSalesData(null);
      setOfficersData([]);
      setError(null);
      setLoadingView(null);
    }
  }, [selectedLocation]);

  if (!selectedLocation) return null;

  const getValue = (key: string): string | number | null => {
    const value = selectedLocation[key];
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return value ?? null;
  };

  const sbu = getValue("sbu");
  const sapId = getValue("sap_id");
  const zone = getValue("zone");
  const company = getValue("company");
  const state = getValue("state");
  const district = getValue("district");
  const city = getValue("city");
  const region = getValue("region");
  const locationName = getValue("location_name");
  const address = getValue("address");

  const displayData = Object.entries(selectedLocation).filter(
    ([key]) =>
      !excludedKeys.includes(key) &&
      !["sbu", "sap_id", "zone", "company", "state", "district", "city", "region", "location_name", "address"].includes(key)
  );

  const handleShowSales = async () => {
    if (typeof sapId !== 'string' && typeof sapId !== 'number') {
        setError("A valid SAP ID is required to fetch sales data.");
        setComponentView('salesPage');
        return;
    }
    setLoadingView('sales');
    setError(null);
    try {
        if (!salesData) {
            const data = await fetchLocationData(sapId, sbu);
            setSalesData(data);
        }
        setComponentView('salesPage');
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch sales data');
        setComponentView('salesPage');
    } finally {
        setLoadingView(null);
    }
  };

  const handleShowOfficers = async () => {
    if ((typeof sapId !== 'string' && typeof sapId !== 'number') || (typeof sbu !== 'string' && typeof sbu !== 'number')) {
      setError("A valid SAP ID and SBU are required to fetch officer data.");
      setComponentView('officersPage');
      return;
    }
    setLoadingView('plant');
    setError(null);
    try {
        if (officersData.length === 0) {
            const data = await fetchOfficersData(sapId, sbu);
            setOfficersData(data);
        }
        setComponentView('officersPage');
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch officer data');
        setComponentView('officersPage');
    } finally {
        setLoadingView(null);
    }
  };

  const normalizeApiData = (data: any) => {
    if (!data) return [];
    if (data.data && Array.isArray(data.data)) return data.data;
    if (data.data && typeof data.data === 'object') return [data.data];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object' && data !== null) return [data];
    return [];
  };

  const salesTableData = normalizeApiData(salesData);

  if (componentView === 'officersPage') {
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setComponentView('dialog')}>
            <div className="w-full max-w-4xl bg-gradient-to-br from-[#2c2a4a] to-[#1f1d36] rounded-2xl shadow-2xl p-6 text-white" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-400/30">
                            <Users className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xl font-bold">Plant Officers</p>
                            <p className="text-sm text-slate-400">{selectedLocation.name}</p>
                        </div>
                    </div>
                    <button onClick={() => setComponentView('dialog')} className="p-2 rounded-lg bg-slate-200/10 hover:bg-slate-200/20 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loadingView === 'plant' && <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>}
                
                {error && <div className="text-red-400 text-sm text-center p-4 bg-red-900/20 rounded-lg border border-red-700">Error: {error}</div>}

                {!loadingView && !error && (
                    <div className="bg-slate-900/50 rounded-lg overflow-hidden">
                        <div className="flex px-6 py-3 bg-slate-800/60 border-b border-slate-700">
                            <div className="w-4/12 flex items-center gap-2 text-sm text-slate-400 font-semibold"><Users className="w-4 h-4 text-blue-400" />Name</div>
                            <div className="w-2/12 flex items-center gap-2 text-sm text-slate-400 font-semibold"><Award className="w-4 h-4 text-blue-400" />User ID</div>
                            <div className="w-3/12 flex items-center gap-2 text-sm text-slate-400 font-semibold"><UserRoundCheck className="w-4 h-4 text-blue-400" />Roles</div>
                            <div className="w-3/12 flex items-center gap-2 text-sm text-slate-400 font-semibold"><Phone className="w-4 h-4 text-blue-400" />Contact</div>
                        </div>
                        <div className="max-h-[50vh] overflow-y-auto">
                            {officersData.length > 0 ? (
                                officersData.map((officer) => (
                                <div key={officer.id || officer.username} className="flex items-center py-4 px-6 border-b border-slate-800 last:border-b-0 hover:bg-slate-800/40 transition-colors">
                                    <div className="w-4/12 flex items-center gap-3 pr-4">
                                        <div className="w-9 h-9 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center font-semibold border border-slate-600 text-orange-300">
                                            {(officer.first_name?.[0] || officer.name?.[0] || '?').toUpperCase()}
                                        </div>
                                        <div className="font-medium text-white leading-tight">
                                            {officer.first_name && officer.last_name ? `${officer.first_name} ${officer.last_name}`.trim() : officer.name || 'Unknown'}
                                        </div>
                                    </div>
                                    <div className="w-2/12">
                                        <span className="text-xs px-2 py-1 bg-blue-600/50 text-blue-300 rounded-md border border-blue-400/30 font-mono">
                                            {officer.username || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="w-3/12">
                                        <div className="flex flex-wrap gap-2">
                                            {officer.novex_role?.length ? officer.novex_role.map((role) => (
                                                <span key={role} className="text-xs px-2.5 py-1 bg-green-600/30 text-green-300 rounded-full border border-green-500/30">
                                                {role}
                                                </span>
                                            )) : <span className="text-slate-500 text-xs">No roles</span>}
                                        </div>
                                    </div>
                                    <div className="w-3/12">
                                        <div className="flex items-center gap-2 text-white">
                                            {officer.contact_number ? (
                                                <>
                                                <Phone className="w-4 h-4 text-green-400 flex-shrink-0" />
                                                <span>{officer.contact_number}</span>
                                                </>
                                            ) : <span className="text-slate-500 text-xs">No contact</span>}
                                        </div>
                                    </div>
                                </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center h-48 text-center">
                                    <Users className="w-12 h-12 text-slate-500 mb-4" />
                                    <h4 className="font-semibold text-lg text-slate-300">No Plant Officers Found</h4>
                                    <p className="text-sm text-slate-500">No officers are currently assigned to this location.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
  }

  if (componentView === 'salesPage') {
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setComponentView('dialog')}>
            <div className="w-full max-w-5xl bg-gradient-to-br from-[#1d3c3a] to-[#1f2d36] rounded-2xl shadow-2xl p-6 text-white" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center border border-green-400/30">
                            <TrendingUp className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <p className="text-xl font-bold">Sales Data</p>
                            <p className="text-sm text-slate-400">{selectedLocation.name}</p>
                        </div>
                    </div>
                    <button onClick={() => setComponentView('dialog')} className="p-2 rounded-lg bg-slate-200/10 hover:bg-slate-200/20 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loadingView === 'sales' && <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-green-400" /></div>}
                
                {error && <div className="text-red-400 text-sm text-center p-4 bg-red-900/20 rounded-lg border border-red-700">Error: {error}</div>}

                {!loadingView && !error && (
                    <div className="bg-slate-900/50 rounded-lg overflow-hidden">
                        {salesTableData.length > 0 ? (
                            <>
                                <div className="flex px-6 py-3 bg-slate-800/60 border-b border-slate-700">
                                    {Object.keys(salesTableData[0]).map((key) => (
                                        <div key={key} className="flex-1 flex items-center gap-2 text-sm text-slate-400 font-semibold">
                                            {formatLabel(key)}
                                        </div>
                                    ))}
                                </div>
                                <div className="max-h-[50vh] overflow-y-auto">
                                    {salesTableData.map((record: any, index: number) => (
                                        <div key={index} className="flex items-center py-4 px-6 border-b border-slate-800 last:border-b-0 hover:bg-slate-800/40 transition-colors">
                                            {Object.keys(record).map((key) => (
                                                <div key={key} className="flex-1 font-medium text-white">
                                                    {typeof record[key] === 'number' ? record[key].toFixed(2) : String(record[key] ?? 'N/A')}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-48 text-center">
                                <TrendingUp className="w-12 h-12 text-slate-500 mb-4" />
                                <h4 className="font-semibold text-lg text-slate-300">No Sales Data Found</h4>
                                <p className="text-sm text-slate-500">No sales records are available for this location.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
  }

  return (
    <Dialog open={componentView === 'dialog'} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl bg-[#0A131C] text-white border border-white shadow-xl rounded-xl p-4">
        <DialogHeader className="border-b border-white pb-3 mb-3">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-blue-400">
            <MapPin className="w-4 h-4 text-slate-400" />
                            <p className="text-sm text-slate-400">{selectedLocation.name}</p>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="SBU" value={sbu} />
            <Field label="SAP ID" value={sapId} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Zone" value={zone} />
            <Field label="Company" value={company} />
          </div>
          <p className="text-xs font-bold text-blue-300 uppercase border-b border-white/20 pb-1 tracking-wide">Location Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="State" value={state} />
            <Field label="District" value={district} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="City" value={city} />
            <Field label="Region" value={region} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Location Name" value={locationName} />
            <Field label="Address" value={address} />
          </div>
          {displayData.length > 0 && (
            <>
              <p className="text-xs font-bold text-blue-300 uppercase border-b border-white/20 pb-1 mt-2 tracking-wide">Other Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayData.map(([key, value]) => (
                  <Field key={key} label={formatLabel(key)} value={typeof value === "boolean" ? (value ? "Yes" : "No") : value ?? "-"}/>
                ))}
              </div>
            </>
          )}
          <div className="flex justify-center gap-4 pt-4 border-t border-white/20 mt-4">
            <button onClick={handleShowSales} disabled={loadingView !== null} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-green-500/25">
              {loadingView === 'sales' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {loadingView === 'sales' ? "Loading..." : "Sales Data"}
            </button>
            <button onClick={handleShowOfficers} disabled={loadingView !== null} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-all duration-200 shadow-lg hover:shadow-orange-500/25">
              {loadingView === 'plant' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Factory className="w-4 h-4" />}
              {loadingView === 'plant' ? "Loading..." : "Plant Officers"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Field: React.FC<{ label: string; value: string | number | null }> = ({ label, value }) => (<div className="flex flex-col"><span className="text-[15px] text-gray-400">{label}</span><span className="text-xs font-medium text-gray-100 truncate">{value || "-"}</span></div>);

export default LocationDialog;