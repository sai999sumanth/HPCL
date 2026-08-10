import { apiClient } from "@/services/apiClient"
import React, { useMemo, useEffect, useState, useRef } from "react"
import { useLocation, useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/@/components/ui/button"
import { ArrowLeft } from "lucide-react"

interface PipelineLocation {
  name: string
  url: string  // Changed to lowercase to match API response
}

interface ApiResponse {
  status: boolean
  message: string
  data: PipelineLocation[]
}

const PipelineIframePage: React.FC = () => {
  const { code } = useParams<{ code: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [pipelineUrls, setPipelineUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasFetchedRef = useRef(false)

  // Extract URL from query params first
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const urlFromQuery = useMemo(() => searchParams.get("url"), [searchParams])
  const decodedCode = useMemo(() => code ? decodeURIComponent(code) : "", [code])
  const pipelineKey = decodedCode || ""

  // Only fetch if we don't have a URL in query params
  useEffect(() => {
    // If we have URL from query params, skip API call
    if (urlFromQuery) {
      setLoading(false)
      return
    }

    // If we already fetched, don't fetch again
    if (hasFetchedRef.current) {
      return
    }

    const fetchPipelineLocations = async () => {
      setLoading(true)
      setError(null)
      hasFetchedRef.current = true

      try {
        const response = await apiClient.post(
          '/api/locationmaster/get_pipeline_locations',
          {},
          { headers: { 'Content-Type': 'application/json' } }
        )

        const result: ApiResponse = response.data

        if (result.status && result.data) {
          // Convert array to Record<string, string>
          const urlMap: Record<string, string> = {}
          result.data.forEach((pipeline) => {
            // Store the URL with the exact name as key (case-insensitive lookup)
            urlMap[pipeline.name.toUpperCase()] = pipeline.url
            
            // Also handle multiple names separated by "/"
            const names = pipeline.name.split("/")
            names.forEach((name) => {
              const trimmedName = name.trim().toUpperCase()
              if (trimmedName) {
                urlMap[trimmedName] = pipeline.url
              }
            })
          })
          setPipelineUrls(urlMap)
        } else {
          throw new Error(result.message || "Invalid response format")
        }
      } catch (err: any) {
        console.error('Error fetching pipeline locations:', err)
        const errorMessage = err?.response?.data?.message || err?.message || 'Failed to fetch pipeline locations'
        setError(errorMessage)
        toast.error(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchPipelineLocations()
  }, [urlFromQuery])

  // Determine target URL
  const targetUrl = useMemo(() => {
    if (urlFromQuery) {
      try {
        return decodeURIComponent(urlFromQuery)
      } catch (e) {
        console.error("Error decoding URL:", e)
        return urlFromQuery
      }
    }
    
    // Try to find URL from mapped pipeline URLs
    const key = pipelineKey.toUpperCase()
    return pipelineUrls[key] || null
  }, [urlFromQuery, pipelineKey, pipelineUrls])

  const isSelfEmbedding = useMemo(() => {
    if (!targetUrl) return false
    try {
      const currentOrigin = window.location.origin
      const resolved = new URL(targetUrl, currentOrigin)
      return resolved.origin === currentOrigin
    } catch {
      return false
    }
  }, [targetUrl])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-140px)] bg-gray-50 text-gray-600">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="text-sm font-medium">Loading pipeline locations...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-140px)] bg-gray-50 text-gray-600 space-y-4">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-red-600">Error loading pipelines</p>
          <p className="text-xs text-gray-500">{error}</p>
        </div>
        <Button
          onClick={() => navigate("/dnc/home/wall/pipeline")}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          Back to Pipeline
        </Button>
      </div>
    )
  }

  if (!targetUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-140px)] bg-gray-50 text-gray-600 space-y-4">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium">Pipeline URL not configured</p>
          <p className="text-xs text-gray-500">
            No URL is set for <span className="font-semibold">{pipelineKey || "this pipeline"}</span>.
          </p>
        </div>
        <Button
          onClick={() => navigate("/dnc/home/wall/pipeline")}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          Back to Pipeline
        </Button>
      </div>
    )
  }

  if (isSelfEmbedding) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-140px)] bg-gray-50 text-gray-600 space-y-4">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-red-600">Invalid pipeline URL</p>
          <p className="text-xs text-gray-500">
            This pipeline URL points to the current application and would cause an iframe loop.
          </p>
        </div>
        <Button
          onClick={() => navigate("/dnc/home/wall/pipeline")}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          Back to Pipeline
        </Button>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-110px)] bg-gray-100 border rounded overflow-hidden shadow-sm" key={`pipeline-${pipelineKey}`}>
      <div className="bg-white border-b px-3 py-2 flex items-center justify-between">
        <Button
          onClick={() => navigate("/dnc/home/wall/pipeline")}
          variant="outline"
          size="sm"
          className="text-xs h-7 px-2"
        >
          <ArrowLeft className="h-3 w-3 mr-1" />
          Back
        </Button>
        <span className="text-xs font-medium text-gray-700">{pipelineKey}</span>
        <div className="w-16" />
      </div>
      <iframe
        src={targetUrl}
        title={`Pipeline ${pipelineKey}`}
        className="w-full border-0"
        style={{ height: "calc(100% - 40px)", display: "block" }}
        allowFullScreen
        key={`iframe-${targetUrl}`}
      />
    </div>
  )
}

export default PipelineIframePage