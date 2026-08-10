import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { apiClient } from "@/services/apiClient"
import { toast } from "sonner"
import { ExternalLink, Loader2, Search } from "lucide-react"

interface PipelineLocation {
  name: string
  url: string
  description?: string
}

interface ApiResponse {
  status: boolean
  message: string
  data: PipelineLocation[]
}

const PipelineLandingPage: React.FC = () => {
  const navigate = useNavigate()
  const [pipelineLocations, setPipelineLocations] = useState<PipelineLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const fetchPipelineLocations = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await apiClient.post<ApiResponse>(
          "/api/locationmaster/get_pipeline_locations",
          {}
        )

        if (response.data?.status && response.data?.data) {
          setPipelineLocations(response.data.data)
        } else {
          throw new Error(response.data?.message || "Invalid response format")
        }
      } catch (err: any) {
        console.error("Error fetching pipeline locations:", err)
        const errorMessage = err?.response?.data?.message || err?.message || "Failed to fetch pipeline locations"
        setError(errorMessage)
        toast.error(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchPipelineLocations()
  }, [])

  const filteredLocations = pipelineLocations.filter(location => {
    const matchesSearch = location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (location.description?.toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesSearch
  })

  const handlePipelineClick = (location: PipelineLocation) => {
    const encodedName = encodeURIComponent(location.name)
    const encodedUrl = encodeURIComponent(location.url)
    navigate(`/pipeline/${encodedName}?url=${encodedUrl}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-gray-600">Loading pipeline locations...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center space-y-2">
          <p className="text-base font-semibold text-red-600">Error loading pipelines</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 p-0 rounded-xl shadow-md border">
      <div className="max-w-full mx-auto p-1">
 {/* Header + Search Row */}
{/* Header + Search */}
<div className="mb-2">
  <div className="bg-white rounded-xl px-4 py-3">

    {/* Row 1: Centered Company Name */}
    <div className="flex justify-center mb-3">
      <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent text-center">
        Hindustan Petroleum Corporation Limited
      </h1>
    </div>

    {/* Row 2: Left text + Right search */}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

      {/* Left Side Text */}
      <div className="flex flex-col leading-tight text-center sm:text-left">
        <p className="text-sm text-gray-600 font-medium">Pipeline SBU</p>
        <p className="text-xs text-gray-500">Operations Overview</p>
      </div>

      {/* Right Side Search */}
      <div className="relative w-1/4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
        <input
          type="text"
          placeholder="Search pipelines..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

    </div>
  </div>
</div>


        {/* Pipeline Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredLocations.map((location, index) => (
            <div
              key={`pipeline-${location.name}-${index}`}
              className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-xl hover:border-blue-500 transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="p-4">
                {/* Pipeline Name */}
                <h3 className="text-base sm:text-lg font-bold text-blue-700 mb-2">
                  {location.name}
                </h3>

                {/* Description */}
                <p className="text-gray-600 text-xs leading-relaxed mb-3 min-h-[50px] line-clamp-3">
                  {location.description || ""}
                </p>

                {/* Launch Button */}
                <button
                  onClick={() => handlePipelineClick(location)}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-semibold py-2 px-2 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center gap-2 group shadow-md hover:shadow-lg"
                >
                  Launch Web SCADA
                  <ExternalLink className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* No Results */}
        {filteredLocations.length === 0 && (
          <div className="text-center py-8">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 max-w-md mx-auto">
              <Search className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-base font-medium text-gray-700 mb-1">No Results Found</p>
              <p className="text-sm text-gray-500">No pipeline systems match your search criteria. Try adjusting your search terms.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PipelineLandingPage