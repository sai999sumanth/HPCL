

import { Button } from "@/@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/@/components/ui/card";
import { apiClient } from "@/services/apiClient";
import useAuthStore from "@/store/authStore";
import { Badge, Building2, Calendar, CheckCircle, Clock, Loader2, MapPin, Phone, RefreshCw, Search, Store, Users, X, Download, Plus } from "lucide-react";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/@/components/ui/select";
import { Textarea } from "@/@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/@/components/ui/tooltip";

const COLUMNS = [
    { key: 'select_business', label: 'BU', minWidth: 50 },
    { key: 'sap_id', label: 'SAP ID', minWidth: 70 },
    { key: 'location', label: 'LOCATION', minWidth: 70 },
    { key: 'sap_tt_no', label: 'TT No', minWidth: 70 },
    { key: 'transporter', label: 'TRANSPORTER', minWidth: 70 },
    { key: 'tt_chassis_no', label: 'CHASSIS NO', minWidth: 120 },
    { key: 'tt_engine_no', label: 'ENGINE NO', minWidth: 70 },
    { key: 'device', label: 'DEVICE ID', minWidth: 70 },
    { key: 'vehicle_installed_by', label: 'INSTALLED BY', minWidth: 70 },
    { key: 'vehicle_installation_date', label: 'INSTALLATION DATE', minWidth: 90 },
    { key: 'device_installation_approved_by', label: 'APPROVED BY', minWidth: 70 },
    { key: 'contract_valid_upto', label: 'CONTRACT VALID UPTO', minWidth: 90 },
    { key: 'created_at', label: 'CREATED AT', minWidth: 70 },
    { key: 'updated_at', label: 'UPDATED AT', minWidth: 70 },
    { key: 'certificate', label: 'CERTIFICATE', minWidth: 60 },
    { key: 'aot_status', label: 'AOT STATUS', minWidth: 70 },
    { key: 'status', label: 'STATUS', minWidth: 70 },
    { key: 'remarks', label: 'REMARKS', minWidth: 70 },
    { key: 'action', label: 'ACTION', minWidth: 50, fixed: true },
];

// Three officers: see OnBoard TT button only (no Action column).
const ALLOWED_ONBOARD_ROLES = ["Planning Officer SOD", "Maintenance Officer SOD", "Safety Officer SOD"];
// Two roles: see Action column only (no OnBoard TT button).
const ALLOWED_ACTION_COLUMN_ROLES = ["Location In-Charge SOD", "Plant In-Charge SOD"];

function hasOnBoardRole(novexRole: unknown): boolean {
    if (!novexRole) return false;
    const roles = Array.isArray(novexRole) ? novexRole : [novexRole];
    const allowed = new Set(ALLOWED_ONBOARD_ROLES.map((r) => r.trim().toLowerCase()));
    return roles.some((r) => typeof r === "string" && allowed.has(String(r).trim().toLowerCase()));
}

function hasActionColumnRole(novexRole: unknown): boolean {
    if (!novexRole) return false;
    const roles = Array.isArray(novexRole) ? novexRole : [novexRole];
    const allowed = new Set(ALLOWED_ACTION_COLUMN_ROLES.map((r) => r.trim().toLowerCase()));
    return roles.some((r) => typeof r === "string" && allowed.has(String(r).trim().toLowerCase()));
}

interface CreateDeviceProps {
    onFormVisibilityChange?: (visible: boolean) => void;
    refreshTrigger?: number;
    selectedZone?: string | null;
    selectedPlant?: string | null;
    selectedBu?: string | null;
    buFilterApplied?: boolean;
    parentTimeFilter?: string | null | { key: string; cond: string; value: string };
}

