import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent } from "../../../@/components/ui/card"
import { Alert, AlertDescription } from "../../../@/components/ui/alert"
import { AlertCircle, Download, Loader2, UploadCloud } from "lucide-react"
import { Button } from "../../../@/components/ui/button"
import { apiClient } from "@/services/apiClient"
import { toast } from "sonner"

const formatDateTime = (timestamp?: string) => {
  if (!timestamp) return "-"
  try {
    const date = new Date(timestamp)
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date)
  } catch {
    return "-"
  }
}

const resolveUploaderName = (documentRecord: Record<string, any>) => {
  return (
    documentRecord?.processed_by_name ||
    documentRecord?.processed_by ||
    documentRecord?.action_owner ||
    documentRecord?.assigned_user ||
    documentRecord?.assigned_user_roles?.join(", ") ||
    documentRecord?.user_name ||
    documentRecord?.created_by ||
    "-"
  )
}

const resolveReportType = (documentRecord: Record<string, any>) => {
  return (
    documentRecord?.report_type ||
    documentRecord?.notice_type ||
    documentRecord?.action_type ||
    "Document"
  )
}

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"]
const ALLOWED_ACCEPT = ".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

const isAllowedFileType = (file: File): boolean => {
  const name = (file.name || "").toLowerCase()
  return ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))
}

const normalizeRecords = (records: any[]) => {
  if (!Array.isArray(records)) return []

  return records.flatMap((record, recordIndex) => {
    const notices = Array.isArray(record?.notices) ? record.notices : []

    if (notices.length > 0) {
      return notices.map((notice, noticeIndex) => ({
        id:
          notice?.file_path ||
          notice?.doc_link ||
          `${record?.id || recordIndex}-notice-${noticeIndex}`,
        uploadedAt:
          notice?.uploaded_date ||
          notice?.document_generated_time ||
          record?.updated_at ||
          record?.created_at,
        uploader:
          notice?.uploaded_by ||
          notice?.uploaded_name ||
          resolveUploaderName(record),
        reportType:
          notice?.report_type ||
          notice?.doc_type ||
          record?.alert_type ||
          "Document",
        documentUrl: notice?.file_path || notice?.doc_link,
      }))
    }

    return [
      {
        id: record?.doc_link || record?.file_path || `${record?.id || recordIndex}`,
        uploadedAt:
          record?.document_generated_time ||
          record?.uploaded_date ||
          record?.updated_at ||
          record?.created_at,
        uploader: resolveUploaderName(record),
        reportType: resolveReportType(record),
        documentUrl: record?.file_path || record?.doc_link,
      },
    ]
  })
}

const VTSDocumentTable = ({ alertId, onUploadClick }) => {
  const [apiDocuments, setApiDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null)

  useEffect(() => {
    if (!alertId) {
      setApiDocuments([])
      return
    }

    const controller = new AbortController()

    const fetchDocuments = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = {
          q: `alert_id='${alertId}'`,
        }
        const response = await apiClient.get("/api/noticesvts", {
          params,
          signal: controller.signal,
        })
        const fetched =
          response?.data?.data && Array.isArray(response.data.data)
            ? response.data.data
            : []
        setApiDocuments(fetched)
      } catch (err) {
        if (controller.signal.aborted) return
        console.error("Error fetching VTS documents:", err)
        setError("Failed to load VTS documents.")
        setApiDocuments([])
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchDocuments()
    return () => controller.abort()
  }, [alertId, refreshToken])

  const preparedDocuments = useMemo(() => {
    return normalizeRecords(apiDocuments)
  }, [apiDocuments])

  const hasDocuments = preparedDocuments.length > 0

  const handleDownload = async (doc: any) => {
    const filePath = doc?.documentUrl
    if (!filePath || downloadingFileId) return
    setDownloadingFileId(doc.id)
    try {
      const response = await apiClient.post(
        "/api/noticesvts/download_notice",
        { file_path: filePath },
        { responseType: "blob" }
      )

      const blobUrl = window.URL.createObjectURL(response.data)
      const link = document.createElement("a")
      link.href = blobUrl
      const filename = filePath.split("/").pop() || "document"
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error("Error downloading VTS document:", error)
      toast.error("Failed to download document. Please try again.")
    } finally {
      setDownloadingFileId(null)
    }
  }

  const triggerFilePicker = () => {
    if (!alertId || uploading) return
    fileInputRef.current?.click()
  }

  const handleUpload = async (file?: File | null) => {
    if (!alertId || uploading || !file) return
    if (!isAllowedFileType(file)) {
      toast.error("Please upload only PDF, DOC, DOCX, JPG, JPEG, or PNG files.")
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("Please upload a file of 5MB or less.")
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("upload_file", file)

      await apiClient.post(`/api/noticesvts/upload_notice?alert_id=${alertId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      toast.success("Document uploaded successfully.")
      setRefreshToken((prev) => prev + 1)
      onUploadClick?.({ alertId, status: "success" })
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      console.error("Error triggering VTS document upload:", error)
      toast.error("Failed to upload document. Please try again.")
      onUploadClick?.({ alertId, status: "error", error })
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    handleUpload(file)
  }

  // if (apiDocuments.length === 0) {
  //   return (
  //     <Alert>
  //       <AlertCircle className="h-4 w-4" />
  //       <AlertDescription>Document data is not available</AlertDescription>
  //     </Alert>
  //   )
  // }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {loading && (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Fetching documents...
            </>
          )}
        </div>
        {error && <div className="text-xs text-gray-500">No data</div>}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ALLOWED_ACCEPT}
          onChange={handleFileChange}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">PDF, DOC, DOCX, JPG, JPEG, PNG. Max 5MB.</span>
          <Button
            type="button"
            onClick={triggerFilePicker}
            disabled={!alertId || uploading}
            variant="secondary"
            className="gap-2 bg-green-300 hover:bg-green-400"
            title="Upload PDF, DOC, DOCX, JPG, JPEG or PNG only. Max 5MB."
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4 " />
                Upload
              </>
            )}
          </Button>
        </div>
      </div>

      <Card className="h-[24.7rem] overflow-hidden">
<CardContent className="p-0 h-full flex flex-col">
  <div className="overflow-auto h-full">
    <table className="w-full">
      <thead className="bg-gray-50 sticky top-0 z-10">
        <tr className="text-xs font-medium text-gray-500">
          <th className="px-4 py-3 text-left">Uploaded Date</th>
          <th className="px-4 py-3 text-left">Uploaded By</th>
          <th className="px-4 py-3 text-left">Report Type</th>
          <th className="px-4 py-3 text-left w-32">Action</th>
        </tr>
      </thead>

      <tbody className="divide-y divide-gray-200 text-xs">
        {hasDocuments ? (
          preparedDocuments.map((doc) => (
            <tr key={doc.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-900">
                {formatDateTime(doc.uploadedAt)}
              </td>
              <td className="px-4 py-3 text-gray-700">{doc.uploader}</td>
              <td className="px-4 py-3 text-gray-900">{doc.reportType}</td>
              <td className="px-4 py-3">
                {doc.documentUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-blue-600 hover:text-blue-800"
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingFileId === doc.id}
                  >
                    {downloadingFileId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {downloadingFileId === doc.id
                      ? "Downloading..."
                      : "Download"}
                  </Button>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td
              colSpan={4}
              className="px-4 py-6 text-center text-gray-500"
            >
              {loading
                ? "Loading documents..."
                : "No document history available"}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</CardContent>

      </Card>
    </div>
  )
}

export default VTSDocumentTable

