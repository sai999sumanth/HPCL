import React, { type ChangeEvent, type RefObject } from "react";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/@/components/ui/dialog";
import {
  Upload,
  AlertCircle,
  CheckCircle,
  Download,
} from "lucide-react";
import { apiClient } from "@/services/apiClient";

export interface UploadStatus {
  isUploading: boolean;
  success: boolean;
  error: string | null;
  fileName: string | null;
}

interface UploadDialogProps {
  showUploadDialog: boolean;
  setShowUploadDialog: (show: boolean) => void;
  uploadStatus: UploadStatus;
  resetUploadStatus: () => void;
  canUpload: () => boolean;
  handleFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  selectedSbu: string;
}

const UploadDialog: React.FC<UploadDialogProps> = ({
  showUploadDialog,
  setShowUploadDialog,
  uploadStatus,
  resetUploadStatus,
  canUpload,
  handleFileSelect,
  fileInputRef,
  selectedSbu,
}) => {
  if (!showUploadDialog) return null;

  const handleDownloadTemplate = async () => {
    try {
      const sbu = (selectedSbu || "sod").toLowerCase();
      const downloadEndpoint = `/api/sodinfra/download_template`;

      const response = await apiClient.post(downloadEndpoint,
        { sbu: selectedSbu || "" },
        {
          responseType: "blob", // important for downloading files
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // Dynamically extract filename from response headers
      let filename = "download";
      const contentDisposition = response.headers["content-disposition"];
      if (contentDisposition && contentDisposition.includes("filename=")) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) {
          filename = match[1];
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download the template.");
    }
  };

  return (
    <Dialog
      open
      onOpenChange={() => {
        setShowUploadDialog(false);
        resetUploadStatus();
      }}
    >
      <DialogContent className="max-w-md bg-white text-gray-900 border border-gray-200 shadow-2xl rounded-2xl">
        <DialogHeader className="border-b border-gray-200 pb-5">
          <DialogTitle className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <Upload className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="font-bold text-lg text-gray-900">
              Upload SBU File
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* 🔽 Download Template Button - Only enabled when SBU is selected */}
        <div className="px-6 pt-4 flex justify-end">
          <button
            onClick={handleDownloadTemplate}
            disabled={!canUpload()}
            className={`inline-flex items-center gap-2 text-xs px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-md ${
              canUpload()
                ? 'bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 text-white hover:shadow-violet-500/30'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>
        </div>

        <div className="p-6 pt-0">
          {!canUpload() && (
            <div className="space-y-5">
              <div className="flex items-center gap-4 py-6">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-700">
                    SBU Selection Required
                  </p>
                  <p className="text-xs text-gray-600 mt-2 bg-gray-100 px-3 py-2 rounded-lg">
                    Please select SBU to upload files.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowUploadDialog(false);
                  resetUploadStatus();
                }}
                className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold transition-all duration-200 shadow-lg"
              >
                Close
              </button>
            </div>
          )}

          {canUpload() &&
            !uploadStatus.isUploading &&
            !uploadStatus.success &&
            !uploadStatus.error && (
              <div className="space-y-5">
                <div className="text-sm text-gray-600 bg-gray-100 p-4 rounded-xl border border-gray-200">
                  Select a file to upload (CSV, XLSX, XLS)
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="w-full text-sm text-gray-700 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:bg-gradient-to-r file:from-emerald-600 file:to-emerald-700 file:text-white file:font-semibold hover:file:from-emerald-700 hover:file:to-emerald-800 file:transition-all file:duration-200 file:cursor-pointer cursor-pointer file:shadow-lg hover:file:shadow-emerald-500/25"
                  accept=".csv,.xlsx,.xls"
                />
              </div>
            )}

          {uploadStatus.isUploading && (
            <div className="flex items-center gap-5 py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent shadow-lg"></div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-800">
                  Uploading {uploadStatus.fileName}...
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full animate-pulse shadow-sm"
                    style={{ width: "60%" }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {uploadStatus.success && (
            <div className="flex items-start gap-5 py-6">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-emerald-700">
                  Upload Successful!
                </p>
                <p className="text-xs text-gray-600 mt-2 bg-gray-100 px-3 py-2 rounded-lg">
                  {uploadStatus.fileName} uploaded successfully.
                </p>
              </div>
            </div>
          )}

          {uploadStatus.error && (
            <div className="space-y-5">
              <div className="flex items-start gap-5 py-4">
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-700">
                    Upload Failed
                  </p>
                  <p className="text-xs text-gray-600 mt-2 break-words bg-gray-100 px-3 py-2 rounded-lg">
                    {uploadStatus.error}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={resetUploadStatus}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-emerald-500/25"
                >
                  Try Again
                </button>
                <button
                  onClick={() => {
                    setShowUploadDialog(false);
                    resetUploadStatus();
                  }}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-semibold transition-all duration-200 shadow-lg"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadDialog;
