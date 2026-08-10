import { useState, KeyboardEvent } from "react"
import { Send, Sparkles, Loader2, AlertCircle, TrendingUp } from "lucide-react"
import { apiClient } from "@/services/apiClient"
import axios from "axios"

type TableRow = Record<string, string | number | boolean | null>

type ApiResponse = TableRow[] | Record<string, unknown>

export default function AIQueryPage(): JSX.Element {
  const [question, setQuestion] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>("")
  const [tableData, setTableData] = useState<ApiResponse | null>(null)

  const handleSubmit = async (): Promise<void> => {
    if (!question.trim()) {
      setError("Please enter a question")
      return
    }

    setLoading(true)
    setError("")
    setTableData(null)

    try {
      const response = await apiClient.post<ApiResponse>(
        "/api/alerts/nlp_2_query",
        { question },
        { headers: { "Content-Type": "application/json" } }
      )

      setTableData(response.data)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || "Failed to fetch data")
      } else {
        setError("Unexpected error occurred")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const renderTable = (): JSX.Element | null => {
    if (!tableData) return null

    if (Array.isArray(tableData)) {
      if (tableData.length === 0) {
        return (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="text-gray-400" size={32} />
            </div>
            <p className="text-gray-500 text-sm">No results found</p>
          </div>
        )
      }

      const headers = Object.keys(tableData[0])

      return (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                {headers.map((header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"
                  >
                    {header.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {tableData.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="hover:bg-blue-50/50 transition-colors"
                >
                  {headers.map((header) => (
                    <td
                      key={header}
                      className="px-4 py-3 text-xs text-gray-800 whitespace-nowrap"
                    >
                      {row[header] !== null && row[header] !== undefined
                        ? String(row[header])
                        : "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-lg border border-gray-200">
        <pre className="text-sm text-gray-800 whitespace-pre-wrap overflow-auto">
          {JSON.stringify(tableData, null, 2)}
        </pre>
      </div>
    )
  }

  const exampleQuestions: string[] = [
    "Show me the top 3 vehicles with the highest device_removed risk score",
    "What are the recent alerts?",
    "List all vehicles with risk score above 0.8",
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-2 py-2">

        {/* Header */}
        <div className="text-center mb-2">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Ask AI
          </h1>
        </div>

        {/* Input Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-2 mb-2">
          <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                <Sparkles className="text-blue-600" size={20} />
            </div>

            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask anything about your data..."
              disabled={loading}
              rows={1}
              className="flex-1 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 border-0 focus:outline-none resize-none leading-6"
                        />

            <button
              onClick={handleSubmit}
              disabled={loading || !question.trim()}
              className="mt-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold rounded-lg disabled:opacity-50 flex items-center gap-1.5"
              >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Thinking...
                </>
              ) : (
                <>
                  <Send size={18} />
                  Ask
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="mt-4 flex gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle size={20} className="text-red-600 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Results */}
        {tableData && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-5 animate-fadeIn">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="text-green-600" size={18} />
              <h2 className="text-lg font-semibold text-gray-800">Results</h2>
            </div>
            {renderTable()}
          </div>
        )}

        {/* Examples */}
        {!tableData && !loading && (
          <div className="bg-white/60 backdrop-blur rounded-2xl border border-gray-200 p-5">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-2">
              <Sparkles size={14} /> Try asking:
            </h3>
            {exampleQuestions.map((q) => (
              <button
                key={q}
                onClick={() => setQuestion(q)}
                className="block w-full text-left px-4 py-3 mb-2 rounded-xl border hover:bg-blue-50 text-xs"
              >
                → {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
