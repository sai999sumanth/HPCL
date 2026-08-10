"use client"
import VideoPlayer from "./rtsp-player"

export default function StreamPage() {
  // Replace this with your HLS stream URL after conversion
  const hlsStreamUrl = "https://your-streaming-server.com/stream/index.m3u8"

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Live Camera Feed</h1>
      <VideoPlayer streamUrl={hlsStreamUrl} />
    </div>
  )
}
