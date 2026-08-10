import React, { useRef, useEffect, useMemo, useState } from "react";
import { Input } from "@/@/components/ui/input";
import { Textarea } from "@/@/components/ui/textarea";
import ReactQuill from "react-quill-new";
import "quill/dist/quill.snow.css";
import {
  Paperclip,
  Trash,
  Download,
  Loader2,
  X,
  AlertTriangle,
  Calendar,
  LockKeyholeOpen,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { Checkbox } from "@/@/components/ui/checkbox";
import { ReusableCombobox } from "./reusable-combobox";
import { MultiSelectCombobox } from "@/@/components/ui/multiselect-combobox";
import TicketScreenshotUpload from "./ScreenshotReport";
import { dialogBusinessUnitOptions, alertSectionOptions as defaultAlertSectionOptions } from "./ticket-form-constants";
import { ComboboxOption } from "./reusable-combobox";
import { TruckNumbersSection } from "./TruckNumbersSection";
import { TicketActivitySection } from "./TickeyActivitySection";

const IMAGE_TAG_REGEX = /<img\b[^>]*>/gi;

const stripImageTags = (html: string): string => html.replace(IMAGE_TAG_REGEX, "");

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const normalizeDescriptionForEditor = (value: string): string => {
  const raw = String(value ?? "");
  if (!raw.trim()) return "";
  const withoutImages = stripImageTags(raw);
  // Existing tickets may contain plain text; convert line breaks to paragraph blocks.
  if (!/<[^>]+>/.test(withoutImages)) {
    return withoutImages
      .split(/\r?\n/)
      .map((line) => (line.trim() ? `<p>${escapeHtml(line)}</p>` : "<p><br></p>"))
      .join("");
  }
  return withoutImages;
};

const toPlainDescription = (value: string): string =>
  String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n")
    .replace(/<\/?p[^>]*>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const normalizeTicketScalarList = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
  }
  if (raw == null || raw === "") return [];
  return [String(raw).trim()].filter(Boolean);
};

/** react-quill-new throws if getEditor() runs before Quill is mounted (e.g. React Strict Mode). */
function getQuillEditorSafe(ref: React.RefObject<ReactQuill | null>) {
  try {
    return ref.current?.getEditor() ?? null;
  } catch {
    return null;
  }
}

interface TicketFormMainContentProps {
  // Form state
  dialogBu: string;
  setDialogBu: (v: string) => void;
  region?: string;
  setRegion?: (v: string) => void;
  salesArea?: string;
  setSalesArea?: (v: string) => void;
  regionOptions?: ComboboxOption[];
  salesAreaOptions?: ComboboxOption[];
  alertSection: string;
  setAlertSection: (v: string) => void;
  /** When provided (e.g. from create-ticket-dialog), Alert Section dropdown is filtered by BU */
  alertSectionOptions?: ComboboxOption[];
  dialogZone: string[];
  setDialogZone: (v: string[]) => void;
  dialogLocation: string[];
  setDialogLocation: (v: string[]) => void;
  summary: string;
  setSummary: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  // Options
  dialogZoneOptions: ComboboxOption[];
  dialogPlantOptions: ComboboxOption[];
  // Linked alerts
  linkedAlerts: any[];
  activeTab: string;
  setActiveTab: (v: string) => void;
  setIsDialogOpen: (v: boolean) => void;
  handleRemoveAlert: (alert: any) => void;
  setHistoryDialogState: React.Dispatch<React.SetStateAction<{ isOpen: boolean; id: string[]; alertId: string | number | null }>>;
  // Attachments
  uploadedFiles: File[];
  handleImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  existingAttachments: { paths: string[]; names: string[]; ids: string[] };
  existingImagePreviews: Record<string, string>;
  imageErrors: Record<string, boolean>;
  setPreviewImage: (v: { src: string; alt: string } | null) => void;
  handleDownload: (id: string, filename: string) => void;
  removeExistingAttachment: (index: number) => void;
  removeFile: (index: number) => void;
  imagePreviews: string[];
  getFileExtension: (filename: string) => string;
  isImageFile: (filename: string) => boolean;
  // Other
  formElementsDisabled: boolean;
  isEditMode: boolean;
  initialData?: any;
  alertSectionForDisplay: string;
  // Block Vehicle (VTS only) - shown dynamically before Summary
  blockVehicleChecked1?: boolean;
  setBlockVehicleChecked1?: (v: boolean) => void;
  blockVehicleChecked2?: boolean;
  setBlockVehicleChecked2?: (v: boolean) => void;
  blockVehicleDate?: string;
  setBlockVehicleDate?: (v: string) => void;
  blockVehicleRemark?: string;
  setBlockVehicleRemark?: (v: string) => void;
  blockVehicleReason?: string;
  setBlockVehicleReason?: (v: string) => void;
  comment?: string;
  setComment?: (v: string) => void;
  /** Emits the latest saved activity comment HTML to parent for update payload sync. */
  onActivityCommentSaved?: (commentHtml: string) => void;
  /** Current user display name for activity comments */
  currentUserName?: string;
  /** When false (in edit mode), Summary & Description are read-only */
  canEditSummaryDescription?: boolean;
  /** Allow editing zone/location for selected edit-state role+workflow combination */
  canEditUpdatedByInitiatorFields?: boolean;
}

