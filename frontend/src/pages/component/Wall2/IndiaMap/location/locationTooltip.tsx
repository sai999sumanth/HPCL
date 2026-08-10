import React, { useEffect, useState, useRef } from 'react';
import { MapPin, Users, RefreshCw, Phone, Mail, X, Eye, Building, Navigation, Award, MapPinIcon, SendHorizonal, Building2, FileBadge2, FileBadge, CircleUserRound, UserRoundCheck } from 'lucide-react';
import axios from 'axios';
import { apiClient } from '@/services/apiClient';

// Types
export interface Location {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    color_code?: string;
    sbu?: string;
    state?: string;
    zone?: string;
    district?: string;
    company?: string;
    location_name?: string;
    sap_id?: string;
    [key: string]: any;
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
    novex_role?: string[];
    [key: string]: any;
}

interface LocationTooltipProps {
    location: Location;
    salesOfficers: SalesOfficer[];
    onClose: () => void;
    position: { x: number; y: number };
}

// Sales Officers Modal Component
const SalesOfficersModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    officers: SalesOfficer[];
    locationName: string;
}> = ({ isOpen, onClose, officers, locationName }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-in fade-in-0 duration-300">
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl ring-1 ring-white/10 max-w-5xl w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
                {/* Enhanced Header with Gradient */}
                <div className="bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20 border-b border-slate-700/50 backdrop-blur-sm">
                    <div className="flex items-center justify-between p-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-400/30">
                                <Users className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-3xl text-slate-300 ">
                                    Plant Officers
                                </p>


                                <p className="text-sm text-slate-300">{locationName}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className=" hover:scale-105"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Enhanced Table with Better Styling */}
                <div className="overflow-auto max-h-[65vh] scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
                    <table className="w-full">
                        <thead className="bg-gradient-to-r from-slate-800/80 to-slate-700/80 sticky top-0 z-10 backdrop-blur-sm">
                            <tr>
                                {[
                                    { label: 'Name', icon: Users },
                                    { label: 'User ID ', icon: Award },
                                    { label: 'Roles', icon: UserRoundCheck },
                                    { label: 'Contact ', icon: Phone }
                                ].map((header, index) => (
                                    <th key={header.label} className="text-left p-4 text-sm font-semibold text-slate-200 border-b border-slate-600/50">
                                        <div className="flex items-center gap-2">
                                            <header.icon className="w-4 h-4 text-blue-400" />
                                            {header.label}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {officers.map((officer, index) => (
                                <tr
                                    key={officer.username || officer.sap_id || index}
                                    className="border-b border-slate-700/30 hover:bg-gradient-to-r hover:from-slate-800/50 hover:to-slate-700/30 transition-all duration-200 group"
                                >
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center border border-blue-400/20 group-hover:border-blue-400/40 transition-all duration-200">
                                                <span className="text-blue-300 font-semibold text-sm">
                                                    {(officer.first_name?.[0] || officer.name?.[0] || officer.username?.[0] || '?').toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-white text-base">
                                                    {officer.first_name && officer.last_name
                                                        ? `${officer.first_name} ${officer.last_name}`.trim()
                                                        : officer.name || officer.username || 'Unknown'}
                                                </div>
                                                {officer.designation && (
                                                    <div className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                                                        <Building className="w-3 h-3" />
                                                        {officer.designation}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="space-y-2">
                                            {officer.username && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded-md border border-blue-400/20 font-mono">
                                                        {officer.username}
                                                    </span>
                                                </div>
                                            )}
                                            {officer.sap_id && (
                                                <div className="flex items-center gap-2">

                                                </div>
                                            )}
                                        </div>
                                        {!officer.username && !officer.sap_id && (
                                            <span className="text-slate-500 text-sm">No ID available</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        {officer.novex_role?.length ? (
                                            <div className="flex flex-wrap gap-2">
                                                {officer.novex_role.map((role, roleIndex) => (
                                                    <span
                                                        key={roleIndex}
                                                        className="text-xs px-3 py-1.5 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-400/30 rounded-full text-emerald-100 font-medium hover:from-emerald-500/30 hover:to-teal-500/30 transition-all duration-200"
                                                    >
                                                        {role}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-slate-500 text-sm">No roles assigned</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <div className="space-y-2">
                                            {officer.contact_number && (
                                                <div className="flex items-center gap-2 text-slate-300 hover:text-green-300 transition-colors">
                                                    <Phone className="w-4 h-4 text-green-400" />
                                                    <span className="text-sm font-medium">{officer.contact_number}</span>
                                                </div>
                                            )}
                                            {officer.email && (
                                                <div className="flex items-center gap-2 text-slate-300 hover:text-blue-300 transition-colors">
                                                    <Mail className="w-4 h-4 text-blue-400" />
                                                    <span className="text-sm font-medium">{officer.email}</span>
                                                </div>
                                            )}
                                        </div>
                                        {!officer.contact_number && !officer.email && (
                                            <span className="text-slate-500 text-sm">No contact info</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const LocationTooltip: React.FC<LocationTooltipProps> = ({ location, salesOfficers, onClose, position }) => {
    const [locationSpecificOfficers, setLocationSpecificOfficers] = useState<SalesOfficer[]>([]);
    const [isLoadingLocationOfficers, setIsLoadingLocationOfficers] = useState(false);
    const [showOfficersModal, setShowOfficersModal] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchLocationOfficers = async () => {
            if (location.sap_id && location.sbu) {
                setIsLoadingLocationOfficers(true);
                try {
                    const payload = { sbu: location.sbu, sap_id: location.sap_id };
                    const response = await apiClient.post('/api/sodinfra/get_sales_officer_infra', payload);
                    const data = response.data?.data || [];
                    setLocationSpecificOfficers(data);
                } catch (error) {
                    const filtered = salesOfficers.filter(officer =>
                        [officer.sap_id, officer.location, officer.district, officer.zone, officer.state]
                            .includes(location.sap_id || location.location_name || location.district || location.zone || location.state)
                    );
                    setLocationSpecificOfficers(filtered);
                } finally {
                    setIsLoadingLocationOfficers(false);
                }
            } else {
                const filtered = salesOfficers.filter(officer =>
                    [officer.location, officer.district, officer.zone, officer.state]
                        .includes(location.location_name || location.district || location.zone || location.state)
                );
                setLocationSpecificOfficers(filtered);
            }
        };
        fetchLocationOfficers();
    }, [location, salesOfficers]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const tooltipWidth = 480;
    const tooltipHeight = 400;
    const padding = 20;
    let left = position.x;
    let top = position.y;
    if (left + tooltipWidth > window.innerWidth - padding) left = window.innerWidth - tooltipWidth - padding;
    if (left < padding) left = padding;
    if (top + tooltipHeight > window.innerHeight - padding) top = window.innerHeight - tooltipHeight - padding;
    if (top < padding) top = padding;

    return (
        <>
            <div
                ref={tooltipRef}
                className="fixed z-50 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                style={{ left, top }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Glassmorphism Container */}
                <div className="bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 backdrop-blur-xl border border-slate-600/40 rounded-2xl shadow-2xl p-6 min-w-[480px] max-w-[520px] ring-1 ring-white/10 overflow-hidden relative">

                    {/* Background Pattern */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-400/10 to-transparent rounded-full blur-2xl pointer-events-none" />

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 rounded-full hover:scale-105 z-10"
                    >
                        <X className="w-4 h-4" />
                    </button>


                    {/* Header Section with Enhanced Styling */}
                    <div className="mb-6 pb-4 border-b border-slate-600/30 relative">
                        <div className="flex items-start gap-3 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center border border-blue-400/30 shadow-lg">
                                <MapPin className="w-6 h-6 text-blue-400" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xl font-bold text-white tracking-tight mb-1">
                                    {location.location_name || location.name}
                                </p>
                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                    <Navigation className="w-3 h-3" />
                                    <span>Plant Location Details</span>
                                </div>
                            </div>
                        </div>

                        {/* Enhanced Info Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                                {location.company && (
                                    <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700/30">
                                        <Building2 className="w-4 h-4 text-orange-400 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs text-slate-400">Company</div>
                                            <div className="text-sm text-white font-medium truncate">{location.company}</div>
                                        </div>
                                    </div>
                                )}
                                {location.sbu && (
                                    <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700/30">
                                        <FileBadge className="w-4 h-4 text-purple-400 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs text-slate-400">SBU</div>
                                            <div className="text-sm text-white font-medium truncate">{location.sbu.toUpperCase()}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-3">
                                {location.zone && (
                                    <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700/30">
                                        <SendHorizonal className="w-4 h-4 text-green-400 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs text-slate-400">Zone</div>
                                            <div className="text-sm text-white font-medium truncate">{location.zone}</div>
                                        </div>
                                    </div>
                                )}
                                {location.state && (
                                    <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700/30">
                                        <MapPinIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs text-slate-400">State</div>
                                            <div className="text-sm text-white font-medium truncate">{location.state}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Officers Section */}
                    {isLoadingLocationOfficers ? (
                        <div className="flex flex-col items-center justify-center py-8 space-y-3">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center border border-blue-400/30">
                                <RefreshCw className="w-6 h-6 text-blue-400 animate-spin" />
                            </div>
                            <div className="text-center">
                                <div className="text-white font-medium mb-1">Loading Plant Officers</div>
                                <div className="text-sm text-slate-400">Please wait while we fetch the latest data...</div>
                            </div>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-lg flex items-center justify-center border border-emerald-400/30">
                                        <Users className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-semibold text-white">Plant Officers</p>
                                        <div className="text-xs text-slate-400">
                                            {locationSpecificOfficers.length} {locationSpecificOfficers.length === 1 ? 'officer' : 'officers'} found
                                        </div>
                                    </div>
                                </div>
                                {locationSpecificOfficers.length > 0 && (
                                    <button
                                        onClick={() => setShowOfficersModal(true)}
                                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600/30 to-blue-500/30 hover:from-blue-600/50 hover:to-blue-500/50 border border-blue-400/40 rounded-xl text-sm font-medium text-blue-100 transition-all duration-200 hover:scale-105 shadow-lg"
                                    >
                                        <Eye className="w-4 h-4" />
                                        View All
                                    </button>
                                )}
                            </div>

                            {locationSpecificOfficers.length > 0 ? (
                                <>
                                    {locationSpecificOfficers.slice(0, 1).map((officer, index) => (
                                        <div
                                            key={officer.username || officer.sap_id || index}
                                            className="bg-gradient-to-br from-slate-800/80 to-slate-700/50 rounded-xl p-4 border border-slate-700/50 shadow-lg relative overflow-hidden"
                                        >
                                            {/* Card Background Pattern */}
                                            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-400/5 to-transparent rounded-full blur-xl pointer-events-none" />

                                            <div className="flex items-start justify-between mb-4 relative">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center border border-blue-400/30 shadow-lg">
                                                        <span className="text-blue-300 font-bold text-lg">
                                                            {(officer.first_name?.[0] || officer.name?.[0] || officer.username?.[0] || '?').toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <div className="text-white font-semibold text-lg">
                                                            {officer.first_name && officer.last_name
                                                                ? `${officer.first_name} ${officer.last_name}`.trim()
                                                                : officer.name || officer.username || 'Unknown Officer'}
                                                        </div>
                                                        {officer.username && (
                                                            <div className="text-sm text-slate-300 flex items-center gap-1 mt-1">
                                                                <Award className="w-3 h-3 text-blue-400" />
                                                                ID: {officer.username}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {officer.sap_id && (
                                                    <div className="text-xs px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 rounded-full text-purple-100 font-medium">
                                                        SAP: {officer.sap_id}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Roles Section */}
                                            {officer.novex_role?.length ? (
                                                <div className="mb-4">
                                                    <div className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                                                        <CircleUserRound className="w-3 h-3" />
                                                        Assigned Roles
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {officer.novex_role.map((role: string, roleIndex: number) => (
                                                            <span
                                                                key={roleIndex}
                                                                className="text-xs px-3 py-1.5 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-400/30 rounded-full text-emerald-100 font-medium hover:from-emerald-500/30 hover:to-teal-500/30 transition-all duration-200"
                                                            >
                                                                {role}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}

                                            {/* Contact Information */}
                                            <div className="space-y-3">
                                                {officer.phone && (
                                                    <div className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-lg border border-slate-600/30">
                                                        <Phone className="w-4 h-4 text-green-400 flex-shrink-0" />
                                                        <span className="text-slate-200 font-medium">{officer.phone}</span>
                                                    </div>
                                                )}
                                                {officer.email && (
                                                    <div className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-lg border border-slate-600/30">
                                                        <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                                        <span className="text-slate-200 font-medium text-sm">{officer.email}</span>
                                                    </div>
                                                )}
                                                {officer.location && officer.location !== location.location_name && (
                                                    <div className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-lg border border-slate-600/30">
                                                        <MapPinIcon className="w-4 h-4 text-orange-400 flex-shrink-0" />
                                                        <div>
                                                            <div className="text-xs text-slate-400">Location</div>
                                                            <div className="text-slate-200 font-medium text-sm">{officer.location}</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {locationSpecificOfficers.length > 1 && (
                                        <div className="text-center text-sm text-slate-400 pt-3">
                                            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-full border border-slate-700/30">
                                                <Users className="w-3 h-3" />
                                                Showing 1 of {locationSpecificOfficers.length} officers
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-gradient-to-br from-slate-700/50 to-slate-600/50 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-600/30">
                                        <Users className="w-7 h-7 text-slate-400" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-300 font-medium">No Plant Officers Found</p>
                                        <p className="text-slate-500 text-sm">No officers are currently assigned to this location</p>
                                        {location.sap_id && (
                                            <p className="text-slate-600 text-xs mt-2 font-mono">SAP ID: {location.sap_id}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <SalesOfficersModal
                isOpen={showOfficersModal}
                onClose={() => setShowOfficersModal(false)}
                officers={locationSpecificOfficers}
                locationName={location.location_name || location.name || 'Unknown Location'}
            />
        </>
    );
};

export default LocationTooltip;