export const CreateDevice = ({ onFormVisibilityChange, refreshTrigger, selectedZone, selectedPlant, selectedBu, buFilterApplied = false, parentTimeFilter }: CreateDeviceProps) => {
    const { user } = useAuthStore();
    // Three officers → OnBoard TT only. Two (Location/Plant In-Charge) → Action column only; never show OnBoard TT to the two.
    const hasOnBoardAccess = hasOnBoardRole(user?.novex_role) && !hasActionColumnRole(user?.novex_role);
    const hasActionColumnAccess = hasActionColumnRole(user?.novex_role);

    const [showForm, setShowForm] = useState(false);
    const [open, setOpen] = useState(false);

    const [dialogData, setDialogData] = useState(null);
    const [dialogLoading, setDialogLoading] = useState(false);
    const [errorLoading, setErrorLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        sapId: "",
        sapTtNo: "",
        device: "",
        location: "",
        zone: "",
        transporter: "",
        business: "",
        installedBy: "",
        installationDate: "",
        certificate: null,
        ChassisNo: "",
        EngineNo: "",
        ContractValid: "",
        ApprovedBy: "",
        // capacityOfTheTruck: "",
        // vehicleType: "",
        // volumeUom: "",
        // NoOfCompartments: "",
    });
    const [action, setAction] = useState("");

    const [remark, setRemark] = useState("");
    const [data, setData] = useState([])

    const [isDuplicate, setIsDuplicate] = useState(false);
    const [downloadingCertificateId, setDownloadingCertificateId] = useState<string | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isFetchingSapRef = useRef(false);
    const lastFetchedSapRef = useRef<string>("");
    
    // State for employee ID lookup
    const [installedByLoading, setInstalledByLoading] = useState(false);
    const [approvedByLoading, setApprovedByLoading] = useState(false);
    const [installedByEmployeeId, setInstalledByEmployeeId] = useState("");
    const [approvedByEmployeeId, setApprovedByEmployeeId] = useState("");

    // Function to fetch user details by employee ID
    const fetchUserByEmployeeId = async (employeeId: string, field: 'installedBy' | 'ApprovedBy') => {
        if (!employeeId.trim()) {
            toast.error("Please enter an employee ID");
            return;
        }

        const setLoadingState = field === 'installedBy' ? setInstalledByLoading : setApprovedByLoading;
        const setEmployeeIdState = field === 'installedBy' ? setInstalledByEmployeeId : setApprovedByEmployeeId;
        setLoadingState(true);

        try {
            const response = await apiClient.get("/api/users", {
                params: {
                    search_text: employeeId.trim(),
                    fields: '["first_name","last_name"]'
                }
            });

            let firstName = '';
            let lastName = '';

            // Handle array response: { data: [ { first_name, last_name, id } ], count, total }
            if (response.data?.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
                firstName = response.data.data[0].first_name || '';
                lastName = response.data.data[0].last_name || '';
            } else if (response.data?.data && (response.data.data.first_name || response.data.data.last_name)) {
                firstName = response.data.data.first_name || '';
                lastName = response.data.data.last_name || '';
            } else if (response.data && (response.data.first_name || response.data.last_name)) {
                firstName = response.data.first_name || '';
                lastName = response.data.last_name || '';
            }

            if (firstName || lastName) {
                const fullName = `${firstName} ${lastName}`.trim();
                // Show "EmployeeID - FirstName LastName" in the input field
                setEmployeeIdState(`${employeeId.trim()} - ${fullName}`);
                handleInputChange(field, employeeId.trim());
                toast.success(`User found: ${fullName}`);
            } else {
                toast.error("User not found for the given employee ID");
            }
        } catch (error: any) {
            console.error("Error fetching user:", error);
            toast.error(error?.response?.data?.message || "Failed to fetch user details");
        } finally {
            setLoadingState(false);
        }
    };
    const [simErrors, setSimErrors] = useState({ Sim1: "", Sim2: "" });
    const [isValidating, setIsValidating] = useState(false);
    const [isValidated, setIsValidated] = useState(false);
    
    const [colWidths, setColWidths] = useState<Record<string, number>>({ tt_chassis_no: 200 });

    useEffect(() => {
        onFormVisibilityChange?.(showForm);
    }, [showForm, onFormVisibilityChange]);

    useEffect(() => {
        if (!hasOnBoardAccess && showForm) setShowForm(false);
    }, [hasOnBoardAccess, showForm]);

    const [currentPage, setCurrentPage] = useState(0);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalItems, setTotalItems] = useState(0);

    const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
    const lastRefreshTriggerRef = useRef<number | null>(null);
    const buildDateFilterQuery = (tf: string | null | { key: string; cond: string; value: string }) => {
        if (!tf) return "";
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (typeof tf === "string") {
            switch (tf) {
                case "TDY":
                    return "vehicle_installation_date::DATE = CURRENT_DATE";
                case "YDY":
                    return `vehicle_installation_date::DATE = '${yesterday.toISOString().split("T")[0]}'`;
                case "1W": {
                    const d = new Date(today); d.setDate(d.getDate() - 7);
                    return `vehicle_installation_date::DATE >= '${d.toISOString().split("T")[0]}'`;
                }
                case "15D": {
                    const d = new Date(today); d.setDate(d.getDate() - 15);
                    return `vehicle_installation_date::DATE >= '${d.toISOString().split("T")[0]}'`;
                }
                case "1M": {
                    const d = new Date(today); d.setMonth(d.getMonth() - 1);
                    return `vehicle_installation_date::DATE >= '${d.toISOString().split("T")[0]}'`;
                }
                case "3M": {
                    const d = new Date(today); d.setMonth(d.getMonth() - 3);
                    return `vehicle_installation_date::DATE >= '${d.toISOString().split("T")[0]}'`;
                }
                default:
                    return "";
            }
        }

        if (typeof tf === "object" && tf.key === "Date") {
            const [startDate, endDate] = String(tf.value || "").split(",");
            if (startDate && endDate) {
                return `vehicle_installation_date::DATE >= '${startDate}' AND vehicle_installation_date::DATE <= '${endDate}'`;
            }
        }

        return "";
    };

    const handleInputChange = (field, value) => {
        if (field === "certificate" && value instanceof File) {
           
            if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
            }
         
            if (value.type.startsWith('image/')) {
                const previewUrl = URL.createObjectURL(value);
                setImagePreview(previewUrl);
            } else {
                setImagePreview(null);
            }
        }
          
        // Reset validation state when any of the 4 validation fields change
        if (["sapTtNo", "sapId", "transporter", "ContractValid"].includes(field)) {
            setIsValidated(false);
        }

        if (field === "Sim1" || field === "Sim2") {
            const digitsOnly = value.replace(/\D/g, '');
            const limitedValue = digitsOnly.slice(0, 10);
                       
            if (limitedValue.length > 0 && limitedValue.length !== 10) {
                setSimErrors((prev) => ({
                    ...prev,
                    [field]: "SIM number must be exactly 10 digits"
                }));
            } else {
                setSimErrors((prev) => ({
                    ...prev,
                    [field]: ""
                }));
            }
            
            setFormData((prev) => ({ ...prev, [field]: limitedValue }));
        } else {
            setFormData((prev) => ({ ...prev, [field]: value }));
        }
    };

    const fetchSapDetails = async (sap) => {
        if (!sap || sap.trim().length === 0) {
            return;
        }

        const trimmedSap = sap.trim();

        if (isFetchingSapRef.current || lastFetchedSapRef.current === trimmedSap) {
            return;
        }

        isFetchingSapRef.current = true;
        lastFetchedSapRef.current = trimmedSap;

        try {
            const body = {
                filters: [{ key: "bu", cond: "equals", value: "TAS" }],
                action: "adding_device",
                payload: { sap_tt_no: trimmedSap },
            };

            const response = await apiClient.post(
                "/api/charts/generate_vis_data",
                body
            );

            console.log("SAP RESPONSE:", response.data);
            const responseMsg = response.data?.message || response.data?.msg || response.data?.status;
            if (response.data?.status && response.data.data?.length > 0) {
                const details = response.data.data[0];
               
                const chassisValue = details["CHASSIS_NO"] || details["chassis_no"] || details["Chassis No"] || details["TT Chassis No"] || "";
                const engineValue = details["ENGINE_NO"] || details["engine_no"] || details["Engine No"] || details["TT Engine No"] || "";

                setFormData((prev) => {
                    const updated = {
                        ...prev,
                        business: details["Select Business"] || "",
                        location: details["Location"] || "",
                        zone: details["zone"] || "",
                        transporter: details["Transporter"] || "",
                        sapId: details["sap_id"] || "",
                        ChassisNo: chassisValue,
                        EngineNo: engineValue,
                        // capacityOfTheTruck: details["capacity_of_the_truck"] || "",
                        // vehicleType: details["vehicle_type"] || "",
                        // volumeUom: details["volume_uom"] || "",
                        // NoOfCompartments: details["no_of_compartments"] || "",
                    };
                    console.log("Updated formData:", updated);
                    return updated;
                });
                toast.success(responseMsg || "SAP details fetched successfully");
            } else {
                toast.info(responseMsg || "No SAP details found");
            }
        } catch (err) {
            console.error("Error fetching SAP TT No:", err);
            lastFetchedSapRef.current = "";
            const errMsg = err.response?.data?.message || err.response?.data?.msg || err.message || "Failed to fetch SAP details";
            toast.error(errMsg);
        } finally {
            isFetchingSapRef.current = false;
        }
    };

    const handleSapKeyPress = (e) => {
        if (e.key === 'Enter' && formData.sapTtNo.trim()) {
            e.preventDefault();
            fetchSapDetails(formData.sapTtNo.trim());
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
            const fileExtension = file.name.split('.').pop()?.toLowerCase();
            const isValidType = allowedTypes.includes(file.type) ||
                ['jpg', 'jpeg', 'png', 'pdf'].includes(fileExtension || '');

            if (!isValidType) {
                toast.error("Please upload only JPG, PNG, or PDF files.");
                e.target.value = '';
                return;
            }

            const maxSize = 8 * 1024 * 1024;
            if (file.size > maxSize) {
                toast.error("File size must be less than 8MB.");
                e.target.value = '';
                return;
            }

            if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
            }

            const isImageFile = file.type.startsWith('image/') ||
                ['jpg', 'jpeg', 'png'].includes(fileExtension || '');

            if (isImageFile) {
                const previewUrl = URL.createObjectURL(file);
                setImagePreview(previewUrl);
            } else {
                setImagePreview(null);
            }

            setFormData((prev) => ({
                ...prev,
                certificate: file,
            }));

            toast.success("File selected successfully!");
        }
    };

    const handleRemoveImage = () => {
        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
            setImagePreview(null);
        }

        setFormData((prev) => ({
            ...prev,
            certificate: null,
        }));

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const installedByValue = formData.installedBy?.trim() || (installedByEmployeeId?.trim().split(" - ")[0] ?? "") || installedByEmployeeId?.trim() || "";
            const approvedByValue = formData.ApprovedBy?.trim() || (approvedByEmployeeId?.trim().split(" - ")[0] ?? "") || approvedByEmployeeId?.trim() || "";

            const params = new URLSearchParams({
                sap_id: formData.sapId,
                sap_tt_no: formData.sapTtNo,
                tt_chassis_no: formData.ChassisNo,
                tt_engine_no: formData.EngineNo,
                select_business: formData.business,
                location: formData.location,
                zone: formData.zone,
                transporter: formData.transporter,
                device: formData.device,
                vehicle_installed_by: installedByValue,
                vehicle_installation_date: formData.installationDate,
                device_installation_approved_by: approvedByValue,
                contract_valid_upto: formData.ContractValid,
                // capacity_of_the_truck: formData.capacityOfTheTruck,
                // vehicle_type: formData.vehicleType,
                // volume_uom: formData.volumeUom,
                // no_of_compartments: formData.NoOfCompartments,
            });

            const formDataPaylad = new FormData();

            if (formData.certificate) {
                formDataPaylad.append("certificate_file", formData.certificate);
                console.log("Certificate attached:", formData.certificate.name);
            } else {
                console.log("No certificate file selected");
            }

            const response = await apiClient.post(
                `/api/deviceinstallation/update_device_installation?${params.toString()}`,
                formDataPaylad,
                {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    }
                }
            );

            console.log("Submit Response:", response.data);
            toast.success("Device updated successfully!");

            setShowForm(false);
            setSearchTerm("");
            setIsValidated(false);
           
            if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
                setImagePreview(null);
            }
            setFormData({
                sapId: "",
                sapTtNo: "",
                ChassisNo: "",
                EngineNo: "",
                business: "",
                location: "",
                zone: "",
                transporter: "",
                device: "",
                installedBy: "",
                installationDate: "",
                ApprovedBy: "",
                ContractValid: "",
                certificate: null,
                // capacityOfTheTruck: "",
                // vehicleType: "",
                // volumeUom: "",
                // NoOfCompartments: ""
            });

            await handleData();

        } catch (err) {
            console.error("Submit Error:", err);
            toast.error(err.response?.data?.message || "Submit Error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleData = async (search = appliedSearchTerm, page = currentPage, limit = itemsPerPage) => {
        setLoading(true);
        setError("");
        try {
            const escapeSqlValue = (value: string) => value.replace(/'/g, "''");
            let q = "commissioning_status = 'SUCCESS' and status_decommissioning !='Request For Approval' and status_decommissioning !='Approved' and status_decommissioning !='Rejected'";
            if (selectedZone && selectedZone.trim()) {
                q += ` AND zone='${escapeSqlValue(selectedZone.trim())}'`;
            }
            if (selectedPlant && selectedPlant.trim()) {
                q += ` AND sap_id='${escapeSqlValue(selectedPlant.trim())}'`;
            }
            if (buFilterApplied && selectedBu && selectedBu.trim()) {
                const buValue = selectedBu.trim().toUpperCase() === "SOD" ? "TAS" : selectedBu.trim();
                q += ` AND select_business='${escapeSqlValue(buValue)}'`;
            }
            const dateQuery = buildDateFilterQuery(parentTimeFilter ?? null);
            if (dateQuery) {
                q += ` AND ${dateQuery}`;
            }

            const params: any = {
                skip: page,
                limit,
                q,
                sort: '{"vehicle_installation_date":"desc"}',
            };

            if (search && search.trim()) {
                params.search_text = search.trim();
            }

            const response = await apiClient.get("/api/deviceinstallation", { params });
            const rows = response.data?.data;
            const total = response.data?.total || response.data?.count || rows?.length || 0;

            // Sort by updated_at desc (fallback created_at) so latest is first, then one row per sap_tt_no
            // const raw = Array.isArray(rows) ? rows : [];
            // const sorted = [...raw].sort((a, b) => {
            //     const tA = a?.updated_at || a?.created_at || "";
            //     const tB = b?.updated_at || b?.created_at || "";
            //     return tB.localeCompare(tA);
            // });
            // const seen = new Set();
            // const deduped = sorted.filter((item) => {
            //     const key =
            //         item?.sap_tt_no != null && String(item.sap_tt_no).trim() !== ""
            //             ? String(item.sap_tt_no).trim()
            //             : `id-${item?.id ?? sorted.indexOf(item)}`;
            //     if (seen.has(key)) return false;
            //     seen.add(key);
            //     return true;
            // });
            const raw = Array.isArray(rows) ? rows : [];
            setData(raw);
            setTotalItems(typeof total === "number" ? total : 0);
        } catch (error) {
            console.error("Error fetching table:", error);
            setError("NO DATA FOUND");
            setData([]);
            setTotalItems(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        handleData(appliedSearchTerm, currentPage, itemsPerPage);
    }, [appliedSearchTerm, currentPage, itemsPerPage, selectedZone, selectedPlant, selectedBu, buFilterApplied, parentTimeFilter]);

    useEffect(() => {
        if (typeof refreshTrigger !== "number") return;

        // Ignore first mount value; only react to actual parent refresh clicks.
        if (lastRefreshTriggerRef.current === null) {
            lastRefreshTriggerRef.current = refreshTrigger;
            return;
        }
        if (lastRefreshTriggerRef.current === refreshTrigger) return;
        lastRefreshTriggerRef.current = refreshTrigger;

        setSearchTerm("");
        setAppliedSearchTerm("");
        setCurrentPage(0);
        setColWidths({});
        setIsValidated(false);

        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
            setImagePreview(null);
        }

        handleData("", 0, itemsPerPage);
    }, [refreshTrigger, itemsPerPage, imagePreview]);

    useEffect(() => {
        return () => {
            if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
            }
        };
    }, [imagePreview]);

    const openDialog = async (row) => {
        setOpen(true);
        // Autofill Device Details dialog with this row's data immediately
        setDialogData({ ...row });
        setAction("");
        setRemark("");
        setDialogLoading(false); // show row data right away, no loading block
        setErrorLoading(false);
        try {
            const response = await apiClient.post("/api/deviceinstallation/action_device_vts", {
                id: row.id,
                status: row.status ?? "",
                remarks: row.remarks ?? ""
            });

            const data = response.data?.data ?? response.data;
            const apiRecord = Array.isArray(data) ? data[0] : data;
            // Optionally merge API response into dialog (e.g. if server returns updated fields)
            if (apiRecord && typeof apiRecord === "object") {
                setDialogData((prev) => ({ ...prev, ...apiRecord }));
            }
        } catch (error) {
            console.error("Dialog API Error:", error);
            // Dialog already shows row data; no change needed
        }
    };

    const handleDailogData = async () => {
        try {
            const body = {
                id: dialogData?.id,
                status: action,
                remarks: remark,
            };

            const response = await apiClient.post("/api/deviceinstallation/action_device_vts", body);
            console.log("response", response.data);

            if (response.data?.status) {
                toast.success(response.data?.message || "Action submitted successfully!");
                setOpen(false);
                setAction("");
                setRemark("");
                handleData();
            } else {
                toast.error(response.data?.message || "Failed to submit action");
            }

        } catch (err) {
            console.error("Submit Error:", err);
            toast.error(err.response?.data?.message || "Failed to submit action");
        }
    };

    const isFormValid = () => {
        const hasInstalledBy = !!(formData.installedBy?.trim() || installedByEmployeeId?.trim());
        const hasApprovedBy = !!(formData.ApprovedBy?.trim() || approvedByEmployeeId?.trim());
        return (
            formData.sapTtNo?.trim() &&
            formData.sapId?.trim() &&
            formData.transporter?.trim() &&
            formData.ContractValid?.trim() &&
            formData.ChassisNo?.trim() &&
            formData.EngineNo?.trim() &&
            formData.business?.trim() &&
            formData.location?.trim() &&
            formData.zone?.trim() &&
            formData.device?.trim() &&
            hasInstalledBy &&
            formData.installationDate?.trim() &&
            hasApprovedBy &&
            formData.certificate
        );
    };

    const canValidate = () => {
        return (
            formData.sapTtNo?.trim() &&
            formData.sapId?.trim() &&
            formData.transporter?.trim() &&
            formData.ContractValid?.trim()
        );
    };

    const handleValidateAotDetails = async () => {
        if (!canValidate()) {
            toast.error("Please fill SAP TT No, SAP ID, Transporter Code and Contract Valid Upto fields");
            return;
        }

        setIsValidating(true);
        try {
            const params = {
                sap_tt_no: formData.sapTtNo.trim(),
                sap_id: formData.sapId.trim(),
                transporter: formData.transporter.trim(),
                contract_valid_upto: formData.ContractValid.trim(),
                select_business: formData.business?.trim() || "",
            };

            const response = await apiClient.post("/api/deviceinstallation/validate_aot_details", params);
            console.log("Validate AOT Response:", response.data);
            const ok = response.data && (response.data.status || response.data.success || response.data.validated);
            if (ok) {
                toast.success(response.data?.message || "AOT details validated successfully");
                setIsValidated(true);
            } else {
                toast.error(response.data?.message || "Validation failed");
                setIsValidated(false);
            }
        } catch (err) {
            console.error("Validate AOT Error:", err);
            toast.error(err.response?.data?.message || "Failed to validate AOT details");
            setIsValidated(false);
        } finally {
            setIsValidating(false);
        }
    };

    const displayData = data;

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = currentPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    const handlePageChange = (page: number) => {
        const maxPage = Math.max(0, totalPages - 1);
        const validPage = Math.max(0, Math.min(page, maxPage));
        setCurrentPage(validPage);
    };

    const handleItemsPerPageChange = (num: number) => {
        setItemsPerPage(num);
        setCurrentPage(0);
    };

    const handleSearch = () => {
        const next = (searchTerm || "").trim();
        setAppliedSearchTerm(next);
        setCurrentPage(0);
    };

    const handleClearSearch = () => {
        setSearchTerm("");
        setAppliedSearchTerm("");
        setCurrentPage(0);
        handleData("", 0, itemsPerPage);
    };

    const handleRefresh = () => {
        setSearchTerm("");
        setAppliedSearchTerm("");
        setCurrentPage(0);
        setColWidths({});
        setIsValidated(false);

        if (imagePreview) {
            URL.revokeObjectURL(imagePreview);
            setImagePreview(null);
        }

        setFormData({
            sapId: "",
            sapTtNo: "",
            ChassisNo: "",
            EngineNo: "",
            business: "",
            location: "",
            zone: "",
            transporter: "",
            device: "",
            installedBy: "",
            installationDate: "",
            ApprovedBy: "",
            ContractValid: "",
            certificate: null,
            // capacityOfTheTruck: "",
            // vehicleType: "",
            // volumeUom: "",
            // NoOfCompartments: "",
        });

        handleData("", 0, itemsPerPage);
    };

    const handleDownloadCertificate = async (item) => {
        const filePath = item.certificate || item.certificate_file || item.certificate_path;

        if (!filePath || downloadingCertificateId) return;

        const id = item.id;
        setDownloadingCertificateId(String(id));

        try {
            const response = await apiClient.post(
                "/api/noticesvts/download_notice",
                { id, file_path: filePath },
                { responseType: "blob" }
            );

            const blobUrl = window.URL.createObjectURL(response.data);

            const link = document.createElement("a");
            link.href = blobUrl;
            const filename = filePath.split("/").pop() || "certificate";
            link.download = filename;

            document.body.appendChild(link);
            link.click();
            link.remove();

            window.URL.revokeObjectURL(blobUrl);
            toast.success("Certificate downloaded successfully.");
        } catch (error) {
            console.error("Error downloading certificate:", error);
            toast.error("Failed to download certificate. Please try again.");
        } finally {
            setDownloadingCertificateId(null);
        }
    };

    const COLUMNS = [
        { key: "select_business",                    label: "BU",                   minWidth: 50 },
        { key: "sap_id",                             label: "SAP ID",               minWidth: 70 },
        { key: "location",                           label: "Location",             minWidth: 70 },
        { key: "zone",                               label: "Zone",                 minWidth: 70 },
        { key: "sap_tt_no",                          label: "TT No",                minWidth: 70 },
        { key: "transporter",                        label: "Transporter",          minWidth: 70 },
        { key: "tt_chassis_no",                      label: "TT Chassis No",        minWidth: 120 },
        { key: "tt_engine_no",                       label: "TT Engine No",         minWidth: 70 },
        { key: "device",                             label: "Device Id",            minWidth: 70 },
        { key: "vehicle_installed_by",               label: "Installed By",         minWidth: 70 },
        { key: "vehicle_installation_date",          label: "Installation Date",    minWidth: 90 },
        { key: "device_installation_approved_by",    label: "Approved By",          minWidth: 70 },
        { key: "contract_valid_upto",                label: "Contract Valid Upto",  minWidth: 90 },
        { key: "created_at",                         label: "Created At",           minWidth: 70 },
        { key: "updated_at",                         label: "Updated At",           minWidth: 70 },
        { key: "certificate",                        label: "Certificate",          minWidth: 60 },
        { key: "aot_status",                         label: "AOT Status",           minWidth: 70 },
        { key: "status",                             label: "Status",               minWidth: 70 },
        { key: "remarks",                            label: "Remarks",              minWidth: 70 },
        { key: "action",                             label: "Action",               minWidth: 50, fixed: true },
    ];
    const visibleColumns = hasActionColumnAccess ? COLUMNS : COLUMNS.filter((c) => c.key !== "action");

    const handleResizeStart = useCallback((e: React.MouseEvent, key: string, currentWidth: number) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.pageX;
        const startW = currentWidth;

        const onMove = (ev: MouseEvent) => {
            const newW = Math.max(COLUMNS.find(c => c.key === key)?.minWidth ?? 60, startW + (ev.pageX - startX));
            setColWidths(prev => ({ ...prev, [key]: newW }));
        };
        const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }, []);

    const getWidth = (col) => colWidths[col.key] ?? 120;

    return (
        <div className="flex-1 p-1 min-h-0 flex flex-col overflow-hidden max-w-full">
            {!showForm && (
                <React.Fragment>
                    {/* Search and Actions Bar - Fixed */}
                    <div className="flex-shrink-0 p-2 bg-white">
                        <div className="flex items-center justify-between gap-4">
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search across all columns (e.g. TT No, Chassis, Device ID)..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                    className="w-full h-9 pl-8 pr-7 text-xs border border-gray-300 rounded-lg 
                                               focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500
                                               bg-white"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={handleClearSearch}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                {/* <button
                                    onClick={handleRefresh}
                                    disabled={loading}
                                    className="h-9 w-9 flex items-center justify-center rounded-lg 
                                               border border-gray-300 bg-white hover:bg-gray-50
                                               disabled:opacity-50"
                                    title="Refresh"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 text-gray-600 ${loading ? "animate-spin" : ""}`} />
                                </button> */}

                                {hasOnBoardAccess && (
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(true)}
                                        className="h-9 px-3 flex items-center gap-2 rounded-lg 
                                                   bg-blue-600 text-white text-xs font-medium
                                                   hover:bg-blue-700 transition"
                                    >
                                        <Plus className="w-3 h-3" />
                                        OnBoard New TT
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Table + Pagination wrapper ── fills remaining height, no overflow */}
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden p-2 pt-0 bg-white">
                        <div className="flex-1 min-h-0 flex flex-col border border-gray-200 rounded-lg overflow-hidden">

                            {/* ── Single scroll container for both header and body ── */}
                            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden relative">
                                <table className="border-collapse w-max min-w-full relative" style={{ tableLayout: "auto" }}>
                                <colgroup>
                                    {visibleColumns.map((col) => {
                                        const w = getWidth(col);
                                        return <col key={col.key} style={{ minWidth: w }} />;
                                    })}
                                </colgroup>
                                <thead className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        {visibleColumns.map((col) => {
                                            const w = getWidth(col);
                                            return (
                                                <th
                                                    key={col.key}
                                                    className={`relative text-left px-4 py-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide select-none border-r border-gray-200 last:border-r-0 whitespace-nowrap
                                                        ${col.fixed ? 'sticky right-0 bg-gray-50 z-20 shadow-[-2px_0_4px_rgba(0,0,0,0.05)]' : ''}`}
                                                    style={{ minWidth: w }}
                                                >
                                                    <span className="block pr-2" title={col.label}>{col.label}</span>

                                                    {/* Drag handle — invisible 4 px strip on the right edge */}
                                                    {!col.fixed && (
                                                        <div
                                                            className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-blue-400 transition-colors"
                                                            style={{ zIndex: 1 }}
                                                            onMouseDown={(e) => handleResizeStart(e, col.key, w)}
                                                        />
                                                    )}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={19} className="text-center py-12 text-gray-500">
                                                <div className="flex items-center justify-center gap-2">
                                                    <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                                                    <span className="text-sm">Loading data...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : displayData.length > 0 ? (
                                        displayData.map((item, index) => {
                                            const columns = [
                                                {
                                                    key: 'select_business',
                                                    value: item.select_business,
                                                    render: (val) => val ? (
                                                        <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                                                            {val}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-600">-</span>
                                                    )
                                                },
                                                { key: 'sap_id', value: item.sap_id, render: (val) => val ?? "-" },
                                                {
                                                    key: 'location',
                                                    value: item.location,
                                                    render: (val) => (val ? <span className="whitespace-nowrap">{val}</span> : "-")
                                                },
                                                {
                                                    key: 'zone',
                                                    value: item.zone,
                                                    render: (val) => (val ? <span className="whitespace-nowrap">{val}</span> : "-")
                                                },
                                                { key: 'sap_tt_no', value: item.sap_tt_no, render: (val) => val ?? "-" },
                                                {
                                                    key: 'transporter',
                                                    value: item.transporter,
                                                    render: (val) => (val ? <span className="whitespace-nowrap">{val}</span> : "-")
                                                },
                                                { key: 'tt_chassis_no', value: item.tt_chassis_no, render: (val) => (val ? <span className="whitespace-nowrap">{val}</span> : "-") },
                                                { key: 'tt_engine_no', value: item.tt_engine_no, render: (val) => (val ? <span className="whitespace-nowrap">{val}</span> : "-") },
                                                { key: 'device', value: item.device, render: (val) => val ?? "-" },
                                                { key: 'vehicle_installed_by', value: item.vehicle_installed_by, render: (val) => val ?? "-" },
                                                { key: 'vehicle_installation_date', value: item.vehicle_installation_date, render: (val) => val ?? "-" },
                                                { key: 'device_installation_approved_by', value: item.device_installation_approved_by, render: (val) => val ?? "-" },
                                                { key: 'contract_valid_upto', value: item.contract_valid_upto, render: (val) => val ?? "-" },
                                                { key: 'created_at', value: item.created_at, render: (val) => val ? val.slice(0, 10) : "-" },
                                                { key: 'updated_at', value: item.updated_at, render: (val) => val ? val.slice(0, 10) : "-" },
                                                {
                                                    key: 'certificate',
                                                    value: item.certificate,
                                                    render: (val) => {
                                                        if (!val) return "-";
                                                        return (
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <button
                                                                            onClick={() => handleDownloadCertificate(item)}
                                                                            disabled={downloadingCertificateId === String(item.id)}
                                                                            className={`text-blue-600 hover:text-blue-800 flex items-center gap-1 ${downloadingCertificateId === String(item.id) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                                                            title="Download certificate"
                                                                        >
                                                                            {downloadingCertificateId === String(item.id) ? (
                                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                                            ) : (
                                                                                <Download className="w-4 h-4" />
                                                                            )}
                                                                        </button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p className="text-xs">Download Certificate</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        );
                                                    }
                                                },
                                                { key: 'aot_status', value: item.aot_status, render: (val) => val || "-" },
                                                {
                                                    key: 'status',
                                                    value: item.status,
                                                    render: (val) => (
                                                        <span className={`px-2 py-1 rounded-full text-xs whitespace-nowrap
                                                            ${["APPROVED", "ACCEPTED", "REQUEST FOR APPROVAL", "REQUESTED", "REUQSTED"].includes(val?.toUpperCase())
                                                                ? "bg-green-100 text-green-800"
                                                                : val
                                                                    ? "bg-red-100 text-red-800"
                                                                    : "text-gray-600"}`}>
                                                            {val || "-"}
                                                        </span>
                                                    )
                                                },
                                                { key: 'remarks', value: item.remarks, render: (val) => val ?? "-" },
                                                ...(hasActionColumnAccess
                                                    ? [{
                                                        key: 'action',
                                                        value: item,
                                                        render: (val: typeof item) => {
                                                            const statusUpper = val?.status?.toUpperCase();
                                                            const canOpenDialog = statusUpper !== "APPROVED" && statusUpper !== "REJECTED";
                                                            
                                                            if (!canOpenDialog) return null;

                                                            return (
                                                                <button
                                                                    onClick={() => openDialog(val)}
                                                                    className="text-blue-600 hover:text-blue-800 text-lg font-semibold px-1"
                                                                    title="Action"
                                                                >
                                                                    +
                                                                </button>
                                                            );
                                                        }
                                                    }]
                                                    : []),
                                            ];

                                            return (
                                                <tr key={index} className="hover:bg-gray-50 transition">
                                                    {columns.map((col) => {
                                                        const w = getWidth(col);
                                                        return (
                                                            <td
                                                                key={col.key}
                                                                className={`px-4 py-3 text-sm text-gray-700 border-b border-gray-200 whitespace-nowrap
                                                                    ${["action", "certificate"].includes(col.key) ? "text-center" : ""}
                                                                    ${col.key === "action" ? "sticky right-0 bg-white z-30 shadow-[-2px_0_4px_rgba(0,0,0,0.05)]" : ""}`}
                                                                style={{ minWidth: w }}
                                                            >
                                                                {col.render(col.value)}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={visibleColumns.length} className="text-center py-12 text-gray-500 text-sm">
                                                {error || "No matching records found"}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                </table>
                                </div>
                            </div>

                            {/* ── Pagination ── pinned at the bottom */}
                            <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-gray-200 bg-white">
                                <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-600">Show</span>
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                                        className="px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        {[5, 10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                    <span className="text-xs text-gray-600">entries</span>
                                </div>
                                <span className="text-xs text-gray-600">
                                    Showing <span className="font-semibold">{totalItems > 0 ? startIndex + 1 : 0}</span> to{" "}
                                    <span className="font-semibold">{endIndex}</span> of{" "}
                                    <span className="font-semibold">{totalItems}</span> entries
                                </span>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0}
                                    className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                    Previous
                                </button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let p: number;
                                    if (totalPages <= 5) p = i;
                                    else if (currentPage <= 2) p = i;
                                    else if (currentPage >= totalPages - 3) p = totalPages - 5 + i;
                                    else p = currentPage - 2 + i;
                                    return (
                                        <button key={p} onClick={() => handlePageChange(p)}
                                            className={`w-7 h-7 text-xs font-medium rounded transition-colors
                                                ${currentPage === p ? "bg-blue-600 text-white" : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"}`}>
                                            {p + 1}
                                        </button>
                                    );
                                })}
                                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages - 1}
                                    className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                    Next
                                </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </React.Fragment>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold">
                            Device Details
                        </DialogTitle>
                        <DialogDescription></DialogDescription>
                    </DialogHeader>
                            {dialogLoading && (
                                <div className="text-center py-10 text-gray-500">
                                    Loading...
                                </div>
                            )}
                            {!dialogLoading && dialogData && (
                                <div className="space-y-4 mb-3">
                                    <div className="bg-white rounded-lg border shadow-sm px-4 py-2">
                                        <div className="flex flex-col lg:flex-row items-center gap-2 flex-wrap">
                                            <span className="text-xs text-gray-600">SAP ID:</span>
                                            <span className="text-sm font-medium">{dialogData.sap_id ?? "-"}</span>
                                            <span className="text-xs text-gray-500">|</span>
                                            <span className="text-sm font-medium">{dialogData.sap_tt_no}</span>
                                            <span className="text-xs text-gray-500">|</span>
                                            <span className="text-xs text-gray-600">Chassis No:</span>
                                            <span className="text-xs font-medium">{dialogData.tt_chassis_no}</span>
                                            <span className="text-xs text-gray-500">|</span>
                                            <span className="text-xs text-gray-600">Engine No:</span>
                                            <span className="text-xs font-medium">{dialogData.tt_engine_no}</span>
                                            <span className="text-xs text-gray-500">|</span>
                                            <span className="text-xs text-gray-600">Status:</span>
                                            <span
                                                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                    !dialogData.status
                                                        ? "bg-gray-100 text-gray-600"
                                                        : dialogData.status.toUpperCase() === "REJECTED"
                                                        ? "bg-red-100 text-red-800"
                                                        : (dialogData.status.toUpperCase() === "APPROVED" || dialogData.status.toUpperCase() === "REQUESTED")
                                                        ? "bg-green-100 text-green-800"
                                                        : "bg-gray-100 text-gray-600"
                                                }`}
                                            >
                                                {dialogData.status || "-"}
                                            </span>
                                            <span className="text-xs text-gray-500">|</span>
                                            <span className="text-xs text-gray-600">Transporter:</span>
                                            <span className="text-xs font-medium">{dialogData.transporter}</span>
                                            <span className="text-xs text-gray-500">|</span>
                                            <span className="text-xs text-gray-600">Location:</span>
                                            <span className="text-xs font-medium">{dialogData.location}</span>
                                        </div>
                                    </div>

                                    <div className="px-2 lg:px-4 md:px-4 py-2 space-y-4">
                                        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4">
                                            <div className="flex items-center gap-2">
                                                <Store className="h-4 w-4 text-blue-500" />
                                                <span className="text-xs text-gray-600">SAP ID:</span>
                                                <span className="text-xs font-medium">{dialogData.sap_id ?? "-"}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Store className="h-4 w-4 text-blue-500" />
                                                <span className="text-xs text-gray-600">Business:</span>
                                                <span className="text-xs font-medium">
                                                    {dialogData.select_business}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-green-500" />
                                                <span className="text-xs text-gray-600">Location:</span>
                                                <span className="text-xs font-medium">{dialogData.location}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-purple-500" />
                                                <span className="text-xs text-gray-600">Certificate:</span>
                                                <span
                                                    className="text-xs font-medium break-words line-clamp-2 max-w-[200px]"
                                                    title={dialogData.certificate}
                                                >
                                                    {dialogData.certificate}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4">
                                            <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4 text-orange-500" />
                                                <span className="text-xs text-gray-600">Installed By:</span>
                                                <span className="text-xs font-medium">
                                                    {dialogData.vehicle_installed_by}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-4 w-4 text-rose-500" />
                                                <span className="text-xs text-gray-600">Installation Date:</span>
                                                <span className="text-xs font-medium">
                                                    {dialogData.vehicle_installation_date}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4 text-cyan-500" />
                                                <span className="text-xs text-gray-600">Approved By:</span>
                                                <span className="text-xs font-medium">
                                                    {dialogData.device_installation_approved_by}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-blue-500" />
                                                <span className="text-xs text-gray-600">Created At:</span>
                                                <span className="text-xs font-medium">
                                                    {dialogData.created_at?.slice(0, 10)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-green-500" />
                                                <span className="text-xs text-gray-600">Updated At:</span>
                                                <span className="text-xs font-medium">
                                                    {dialogData.updated_at?.slice(0, 10)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-yellow-500" />
                                                <span className="text-xs text-gray-600">Device:</span>
                                                <span className="text-xs font-medium">{dialogData.device}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-start border-t pt-4 mb-5 gap-4">
                                        <div className="w-56">
                                            <div className="text-sm font-medium mb-1 text-gray-700">Action</div>
                                            <Select value={action} onValueChange={(value) => setAction(value)}>
                                                <SelectTrigger className="h-10 bg-gray-100 text-xs">
                                                    <SelectValue placeholder="Select Action" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Accepted">Accepted</SelectItem>
                                                    <SelectItem value="Rejected">Rejected</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="w-56">
                                            <div className="text-sm font-medium mb-1 text-gray-700">Remarks</div>
                                            <Textarea
                                                value={remark}
                                                onChange={(e) => setRemark(e.target.value)}
                                                placeholder="Enter your remarks..."
                                                className="h-10 min-h-0 py-2 bg-gray-100 resize-none"
                                            />
                                        </div>

                                        <div className="flex items-end mt-6">
                                            <button
                                                className="px-4 py-2 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700"
                                                onClick={handleDailogData}
                                            >
                                                Submit
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>

            {showForm && hasOnBoardAccess && (
                <div className="px-2 py-3 overflow-auto">
                    <Card className="shadow-md px-2 py-4">
                        <CardHeader className="border-b py-2 px-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xl font-semibold text-gray-800">
                                    Add Device
                                </CardTitle>
                                <Button
                                    type="button"
                                    onClick={handleValidateAotDetails}
                                    disabled={!canValidate() || isValidating || isValidated}
                                    className="px-4 py-2 rounded text-white bg-green-600 hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-70 disabled:pointer-events-none disabled:cursor-not-allowed"
                                    title={isValidated ? "Already validated" : undefined}
                                >
                                    {isValidating && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {isValidated && <CheckCircle className="h-4 w-4" />}
                                    {isValidating ? "Validating..." : isValidated ? "Validated" : "Validate"}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 min-h-[300px] py-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 mb-5 gap-6">
                                <div>
                                    <label className="block text-sm text-gray-700 mb-2">
                                         TT No.<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.sapTtNo}
                                        onChange={(e) => handleInputChange("sapTtNo", e.target.value)}
                                        onKeyPress={handleSapKeyPress}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                                        placeholder="Enter TT No and press Enter"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-700 mb-2">
                                        SAP ID<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.sapId}
                                        onChange={(e) => handleInputChange("sapId", e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm text-gray-700 mb-2">
                                        Transporter Code<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.transporter}
                                        onChange={(e) => handleInputChange("transporter", e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-700 mb-2">
                                        Contract Valid Upto<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.ContractValid}
                                        onChange={(e) => handleInputChange("ContractValid", e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 mb-5 gap-6">
                                  <div>
                                    <label className="block text-sm text-gray-700 mb-2">
                                        TT Chassis No<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.ChassisNo}
                                        onChange={(e) => handleInputChange("ChassisNo", e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-700 mb-2">
                                        TT Engine No<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.EngineNo}
                                        onChange={(e) => handleInputChange("EngineNo", e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-700 mb-2">
                                        Select Business<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.business}
                                        onChange={(e) => handleInputChange("business", e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-700 mb-2">
                                        Location<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.location}
                                        onChange={(e) => handleInputChange("location", e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div>
                                    <label className="block text-sm text-gray-700 mb-2">
                                        Device Id<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.device}
                                        onChange={(e) => handleInputChange("device", e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-700 mb-2">
                                    Device Installed By <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={installedByEmployeeId || formData.installedBy}
                                            onChange={(e) => {
                                                setInstalledByEmployeeId(e.target.value);
                                                if (!e.target.value) {
                                                    handleInputChange("installedBy", "");
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    fetchUserByEmployeeId(installedByEmployeeId, 'installedBy');
                                                }
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 pr-8"
                                            placeholder="Enter Employee ID and press enter"
                                            disabled={installedByLoading}
                                        />
                                        {installedByLoading && (
                                            <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-700 mb-2">
                                        Device Installation Date <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.installationDate}
                                        onChange={(e) => handleInputChange("installationDate", e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-700 mb-2">
                                        Device Installation Approved By<span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={approvedByEmployeeId || formData.ApprovedBy}
                                            onChange={(e) => {
                                                setApprovedByEmployeeId(e.target.value);
                                                // If user clears the field, also clear the formData
                                                if (!e.target.value) {
                                                    handleInputChange("ApprovedBy", "");
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    fetchUserByEmployeeId(approvedByEmployeeId, 'ApprovedBy');
                                                }
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700 pr-8"
                                            placeholder="Enter Employee ID and press enter"
                                            disabled={approvedByLoading}
                                        />
                                        {approvedByLoading && (
                                            <Loader2 className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-blue-500" />
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-700 mb-2">
                                        Zone
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.zone}
                                        onChange={(e) => handleInputChange("zone", e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm text-gray-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm whitespace-nowrap text-gray-700 mb-2">
                                        Upload Installation Certificate(Max 8MB - JPG, PNG, PDF only)<span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                                        className="w-full px-3 py-1 mb-3 border border-gray-300 rounded text-sm text-gray-700"
                                        onChange={handleFileChange}
                                    />
                                    {imagePreview && (
                                        <div className="mb-3">
                                            <div className="border border-gray-300 rounded-lg p-2 bg-gray-50 inline-block relative">
                                                <button
                                                    onClick={handleRemoveImage}
                                                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg transition-colors z-10"
                                                    type="button"
                                                    aria-label="Remove image"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                                <img
                                                    src={imagePreview}
                                                    alt="Certificate preview"
                                                    className="max-w-full h-auto max-h-64 rounded"
                                                    style={{ maxWidth: '300px' }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>

                        <CardFooter className="border-t flex justify-end py-3 px-3">
                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowForm(false)}
                                >
                                    Close
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={!isFormValid() || isSubmitting}
                                    className={`px-6 py-2 rounded text-white transition-colors flex items-center gap-2
                                        ${!isFormValid() || isSubmitting ? "bg-blue-300 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600"} disabled:opacity-70 disabled:pointer-events-none`}
                                >
                                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {isSubmitting ? "Sending..." : "Send for Approval"}
                                </Button>
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default CreateDevice;
