// import { useState, useRef, useEffect } from "react";
// import { AlertCircle, RefreshCcw } from "lucide-react";
// import { Button } from "@/@/components/ui/button";

// interface StreamPlayerProps {
//   url: string;
//   status: "connected" | "disconnected" | "connecting";
// }

// // Type definitions for HLS.js
// declare global {
//   interface Window {
//     Hls: {
//       isSupported: () => boolean;
//       Events: {
//         ERROR: string;
//         MANIFEST_PARSED: string;
//       };
//       new(): {
//         on: (event: string, callback: any) => void;
//         loadSource: (url: string) => void;
//         attachMedia: (element: HTMLVideoElement) => void;
//         destroy: () => void;
//       };
//     };
//   }
// }

// // Improved StreamPlayer that connects to actual RTSP streams via a server proxy
// const StreamPlayer: React.FC<StreamPlayerProps> = ({ url, status }) => {
//   const videoRef = useRef<HTMLVideoElement>(null);
//   const canvasRef = useRef<HTMLCanvasElement>(null);
//   const [streamError, setStreamError] = useState<boolean>(false);
  
//   useEffect(() => {
//     if (status === "connected" && videoRef.current) {
//       // Convert RTSP URL to a server endpoint that handles conversion to HLS
//       const streamUrl = `${encodeURIComponent(url)}`;
      
//       const video = videoRef.current;
      
//       // Set up HLS.js to handle the stream
//       if (window.Hls && window.Hls.isSupported()) {
//         const hls = new window.Hls();
//         hls.on(window.Hls.Events.ERROR, (_event: any, data: { fatal: boolean }) => {
//           console.error("HLS error:", data);
//           if (data.fatal) {
//             setStreamError(true);
//             hls.destroy();
//           }
//         });
        
//         hls.loadSource(streamUrl);
//         hls.attachMedia(video);
//         hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
//           video.play().catch(e => {
//             console.error("Video playback failed:", e);
//             setStreamError(true);
//           });
//         });
        
//         return () => {
//           hls.destroy();
//         };
//       } 
//       // Fallback for browsers that support native HLS
//       else if (video.canPlayType('application/vnd.apple.mpegurl')) {
//         video.src = streamUrl;
//         const handleMetadata = () => {
//           video.play().catch(e => {
//             console.error("Video playback failed:", e);
//             setStreamError(true);
//           });
//         };
        
//         const handleError = () => {
//           setStreamError(true);
//         };
        
//         video.addEventListener('loadedmetadata', handleMetadata);
//         video.addEventListener('error', handleError);
        
//         return () => {
//           video.removeEventListener('loadedmetadata', handleMetadata);
//           video.removeEventListener('error', handleError);
//         };
//       } else {
//         console.error("HLS not supported by browser and HLS.js not available");
//         setStreamError(true);
//       }
//     }
//   }, [url, status]);

//   // Draw camera info overlay on canvas
//   useEffect(() => {
//     if (status === "connected" && canvasRef.current && !streamError) {
//       const canvas = canvasRef.current;
//       const ctx = canvas.getContext('2d');
      
//       if (!ctx) return;
      
//       // Animation loop to draw info overlay
//       let frameId: number;
//       const drawOverlay = () => {
//         if (!canvas || !ctx) return;
        
//         // Clear canvas
//         ctx.clearRect(0, 0, canvas.width, canvas.height);
        
//         // Draw camera info
//         ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
//         ctx.font = '14px Arial';
//         ctx.fillText(`RTSP: ${url}`, 20, 30);
        
//         // Draw time
//         const now = new Date();
//         const timeStr = now.toLocaleTimeString();
//         ctx.fillText(timeStr, canvas.width - 100, canvas.height - 20);
        
//         frameId = requestAnimationFrame(drawOverlay);
//       };
      
//       drawOverlay();
      
//       return () => {
//         if (frameId) {
//           cancelAnimationFrame(frameId);
//         }
//       };
//     }
//   }, [url, status, streamError]);
  
