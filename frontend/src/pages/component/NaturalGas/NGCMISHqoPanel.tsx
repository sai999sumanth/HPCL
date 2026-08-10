import React, { useState } from "react";
import { Loader2, CheckCircle2, XCircle, Upload, Table2, X } from "lucide-react";
import { apiClient } from "@/services/apiClient";
import { Card, CardContent } from "@/@/components/ui/card";
import { Button } from "@/@/components/ui/button";
import { toast } from "sonner";
import { ConnectionPreviewTables } from "./ConnectionPreviewTables";
import { NaturalGasListTables } from "./NaturalGasListTables";
import {
  CONFIRM_SYNC_API,
  UPLOAD_CONNECTION_API,
  isConfirmSuccessful,
  parseConfirmFromAxiosError,
  parseConfirmSyncResponse,
  parseUploadConnectionResponse,
  type ConnectionJvRow,
} from "./connectionDataUtils";

export const NGCMISHqoPanel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  /** Remount file input so the browser clears "No file chosen" / previous name after reset. */
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [ackId, setAckId] = useState<string | null>(null);
  const [jvRows, setJvRows] = useState<ConnectionJvRow[]>([]);

  const [syncOutcome, setSyncOutcome] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [uploadError, setUploadError] = useState(false);
  /** Bumps to refetch GET summary / connections lists after sync. */
  const [listRefreshSignal, setListRefreshSignal] = useState(0);

  const clearPreview = () => {
    setAckId(null);
    setJvRows([]);
  };

  const resetFileInput = () => {
    setFile(null);
    setFileInputKey((k) => k + 1);
  };

  /** Clear chosen file and server preview; use after sync success or when user removes file. */
  const resetForNewUpload = () => {
    clearPreview();
    setSyncOutcome(null);
    setUploadError(false);
    resetFileInput();
  };

  const removeSelectedFile = () => {
    setSyncOutcome(null);
    setUploadError(false);
    resetFileInput();
    if (ackId) {
      clearPreview();
    }
  };

  /** Called automatically when user selects a file (no separate Upload click). */
  const runUpload = async (fileToUpload: File) => {
    setSyncOutcome(null);
    setUploadError(false);
    const fd = new FormData();
    fd.append("upload_file", fileToUpload);
    setUploading(true);
    try {
      const res = await apiClient.post(UPLOAD_CONNECTION_API, fd);
      const parsed = parseUploadConnectionResponse(res);
      if (!parsed) {
        toast.error("Upload response did not include preview data.");
        setUploadError(true);
        clearPreview();
        return;
      }
      setAckId(parsed.ack_id);
      setJvRows(parsed.jv);
      toast.success("File uploaded. Review below, then confirm sync.");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : "Upload failed.";
      toast.error(msg);
      setUploadError(true);
      clearPreview();
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmSync = async () => {
    if (!ackId) {
      toast.error("Nothing to sync.");
      return;
    }
    setSyncing(true);
    setSyncOutcome(null);
    try {
      const res = await apiClient.post(CONFIRM_SYNC_API, { ack_id: ackId });
      const { status, message } = parseConfirmSyncResponse(res);
      const ok = isConfirmSuccessful(status, message);
      const text =
        message && message.length > 0
          ? message
          : ok
            ? "Data synced successfully."
            : "Sync could not be completed.";
      if (ok) {
        toast.success(text);
        resetForNewUpload();
        setListRefreshSignal((s) => s + 1);
      } else {
        setSyncOutcome({ ok: false, message: text });
        toast.error(text);
      }
    } catch (e: unknown) {
      const parsed = parseConfirmFromAxiosError(e);
      const status = parsed?.status ?? null;
      const message =
        parsed?.message ??
        (e && typeof e === "object" && "message" in e
          ? String((e as { message?: string }).message)
          : null);
      const ok = parsed !== null ? isConfirmSuccessful(status, message) : false;
      const text =
        message && message.length > 0 ? message : "Sync failed.";
      if (ok) {
        toast.success(text);
        resetForNewUpload();
        setListRefreshSignal((s) => s + 1);
      } else {
        setSyncOutcome({ ok: false, message: text });
        toast.error(text);
      }
    } finally {
      setSyncing(false);
    }
  };

  const hasPreview = Boolean(ackId);

  return (
    <div className="space-y-1.5">
      <Card className="overflow-hidden border border-gray-200/90 ring-1 ring-gray-100/80">
        <CardContent className="p-1.5 sm:p-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <div className="flex shrink-0 items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-100 text-cyan-700 shadow-sm">
                <Upload className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
            </div>
            <span className="shrink-0 text-sm font-medium text-gray-800">
              Upload MIS file
            </span>
            <input
              key={fileInputKey}
              id="ngc-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={uploading || syncing}
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setSyncOutcome(null);
                if (!f) {
                  setFile(null);
                  return;
                }
                setFile(f);
                void runUpload(f);
              }}
            />
            {!file ? (
              <label
                htmlFor="ngc-file"
                className={
                  uploading || syncing
                    ? "inline-flex h-8 cursor-not-allowed items-center rounded-md border border-gray-200/80 bg-gray-50 px-2 text-xs font-medium text-gray-400"
                    : "inline-flex h-8 cursor-pointer items-center rounded-md border border-gray-200/90 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50/90"
                }
              >
                Choose file
              </label>
            ) : (
              <div className="flex min-w-0 max-w-[min(100%,min(360px,90vw))] items-center gap-1 rounded-md border border-gray-200/80 bg-gray-50/90 py-0.5 pl-2 pr-0.5">
                <span
                  className="min-w-0 flex-1 truncate text-xs font-medium text-gray-800"
                  title={file.name}
                >
                  {file.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
                  disabled={uploading || syncing}
                  onClick={() => removeSelectedFile()}
                  title="Remove file"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">Remove file</span>
                </Button>
              </div>
            )}
            <div className="flex min-w-[6.5rem] shrink-0 items-center justify-end">
              {uploading ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-600">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  Uploading…
                </span>
              ) : ackId && file && !uploadError ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                  Uploaded
                </span>
              ) : uploadError && file ? (
                <span className="max-w-[10rem] text-right text-xs leading-tight text-red-600 sm:max-w-none">
                  Upload failed — remove file and try again
                </span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {!hasPreview ? (
        <NaturalGasListTables refreshSignal={listRefreshSignal} />
      ) : (
        <Card className="overflow-hidden border border-gray-200/90 ring-1 ring-gray-100/80">
          <CardContent className="p-1.5 sm:p-2">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/80 pb-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-700 shadow-sm">
                  <Table2 className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <p className="text-sm font-medium text-gray-800">
                  Preview &amp; confirm sync
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={syncing}
                  onClick={() => {
                    resetForNewUpload();
                  }}
                >
                  Discard preview
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={syncing || !ackId}
                  onClick={() => void handleConfirmSync()}
                >
                  {syncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing…
                    </>
                  ) : (
                    "Confirm sync"
                  )}
                </Button>
              </div>
            </div>
            <ConnectionPreviewTables jv={jvRows} jvTitle="Upload preview" />
          </CardContent>
        </Card>
      )}

      {syncOutcome && (
        <div
          role="status"
          className={
            syncOutcome.ok
              ? "flex gap-2 rounded-md border border-emerald-200/90 bg-emerald-50/90 px-2.5 py-2 shadow-sm"
              : "flex gap-2 rounded-md border border-red-200/90 bg-red-50/90 px-2.5 py-2 shadow-sm"
          }
        >
          {syncOutcome.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 sm:text-sm">
              {syncOutcome.ok ? "Sync successful" : "Sync failed"}
            </p>
            <p className="mt-0.5 text-xs text-gray-600">{syncOutcome.message}</p>
          </div>
        </div>
      )}
    </div>
  );
};