export function TicketFormMainContent({
  dialogBu,
  setDialogBu,
  region = "",
  setRegion = () => { },
  salesArea = "",
  setSalesArea = () => { },
  regionOptions = [],
  salesAreaOptions = [],
  alertSection,
  setAlertSection,
  alertSectionOptions: alertSectionOptionsProp,
  dialogZone,
  setDialogZone,
  dialogLocation,
  setDialogLocation,
  summary,
  setSummary,
  description,
  setDescription,
  dialogZoneOptions,
  dialogPlantOptions,
  linkedAlerts,
  activeTab,
  setActiveTab,
  setIsDialogOpen,
  handleRemoveAlert,
  setHistoryDialogState,
  uploadedFiles,
  handleImageChange,
  existingAttachments,
  existingImagePreviews,
  imageErrors,
  setPreviewImage,
  handleDownload,
  removeExistingAttachment,
  removeFile,
  imagePreviews,
  getFileExtension,
  isImageFile,
  formElementsDisabled,
  isEditMode,
  initialData,
  alertSectionForDisplay,
  blockVehicleChecked1 = false,
  setBlockVehicleChecked1 = () => { },
  blockVehicleChecked2 = false,
  setBlockVehicleChecked2 = () => { },
  blockVehicleDate = "",
  setBlockVehicleDate = () => { },
  blockVehicleRemark = "",
  setBlockVehicleRemark = () => { },
  blockVehicleReason = "",
  setBlockVehicleReason = () => { },
  comment = "",
  setComment = () => { },
  onActivityCommentSaved,
  currentUserName,
  canEditSummaryDescription = true,
  canEditUpdatedByInitiatorFields = false,
}: TicketFormMainContentProps) {
  const blockDetailsRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<ReactQuill | null>(null);
  const showBlockDetails =
    (blockVehicleChecked1 && !!blockVehicleDate) || (blockVehicleChecked1 && blockVehicleChecked2);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minBlockTillDate = tomorrow.toISOString().split("T")[0];

  const getAttachmentTypeLabel = (filename: string): string => {
    const ext = getFileExtension(filename).toLowerCase();
    if (ext === "pdf") return "PDF";
    if (ext === "xlsx") return "XLSX";
    if (ext === "xls") return "XLS";
    if (ext === "csv") return "CSV";
    return ext ? ext.toUpperCase() : "FILE";
  };

  const getAttachmentTypeBadgeClass = (label: string): string => {
    if (label === "PDF") return "bg-red-600 text-white";
    if (label === "XLSX" || label === "XLS" || label === "CSV") return "bg-emerald-600 text-white";
    return "bg-slate-500 text-white";
  };

  const summaryDescriptionDisabled =
    formElementsDisabled || (isEditMode && !canEditSummaryDescription);
  const editReadonlyValueClass = isEditMode
    ? "text-slate-800 disabled:text-slate-800 disabled:opacity-100"
    : "";
  const editReadonlyTextInputClass = isEditMode
    ? "text-slate-800 disabled:text-slate-800 disabled:opacity-100"
    : "";

  /** Last plain text we pushed from the editor — used to ignore self-induced `description` prop updates. */
  const plainFromEditorRef = useRef(description);
  const [quillHtml, setQuillHtml] = useState(() =>
    normalizeDescriptionForEditor(description)
  );

  useEffect(() => {
    if (description !== plainFromEditorRef.current) {
      plainFromEditorRef.current = description;
      setQuillHtml(normalizeDescriptionForEditor(description));
    }
  }, [description]);
  const ticketReassigneeEmployeeIds = useMemo(() => {
    const raw = initialData as any;
    return normalizeTicketScalarList(
      raw?.re_assingee_employee_id ??
      raw?.re_assignee_employee_id ??
      raw?.reassignee_employee_id
    );
  }, [initialData]);

  const quillModules = useMemo(
    () => ({
      toolbar: summaryDescriptionDisabled
        ? false
        : [
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ header: [1, 2, 3, false] }],
        ],
      clipboard: {
        matchers: [
          // Never allow image embeds in description content.
          ["img", () => ({ ops: [] })],
        ],
      },
    }),
    [summaryDescriptionDisabled]
  );

  const quillFormats = useMemo(
    () => ["bold", "italic", "underline", "strike", "list", "bullet", "header"],
    []
  );

  useEffect(() => {
    if (showBlockDetails) {
      blockDetailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showBlockDetails]);

  useEffect(() => {
    if (summaryDescriptionDisabled) return;

    let root: HTMLElement | null = null;
    let rafId = 0;
    let cancelled = false;
    let attachAttempts = 0;
    const maxAttachAttempts = 90;

    const handlePaste = (e: ClipboardEvent) => {
      const editor = getQuillEditorSafe(quillRef);
      if (!editor) return;
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const hasImage = Array.from(clipboardData.items ?? []).some((item) =>
        item.type.startsWith("image/")
      );

      if (hasImage) {
        e.preventDefault();
        return;
      }

      // Keep pasted input as plain text only.
      const text = clipboardData.getData("text/plain");
      if (text) {
        e.preventDefault();
        const range = editor.getSelection(true);
        const index = range?.index ?? editor.getLength();
        editor.insertText(index, text, "user");
        editor.setSelection(index + text.length, 0, "user");
      }
    };

    const handleDrop = (e: DragEvent) => {
      const droppedFiles = Array.from(e.dataTransfer?.files ?? []);
      const hasImageFile = droppedFiles.some((file) => file.type.startsWith("image/"));
      const hasAnyFile = droppedFiles.length > 0;
      if (hasImageFile || hasAnyFile) {
        e.preventDefault();
      }
    };

    const tryAttach = () => {
      if (cancelled) return;
      const editor = getQuillEditorSafe(quillRef);
      if (!editor) {
        attachAttempts += 1;
        if (attachAttempts < maxAttachAttempts) {
          rafId = requestAnimationFrame(tryAttach);
        }
        return;
      }
      root = editor.root;
      root.addEventListener("paste", handlePaste, true);
      root.addEventListener("drop", handleDrop);
    };

    tryAttach();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (root) {
        root.removeEventListener("paste", handlePaste, true);
        root.removeEventListener("drop", handleDrop);
      }
    };
  }, [isEditMode, summaryDescriptionDisabled]);

  return (
    <div className="col-span-1 md:col-span-12 lg:col-span-8 space-y-1 sm:space-y-1.5">
      {/* Ticket Details Section */}
      <section className="bg-white dark:bg-slate-900 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-1.5 sm:p-2 md:p-3 space-y-2 sm:space-y-3">
          {/* When RO: responsive 3-column grid (BU, Region, Sales, Alert Section, Zone, Location/Plant) */}
          {/* When not RO: responsive 4-column grid (BU, Alert Section, Zone, Location/Plant) */}
          <div
            className={`grid gap-2 sm:gap-3 md:gap-4 ${dialogBu === "RO"
                ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
                : "grid-cols-1 sm:grid-cols-2 md:grid-cols-4"
              }`}
          >
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                Business Unit <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span>
              </label>
              <ReusableCombobox
                options={dialogBusinessUnitOptions}
                value={dialogBu}
                onValueChange={setDialogBu}
                placeholder="Select Business Unit"
                buttonClassName={`h-8 w-full text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary transition-all py-1.5 px-2 ${editReadonlyValueClass}`}
                disabled={formElementsDisabled}
              />
            </div>
            {dialogBu === "RO" && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    Region <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span>
                  </label>
                  <ReusableCombobox
                    options={regionOptions}
                    value={region}
                    onValueChange={setRegion}
                    placeholder="Select Region"
                    buttonClassName="h-8 w-full text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary transition-all py-1.5 px-2"
                    disabled={formElementsDisabled}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    Sales <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span>
                  </label>
                  <ReusableCombobox
                    options={salesAreaOptions}
                    value={salesArea}
                    onValueChange={setSalesArea}
                    placeholder="Select Sales"
                    buttonClassName="h-8 w-full text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary transition-all py-1.5 px-2"
                    disabled={formElementsDisabled}
                  />
                </div>
              </>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                Alert Section <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span>
              </label>
              <ReusableCombobox
                options={alertSectionOptionsProp ?? defaultAlertSectionOptions}
                value={alertSection}
                onValueChange={setAlertSection}
                placeholder="Select Alert Section"
                buttonClassName={`h-8 w-full text-sm bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary transition-all py-1.5 px-2 ${editReadonlyValueClass}`}
                disabled={formElementsDisabled}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                Zone <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span>
              </label>
              <MultiSelectCombobox
                options={dialogZoneOptions}
                value={dialogZone}
                onChange={setDialogZone}
                placeholder="Select Zones"
                className={`h-8 min-h-8 text-sm w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary transition-all py-1.5 px-2 ${editReadonlyValueClass}`}
                disabled={formElementsDisabled && !canEditUpdatedByInitiatorFields}
              />
            </div>
            <div className="space-y-1 mt-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                Location/Plant
              </label>
              <MultiSelectCombobox
                options={dialogPlantOptions}
                value={dialogLocation}
                onChange={setDialogLocation}
                placeholder="Select Locations"
                className={`h-8 min-h-8 text-sm w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary transition-all py-1.5 px-2 ${editReadonlyValueClass}`}
                disabled={
                  (formElementsDisabled && !canEditUpdatedByInitiatorFields) ||
                  dialogZone.length > 1
                }
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              Summary (Subject) <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span>
            </label>
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief summary of the issue..."
              className={`h-8 text-sm w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md focus:ring-primary focus:border-primary transition-all py-1.5 px-2 ${editReadonlyTextInputClass}`}
              disabled={summaryDescriptionDisabled}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              Description <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span>
            </label>
            <div className={summaryDescriptionDisabled ? (isEditMode ? "opacity-100" : "opacity-60") : ""}>
              <ReactQuill
                ref={quillRef}
                theme="snow"
                value={quillHtml}
                onChange={(value) => {
                  const cleaned = stripImageTags(value);
                  const plain = toPlainDescription(cleaned);
                  plainFromEditorRef.current = plain;
                  setQuillHtml(cleaned);
                  setDescription(plain);
                }}
                readOnly={summaryDescriptionDisabled}
                placeholder="Provide detailed description..."
                className="text-sm [&_.ql-editor]:min-h-[120px] [&_.ql-editor]:text-slate-800 bg-slate-50 dark:bg-slate-800"
                modules={quillModules}
                formats={quillFormats}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Attachments Section */}
      <section className="bg-white dark:bg-slate-900 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-1.5 sm:p-2 md:p-3 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Attachments{" "}
              <span className="font-normal normal-case text-xs text-slate-400 dark:text-slate-500">
                (upload max 5 MB images, PDF, Excel, CSV)
              </span>
            </h3>
          </div>

          <div className="w-full">
            <TicketScreenshotUpload
              onFilesSelected={(files: File[]) => {
                if (files.length > 0) {
                  const dataTransfer = new DataTransfer();
                  files.forEach((file) => dataTransfer.items.add(file));
                  const syntheticEvent = {
                    target: { files: dataTransfer.files, value: "" },
                  } as React.ChangeEvent<HTMLInputElement>;
                  handleImageChange(syntheticEvent);
                }
              }}
              disabled={formElementsDisabled}
              existingFiles={uploadedFiles}
            />
          </div>
    
          {isEditMode && existingAttachments.paths.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Existing Attachments ({existingAttachments.paths.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {existingAttachments.paths.map((path, idx) => {
                  const filename = existingAttachments.names[idx] || `Attachment ${idx + 1}`;
                  const isImage = isImageFile(filename);
                  const previewSrc = existingImagePreviews[path];
                  const hasError = imageErrors[path];
                  return (
                    <div
                      key={`existing-${idx}`}
                      className={isImage ? "relative group border border-gray-300 dark:border-slate-600 rounded" : "relative group"}
                    >
                      {isImage ? (
                        <button
                          type="button"
                          className="w-full h-24 sm:h-28 md:h-32"
                          onClick={() =>
                            previewSrc &&
                            setPreviewImage({ src: previewSrc, alt: filename })
                          }
                          disabled={!previewSrc || hasError}
                        >
                          <div className="relative h-full w-full">
                            {hasError || !previewSrc ? (
                              <div className="h-full w-full bg-gray-100 dark:bg-slate-800 rounded flex items-center justify-center flex-col">
                                {hasError ? (
                                  <>
                                    <Paperclip className="h-8 w-8 text-gray-400 dark:text-slate-500" />
                                    <span className="text-xs text-gray-500 dark:text-slate-400 mt-1">Error</span>
                                  </>
                                ) : (
                                  <Loader2 className="h-6 w-6 text-gray-400 dark:text-slate-500 animate-spin" />
                                )}
                              </div>
                            ) : (
                              <img src={previewSrc} alt={filename} className="h-full w-full object-cover rounded" />
                            )}
                          </div>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="w-full"
                          onClick={() => {
                            handleDownload(String(initialData!.id), filename);
                          }}
                          title="Download attachment"
                        >
                          <div className="w-full max-w-[720px] rounded-xl border border-emerald-200 dark:border-emerald-700/40 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-2 text-left flex items-center gap-3 min-h-[56px]">
                            <div className={`h-10 w-10 rounded-md text-[11px] font-bold flex items-center justify-center ${getAttachmentTypeBadgeClass(getAttachmentTypeLabel(filename))}`}>
                              {getAttachmentTypeLabel(filename)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate" title={filename}>
                                {filename}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {getAttachmentTypeLabel(filename)}
                              </p>
                            </div>
                            <span className="h-8 w-8 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center">
                              <Download className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                            </span>
                          </div>
                        </button>
                      )}
                      {isImage && (
                        <>
                          <div className="absolute top-1 right-1 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(String(initialData!.id), filename);
                              }}
                              className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-blue-600"
                              title="Download attachment"
                            >
                              <Download className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate rounded-b">
                            {filename}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                File Uploaded ({uploadedFiles.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                {uploadedFiles.map((file, idx) => {
                  const src = imagePreviews[idx];
                  const filename = file?.name || `Attachment ${idx + 1}`;
                  const isImage = isImageFile(filename);
                  const typeLabel = getAttachmentTypeLabel(filename);
                  return (
                    <div key={`new-${idx}`} className="relative group">
                      {isImage ? (
                        <button
                          type="button"
                          className="w-full h-24 sm:h-28 md:h-32"
                          onClick={() =>
                            src &&
                            setPreviewImage({
                              src,
                              alt: filename,
                            })
                          }
                        >
                          <img
                            src={src}
                            alt={`Preview ${idx + 1}`}
                            className="h-full w-full object-cover rounded border border-gray-300 dark:border-slate-600"
                          />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="w-full"
                          onClick={() => {
                            const url = src || URL.createObjectURL(file);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            if (!src) URL.revokeObjectURL(url);
                          }}
                          title="Download attachment"
                        >
                          <div className="w-full max-w-[720px] rounded-xl border border-emerald-200 dark:border-emerald-700/40 bg-emerald-100 dark:bg-emerald-900/30 px-3 py-2 text-left flex items-center gap-3 min-h-[56px]">
                            <div className={`h-10 w-10 rounded-md text-[11px] font-bold flex items-center justify-center ${getAttachmentTypeBadgeClass(typeLabel)}`}>
                              {typeLabel}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate" title={filename}>
                                {filename}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {typeLabel}
                              </p>
                            </div>
                            <span className="h-8 w-8 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center">
                              <Download className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                            </span>
                          </div>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        title="Remove file"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {isImage && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate rounded-b">
                          {filename}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {existingAttachments.paths.length === 0 && uploadedFiles.length === 0 && (
            <div className="text-xs text-gray-500 dark:text-slate-400">No files attached</div>
          )}
        </div>
      </section>

      {(() => {
        const linkedRows = (initialData as any)?.linked_rows;
        const truckNo = (initialData as any)?.truck_no;
        const orderId = (initialData as any)?.order_id;
        const hasLinkedRows = Array.isArray(linkedRows) && linkedRows.length > 0;
        const hasTruckNo = Array.isArray(truckNo) && truckNo.filter(Boolean).length > 0;
        const hasOrderId = Array.isArray(orderId) && orderId.filter(Boolean).length > 0;
        if (!hasLinkedRows && !hasTruckNo && !hasOrderId) return null;
        return (
          <section className="bg-white dark:bg-slate-900 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-1.5 sm:p-2 md:p-3">
              <TruckNumbersSection
                linkedRows={linkedRows || undefined}
                initialData={initialData}
              />
            </div>
          </section>
        );
      })()}

      {/* Block Vehicle - after Vehicle numbers, only when creating ticket from Risk Score or VTS Live */}
      {!isEditMode &&
        alertSectionForDisplay === "VTS" &&
        ((initialData as any)?.ticket_section === "RiskScore" ||
          (initialData as any)?.ticket_section === "VTS Live") && (
          <section
            data-section="block-vehicle"
            className="bg-white dark:bg-slate-900 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            <div className="p-3 sm:p-4 md:p-5 space-y-4 sm:space-y-5">
              <div className="space-y-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Block Vehicle
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Select a blocking status for the vehicle associated with this ticket. This action will affect the
                  vehicle&apos;s permissions across all terminals.
                </p>
              </div>

              <div className="grid gap-2 sm:gap-3 md:grid-cols-3">
                <button
                  type="button"
                  disabled={formElementsDisabled}
                  onClick={() => {
                    if (formElementsDisabled) return;
                    const next = !blockVehicleChecked1;
                    setBlockVehicleChecked1(next);
                    if (!next) {
                      setBlockVehicleChecked2(false);
                      setBlockVehicleDate("");
                    }
                  }}
                  className={`flex flex-col rounded-lg border p-2 sm:p-2.5 text-left transition-all relative ${blockVehicleChecked1
                      ? "border-primary bg-primary/15 dark:bg-primary/20 shadow-md ring-2 ring-primary/20"
                      : "border-slate-200 hover:border-primary/70 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-primary/70 dark:hover:bg-slate-800"
                    } ${formElementsDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                  aria-pressed={blockVehicleChecked1}
                >
                  {blockVehicleChecked1 && (
                    <div className="absolute top-2 right-2 flex-shrink-0 text-primary">
                      <CheckCircle2 className="h-4 w-4 fill-primary text-white" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <div className="inline-flex items-center justify-center rounded-full bg-red-50 text-red-500 border border-red-100 h-6 w-6 self-start">
                      <Ban className="h-3.5 w-3.5 rotate-180" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">AutoBlock</p>
                      <p className="mt-0.5 text-[11px] leading-tight text-slate-600 dark:text-slate-300">
                        The selected truck will be automatically unblocked.
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={formElementsDisabled || (blockVehicleChecked1 && !!blockVehicleDate)}
                  onClick={() => {
                    if (formElementsDisabled || (blockVehicleChecked1 && !!blockVehicleDate)) return;
                    setBlockVehicleChecked2(!blockVehicleChecked2);
                  }}
                  className={`flex flex-col rounded-lg border p-2 sm:p-2.5 text-left transition-all relative ${blockVehicleChecked2
                      ? "border-primary bg-primary/15 dark:bg-primary/20 shadow-md ring-2 ring-primary/20"
                      : "border-slate-200 hover:border-primary/70 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-primary/70 dark:hover:bg-slate-800"
                    } ${formElementsDisabled || (blockVehicleChecked1 && !!blockVehicleDate)
                      ? "opacity-60 cursor-not-allowed"
                      : "cursor-pointer"
                    }`}
                  aria-pressed={blockVehicleChecked2}
                >
                  {blockVehicleChecked2 && (
                    <div className="absolute top-2 right-2 flex-shrink-0 text-primary">
                      <CheckCircle2 className="h-4 w-4 fill-primary text-white" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <div className="inline-flex items-center justify-center rounded-full bg-emerald-50 text-emerald-500 border border-emerald-100 h-6 w-6 self-start">
                      <LockKeyholeOpen className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">AutoUnblock</p>
                      <p className="mt-0.5 text-[11px] leading-tight text-slate-600 dark:text-slate-300">
                        Vehicle is automatically unblocked when the ticket is closed.
                      </p>
                    </div>
                  </div>
                </button>

                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && blockVehicleDate && !formElementsDisabled && !(blockVehicleChecked1 && blockVehicleChecked2)) {
                      e.preventDefault();
                      setBlockVehicleDate("");
                    }
                  }}
                  onClick={() => {
                    if (formElementsDisabled || (blockVehicleChecked1 && blockVehicleChecked2)) return;
                    if (blockVehicleDate) setBlockVehicleDate("");
                  }}
                  className={`flex flex-col rounded-lg border p-2 sm:p-2.5 text-left transition-all relative ${blockVehicleDate
                      ? "border-primary bg-primary/15 dark:bg-primary/20 shadow-md ring-2 ring-primary/20"
                      : "border-slate-200 hover:border-primary/70 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-primary/70 dark:hover:bg-slate-800"
                    } ${formElementsDisabled || (blockVehicleChecked1 && blockVehicleChecked2)
                      ? "opacity-60 cursor-not-allowed"
                      : "cursor-pointer"
                    }`}
                >
                  {blockVehicleDate && (
                    <div className="absolute top-2 right-2 flex-shrink-0 text-primary">
                      <CheckCircle2 className="h-4 w-4 fill-primary text-white" />
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 inline-flex items-center justify-center rounded-full bg-blue-50 text-blue-500 border border-blue-100 h-6 w-6">
                      <Calendar className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Scheduled Block</p>
                      <p className="mt-0.5 text-[11px] leading-tight text-slate-600 dark:text-slate-300">
                        The truck will be blocked until the specific date selected.
                      </p>
                    </div>
                  </div>
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <label className="mb-0.5 block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      Block till date
                    </label>
                    <Input
                      type="date"
                      value={blockVehicleDate}
                      min={minBlockTillDate}
                      onChange={(e) => {
                        const next = e.target.value;
                        setBlockVehicleDate(next);
                        if (blockVehicleChecked1 && !!next) setBlockVehicleChecked2(false);
                      }}
                      className="h-8 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md text-xs focus:ring-primary focus:border-primary w-full py-1.5"
                      disabled={formElementsDisabled || (blockVehicleChecked1 && blockVehicleChecked2)}
                    />
                  </div>
                </div>
              </div>

              {showBlockDetails ? (
                <div ref={blockDetailsRef} className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-3">
                    Block details <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span>
                  </p>
                  <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                        Remark <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span>
                      </label>
                      <Textarea
                        value={blockVehicleRemark}
                        onChange={(e) => setBlockVehicleRemark(e.target.value)}
                        placeholder="e.g. Blocked for maintenance / penalty"
                        className="h-10 min-h-0 resize-none py-1.5 px-3 text-sm bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400"
                        disabled={formElementsDisabled}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                        Reason <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span>
                      </label>
                      <Input
                        value={blockVehicleReason}
                        onChange={(e) => setBlockVehicleReason(e.target.value)}
                        placeholder="e.g. Ticket creation - vehicle blocking"
                        className="h-10 py-1.5 px-3 text-sm bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400"
                        disabled={formElementsDisabled}
                        required
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        )}

      {/* Linked Alerts Section - hidden when create from Risk/Ongoing or when editing a RiskScore/VTS Live ticket */}
      {!(initialData as any)?.hideLinkedAlerts &&
        !(
          isEditMode &&
          ((initialData as any)?.ticket_section === "RiskScore" ||
            (initialData as any)?.ticket_section === "VTS Live" ||
            (initialData as any)?.ticket_section === "PM Orders")
        ) && (
          <div className="flex flex-col gap-3 sm:gap-4">
            <section
              data-section="linked-alerts"
              className="bg-white dark:bg-slate-900 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
            >
              <div className="p-1.5 sm:p-2 md:p-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 sm:gap-4">
                <div className="flex items-center gap-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Linked Alerts
                  </h3>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveTab("linkedAlerts");
                      }}
                      className={`text-sm font-medium pb-5 -mb-6 ${activeTab === "linkedAlerts"
                          ? "border-b-2 border-primary text-primary"
                          : isEditMode
                            ? "border-transparent text-slate-700 hover:text-slate-800"
                            : "border-transparent text-slate-400 hover:text-slate-600"
                        }`}
                    >
                      Linked Alerts ({linkedAlerts?.length || 0})
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="hover:bg-blue-500 hover:text-white px-3 py-1.5 text-sm font-medium rounded-md border border-slate-200 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={dialogZone.length === 0 || isEditMode}
                  onClick={() => setIsDialogOpen(true)}
                >
                  + Add Alert
                </button>
              </div>

              {linkedAlerts && linkedAlerts.length > 0 ? (
                <div className="p-2">
                  <div className="overflow-x-auto">
                    <table className="min-w-full border text-xs">
                      <thead className="bg-gray-100 dark:bg-slate-800">
                        <tr>
                          <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-left text-slate-700 dark:text-slate-300">ID</th>
                          <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-left text-slate-700 dark:text-slate-300">Location</th>
                          <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-left text-slate-700 dark:text-slate-300">Alert</th>
                          <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-left text-slate-700 dark:text-slate-300">Unique ID</th>
                          {alertSectionForDisplay === "VTS" && (
                            <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-left text-slate-700 dark:text-slate-300">
                              Vehicle Number
                            </th>
                          )}
                          <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-left text-slate-700 dark:text-slate-300">Created At</th>
                          <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-left text-slate-700 dark:text-slate-300">Updated At</th>
                          <th className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-left text-slate-700 dark:text-slate-300">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linkedAlerts.map((alert) => (
                          <tr key={alert.id || alert.unique_id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                            <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-slate-900 dark:text-slate-100">{alert.sap_id}</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-slate-900 dark:text-slate-100">{alert.location_name}</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-slate-900 dark:text-slate-100">{alert.interlock_name}</td>
                            <td className="border border-slate-200 dark:border-slate-700 px-2 py-2">
                              <button
                                type="button"
                                className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setHistoryDialogState({
                                    isOpen: true,
                                    alertId: alert.id || alert.unique_id,
                                    id: [String(alert.unique_id)],
                                  });
                                }}
                              >
                                {alert.unique_id}
                              </button>
                            </td>
                            {alertSectionForDisplay === "VTS" && (
                              <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-slate-900 dark:text-slate-100">
                                {alert.vehicle_number || "N/A"}
                              </td>
                            )}
                            <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-slate-900 dark:text-slate-100">
                              {alert.created_at ? new Date(alert.created_at).toLocaleString() : "-"}
                            </td>
                            <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-slate-900 dark:text-slate-100">
                              {alert.updated_at ? new Date(alert.updated_at).toLocaleString() : "-"}
                            </td>
                            <td className="border border-slate-200 dark:border-slate-700 px-2 py-2 text-center">
                              <button
                                type="button"
                                className={`text-red-600 dark:text-red-400 font-bold hover:text-red-800 dark:hover:text-red-300 ${isEditMode ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
                                  }`}
                                onClick={() => {
                                  if (isEditMode) return;
                                  handleRemoveAlert(alert);
                                }}
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className={`p-4 flex flex-col items-center justify-center text-center space-y-2 ${isEditMode ? "opacity-100" : "opacity-60"}`}>
                  <AlertTriangle className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                  <p className={`${isEditMode ? "text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400"} text-sm font-medium`}>No alerts linked yet.</p>
                </div>
              )}
            </section>

            {/* Block Vehicle - only for VTS, shown next to Linked Alerts only after alerts are selected; hidden in edit mode; not shown for RiskScore/VTS Live (shown after Vehicle numbers there) */}
            {alertSectionForDisplay === "VTS" &&
              (linkedAlerts?.length ?? 0) > 0 &&
              !isEditMode &&
              (initialData as any)?.ticket_section !== "RiskScore" &&
              (initialData as any)?.ticket_section !== "VTS Live" && (
                <section
                  data-section="block-vehicle"
                  className="bg-white dark:bg-slate-900 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
                >
                  <div className="p-3 sm:p-4 md:p-5 space-y-4 sm:space-y-5">
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Block Vehicle
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Select a blocking status for the vehicle associated with this ticket. This action will affect the
                        vehicle&apos;s permissions across all terminals.
                      </p>
                    </div>

                    <div className="grid gap-2 sm:gap-3 md:grid-cols-3">
                      {/* AutoBlock card */}
                      <button
                        type="button"
                        disabled={formElementsDisabled}
                        onClick={() => {
                          if (formElementsDisabled) return;
                          const next = !blockVehicleChecked1;
                          setBlockVehicleChecked1(next);
                          if (!next) {
                            setBlockVehicleChecked2(false);
                            setBlockVehicleDate("");
                          }
                        }}
                        className={`flex flex-col rounded-lg border p-2 sm:p-2.5 text-left transition-all relative ${blockVehicleChecked1
                            ? "border-primary bg-primary/15 dark:bg-primary/20 shadow-md ring-2 ring-primary/20"
                            : "border-slate-200 hover:border-primary/70 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-primary/70 dark:hover:bg-slate-800"
                          } ${formElementsDisabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                        aria-pressed={blockVehicleChecked1}
                      >
                        {blockVehicleChecked1 && (
                          <div className="absolute top-2 right-2 flex-shrink-0 text-primary">
                            <CheckCircle2 className="h-4 w-4 fill-primary text-white" />
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          <div className="inline-flex items-center justify-center rounded-full bg-red-50 text-red-500 border border-red-100 h-6 w-6 self-start">
                            <Ban className="h-3.5 w-3.5 rotate-180" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">AutoBlock</p>
                            <p className="mt-0.5 text-[11px] leading-tight text-slate-600 dark:text-slate-300">
                              The selected truck will be automatically unblocked.
                            </p>
                          </div>
                        </div>
                      </button>

                      {/* AutoUnblock card */}
                      <button
                        type="button"
                        disabled={formElementsDisabled || (blockVehicleChecked1 && !!blockVehicleDate)}
                        onClick={() => {
                          if (formElementsDisabled || (blockVehicleChecked1 && !!blockVehicleDate)) return;
                          setBlockVehicleChecked2(!blockVehicleChecked2);
                        }}
                        className={`flex flex-col rounded-lg border p-2 sm:p-2.5 text-left transition-all relative ${blockVehicleChecked2
                            ? "border-primary bg-primary/15 dark:bg-primary/20 shadow-md ring-2 ring-primary/20"
                            : "border-slate-200 hover:border-primary/70 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-primary/70 dark:hover:bg-slate-800"
                          } ${formElementsDisabled || (blockVehicleChecked1 && !!blockVehicleDate)
                            ? "opacity-60 cursor-not-allowed"
                            : "cursor-pointer"
                          }`}
                        aria-pressed={blockVehicleChecked2}
                      >
                        {blockVehicleChecked2 && (
                          <div className="absolute top-2 right-2 flex-shrink-0 text-primary">
                            <CheckCircle2 className="h-4 w-4 fill-primary text-white" />
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          <div className="inline-flex items-center justify-center rounded-full bg-emerald-50 text-emerald-500 border border-emerald-100 h-6 w-6 self-start">
                            <LockKeyholeOpen className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">AutoUnblock</p>
                            <p className="mt-0.5 text-[11px] leading-tight text-slate-600 dark:text-slate-300">
                              Vehicle is automatically unblocked when the ticket is closed.
                            </p>
                          </div>
                        </div>
                      </button>

                      <div
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if ((e.key === "Enter" || e.key === " ") && blockVehicleDate && !formElementsDisabled && !(blockVehicleChecked1 && blockVehicleChecked2)) {
                            e.preventDefault();
                            setBlockVehicleDate("");
                          }
                        }}
                        onClick={() => {
                          if (formElementsDisabled || (blockVehicleChecked1 && blockVehicleChecked2)) return;
                          if (blockVehicleDate) setBlockVehicleDate("");
                        }}
                        className={`flex flex-col rounded-lg border p-2 sm:p-2.5 text-left transition-all relative ${blockVehicleDate
                            ? "border-primary bg-primary/15 dark:bg-primary/20 shadow-md ring-2 ring-primary/20"
                            : "border-slate-200 hover:border-primary/70 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-primary/70 dark:hover:bg-slate-800"
                          } ${formElementsDisabled || (blockVehicleChecked1 && blockVehicleChecked2)
                            ? "opacity-60 cursor-not-allowed"
                            : "cursor-pointer"
                          }`}
                      >
                        {blockVehicleDate && (
                          <div className="absolute top-2 right-2 flex-shrink-0 text-primary">
                            <CheckCircle2 className="h-4 w-4 fill-primary text-white" />
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <div className="shrink-0 inline-flex items-center justify-center rounded-full bg-blue-50 text-blue-500 border border-blue-100 h-6 w-6">
                            <Calendar className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Scheduled Block</p>
                            <p className="mt-0.5 text-[11px] leading-tight text-slate-600 dark:text-slate-300">
                              The truck will be blocked until the specific date selected.
                            </p>
                          </div>
                        </div>
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                          <label className="mb-0.5 block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            Block till date
                          </label>
                          <Input
                            type="date"
                            value={blockVehicleDate}
                            min={minBlockTillDate}
                            onChange={(e) => {
                              const next = e.target.value;
                              setBlockVehicleDate(next);
                              if (blockVehicleChecked1 && !!next) setBlockVehicleChecked2(false);
                            }}
                            className="h-8 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md text-xs focus:ring-primary focus:border-primary w-full py-1.5"
                            disabled={formElementsDisabled || (blockVehicleChecked1 && blockVehicleChecked2)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Remark and Reason - required when AutoBlock + Schedule Block or AutoBlock + AutoUnblock */}
                    {showBlockDetails ? (
                      <div ref={blockDetailsRef} className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-3">
                          Block details <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span>
                        </p>
                        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
                          <div className="space-y-2">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                              Remark <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span>
                            </label>
                            <Textarea
                              value={blockVehicleRemark}
                              onChange={(e) => setBlockVehicleRemark(e.target.value)}
                              placeholder="e.g. Blocked for maintenance / penalty"
                              className="h-10 min-h-0 resize-none py-1.5 px-3 text-sm bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400"
                              disabled={formElementsDisabled}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                              Reason <span className="text-red-500 text-xl font-bold align-middle leading-none">*</span>
                            </label>
                            <Input
                              value={blockVehicleReason}
                              onChange={(e) => setBlockVehicleReason(e.target.value)}
                              placeholder="e.g. Ticket creation - vehicle blocking"
                              className="h-10 py-1.5 px-3 text-sm bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder:text-slate-400"
                              disabled={formElementsDisabled}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {/* <div className="mt-1 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 sm:px-3 sm:py-2.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-blue-600 border border-blue-200 text-[10px] font-semibold">
                    i
                  </span>
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-100">How blocking works:</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-xs">
                      <li>
                        <span className="font-semibold">AutoBlock:</span> Direct override, prevents all gate entries.
                      </li>
                      <li>
                        <span className="font-semibold">AutoUnblock:</span> Temporary restriction linked to the life of
                        the ticket.
                      </li>
                      <li>
                        <span className="font-semibold">Scheduled Block:</span> Custom duration for scheduled maintenance or
                        penalties.
                      </li>
                    </ul>
                  </div>
                </div>
              </div> */}
                  </div>
                </section>
              )}
          </div>
        )}

      <TicketActivitySection
        comment={comment}
        setComment={setComment}
        onSaveComment={(savedComment) => onActivityCommentSaved?.(savedComment.body)}
        ticketId={initialData?.ticket_id}
        reAssigneeEmployeeIds={ticketReassigneeEmployeeIds}
        // Only use comment_history for activity history; ignore ticket_history entries
        ticketHistory={(((initialData as any)?.comment_history as any[]) ?? [])}
        currentUserName={
          currentUserName ??
          (Array.isArray((initialData as any)?.assignee_name) && (initialData as any).assignee_name?.length
            ? (initialData as any).assignee_name[0]
            : "Current User"
          )
        }
        formElementsDisabled={formElementsDisabled}
        isEditMode={isEditMode}
      />
    </div>
  );
}
