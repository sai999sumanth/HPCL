"use client"

import { useEffect, useRef } from "react"
import videojs from "video.js"
import "video.js/dist/video-js.css"
import type Player from "video.js/dist/types/player"

interface VideoPlayerProps {
  streamUrl: string
}

export default function VideoPlayer({ streamUrl }: VideoPlayerProps) {
  const videoRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<Player | null>(null)

  useEffect(() => {
    // Make sure Video.js player is only initialized once
    if (!playerRef.current) {
      if (!videoRef.current) return

      const videoElement = document.createElement("video")
      videoElement.className = "video-js vjs-big-play-centered"
      videoRef.current.appendChild(videoElement)

      playerRef.current = videojs(videoElement, {
        autoplay: true,
        controls: true,
        responsive: true,
        fluid: true,
        sources: [
          {
            src: streamUrl,
            type: "application/x-mpegURL", // HLS stream type
          },
        ],
      })
    } else {
      // Update the player source if streamUrl changes
      playerRef.current.src([
        {
          src: streamUrl,
          type: "application/x-mpegURL",
        },
      ])
    }
  }, [streamUrl, videoRef])

  // Dispose the Video.js player when the component unmounts
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose()
        playerRef.current = null
      }
    }
  }, [])

  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
      <div ref={videoRef} className="w-full h-full" />
    </div>
  )
}
