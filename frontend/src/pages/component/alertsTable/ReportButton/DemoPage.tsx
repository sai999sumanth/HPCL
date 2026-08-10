import ScreenshotReport from "./ScreenshotCapture";

export default function DemoPage() {
  // Example API handler
  const handleReportSubmit = async (data: { imageUrl: string; description: string; metadata: any }) => {
    console.log("Report submitted:", data)
    // Here you would typically send to your backend
    // Example: await fetch('/api/reports', { method: 'POST', body: JSON.stringify(data) })
  }

  return (
    <div >
                <ScreenshotReport onSubmit={handleReportSubmit} apiEndpoint="/api/ticketing/create_ticket" />

    </div>
  )
}