//   return (
//     <div className="relative w-full h-full">
//       {streamError ? (
//         <div className="absolute inset-0 flex items-center justify-center text-white">
//           <div className="flex flex-col items-center">
//             <AlertCircle className="h-8 w-8 mb-2" />
//             <p>Stream connection failed</p>
//             <Button 
//               variant="outline" 
//               size="sm" 
//               className="mt-2 text-white border-white hover:bg-white/10"
//               onClick={() => setStreamError(false)}
//             >
//               <RefreshCcw className="h-4 w-4 mr-2" /> Retry
//             </Button>
//           </div>
//         </div>
//       ) : (
//         <>
//           {/* The actual video element */}
//           <video
//             ref={videoRef}
//             className="w-full h-full object-cover"
//             muted
//             playsInline
//           />
          
//           {/* Canvas overlay for information */}
//           <canvas 
//             ref={canvasRef}
//             className="absolute top-0 left-0 w-full h-full pointer-events-none"
//             width={640}
//             height={360}
//           />
//         </>
//       )}
//     </div>
//   );
// };

// export default StreamPlayer;
"use client"

import { useRef, useEffect, useState } from "react"
import { AlertCircle, RefreshCcw } from "lucide-react"
import { Button } from "@/@/components/ui/button"

interface StreamPlayerProps {
  url: string
  status: "connected" | "disconnected" | "connecting"
}

export default function StreamPlayer({ url, status }: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!videoRef.current || status !== "connected") return

    // Convert RTSP URL to HLS URL via backend proxy
    // This assumes you have a backend service that converts RTSP to HLS
    const hlsUrl = `/api/stream?url=${encodeURIComponent(url)}`

    const loadPlayer = async () => {
      setIsLoading(true)
      setError(null)

      try {
        if (videoRef.current) {
          // Check if HLS.js is available (loaded via script in parent component)
          if (window.Hls && window.Hls.isSupported()) {
            const hls = new window.Hls({
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
              liveSyncDuration: 3,
              liveMaxLatencyDuration: 10,
            })

            hls.loadSource(hlsUrl)
            hls.attachMedia(videoRef.current)

            hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
              videoRef.current?.play().catch((e) => {
                console.error("Error playing video:", e)
                setError("Playback error. Click to retry.")
              })
            })

            hls.on(window.Hls.Events.ERROR, (_, data) => {
              if (data.fatal) {
                console.error("HLS error:", data)
                setError("Stream connection error. Click to retry.")
                hls.destroy()
              }
            })

            return () => {
              hls.destroy()
            }
          } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
            // For Safari which has native HLS support
            videoRef.current.src = hlsUrl
            videoRef.current.addEventListener("loadedmetadata", () => {
              videoRef.current?.play().catch((e) => {
                console.error("Error playing video:", e)
                setError("Playback error. Click to retry.")
              })
            })
          } else {
            setError("Your browser doesn't support HLS playback")
          }
        }
      } catch (err) {
        console.error("Error setting up video player:", err)
        setError("Failed to initialize player")
      } finally {
        setIsLoading(false)
      }
    }

    loadPlayer()
  }, [url, status])

  const handleRetry = () => {
    setError(null)
    setIsLoading(true)

    // Force reload the player
    if (videoRef.current) {
      videoRef.current.load()
    }
  }

  if (status !== "connected") {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        {status === "connecting" ? (
          <div className="text-center text-white">
            <RefreshCcw className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p>Connecting to stream...</p>
          </div>
        ) : (
          <div className="text-center text-white">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>Camera disconnected</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative w-full h-full bg-black">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <RefreshCcw className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80">
          <div className="text-center text-white">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="mb-3">No Data</p>
            <Button
              variant="outline"
              size="sm"
              className="text-white border-white/30 hover:bg-white/10"
              onClick={handleRetry}
            >
              <RefreshCcw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </div>
        </div>
      )}

      <video ref={videoRef} className="w-full h-full object-contain" playsInline muted autoPlay />
    </div>
  )
}

// Add this to make TypeScript happy with the HLS.js global
declare global {
  interface Window {
    Hls: any
  }
}
